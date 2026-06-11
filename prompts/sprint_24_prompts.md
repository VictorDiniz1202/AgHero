# 📋 Guia de Engenharia de Frontend: Sprint 24 (Exportação de Dados & Centro de Relatórios)

Você é um Engenheiro Frontend Sênior React + Tailwind CSS v4. Sua tarefa é implementar as modificações da Sprint 24, desenvolvendo a funcionalidade de exportação de dados CSV e exibição dos relatórios técnicos para produtores avícolas sob a estética Premium Glassmorphism.

Arquivos base para seu contexto:
*   `src/components/SidebarMenu.jsx`
*   `src/firebase/services.js` (Será onde consumirá as funções)

---

### 1. NOVO COMPONENTE: CENTRO DE RELATÓRIOS (`src/components/CentroRelatorios.jsx`)
Crie a tela `CentroRelatorios.jsx`. Esta deve ser uma página inteira acessível via o menu lateral (`SidebarMenu.jsx`).

*   **Aparência Estética:**
    - Fundo Glassmorphism (.glass-panel) principal contendo o título da tela e breve descrição.
    - O layout deve ser limpo e intuitivo, otimizado para dispositivos móveis, mas com excelente usabilidade em desktop.
*   **Filtros de Exportação:**
    - Seletor de Lote: Um Dropdown/Select listando os lotes da fazenda (ativos e inativos).
    - Intervalo de Datas: Dois campos de data (Início e Fim) com validação (A data final não pode ser menor que a inicial).
    - Tipo de Relatório: Select com as opções "Manejo Sanitário", "Consumo (Água/Ração)", "Tabela Zootécnica Completa".
*   **Ação de Exportação:**
    - Botão "Gerar Relatório CSV" (altura >= 48px), estilizado com gradiente de Azul Safira para Azul Teal (`bg-gradient-to-r from-blue-500 to-teal-400 hover:scale-105`).
    - Ao clicar no botão:
        1. Altere para estado "Gerando Arquivo..." (spinner de carregamento).
        2. Chame a função de utilitário (fornecida pelo Backend) que gera a string CSV.
        3. Crie um Blob com o conteúdo e dispare o download automático através de um link âncora criado dinamicamente (`<a download="relatorio.csv">`).
        4. Mostre um toast verde translúcido de sucesso.

### 2. EXIBIÇÃO DE PRÉVIA DOS DADOS (Tabela Zootécnica)
Abaixo dos filtros, crie uma prévia tabular dos últimos 5 dias do lote selecionado.
*   **Design da Tabela:**
    - Cabeçalhos translúcidos ou com opacidade reduzida.
    - Linhas com bordas divisórias muito sutis.
    - Se a aptidão do lote for "postura", exiba colunas de Ovos Produzidos e % de Postura.
    - Se for "corte", exiba colunas de Peso Médio e GPD (Ganho de Peso Diário).

### 3. RESILIÊNCIA OFFLINE
*   Se a aplicação detectar que está offline (`navigator.onLine === false`):
    - O botão de "Gerar Relatório CSV" ainda **deve funcionar**, pois a extração CSV será feita com base no que estiver sincronizado localmente (IndexedDB via Firebase).
    - Exiba um badge informativo amarelo: *"⚠️ Você está offline. O relatório conterá apenas dados armazenados localmente."*

Avise-me quando a estrutura de UI estiver pronta!
