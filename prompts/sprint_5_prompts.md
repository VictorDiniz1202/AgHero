# Prompts para o Claude: Sprint 5 (Dashboard Dinâmico & Alertas Locais)

Este documento contém os prompts estruturados sob o framework **PREP-C** (Persona, Requisitos, Especificações, Output, Cenários de Teste) para serem utilizados no Claude para desenvolver o Painel de Controle Dinâmico.

---

## Sub-Prompt 1: Componente de Dashboard Dinâmico (`DashboardReal.jsx`)
**Objetivo:** Desenvolver a tela de visualização de dados reais da fazenda com KPIs, gráficos em SVG dinâmicos e detecção local de anomalias (fallback offline).

```markdown
### PERSONA & CONTEXTO (P)
Você é um desenvolvedor frontend React especialista em Tailwind CSS (v4) e arquiteturas local-first/offline-first. Estamos construindo o Painel de Controle principal do "Agtech", um SaaS premium de avicultura. O painel deve ser visualmente premium (verde floresta #1B4332, off-white #F9FAFB, alertas contrastantes) e otimizado para celulares de campo (cliques rápidos e legibilidade sob o sol).

### REQUISITOS DE NEGÓCIO (R)
O produtor precisa ver um resumo real da saúde do lote selecionado. Se o sistema estiver sem rede (offline), os cálculos e gráficos devem ser gerados instantaneamente a partir dos dados do cache do Firestore. 
O dashboard deve exibir:
1. Seletor de lotes ativos da fazenda.
2. KPIs: Aves Ativas, Mortalidade Acumulada (%) e Conversão Alimentar (FCR).
3. Gráfico dinâmico do consumo diário de água (litros) e ração (kg) nos últimos 7 dias.
4. Um card de destaque com insights de IA (exibindo alertas preditivos gerados localmente).

### ESPECIFICAÇÕES TÉCNICAS (E)
1. Crie o arquivo `src/components/DashboardReal.jsx`.
2. Consuma os dados do Firestore usando a API local em `src/firebase/services.js`:
   - Chame `obterLotesAtivos(id_fazenda)` para popular o seletor de lotes.
   - Chame `obterUltimosRegistros(id_fazenda, 10)` para buscar o histórico de manejos.
3. Cálculos de KPIs no Cliente:
   - **Aves Ativas**: Quantidade inicial do lote menos a soma de mortes dos registros.
   - **Mortalidade Acumulada**: `(Soma de mortes / Quantidade inicial do lote) * 100` (formatar com duas casas decimais).
   - **Conversão Alimentar (FCR)**: Estime a idade do lote em dias (diferença entre hoje e a data de alojamento). Use uma curva simples onde o peso corporal estimado da ave é `50g * (1.15 ^ idade_em_dias)`. Calcule a FCR dividindo o consumo total acumulado de ração pelo ganho de peso total estimado das aves ativas.
4. Gráfico SVG Dinâmico:
   - Não use bibliotecas pesadas de gráficos. Desenhe o gráfico de linhas e áreas usando elementos `<svg>`, `<polyline>` e `<polygon>` dinâmicos, mapeando os últimos 7 dias de dados de consumo de água e ração proporcionalmente à largura/altura do SVG.
5. Motor de Alertas Local (XAI Offline):
   - Implemente em Javascript as mesmas regras zootécnicas do motor de IA:
     - **Estresse Térmico**: Se a temperatura máxima no dia mais recente for maior que 32°C.
     - **Queda de Consumo de Água**: Se o consumo de água do dia mais recente for menor que a média móvel de 3 dias dos dias anteriores em mais de 10% (limiar `0.10`).
     - **Desvio de Relação Água/Ração**: Se a relação do dia atual estiver fora do intervalo de 1.6 a 2.5.
   - Formate mensagens explicativas amigáveis em português caso as anomalias ocorram.
6. Ações:
   - Botão grande (mínimo 48px de altura) com link para "Lançar Manejo Diário" que chama a propriedade callback `onAbrirFormulario()`.

### PADRÃO DE OUTPUT (P)
O código completo de `src/components/DashboardReal.jsx` usando Tailwind CSS para a estilização premium e SVG puro para o gráfico de linhas.

### CENÁRIOS DE TESTE (C)
1. Lote sem registros (exibir estado vazio amigável: "Sem registros cadastrados para este lote").
2. Lote com histórico estável (gráfico renderiza curvas retas, KPI de FCR correto, sem alertas).
3. Lote com temperatura crítica de 34°C (deve exibir o card vermelho de Alerta de Estresse Térmico).
4. Lote com queda súbita de água de 12% em relação aos dias anteriores (deve exibir o alerta de queda de água com explicação XAI).
```

---

## Sub-Prompt 2: Integração e Fluxo de Telas em `AgHero.jsx`
**Objetivo:** Adaptar o roteador principal do frontend para gerenciar a transição suave entre a Landing Page, o Dashboard Dinâmico e o Formulário de Manejo.

```markdown
### PERSONA & CONTEXTO (P)
Você é um arquiteto frontend React sênior focado em roteamento SPA simples, otimizado e HMR-safe.

### REQUISITOS DE NEGÓCIO (R)
Precisamos conectar as telas do Agtech. Quando o usuário clica em "Acessar Sistema" na landing page, ele deve ver o seu Dashboard Real (com os dados do seu lote). No Dashboard, se ele clicar em "Lançar Manejo", ele abre o formulário. Do formulário, ele pode voltar para o Dashboard.

### ESPECIFICAÇÕES TÉCNICAS (E)
1. Modifique `src/AgHero.jsx` para importar `DashboardReal` de `./components/DashboardReal`.
2. Altere o estado `tela` para aceitar os valores: `"landing"`, `"dashboard"`, `"formulario"`.
3. Renderize condicionalmente:
   - `"landing"`: exibe a Navbar e a HeroSection original.
   - `"dashboard"`: exibe o componente `<DashboardReal id_fazenda="fazenda_demo_123" onAbrirFormulario={() => setTela("formulario")} onVoltar={() => setTela("landing")} />`.
   - `"formulario"`: exibe o componente `<FormularioManejo id_fazenda="fazenda_demo_123" onVoltar={() => setTela("dashboard")} />`.

### PADRÃO DE OUTPUT (P)
O arquivo `src/AgHero.jsx` modificado mantendo a UI original e os estilos premium da landing page, mas com a navegação real e dinâmica.

### CENÁRIOS DE TESTE (C)
1. Transição rápida entre telas: verificar se os dados atualizados no formulário aparecem refletidos no gráfico e KPIs ao retornar para a tela do dashboard.
```
