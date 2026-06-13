# Auditoria — Correções da Rodada 2

**Data:** 2026-06-12
**Escopo:** Correções aplicadas a partir da auditoria de arquivos ainda não cobertos na Rodada 1 (`auditoria_codigo_completa.txt`), focada em segurança, integridade de dados e robustez operacional antes do go-live.

---

## 🔴 Bloqueadores Críticos (corrigidos)

### 1. Bypass de plano via Simulador de Pagamento (`ModalUpsell.jsx` + `firestore.rules`)

**Problema:** o "Simulador de Gateway" chamava `atualizarPlanoFazenda(id_fazenda, 'Pro')` diretamente do cliente, e a regra do Firestore permitia que o próprio dono alterasse o campo `plano` de sua fazenda. Qualquer usuário autenticado poderia se auto-promover ao Plano Pro sem pagar.

**Correção:**
- [firestore.rules](agtech-hero/../firestore.rules) — a regra `update` de `/fazendas/{id_fazenda}` agora exige `request.resource.data.plano == resource.data.plano`. O campo `plano` só pode ser alterado via Admin SDK (Cloud Functions), após confirmação real de pagamento.
- [ModalUpsell.jsx](agtech-hero/src/components/ModalUpsell.jsx) — o botão "Confirmar Pagamento Simulado" agora só é exibido quando `import.meta.env.DEV` é verdadeiro (ambiente de desenvolvimento). Em produção, o modal mostra "Checkout em implantação" e um botão "Fechar".

**Pendência para Sprint 23:** implementar o checkout real (Stripe/Asaas) e a Cloud Function que recebe o webhook de pagamento confirmado e então chama `atualizarPlanoFazenda` via Admin SDK.

---

### 2. `ReferenceError: useRef is not defined` (`FormularioManejo.jsx`)

**Problema:** o hook `useRef` era usado (`camposEditadosManualmente`) mas não estava importado, causando crash ao abrir a tela de Lançamento de Manejo Diário.

**Correção:** [FormularioManejo.jsx:7](agtech-hero/src/components/FormularioManejo.jsx) — adicionado `useRef` ao import de `react`:
```diff
- import { useEffect, useState } from 'react';
+ import { useEffect, useRef, useState } from 'react';
```

---

### 3. CSV/Formula Injection nos relatórios exportados (`exportadorDados.js`)

**Problema:** campos de texto livre (observações, produto/vacina, dosagem) eram exportados sem sanitização. Um valor digitado como `=cmd|'/c calc'!A1` (ou iniciando com `+`, `-`, `@`) seria interpretado como fórmula ao abrir o CSV no Excel/Sheets, permitindo execução de comandos na máquina do usuário.

**Correção:** [exportadorDados.js](agtech-hero/src/utils/exportadorDados.js) — adicionada a função `sanitizarCelula`, que prefixa com apóstrofo (`'`) qualquer célula cujo texto comece com `=`, `+`, `-`, `@`, tab ou CR, antes da escrita no CSV. Aplicada em `compilarCSV` para todas as células.

---

### 4. Fallback de autenticação mockada em produção (`firebase/config.js`)

**Problema:** se `getAuth(app)` lançasse erro (ex.: API key inválida/ausente), o app caía em um mock que autenticava automaticamente como `dono_demo_123` — inclusive em produção, expondo a fazenda de demonstração e mascarando falhas reais de configuração.

**Correção:** [config.js](agtech-hero/src/firebase/config.js) — em `import.meta.env.PROD`, o erro é relançado (`throw error`) e tratado pelo `ErrorBoundary`, em vez de cair no mock. O mock `dono_demo_123` permanece disponível apenas em desenvolvimento (`DEV`).

---

## 🟡 Avisos (corrigidos)

### 5. Cálculo de % de mortalidade crítica (`motorAlertas.js`)

**Revisão:** o cálculo `mortalidade_qtd / quantidade_inicial * 100` usa a população **inicial** alojada como denominador — a mesma base usada em `calcularFechamentoLote` (`fechamentoLote.js`) para `mortalidade_pct`. Optou-se por manter essa base (em vez de "aves vivas hoje") para que o limite configurado em `alertas_config.mortalidade_critica` seja diretamente comparável ao percentual consolidado no fechamento do lote.

**Correção:** [motorAlertas.js](agtech-hero/src/utils/motorAlertas.js) — variável renomeada de `avesAtivas` para `populacaoInicial` (o nome anterior sugeria "aves vivas no momento", o que não correspondia ao cálculo real) e comentário atualizado explicando a escolha de denominador.

---

### 6. Webhook n8n apontando para endpoint de testes + listener duplicado em HMR (`motorAlertas.js`)

**Problema A:** `WEBHOOK_URL` estava fixo no endpoint `/webhook-test/...` do n8n (endpoint de testes, não o de produção).

**Correção A:** [motorAlertas.js](agtech-hero/src/utils/motorAlertas.js) — `WEBHOOK_URL` agora lê de `import.meta.env.VITE_N8N_WEBHOOK_URL`, com fallback para o endpoint de testes atual. Variável documentada em [.env.example](agtech-hero/.env.example).

> ⚠️ **Ação necessária antes do go-live:** configurar `VITE_N8N_WEBHOOK_URL` no `.env` de produção com o endpoint `/webhook/...` definitivo do workflow n8n.

**Problema B:** `window.addEventListener('online', processarFilaAlertasPendentes)` era registrado incondicionalmente no carregamento do módulo. Durante o desenvolvimento (HMR do Vite), cada edição salva re-executava o módulo e acumulava um novo listener, processando a fila de alertas pendentes múltiplas vezes a cada evento `online`.

**Correção B:** [motorAlertas.js](agtech-hero/src/utils/motorAlertas.js) — o registro do listener é protegido por uma flag `window.__agtechFilaAlertasListenerRegistrado`, evitando duplicação entre re-execuções do módulo via HMR.

---

### 7. Data padrão de alojamento sujeita a "salto de dia" por UTC (`GestaoLotes.jsx`)

**Problema:** o valor inicial do campo "Data de Alojamento" usava `new Date().toISOString().split("T")[0]`. Como `toISOString()` converte para UTC, entre 21h e 23h59 (horário de Brasília, UTC-3) o resultado já é o dia **seguinte** em UTC — o formulário pré-preenchia a data errada para quem cadastrasse um lote à noite.

**Correção:** [GestaoLotes.jsx](agtech-hero/src/components/GestaoLotes.jsx) — adicionada a função `dataLocalStr(data)` (mesmo padrão de `dataRegistroStr` usado em `FormularioManejo.jsx`, baseada em `getFullYear`/`getMonth`/`getDate` locais) e usada para o valor inicial de `dataAlojamento`.

**Nota:** `fechamentoLote.js` (`data_encerramento: new Date().toISOString()`) foi revisado e **não precisa de alteração** — esse campo é um timestamp completo (formato ISO, conforme schema documentado), não uma chave de agrupamento por dia, e é exibido via `new Date(...).toLocaleDateString('pt-BR')`, que já converte corretamente para o horário local.

---

### 8. Importação em lote interrompia tudo no primeiro erro (`services.js` + `ImportadorDados.jsx`)

**Problema:** `importarDadosLote` processava registros e transações em um único `try/catch` — uma linha problemática (ex.: data inválida) lançava exceção e abortava a importação inteira, sem indicar quais linhas já tinham sido salvas nem qual linha falhou.

**Correção:**
- [services.js](agtech-hero/src/firebase/services.js) — `importarDadosLote` agora processa cada registro/transação em seu próprio `try/catch`, contabiliza sucessos e retorna `{ registrosImportados, transacoesImportadas, erros: [...] }`, onde cada item de `erros` identifica o tipo, a data e a mensagem.
- [ImportadorDados.jsx](agtech-hero/src/components/ImportadorDados.jsx) — a tela de conclusão agora exibe quantos registros/transações foram importados com sucesso e lista as linhas que falharam (se houver), em vez de um simples "✅ Importação Concluída".

---

### 9. Race condition no reload do ErrorBoundary (`ErrorBoundary.jsx`)

**Problema:** `handleReload` chamava `caches.delete(...)` (assíncrono, sem `await`) e imediatamente `window.location.reload(true)`. O reload podia ocorrer antes da limpeza dos caches do Service Worker terminar, fazendo a página recarregar a partir do cache antigo e potencialmente repetir o mesmo erro em loop. Além disso, `reload(true)` é um parâmetro legado ignorado pelos navegadores atuais.

**Correção:** [ErrorBoundary.jsx](agtech-hero/src/components/ErrorBoundary.jsx) — `handleReload` agora aguarda `Promise.all` da exclusão de todos os caches (com `.catch` de segurança) antes de chamar `window.location.reload()` (sem o argumento legado).

---

## Resumo de Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `firestore.rules` | Trava o campo `plano` contra alteração direta pelo dono |
| `agtech-hero/src/components/ModalUpsell.jsx` | Gateia simulador de pagamento ao ambiente DEV |
| `agtech-hero/src/components/FormularioManejo.jsx` | Corrige `ReferenceError` (`useRef`) |
| `agtech-hero/src/utils/exportadorDados.js` | Sanitiza CSV contra formula injection |
| `agtech-hero/src/firebase/config.js` | Remove fallback de auth mock em produção |
| `agtech-hero/src/utils/motorAlertas.js` | Renomeia variável de % mortalidade, webhook configurável via env, guarda listener HMR |
| `agtech-hero/.env.example` | Documenta `VITE_N8N_WEBHOOK_URL` |
| `agtech-hero/src/components/GestaoLotes.jsx` | Corrige data padrão de alojamento (timezone-safe) |
| `agtech-hero/src/firebase/services.js` | `importarDadosLote` trata erros por linha |
| `agtech-hero/src/components/ImportadorDados.jsx` | Exibe resumo de sucessos/erros da importação |
| `agtech-hero/src/components/ErrorBoundary.jsx` | Corrige race condition no reload |

## Ações Pendentes (fora do escopo desta rodada)

1. **Sprint 23** — Checkout real (Stripe/Asaas) e Cloud Function de confirmação de pagamento (`atualizarPlanoFazenda` via Admin SDK).
2. Configurar `VITE_N8N_WEBHOOK_URL` com o endpoint de produção (`/webhook/...`) do n8n antes do go-live.
3. Inconsistência cosmética nos nomes de plano (`Standard`/`Pro` no código vs. `Essencial`/`Inteligente` no schema do CLAUDE.md) — não corrigida nesta rodada, requer decisão de padronização.
