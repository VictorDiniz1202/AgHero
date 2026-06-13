# Plano de Implementação — Pendências Pós-Consolidação de Alertas

**Data:** 2026-06-13
**Origem:** seção "Ações Pendentes (go-live)" de [auditoria_consolidacao_alertas.md](auditoria_consolidacao_alertas.md).
**Status:** Item 3 (Nomenclatura) foi implementado com sucesso. Itens 1 e 2 dependem de configurações de infraestrutura/ambiente do usuário.

---

## 1. Configurar `EVOLUTION_URL` / `EVOLUTION_INSTANCE` / `EVOLUTION_API_KEY`

**Problema:** sem essas variáveis, `sendWhatsAppMessage` (functions/index.js) faz no-op com `logger.warn`. Hoje **nenhum alerta Pro está sendo enviado** em produção, mesmo após a consolidação.

### Opção A — Reaproveitar a instância Evolution já usada pelo n8n (Recomendado)
O workflow n8n (`agtech-registro-diario`) já dispara mensagens via Evolution API (nó "Evolution API (Upsell)" / "Evolution API (Alerta XAI)"). Essa instância já está provisionada e com número de WhatsApp conectado (sessão pareada via QR Code).

- **Como fazer:** abrir os nós "Evolution API" no editor do n8n e copiar a URL base, o nome da instância e a `apikey` usados na requisição HTTP.
- **Onde configurar:** `functions/.env` (local/emulador) e `firebase functions:secrets:set` ou variáveis de ambiente do Firebase Functions v2 (produção).
- **Esforço:** baixo (cópia de 3 valores já existentes).
- **Risco:** a sessão WhatsApp da instância pode estar pareada num número de testes — confirmar se é o número que deve receber/enviar alertas em produção.

### Opção B — Provisionar uma instância Evolution dedicada ao AgBoy
Criar uma nova instância (novo número de WhatsApp) separada da usada para testes/n8n, evitando misturar tráfego de automações antigas com o canal oficial de alertas do produtor.

- **Como fazer:** subir/registrar nova instância na Evolution API (mesmo host do Easypanel ou outro), parear novo número via QR Code, gerar nova `apikey`.
- **Onde configurar:** mesmo destino da Opção A.
- **Esforço:** médio (requer um número de WhatsApp dedicado e re-pareamento).
- **Risco:** atraso até o novo número estar pareado e estável.

### Opção C — Confirmar se já existe uma instância dedicada não documentada
Antes de A ou B, vale checar se já existe uma instância Evolution própria do AgBoy (separada da usada pelo n8n) que simplesmente nunca foi configurada nas variáveis do Cloud Function — `EVOLUTION_WEBHOOK_SECRET` já é referenciado em `agboyWebhook`, o que sugere que pode haver uma instância dedicada ao chatbot AgBoy.

- **Esforço:** baixo (apenas verificação).

---

## 2. Workflow `agtech-registro-diario` no n8n (legado)

**Contexto:** o app não envia mais nada para esse webhook. O arquivo de referência já foi renomeado para [functions/workflow_n8n.LEGACY.json](functions/workflow_n8n.LEGACY.json) como backup.

### Opção A — Desativar o workflow no n8n (Recomendado)
Mantém o workflow visível no editor (toggle "Inactive"), preservando o histórico de execuções e os nós já configurados (incluindo credenciais Evolution/Firestore), sem risco de chamadas indevidas.

- **Esforço:** trivial (1 clique no n8n).
- **Reversível:** sim.

### Opção B — Excluir o workflow
Remove definitivamente do n8n. Mais "limpo", mas perde o histórico de execuções e as credenciais configuradas nos nós (úteis como referência para a Opção A/C do item 1).

- **Esforço:** trivial.
- **Reversível:** não (mitigado pelo `workflow_n8n.LEGACY.json` salvo no repo, mas sem credenciais).

### Opção C — Reaproveitar a cadeia "Motor Preditivo FastAPI" (separar dos alertas)
A cadeia órfã "Buscar Histórico (Firestore) → Formatar Histórico → Motor Preditivo FastAPI → Teve Anomalia (IA)? → Evolution API (Alerta XAI)" nunca chegou a ser conectada/usada. Ela representa uma funcionalidade **diferente** (predição via série temporal/FastAPI) do que foi consolidado no Cloud Function (regras de `alertas_config`).

Se esse motor preditivo (Pandas/Numpy/Scikit-learn, citado em `<predictive_engine>` no CLAUDE.md) ainda for um objetivo do produto, esta cadeia pode ser **reconectada a um novo gatilho** (ex.: um segundo webhook ou um cron do n8n) — como um pipeline complementar e explicitamente separado do motor de alertas por regras.

- **Esforço:** alto — depende de o microsserviço FastAPI (`http://HOST_DA_SUA_API_FASTAPI:8000/analisar`) existir e estar acessível; hoje é um placeholder.
- **Recomendação:** tratar como item de **backlog/Sprint futura**, não como bloqueador do go-live atual. Não impede a Opção A do item acima (desativar o workflow inteiro por ora; a cadeia preditiva pode ser recriada do zero quando o microsserviço existir).

---

## 3. Padronização de nomenclatura de planos (`Standard`/`Pro` vs. `Essencial`/`Inteligente`)

**Contexto:** o código usa `'Pro'` como gate (`onRegistroDiarioEscrito`, `chatComAgBoy`, `agboyWebhook`, `ModalUpsell.jsx`), enquanto o `CLAUDE.md` documenta os nomes comerciais `Essencial`/`Inteligente`. Isso é cosmético hoje, mas a **Sprint 23** (checkout real) vai gravar o valor de `fazenda.plano` que o resto do sistema lê — por isso a decisão precisa vir antes dessa sprint.

### Opção A — Padronizar no código para `Essencial`/`Inteligente` (alinhar com CLAUDE.md)
Atualiza todos os `=== 'Pro'` / `=== 'Standard'` (Cloud Functions + frontend) para os nomes comerciais documentados.

- **Esforço:** médio — são poucos pontos (`functions/index.js` x2, `ModalUpsell.jsx`, `FormularioManejo.jsx` já removido, busca por outras ocorrências de `'Pro'`/`'Standard'`).
- **Vantagem:** documentação e código convergem; nomes comerciais ficam visíveis no banco de dados (mais legível para suporte/admin).

### Opção B — Padronizar o CLAUDE.md para `Standard`/`Pro` (alinhar com código)
Atualiza apenas a documentação, mantendo o código como está.

- **Esforço:** trivial.
- **Desvantagem:** nomes técnicos (`Pro`) ficam expostos como valor de negócio no Firestore — pode confundir caso o time comercial use termos diferentes (`Essencial`/`Inteligente`) nas comunicações com o cliente.

### Opção C — Camada de mapeamento (nomes comerciais ≠ valores internos)
`fazenda.plano` guarda um identificador técnico estável (ex.: `'standard' | 'pro'`), e a UI traduz para os nomes comerciais (`Essencial`/`Inteligente`) via um dicionário central.

- **Esforço:** médio-alto — exige criar e aplicar o dicionário em todos os pontos de exibição.
- **Vantagem:** desacopla nomenclatura comercial (pode mudar por marketing) de checagens de código (`=== 'pro'`), reduzindo risco de outra inconsistência futura.
- **Recomendação:** mais robusto a longo prazo, mas só vale o esforço se houver expectativa de o nome comercial dos planos mudar novamente.

---

## Resumo / Próximos Passos

| # | Item | Opção recomendada / Status | Bloqueia go-live? |
|---|---|---|---|
| 1 | Credenciais Evolution API | C (verificar) → A (reaproveitar) ou B (nova instância) | **Sim** — sem isso, nenhum alerta Pro é enviado |
| 2 | Workflow n8n legado | A (desativar) | Não, mas recomendado antes do go-live |
| 3 | Nomenclatura de planos | **Concluído** (Opção A - Padronizado para `Essencial`/`Inteligente` no código e regras) | Não |

Implementações de código da parte de nomenclaturas concluídas. Itens de ambiente (n8n/Evolution) aguardam configuração de chaves.
