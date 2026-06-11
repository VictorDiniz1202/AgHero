# Prompts da Sprint 17

Este documento contém os prompts estruturados para guiar o desenvolvimento da Sprint 17.

---

## 🤖 Prompt para a Sub-sprint 17.1: Agente Backend / Antigravity

Copie este prompt se for rodar o agente backend ou execute as tarefas correspondentes:

```markdown
Você é o Engenheiro de Backend encarregado de implementar a infraestrutura PWA e o serviço de banco de dados financeiro para a Sprint 17 do AgTech Hero.

### Requisitos Técnicos

#### 1. Configuração do PWA (`vite.config.js` e `package.json`)
*   Instalar `vite-plugin-pwa` como dependência de desenvolvimento (`npm install vite-plugin-pwa --save-dev`).
*   Modificar [vite.config.js](file:///c:/Computa%C3%A7ao/AgTech/agtech-hero/vite.config.js) para integrar o plugin de PWA (`VitePWA`) com as seguintes especificações:
    *   `registerType: 'prompt'`: Exibe alerta quando nova versão estiver disponível no servidor.
    *   `manifest`: Incluir nome 'AgTech Hero', nome curto 'AgTech', tema visual (cores `#0B2F1D` e `#FAF9F6`), escopo e URL de início (`/`), e orientação vertical/horizontal.
    *   `workbox`: Configurar caching estratégico para requisições de fontes de terceiros (Google Fonts) e APIs externas (como OpenMeteo) com Stale-While-Revalidate.
*   Deletar o service worker manual legado `public/sw.js` (pois o plugin irá gerar o Service Worker otimizado automaticamente na compilação).

#### 2. Motores Financeiros (`src/utils/financeiroLote.js`)
*   Criar um arquivo utilitário que contenha:
    *   `calcularResumoFinanceiro(transacoes, quantidadeInicial)`: Recebe uma lista de transações financeiras e a quantidade inicial de aves. Retorna um objeto com `{ receitasTotais, despesasTotais, saldoLiquido, custoPorAve }`.
    *   Garanta que a divisão por zero seja evitada se `quantidadeInicial` não estiver definida ou for nula (utilizar valor padrão de 1 para evitar NaN).

#### 3. CRUD Firestore Financeiro (`src/firebase/services.js`)
*   Implementar as funções de escrita e leitura otimistas (sem travar a interface em caso de oscilações de rede):
    *   `registrarTransacao(id_fazenda, id_lote, transacaoData)`: Grava na subcoleção `/fazendas/{id_fazenda}/lotes/{id_lote}/financeiro` um documento com `data` (Timestamp do Firestore), `tipo`, `categoria`, `valor` e `descricao`.
    *   `obterTransacoesLote(id_fazenda, id_lote)`: Retorna as transações ordenadas pela data de forma decrescente (mais recentes primeiro).
    *   `deletarTransacao(id_fazenda, id_lote, id_transacao)`: Deleta o documento correspondente.
```

---

## 🤖 Prompt para a Sub-sprint 17.2: Claude (Frontend UI)

Copie e cole o prompt abaixo no Claude para que ele desenvolva as telas de controle financeiro e a interface integrada do PWA:

```markdown
Você é a IA Frontend encarregada de implementar a Sub-sprint 17.2: Painel Financeiro do Lote e Integração PWA no AgTech Hero.

### 1. PROPÓSITO
Para dar o próximo passo rumo ao profissionalismo de gestão de granjas, precisamos fornecer ao produtor uma forma rápida e eficiente de controlar o fluxo de caixa do lote (despesas com ração, pintinhos e vacinas cruzadas com receitas de vendas). Também precisamos concluir a experiência offline conectando os eventos do novo PWA gerado por `vite-plugin-pwa` para exibir notificações de atualização e conexão de internet.

### 2. REQUISITOS

#### A. Painel de Gestão Financeira (`src/components/GestaoFinanceira.jsx`)
*   **Aparência Visual Premium:** Use o tema Glassmorphism do site (painéis translúcidos, sombras suaves, tipografia de alta qualidade).
*   **Cards de Resumo:**
    *   *Receitas:* Total faturado com vendas (exibido em Verde).
    *   *Despesas:* Total investido (exibido em Vermelho/Laranja).
    *   *Saldo Líquido:* Receita menos Despesas (verde se positivo, vermelho se negativo).
    *   *KPI de Custo/Ave:* O custo acumulado dividido pelas aves alojadas inicialmente.
*   **Registro de Movimentações (Modal):**
    *   Formulário limpo com campos: Tipo (Despesa / Receita), Categoria (Ração, Pintinhos, Vacinas, Venda de Aves, Venda de Ovos, Energia, Outros), Valor (R$), Data (padrão dia atual) e Descrição.
    *   Ao salvar, chama `registrarTransacao` do Firebase e atualiza o estado local de forma otimista.
*   **Lista de Transações:**
    *   Tabela elegante exibindo todas as movimentações do lote com ordenação por data.
    *   Filtros rápidos no topo: "Todas", "Apenas Receitas", "Apenas Despesas" ou filtro por categoria.
    *   Opção de deletar transação (com botão de confirmação).

#### B. Registro do PWA e Banner de Conexão no Header (`src/AgHero.jsx`)
*   **Registro do SW:** Importar `registerSW` de `virtual:pwa-register` (injetado automaticamente pelo `vite-plugin-pwa`).
*   **Detector de Versão:** Ao detectar uma nova versão (evento `onNeedRefresh`), exiba um Toast flutuante discreto com o texto: *"Nova versão do AgTech Hero disponível! [Clique para Atualizar]"*. Ao clicar, executa a função de atualização para atualizar o cache do navegador imediatamente.
*   **Detector Offline:** Monitore o estado de conexão do navegador (`window.navigator.onLine`).
    *   Exiba uma Badge no topo do painel principal (ao lado de Sync OK): se online, exibe *"Sync OK"* em Verde; se offline, exibe *"Trabalhando Offline (Salvo no PC)"* em Amarelo/Laranja Piscante.

#### C. Sidebar e Roteamento
*   Modifique o `src/AgHero.jsx` para suportar a tela `financeiro`.
*   Atualize a Sidebar de menu de todos os componentes (`DashboardReal.jsx`, `CentralBI.jsx`, `DashboardNutricao.jsx`, `DashboardAgua.jsx`, `GestaoFinanceira.jsx`) adicionando o link "Gestão Financeira" com ícone de cifrão (`$`) mantendo a sidebar perfeitamente consistente em todas as páginas.

### 3. CONTEXTO EXISTENTE
Os métodos de backend já estarão disponíveis em:
*   [services.js](file:///c:/Computa%C3%A7ao/AgTech/agtech-hero/src/firebase/services.js) -> `registrarTransacao`, `obterTransacoesLote`, `deletarTransacao`.
*   [financeiroLote.js](file:///c:/Computa%C3%A7ao/AgTech/agtech-hero/src/utils/financeiroLote.js) -> `calcularResumoFinanceiro`.
*   O lote ativo possui a propriedade `quantidade_inicial` para calcular o Custo por Ave.
```
