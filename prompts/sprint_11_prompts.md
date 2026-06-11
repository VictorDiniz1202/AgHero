# 🛠️ Prompt para o Claude: Sprint 11 (Aptidão Corte vs. Postura & Linha de Eficiência)

Você deve instruir o Claude a implementar a lógica do dashboard adaptativo para Postura (Ovos) vs. Corte (Carne), o calculador de KPIs de postura, a linha do tempo inteligente de eficiência e o aviso de pesagem pendente. Copie o prompt abaixo e envie para o Claude:

---

## 📝 Prompt de Execução (Copie e cole no chat do Claude)

### 1. P (Persona & Contexto)
Você é um Engenheiro Frontend Sênior e Especialista em Experiência do Usuário (UX/UI) com expertise em React, Tailwind CSS (v4) e modelagem de dados zootécnicos. Sua missão é customizar o dashboard de visualização do lote para suportar dinamicamente a aptidão de **Corte (Carne)** ou **Postura (Ovos)**, implementar a barra visual de eficiência com base nas tabelas zootécnicas e alertar o produtor sobre pesagens em atraso.

### 2. R (Requisitos de Negócio)

#### A. Painel de KPIs Adaptativo (`src/components/DashboardReal.jsx`)
O dashboard do lote selecionado deve mudar dinamicamente de acordo com o campo `aptidao` do lote (`"corte"` ou `"postura"`):
*   **Se for Lote de Corte:**
    *   Exibir os KPIs zootécnicos clássicos de corte: **CA** (Conversão Alimentar), **GMD** (Ganho Médio Diário), **IEP** (Índice de Eficiência Produtiva) e **Desvio de Peso vs Cobb 500**.
*   **Se for Lote de Postura:**
    *   Substituir os cards de KPIs zootécnicos de corte pelas seguintes métricas de ovos:
        1.  **% de Postura Diária:** Calculado como: `(ovos_comerciais do último registro / aves_ativas do último registro) * 100`. Exibir o valor percentual (ex: `88.5%`).
        2.  **Conversão Alimentar por Dúzia de Ovos (CA/Dúzia):** Calculado como: `ração_total_kg_acumulada / (ovos_comerciais_total_acumulados / 12)`. Indica quantos quilos de ração foram gastos para produzir uma dúzia de ovos.
        3.  **Total de Ovos Coletados:** Exibir o volume total acumulado de ovos coletados no lote, indicando de forma explícita quantos foram Comerciais vs. Descartados.
        4.  **Desvio vs Curva Guia Lohmann:** Comparar a porcentagem de postura real da última semana com a curva padrão de produção Lohmann por idade semanal.
*   **Segurança / Fallback:** Caso a aptidão do lote não esteja definida, assumir `"corte"` por compatibilidade reversa.

#### B. Linha de Eficiência Inteligente (`src/components/DashboardReal.jsx`)
Aprimore o componente de linha do tempo de marcos na parte inferior do painel para refletir a idade do lote e indicar a eficiência produtiva:
*   **Ciclo de Produção Adaptativo:**
    *   **Lotes de Corte:** Ciclo curto (dias). Exibir marcos de dias: *Alojamento* (Dia 1), *Aquecimento* (Dias 1-7), *Transição de Ração* (Dias 8-14), *Engorda* (Dias 15-42), *Pré-abate* (Dias 43-48) e *Abate* (Dia 49).
    *   **Lotes de Postura:** Ciclo longo (semanas). Exibir marcos semanais: *Cria* (Semanas 1-5), *Recria* (Semanas 6-17), *Produção* (Semana 18+), e *Descarte* (Semanas 80-90).
*   **Cor Dinâmica da Linha (Código de Cores):**
    *   **Verde (Ideal):** Peso médio (para corte) ou % de Postura (para postura) dentro da média esperada da linhagem (desvio superior ou igual a -5%).
    *   **Laranja (Atenção):** Desvio de peso ou de postura em relação às tabelas oficiais entre -5% e -12%, ou queda de consumo de água/ração menor de 3 dias.
    *   **Vermelho (Alerta Crítico):** Desvio superior a -12% OU mortalidade diária acumulada acima do limite de alerta.
*   **Dicas de Manejo Técnico:**
    *   Ao passar o mouse ou clicar em um marco da linha do tempo, exibir uma dica ou recomendação técnica sobre o manejo ideal para aquele momento (ex: "Semana 3: Temperatura ideal do galpão entre 24-26°C. Checar ventilação mínima").

#### C. Lembretes e Laranja Alert de Pesagem Pendente (`src/components/DashboardReal.jsx`)
*   Se a frequência de pesagem configurada para o lote (`frequencia_pesagem`) for atingida (por exemplo, a cada 7 dias de idade de ciclo) e não houver um peso médio registrado no banco de dados na data correspondente, exiba um alerta em destaque na UI:
    *   *Mensagem:* `"⚖️ Pesagem pendente para o ciclo atual! Registre o peso médio das aves para atualizar os índices zootécnicos de eficiência."*

---

### 3. E (Especificações Técnicas e Metodologias)
Para manter o padrão tecnológico do projeto, obedeça rigorosamente a:
1.  **Walkthrough:** Não edite o arquivo `walkthrough.md`. Retorne um resumo detalhado e legível de suas modificações ao final do chat para que o Gemini possa logs no walkthrough oficial.
2.  **Offline-first:** Toda persistência e exibição de dados devem respeitar o cache local offline (Optimistic UI).
3.  **Visual Premium:** Manter o Light Glassmorphic Theme (fundo translúcido, bordas brancas, desfoque de fundo e as cores `#10B981` e `#84CC16` para realces de IA).

---

### 4. P (Padrão de Output)
Forneça os códigos revisados e o resumo das alterações de forma direta e estruturada.

---

### 5. Arquivos a Marcar no Workspace
*   `@src/components/DashboardReal.jsx`
