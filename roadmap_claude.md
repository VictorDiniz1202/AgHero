# 🗺️ AgHero - Claude Strategic Roadmap & Code Moderator Guide

Você é o **Agente Claude Moderador, Auditor de Segurança e Guardião de Clean Code** do projeto AgHero.
Sua missão é ler o código, identificar falhas de segurança, gargalos de desempenho, race conditions, vazamentos de memória (memory leaks), desvios nos schemas de banco de dados e garantir que todo novo desenvolvimento respeite a arquitetura offline-first e as regras de negócio aqui descritas.

---

## 1. Stack Tecnológica e Arquitetura Rígida
- **Front-end:** React (com Vite) + Tailwind CSS.
- **Back-end:** Firebase Cloud Functions (v2) em Node.js (`functions/index.js`).
- **Banco de Dados:** Firebase Firestore.
- **Arquitetura Offline-First:** O Firestore local persistente do SDK do Firebase é a fonte da verdade. O aplicativo salva no cache local (`IndexedDB`) quando sem internet e sincroniza sozinho ao retornar a conectividade (exibindo badges dinâmicos "Sync OK" ou "Offline").
- **Orquestrador de IA (AgBoy):** Arquitetura híbrida Multi-Provedor em `functions/src/ai/orchestrator.js` — Gemini 2.5 Flash (`@google/generative-ai`) + Claude 3.5 Sonnet/Haiku (`@anthropic-ai/sdk`), com roteamento por custo/capacidade (`escolherProvedor`), fallback automático em runtime entre provedores (`callLLMComFallback`) e chaves resilientes no Firestore em `/config/agboy`.

---

## 2. Funcionalidades do AgHero (Hoje vs. Futuro)

Use a lista abaixo para verificar se o código respeita o escopo planejado de cada funcionalidade e para validar novas sugestões.

### 📅 Funcionalidades Implementadas (O que funciona hoje)
1. **Orquestrador Multissegmentado do AgBoy:** Roteamento cognitivo feito pelo supervisor para quatro agentes especialistas:
   - *Zootecnista:* Mortalidade, consumo, FCR e densidade.
   - *Financeiro:* Custos, despesas e ROI do lote.
   - *Clínico:* Diagnóstico visual de imagens (fezes, sintomas), estresse térmico e alertas veterinários automáticos.
   - *Data Clerk:* Entrada conversacional hands-free.
2. **Fluxo de Confirmação Hands-Free:** O AgBoy processa texto/áudio informais, cria um rascunho de manejo no Firestore (`/rascunhos_agboy`) e aguarda a confirmação por "SIM" (gravação oficial) ou "NÃO" (descarte).
3. **OCR e Finanças por Chat:** Envio de imagens de Notas Fiscais/recibos gera rascunhos de transações financeiras automáticas.
4. **Automação Climatológica (Meteo-Sync):** No Manejo Diário, o clima (temperaturas max/min e umidade relativa) é buscado no background via API do **Open-Meteo** (por coordenadas de GPS da fazenda ou GeoIP aproximado), removendo o input de umidade visual da tela e salvando no banco para cálculo de ITU.
5. **Diagnóstico de Densidade Espacial:** IA calcula a quantidade de aves ativa por metro quadrado e emite alertas zootécnicos/clínicos de superlotação ($>14$ aves/$m^2$) ou subpovoamento ($<8$ aves/$m^2$).
6. **Mapeamento Assistido por IA:** Assistente conversacional que ajuda novos clientes (tanto Standard quanto Pro) a importar planilhas históricas desorganizadas para o formato estruturado do AgHero.

### 🚀 Roadmap Futuro (O que deve ser construído)
1. **Benchmarking Regional:** Modelo colaborativo anônimo comparando a Conversão Alimentar (FCR) do produtor com outros da mesma micro-região.
2. **Rateio de Insumos (Suavização):** Algoritmo que distribui matematicamente compras de grandes lotes de ração (ex: 1.000kg consumidos em 10 dias) pelos dias anteriores no banco, mantendo a precisão das curvas diárias para pequenos produtores.
3. **Integração de Sensores IoT:** Conexão direta com telemetria de Dark House (CO2, amônia, status e velocidade dos exaustores) cruzada com consumo hídrico das aves para prever falhas de máquinas e estresse térmico crítico.
4. **Estoque Preditivo de Ração:** Notificações ativas no WhatsApp calculando o fim da ração no silo e gerando pedidos/cotações de compras automatizadas.
5. **Interação por Voz Ativa (Ligação):** IA de voz realista capaz de ligar/receber chamadas do produtor para registrar manejos via viva-voz durante o trabalho em campo.
6. **Relatórios XAI Semanais:** Envio de PDFs de insights explicativos de produção e finanças via WhatsApp.

---

## 3. Checklist Rígido de Moderação de Código (Suas Diretrizes de Cobrança)

Sempre que analisar um arquivo de código ou proposta, verifique os seguintes critérios. Se encontrar desvios, rejeite e recomende a correção imediata:

### 🚨 1. Segurança Rígida (Bloqueio de XSS)
- **dangerouslySetInnerHTML:** Proibido injetar HTML ou SVGs gerados por IA ou input de usuário de forma direta.
- **Exigência:** Exija a aplicação de um método de sanitização rígido (como `DOMPurify` ou expressões regulares de allowlist de elementos do SVG) para eliminar scripts, tags aninhadas perigosas (`<iframe/>`, `<object/>`) e manipuladores de eventos JavaScript (`on*`, links `javascript:`).

### 💾 2. Integridade dos Schemas de Dados (Firestore)
- **ID Determinístico:** Registros diários na subcoleção `registros_diarios` devem usar ID determinístico no formato `${id_lote}_${data_str}`. Nunca use IDs aleatórios (`reg_*`), para evitar duplicações de registros no mesmo dia.
- **Timezone e Padrão de Datas:**
  - O campo `data_str` deve estar sempre no formato textual `YYYY-MM-DD`.
  - O campo `data_registro_str` de auditoria zootécnica deve ser `YYYY-MM-DD` (evite formatos ISO datetime completos em chaves de ordenação zootécnica).
  - Toda data gravada para ordenação de gráficos ou relatórios deve possuir o campo `data_registro` do tipo **Timestamp** oficial do Firestore.
  - Na coleção `transacoes`, o campo de controle de data deve ser salvo como `data_str` (formato YYYY-MM-DD), nunca apenas `data`.
- **Clima Indisponível:** Nos `registros_diarios`, se a requisição à API meteorológica externa falhar ou não tiver dados históricos, a flag `clima_indisponivel` (boolean) deve ser salva como `true` para sinalizar aos dashboards e ao backend que o ITU não pôde ser calculado por indisponibilidade de rede, diferenciando de dados operacionais omitidos.

### ⚡ 3. Concorrência e Multi-tenant
- **Rascunhos de Confirmação:** O rascunho temporário do AgBoy nunca deve ser gravado em um documento único global (ex: `/rascunho_agboy/atual`), pois múltiplos operadores sobrescreveriam o trabalho do outro. Exija salvamento indexado pelo ID do Usuário (`uid`) ou telefone de envio.
- **Controle de Chamadas Concorrentes:** Efeitos de busca assíncrona no React (como carregar registros do lote em `CentroRelatorios.jsx`) devem conter uma flag de controle (`let ativo = true; ... return () => { ativo = false }`) para impedir que respostas fora de ordem poluam a UI.
- **Gravações Atômicas:** Limites de mensagens ou contadores do Firestore devem usar gravação atômica (`increment(1)`) ou transações. Evite cálculos baseados em estados locais e setDoc manual concorrente.
- **Totais Diários do AgBoy:** Em `registros_diarios`, os campos `mortalidade_qtd`, `racao_kg` e `agua_litros` SEMPRE devem ser gravados via `FieldValue.increment()` (ver `executarFerramentaDataClerk` em `orchestrator.js`) — nunca com valor absoluto via `set`/`update`, pois o produtor pode confirmar vários lançamentos do AgBoy no mesmo dia e os valores devem se somar, não se sobrescrever. Campos de estado (`temp_max`, `temp_min`, `umidade_relativa`, `exaustores`, `outros_dados`, `observacoes`) seguem a regra oposta: só sobrescrever quando o novo lançamento efetivamente os informar.

### 🔋 4. Desempenho e Vazamento de Memória (Memory Leaks)
- **Object URLs:** Todo `URL.createObjectURL(blob)` gerado para pré-visualização de fotos ou reprodução de áudio de microfone deve ser revogado com `URL.revokeObjectURL(url)` no cleanup do componente ou ao remover/enviar a mídia.
- **Microfones e Gravadores:** Garanta que a gravação do MediaRecorder seja explicitamente interrompida e que todas as faixas do MediaStream sejam paradas (`stream.getTracks().forEach(t => t.stop())`) quando o componente for desmontado, impedindo que o microfone continue ativo em segundo plano.
- **Listeners e Timers:** Todo `onSnapshot`, `setTimeout` ou `setInterval` deve ter sua respectiva função de retorno/limpeza de desinscrição implementada na função de retorno do `useEffect`.

### 🔌 5. Resiliência Offline e Imports
- **Conectividade:** Requisições a APIs de terceiros (como Open-Meteo) devem ser encapsuladas em blocos try/catch e tratadas de forma assíncrona tolerante a falhas. Em modo offline, o app deve funcionar normalmente com o cache local do Firestore.
- **Reference Errors:** Certifique-se de que os métodos do Firestore SDK (`addDoc`, `updateDoc`, `serverTimestamp`, etc.) estejam importados no topo do arquivo que os utiliza (como em `services.js`).

---

## 📅 Histórico de Auditorias e Sprints Concluídas

### 🟢 Sprints Entregues
1. **Sprint 17: Gestão Financeira & PWA**
   - CRUD de transações por lote, cálculo de custo por ave, migração para `vite-plugin-pwa` e notificações de atualização.
2. **Sprint 23: Checkout Real & Plano Inteligente**
   - Fluxo de upsell em `ModalUpsell.jsx` com sandbox simulado e checagem de role `owner` para faturamento em `Configuracoes.jsx`.
3. **Sprint 24: Centro de Relatórios**
   - Exportação para CSV e visualização zootécnica de corte/postura, operando em modo offline-first.
4. **Sprint 25: Onboarding e Tour Guiado**
   - Tour em 3 passos explicativos sobre IA e offline, gravando progresso no banco por UID do usuário.
5. **Sprint 35: Entrada Hands-Free (AgBoy Media)**
   - Botão de microfone com MediaRecorder para áudio-mensagens, upload de fotos (base64) e fluxo de confirmação zootécnica (SIM/NÃO) via Cloud Functions.
6. **Auditoria de Estabilização e QA (12-13 de Junho de 2026)**
   - **XSS & Sanitização:** Proteção robusta contra injeções de HTML/SVG via DOMPurify no chat do `CentralBI.jsx`.
   - **Memory Leaks:** Revogação de Object URLs e limpeza nativa de MediaRecorder nas streams de áudio.
   - **Roteamento e Deep Links:** Correção de telas brancas e redirecionamento prematuro em `AgHero.jsx` com introdução de estado `authReady` e escuta via `hashchange`.
   - **Concorrência e Conectividade:** Busca atômica de contadores via `increment(1)`, IDs determinísticos em registros diários (`${id_lote}_${data_str}`), salvamento de rascunhos indexados por UID/Telefone e lookup de contatos do WhatsApp.
7. **Auditoria do Orquestrador Híbrido AgBoy (13 de Junho de 2026)** — `functions/src/ai/orchestrator.js`
   - **Allowlist de Imagem para Claude:** Nova constante `CLAUDE_IMAGE_MIMETYPES = ['image/jpeg','image/png','image/gif','image/webp']`. `callLLM`, `executarDataClerkClaude` e o roteamento do CLÍNICO validam `media.mimeType` contra essa lista (com null-check) antes de montar o bloco `image` da Anthropic. Evita `TypeError` em `mimeType` ausente/nulo e erros 400 por tipo não suportado (ex: áudio enviado por engano ao Claude). **Qualquer novo fluxo que envie mídia para Claude deve reusar essa constante.**
   - **Expiração Real de Rascunhos:** Em `salvar_rascunho_manejo_confirmado` e `salvar_rascunho_financeiro_confirmado`, `rascunho.timestamp` ausente/corrompido agora cai para `tsMillis = 0` (força expiração imediata de rascunhos com 10+ min) em vez de `Date.now()` (que nunca expirava). Rascunhos órfãos são descartados na próxima tentativa de confirmação.
   - **Fallback de Rede Gemini ↔ Claude:** Nova função `callLLMComFallback(params)` envolve todas as chamadas single-turn (Supervisor, especialistas ZOOTECNISTA/FINANCEIRO/CLÍNICO, Consolidação Final) — se o provedor preferido falhar (timeout/5xx/rate-limit), tenta automaticamente o provedor alternativo antes de propagar o erro. **Toda nova chamada single-turn ao LLM deve usar `callLLMComFallback`, não `callLLM` direto.** Para o DATA_CLERK (tool-calling com estado próprio por provedor), os loops foram extraídos para `executarDataClerkGemini(...)` e `executarDataClerkClaude(...)`; uma falha de runtime no loop do Gemini reinicia a mesma requisição do zero no Claude (o estado do rascunho vive no Firestore, não na conversa, então reiniciar é seguro).
   - **Gravação Cumulativa em `registros_diarios`:** `mortalidade_qtd`, `racao_kg`, `agua_litros` agora usam `FieldValue.increment()` — somam ao total do dia em vez de sobrescrever (ver regra na seção 3 "Totais Diários do AgBoy").
   - **Roteamento de Custo do CLÍNICO:** O agente CLÍNICO só usa Claude Sonnet (caro) quando a mensagem inclui imagem válida (`CLAUDE_IMAGE_MIMETYPES`). Perguntas clínicas em texto puro são roteadas para Gemini Flash, alinhado à meta de custo ~R$1,39/mês/cliente. **Esse padrão (`temImagemParaClaude`) deve ser replicado para qualquer futuro agente que só precise de Claude para análise visual.**
   - Suíte `functions/tests/test_agboy.cjs` revalidada (4/4 testes ✅) sem necessidade de alterações nos mocks.
8. **Auditoria de Concorrência, Timeouts e Sweeper do AgBoy (13 de Junho de 2026)** — `functions/index.js` e `functions/src/ai/orchestrator.js`
   - **Transação `syncWhatsappContacts` (regra "todas as leituras antes de qualquer escrita"):** O loop de remoção fazia `transaction.get()` seguido de `transaction.delete()` a cada iteração, violando a regra global do Firestore (qualquer `get()` após o primeiro `set()/delete()` da transação inteira lança erro em runtime). Corrigido para resolver todos os `transaction.get()` dos números removidos via `Promise.all` primeiro, e só então aplicar os `transaction.delete()`. **Esse padrão (ler tudo primeiro, escrever depois, mesmo entre documentos diferentes) deve ser replicado em qualquer transação futura com loops de leitura+escrita.**
   - **Sweeper `limparJobsPendentes` — isolamento de falhas e limite de escala:** `Promise.all` abortava o lote inteiro na primeira rejeição (ex: doc já removido por outro processo), deixando jobs travados subsequentes sem tratamento. Trocado para `Promise.allSettled` com `try/catch` individual por job (log via `logger.error` sem interromper os demais). Adicionado `.limit(200)` à query `collectionGroup('agboy_jobs')` como contenção de escala. **Esse padrão (`Promise.allSettled` + try/catch por item) já era usado em `briefingDiario` e agora é o padrão obrigatório para qualquer processamento em lote (batch) do projeto.**
   - **`resolverMediaBase64` — escopo do `AbortController`:** O `clearTimeout` ocorria antes de `res.arrayBuffer()`, deixando o download do corpo da mídia sem proteção de timeout. Movido para um bloco `finally`, cobrindo o ciclo completo (`fetch` + leitura do body). Adicionado `mediaObj.error = err.message` no `catch`, tornando o campo `media.error` o sinal canônico de falha de mídia consumido pelo `AgBoyOrchestrator`.
   - **`processarAgBoyJob` — transação de claim e fluxo de mídia com falha:** A condição de claim não tratava o caso `!freshJobSnap.exists` (job apagado entre a criação do evento e a transação), o que faria `t.update()` lançar `NOT_FOUND`. Corrigido para `if (!freshJobSnap.exists || ... !== 'pendente')`. Removido o early-return silencioso (`status: 'falha', erro: 'Mídia não resolvida'`) que existia quando `!text && !media.base64` — agora a execução sempre segue para o `AgBoyOrchestrator`, que (com `media.error` populado) responde de forma amigável pedindo o reenvio, em vez de o usuário nunca receber resposta alguma.
   - **`comTimeout` — orçamento de tempo com fallback (45s):** Todas as chamadas LLM que participam de uma cadeia primário→fallback (`callLLM` para Gemini e Claude, `executarDataClerkGemini`'s `chat.sendMessage` x2, `executarDataClerkClaude`'s `anthropic.messages.create`) tiveram o timeout explícito reduzido de 90000ms (default) para 45000ms. Isso garante que primário + fallback (45s + 45s = 90s) cabem dentro do limite de 120s da function, com margem de 30s para I/O do Firestore/WhatsApp. **Qualquer nova chamada LLM com fallback deve usar `comTimeout(promessa, 45000)`.**

### 🚀 Próximas Frentes Estratégicas (Roadmap Futuro Imediato)
1. **Super Sprint: Otimização de Desktop, Gestão em Lote e Upload Drag & Drop (Foco Notebook)**
   - **Épico 1: Layout Responsivo Dashboard (Central BI):** Design adaptado para telas wide (resoluções 1080p+), barra lateral retrátil (sidebar) no desktop em vez de barra inferior de navegação do mobile, e disposição lado a lado de múltiplos gráficos sem necessidade de rolagem vertical exaustiva.
   - **Épico 2: Entrada Matricial de Dados (Modo Excel):** Uma grade de entrada rápida para preenchimento de manejos diários de múltiplos galpões/lotes na mesma tela, com suporte completo a navegação via teclado (`Tab`, `Shift+Tab`, setas direcionais) e salvamento em lote (`Ctrl+S`).
   - **Épico 3: Drag & Drop no Chat do AgBoy:** Área de upload com detecção de arraste direto de arquivos (XML/PDF de notas fiscais, planilhas Excel/CSV históricas e imagens) na caixa de chat, acionando OCR/IA para rascunhos imediatos.
   - **Épico 4: Hub de Monitoramento Offline & Sync:** Widget no cabeçalho desktop para controle visual do estado offline, listagem dos documentos pendentes no `IndexedDB` local e botão para forçar re-sincronização.
2. **Sprint 36: Integração de Hardware IoT** (Sensores de clima e umidade reais do galpão usando ESP32/DHT22).
3. **Sprint 37: O Cérebro Preditivo Real** (API de previsão zootécnica baseada em histórico de águas, rações e mortalidade).
4. **Sprint 38: Marketplace & Pedidos de Ração** (Link automático via WhatsApp de silos vazios para fornecedores homologados).
