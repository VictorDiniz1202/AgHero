# Prompts da Sprint 18

Este documento contém os prompts estruturados e prontos para guiar a execução da Sprint 18.

---

## 🤖 Prompt para o Claude (Sub-sprint 18.2 - Frontend & UI)

Copie e cole o prompt abaixo diretamente no Claude:

```markdown
Você é a IA Frontend responsável por implementar a Sub-sprint 18.2: Adaptação de Aptidão, Timeline de Produção e Gestão de Pesagens no AgTech Hero.

### 1. PROPÓSITO
Nosso objetivo nesta sprint é fazer com que a aplicação se comporte de forma customizada dependendo da aptidão do lote (Corte vs. Postura), adicionando uma Timeline de Produção interativa no rodapé e alertas de pesagem pendentes.

### 2. TAREFAS DE DESENVOLVIMENTO

#### A. Adaptação Dinâmica do Dashboard (`src/components/DashboardReal.jsx`)
*   Reorganizar a exibição dos cards Bento Box utilizando a propriedade `lote.aptidao` ("corte" ou "postura"):
    *   **Corte:** Exibir cards de Conversão Alimentar (FCR), Ganho Médio Diário (GMD), Índice de Eficiência Produtiva (IEP) e desvio gráfico contra curva Cobb 500/Ross 308.
    *   **Postura:** Exibir cards de % de Postura Diária, Conversão Alimentar por Dúzia de Ovos (FCR dz), total de Ovos Comerciais e Descarte, e desvio gráfico contra Lohmann.
*   Garantir a consistência visual do Light Glassmorphism (fundo semitransparente, desfoque traseiro, tons de verde e laranja discretos).

#### B. Linha do Tempo Visual de Produção (`src/components/DashboardReal.jsx`)
*   Implementar uma trilha de progresso zootécnico horizontal no rodapé do dashboard:
    *   O marcador deve representar a idade atual (Dias para Corte; Semanas para Postura).
    *   A cor do progresso/marcador muda dinamicamente: Verde (Desvio até -5%), Laranja (Desvio de -5% a -12%) ou Vermelho (Desvio > -12% ou mortalidade crítica).
    *   Injetar marcos interativos clicáveis representando vacinas programadas/aplicadas (💉), obtendo dados do histórico de Manejo Sanitário.

#### C. Gestão de Pesagens (`src/components/Configuracoes.jsx` e `src/components/DashboardReal.jsx`)
*   Adicionar campo de seletor de Frequência de Pesagem nas Configurações da Fazenda: `Semanal` (padrão), `Diária` ou `Personalizada`.
*   Caso a data programada para pesagem passe e nenhum peso médio seja registrado, exibir um banner/alerta piscante em tom de laranja sob o header: *"⚖️ Pesagem pendente para o Dia X. Registre o peso médio para atualizar os índices."*.

### 3. DIRETRIZES TÉCNICAS
*   Utilize as curvas e diretrizes estáticas declaradas em `src/data/DiretrizesZootecnicas.js`.
*   Garanta que todos os cliques de salvamento (ex: alteração de configurações) continuem offline-first e integrados de forma transparente.
```

---

## 🛠️ Instruções para a Sub-sprint 18.1: Agente Backend / Antigravity

Estas são as diretrizes de código que serão aplicadas para o refactoring estrutural:

1.  **Refatorar [AgHero.jsx](file:///c:/Computa%C3%A7ao/AgTech/agtech-hero/src/AgHero.jsx):**
    *   Hoistar a definição do `PWABadge` e `SystemWrapper` para fora do componente `AgHero` (antes da linha `export default function AgHero()`).
    *   Substituir a estrutura de múltiplos retornos duplicados com `<SystemWrapper>` por um único retorno central que envolve o seletor condicional de telas.
2.  **Verificar Compilação:** Garantir que o frontend continue compilando corretamente sem warnings ou erros de escopo.
