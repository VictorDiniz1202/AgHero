# 🛠️ Prompts para a Sprint 13: Engenharia de Upsell & Simulador de ROI

Este arquivo divide as responsabilidades e prepara os prompts de execução para o **Gemini** (Sub-sprint 13.1) e para o **Claude** (Sub-sprint 13.2) para implementar a restrição de envio de alertas pelo plano, banners de upgrade e o Simulador de ROI.

---

## 🚀 Sub-sprint 13.1: Gemini (Antigravity) - Restrição de Webhook por Plano & Simulador de ROI

### 📝 Prompt de Execução para o Gemini (Você mesmo na próxima etapa)

#### 1. Contexto e Objetivos
Ajustar o motor de disparos e a tela de configurações para suportar a diferenciação de planos (Essencial vs. Inteligente). A fazenda no plano **Essencial** não deve realizar o disparo de webhook de WhatsApp, salvando o alerta com status `"bloqueado_plano"`. Também adicionaremos a lógica da calculadora de ROI baseada no tamanho do lote para demonstrar o ganho financeiro de assinar o plano Inteligente.

#### 2. Requisitos de Código

##### A. Ajustar Disparo de Alertas (`src/components/FormularioManejo.jsx` ou `src/utils/motorAlertas.js`)
1.  Verificar o plano atual da fazenda (`fazendaConfig.plano` ou `fazendaConfig.plano === 'Inteligente'`).
2.  Na função `processarAlertas`:
    *   Se `plano !== 'Inteligente' && plano !== 'Premium'`:
        *   **Não chamar** `dispararAlertaWhatsapp`.
        *   Chamar diretamente `salvarAlertaEnviado(id_fazenda, ...)` passando `status_envio: 'bloqueado_plano'`.
    *   Se `plano === 'Inteligente'` ou `plano === 'Premium'`:
        *   Manter o comportamento original de disparar o webhook.

##### B. Criar Painel de Simulação de ROI (`src/components/Configuracoes.jsx`)
1.  Abaixo do card do Plano de Assinatura, implementar um painel glassmorphic **"Simulador de ROI de Perda Evitada"**.
2.  Buscar a quantidade inicial de aves do lote ativo atual. Se não houver lote ativo, usar 10.000 como padrão simulado.
3.  **Lógica do Cálculo:**
    *   *Redução média de mortalidade pela IA:* **2.5%**
    *   *Preço médio de venda da ave:* **R$ 8,50** para Corte e **R$ 4,50** para Postura.
    *   *Economia Estimada (R$):* `Quantidade de Aves * 0.025 * Preço Médio`.
4.  Exibir a estimativa de forma impactante na UI:
    *   *"Com seu lote ativo de **[Quantidade] aves**, a IA preditiva pode evitar a perda de até **[Aves Salvas] aves**, economizando cerca de **R$ [Valor Economizado]** por ciclo."*
    *   Adicionar um botão de Upgrade que chama o modal comercial.

---

## 🤖 Sub-sprint 13.2: Claude - Banners de Gatilho de Upgrade & Roteamento Visual

### 📝 Prompt de Execução (Copie e cole no chat do Claude após a Sub-sprint 13.1)

#### 1. P (Persona & Contexto)
Você é um Engenheiro Frontend Sênior com profundo conhecimento em React, PWA offline-first e design de interfaces premium (Light Glassmorphic). Sua missão é implementar os gatilhos visuais de upsell para converter usuários do plano Essencial para o plano Inteligente.

#### 2. R (Requisitos de Negócio & Lógica Visual)

##### A. Badge de WhatsApp Bloqueado (`src/components/CentralBI.jsx`)
1.  No componente `CardAlerta`, mapear o status `bloqueado_plano`.
2.  Se `alerta.status_envio === 'bloqueado_plano'`:
    *   Renderizar o badge: `🟠 WhatsApp bloqueado (Plano Essencial)`.
    *   Tornar o badge interativo (clicável), abrindo o Modal de Upgrade Comercial (`ModalUpsell`).

##### B. Banner de Alerta Crítico no Dashboard (`src/components/DashboardReal.jsx`)
1.  Carregar os alertas recentes via `obterAlertasEnviados(id_fazenda)`.
2.  Verificar se há algum alerta com status `bloqueado_plano` gerado nas últimas 24h para o lote ativo.
3.  Se houver:
    *   Exibir um banner de alerta vermelho/laranja reluzente com micro-animação (ex: pulsação suave) logo abaixo do cabeçalho do `DashboardReal`.
    *   Texto do banner:
        *   *"⚠️ **Anomalia Crítica Detectada!** A IA detectou desvios no Lote hoje. [Clique aqui para ativar o Plano Inteligente] e liberar o envio automático via WhatsApp para seu veterinário."*
    *   Ao clicar no banner, abrir o modal de Upsell para realizar a conversão.

#### 3. E (Especificações Técnicas)
*   **Design System:** Usar as cores de alerta do Agtech (Laranja Alerta, Vermelho Perigo) aplicadas em painéis translúcidos com bordas bem definidas e blur de fundo (`backdrop-blur-md`).
*   **Segurança:** Garantir que peões e administradores vejam o banner, mas somente proprietários possam abrir ou interagir com o fluxo de Upgrade (ou exibir aviso de que apenas administradores podem gerenciar planos).

#### 4. Arquivos a Marcar no Workspace
*   `@src/components/DashboardReal.jsx`
*   `@src/components/CentralBI.jsx`
*   `@src/components/Configuracoes.jsx`
