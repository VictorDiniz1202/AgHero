# Prompts da Sprint 19

Este documento contém os prompts estruturados e prontos para guiar a execução da Sprint 19.

---

## 🤖 Prompt para o Claude (Sub-sprint 19.2 - UI & Frontend)

Copie e cole o prompt abaixo diretamente no Claude:

```markdown
Você é a IA Frontend responsável por implementar a Sub-sprint 19.2: Histórico de Lotes Encerrados, Relatórios PDF e Gráfico de Peso Corporal no AgTech Hero.

### 1. PROPÓSITO
Nosso objetivo nesta sprint é fechar a régua de ciclo de vida do lote, fornecendo ao produtor histórico de lotes passados, relatórios para impressão (PDF) e um gráfico comparativo de crescimento do peso corporal contra os guias zootécnicos oficiais.

### 2. TAREFAS DE DESENVOLVIMENTO

#### A. Histórico e Ficha de Fechamento de Lote (`src/components/GestaoLotes.jsx`)
*   Adicionar abas de navegação na tela de Gestão de Lotes: "Lotes Ativos" e "Histórico de Lotes".
*   Listar lotes encerrados com um visual clean de "card fechado".
*   Ao clicar em um lote encerrado, abrir um painel visualmente premium de leitura contendo:
    *   Métricas de produtividade acumuladas (Mortalidade acumulada %, FCR, Ovos produzidos ou Peso Final de abate).
    *   Balanço financeiro consolidado do lote (Receitas vs Despesas = Lucro Líquido do lote).
    *   Custo de produção amortizado por ave.

#### B. Gráfico de Curva de Crescimento Corporal (`src/components/DashboardReal.jsx`)
*   Implementar um modal ou expandir a Bento Box com o componente `GrowthChart`.
*   O gráfico deve ser gerado dinamicamente via SVG (como o `LineChart` existente):
    *   Plotar a linha guia de peso padrão (Cobb 500 para Corte, Lohmann para Postura) baseando-se em `src/data/DiretrizesZootecnicas.js`.
    *   Plotar os pesos reais médios registrados no lote nas datas de pesagem.
    *   Exibir uma legenda clara e destacar o desvio percentual final.

#### C. Otimização de Impressão (`src/index.css`)
*   Configurar os seletores `@media print` para garantir que, ao imprimir a Dashboard ou a Ficha de Fechamento:
    *   Menos elementos desnecessários apareçam (ocultar sidebar, barra superior de lotes, banners, chat do BI e botões de ação).
    *   O fundo fique claro com contraste máximo, quebrando páginas de forma limpa sem cortar blocos de conteúdo no meio.
*   Adicionar um botão de ícone de impressora 🖨️ no topo do Dashboard com a ação `window.print()`.

### 3. DIRETRIZES TÉCNICAS
*   Aproveite as funções de busca do Firestore implementadas em `services.js` (como `obterLotesInativos`).
*   Mantenha a estética premium de Light Glassmorphism no modal e nas abas.
```

---

## 🛠️ Instruções para a Sub-sprint 19.1: Agente Backend / Antigravity

Estas são as diretrizes de código que serão aplicadas para o suporte de backend e controle de lotes:

1.  **Limitar Roteamento Lateral:** 
    *   Ajustar a lógica do seletor de lotes para garantir que lotes encerrados não fiquem visíveis no dropdown rápido de navegação diária, a menos que selecionados via gerenciador de lotes.
2.  **Lógica de Agregação de Fechamento:**
    *   Criar uma função utilitária em `src/utils/fechamentoLote.js` que receba o histórico diário e transações financeiras de um lote e devolva os acumulados prontos para gravação e exibição na Ficha de Fechamento.
3.  **Compilação:** Garantir que o build continue livre de falhas de importação ou conflitos.
