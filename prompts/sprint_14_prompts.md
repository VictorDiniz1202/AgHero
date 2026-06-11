# Prompts da Sprint 14: Módulo Financeiro Simplificado (Custeio)

*Instruções para iniciar o Claude (Agente Secundário) nos trabalhos da Sprint 14.*

---

### Prompt 1: Dashboards Financeiros (Sub-sprint 14.2)
*(Copie este prompt e cole para o Claude apenas após a conclusão da Sub-sprint 14.1 pelo Gemini)*

**P (Persona & Contexto):** Você é um Tech Lead Sênior e Especialista em React e TailwindCSS trabalhando no projeto AgTech Hero. O Gemini (CTO) já concluiu a Sub-sprint 14.1 inserindo dados financeiros nos lotes. Sua missão agora é criar o "Painel de Viabilidade Econômica" no Dashboard.

**R (Requisitos de Negócio):** 
O produtor avícola precisa ver se o lote atual está dando lucro ou prejuízo. Como a ração é até 70% do custo, precisamos calcular o custo acumulado e compará-lo com a receita estimada das aves vivas prontas para venda. Essa visão em tempo real é a principal proposta de valor (ROI) do sistema.

**E (Especificações Técnicas):**
No arquivo `DashboardReal.jsx`, calcule o lucro em tempo real (offline-first):
1.  **Custo Acumulado:** `(qtdInicial * custoPintinho) + (totalRacaoAcumulada * custoRacaoKg)`.
    *(Obtenha `custoPintinho`, `custoRacaoKg` e `precoVendaEstimado` a partir de `loteAtual.financeiro`)*.
2.  **Receita Estimada (Corte):** `(avesAtivas * pesoMedioEstimadoKg) * precoVendaEstimado`. (Obs: Se `aptidao === 'postura'`, mude a lógica ou exiba algo mais genérico caso precise simplificar).
3.  **Lucro/Prejuízo:** `Receita Estimada - Custo Acumulado`.
Crie um bloco Glassmorphism no Dashboard (abaixo dos KPIs Zootécnicos) exibindo esses 3 valores. O card de Lucro/Prejuízo deve mudar de estilo (vermelho/laranja para prejuízo, verde reluzente quando atingir o Break-even positivo).

**P (Padrão de Output):**
Edite o arquivo diretamente e mantenha o rigor do Glassmorphism: painéis `glass-panel`, com blur e transparências limpas, sem cores chapadas. O código deve ser à prova de falhas (se os dados financeiros não existirem no lote antigo, renderize algo como "Dados Financeiros não configurados", com um botão para editar o lote).

**C (Cenários de Teste):**
1. O usuário é peão: Ele vê o painel ou escondemos dele? Ocultar o painel financeiro caso `papelUsuario === 'peao'`.
2. Dados vazios (Undefined): Trate propriedades `loteAtual.financeiro` inexistentes elegantemente, sem quebrar a tela branca.

**Arquivos a Marcar na Contextualização:**
- `@DashboardReal.jsx`
- `@sprint_14_planning.md`
