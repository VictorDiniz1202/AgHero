# Consolidação do Pipeline de Alertas (WhatsApp)

**Data:** 2026-06-12
**Contexto:** revisão do workflow n8n (`agtech-registro-diario`) usado para alertas de WhatsApp via Evolution API e análise preditiva via FastAPI.

---

## Diagnóstico

Antes desta mudança, existiam **3 pipelines paralelos e parcialmente quebrados** para o mesmo objetivo (notificar o produtor de anomalias no manejo diário):

1. **Cliente → n8n** ([motorAlertas.js](agtech-hero/src/utils/motorAlertas.js)): `detectarAnomalias` rodava no navegador e disparava `montarPayloadAlerta` para o webhook n8n (`/webhook-test/agtech-registro-diario`), com fila offline em `localStorage`.
2. **Cloud Function → Evolution direta** ([functions/index.js](functions/index.js), `onRegistroDiarioEscrito`): regras hardcoded ("mortalidade > 10", "consumo < 85% da média de 3 dias") enviavam direto pela Evolution API e gravavam em `alertas_enviados` com `tipo: 'anomalia_proativa'` (não reconhecido pelo `ICONES_TIPO_ALERTA` do dashboard, caindo no ícone genérico ⚠️).
3. **Cloud Function → n8n legado** (mesmo arquivo, bloco "Disparo Legado n8n"): reenviava um payload `{plano, contatos_autorizados, registro: {...}}` para `N8N_WEBHOOK_URL`, em formato **incompatível** com o payload do pipeline 1.

Além disso, o workflow n8n colado pelo usuário tinha o roteamento do nó "Roteamento de Plano" quebrado (saída 0, do plano Inteligente, ia para `[]` — vazio), e a cadeia "Buscar Histórico (Firestore) → Motor Preditivo FastAPI → Evolution API (Alerta XAI)" estava **órfã** (zero conexões de entrada).

## Decisão (Opção 1 — aprovada pelo usuário)

Consolidar **toda** a lógica de detecção e disparo de alertas em `onRegistroDiarioEscrito` (Cloud Function, Admin SDK → Evolution API direta), usando exatamente as mesmas 5 regras do motor client-side (`detectarAnomalias`), agora portadas para o backend. O workflow n8n e o pipeline cliente→n8n passam a ser **legado/obsoleto**.

---

## Mudanças

### Novos arquivos (backend)

- [functions/src/data/diretrizesZootecnicas.js](functions/src/data/diretrizesZootecnicas.js) — port CommonJS de [DiretrizesZootecnicas.js](agtech-hero/src/data/DiretrizesZootecnicas.js) (necessário para o check de Estresse Térmico).
- [functions/src/motorAlertas.js](functions/src/motorAlertas.js) — port CommonJS de `detectarAnomalias` (5 tipos: `mortalidade`, `temperatura`, `agua`, `racao`, `postura`), idêntico ao motor client-side anterior.

> ⚠️ Os dois arquivos acima são cópias mantidas em sincronia manual com seus equivalentes em `agtech-hero/src/`. Qualquer ajuste de regra/limite deve ser replicado em ambos (ou, numa próxima sprint, extraído para um pacote compartilhado).

### [functions/index.js](functions/index.js) — `onRegistroDiarioEscrito`

- Agora busca o documento do **lote** (`fazendas/{id_fazenda}/lotes/{id_lote}`) — necessário para `linhagem`, `quantidade_inicial` e `aptidao`.
- Busca o **registro do dia anterior** do mesmo lote (consulta por `data_registro_str`, corrigindo um bug pré-existente que filtrava por um campo inexistente `data_str` em `registros_diarios` — a consulta antiga nunca retornava resultados).
- Roda `detectarAnomalias` (mesma lógica do antigo motor client-side) com `alertas_config` da fazenda.
- Para cada anomalia detectada:
  - Se `fazenda.plano === 'Pro'`: envia a `mensagem_gerada` via `sendWhatsAppMessage` para **todos** os `contatos_autorizados` + `veterinario_responsavel.whatsapp` (antes, só o primeiro contato recebia).
  - Grava em `alertas_enviados` com `tipo` correto (`mortalidade`/`temperatura`/`agua`/`racao`/`postura` — agora reconhecido por `ICONES_TIPO_ALERTA` no [CentralBI.jsx](agtech-hero/src/components/CentralBI.jsx)), `detalhe`, `valor_medido`, `limite_definido`, `mensagem_gerada` e `status_envio: 'enviado'` ou `'bloqueado_plano'` (se o plano não for Pro).
- **Removido**: as 3 regras hardcoded antigas (mortalidade > 10 aves, queda de água/ração > 15% da média de 3 dias) e o bloco "Disparo Legado n8n" (`N8N_WEBHOOK_URL`).

### Cliente

- [motorAlertas.js](agtech-hero/src/utils/motorAlertas.js) — removido todo o motor de detecção e disparo (`detectarAnomalias`, `montarPayloadAlerta`, `dispararAlertaWhatsapp`, fila offline `localStorage`, listener `online`, `WEBHOOK_URL`). Mantido apenas `calcularIdadeDias` (usado pela previsão climática).
- [FormularioManejo.jsx](agtech-hero/src/components/FormularioManejo.jsx) — removida a função `processarAlertas` e sua chamada em `handleSalvar`, o state `registroAnterior` e o `useEffect` que o carregava (`obterRegistroPorData`). `fazendaConfig`/`calcularIdadeDias` permanecem, pois alimentam a previsão climática.
- [services.js](agtech-hero/src/firebase/services.js) — removidas as funções `obterRegistroPorData` e `salvarAlertaEnviado`, que ficaram sem uso.
- [.env.example](agtech-hero/.env.example) — removida a seção `VITE_N8N_WEBHOOK_URL` (obsoleta).

### Configuração / Legado

- [functions/.env](functions/.env) e [functions/.env.example](functions/.env.example) — removida `N8N_WEBHOOK_URL`; adicionadas `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET` (já usadas por `sendWhatsAppMessage`/`agboyWebhook`, mas não estavam documentadas/preenchidas).
- [functions/workflow_n8n.json](functions/workflow_n8n.LEGACY.json) → renomeado para `workflow_n8n.LEGACY.json`. O workflow ativo no n8n (`agtech-registro-diario`) deve ser **desativado** — não recebe mais nenhuma chamada do app.
- `functions/package.json` — descrição atualizada (deixou de mencionar "ponte ... -> n8n").

---

## Ações Pendentes (go-live)

1. **Preencher `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`** no `.env` de produção das Cloud Functions (`functions/.env`) — sem isso, `sendWhatsAppMessage` faz no-op (apenas `logger.warn`) e nenhum alerta Pro é enviado.
2. Desativar (ou remover) o workflow `agtech-registro-diario` no n8n — está obsoleto.
3. Confirmar que `fazenda.plano === 'Pro'` é o valor correto pós-checkout (Sprint 23) — ver inconsistência de nomenclatura `Standard`/`Pro` vs. `Essencial`/`Inteligente` já registrada em `auditoria_correcoes_rodada2.md`.
