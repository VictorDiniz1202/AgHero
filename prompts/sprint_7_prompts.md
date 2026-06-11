# 🛠️ Prompt 7: O Calendário de Manejo (Sprint B - Claude)

## 📌 Contexto de Execução
Você deve criar o componente `src/components/CalendarioManejo.jsx` seguindo as diretrizes de design **Premium Light Glassmorphism** e **Offline-First**. 

Antes de iniciar, marque e leia atentamente os seguintes arquivos do workspace:
* `@arquitetura_projeto_luis.md`
* `@AGTECH_STRATEGY.md`
* `@src/components/FormularioManejo.jsx` (para referência de estilo e banner de sincronização)

---

## 📝 Sub-Prompt PREP-C

### 1. P (Persona & Contexto)
Você é um Engenheiro Frontend Sênior especializado em React, Tailwind CSS (v4) e integração com Firebase. Sua missão é construir o componente de conformidade zootécnica do Agtech.

### 2. R (Requisitos de Negócio)
O dono da fazenda precisa saber se os peões estão realizando as tarefas diárias no prazo. O **Calendário de Manejo** servirá como um painel de auditoria visual de processos:
* **Visualização Mensal:** Uma grade de calendário clássica (mês atual) com opção de navegar para meses anteriores/próximos.
* **Mapa de Calor de Conformidade:** Cada dia do calendário deve refletir o status de preenchimento dos dados do lote ativo:
  * **Verde (Conforme):** Registro diário preenchido com todos os 3 indicadores cruciais maiores que zero (`agua_litros`, `racao_kg`, `mortalidade_qtd`).
  * **Amarelo (Parcial):** Registro existe, mas algum indicador crucial está vazio ou zerado (ex: peão esqueceu de pesar a ração, mas lançou água).
  * **Vermelho (Incompleto/Ausente):** Sem nenhum registro diário lançado para o dia.
* **Detalhes do Dia:** Ao clicar em um dia, abre-se uma gaveta ou modal de vidro (`glass-panel backdrop-blur-md`) listando as informações coletadas naquele dia (água, ração, mortalidade, temperaturas, observações) e uma seção de "Manejo Sanitário" (se houve registro de vacina no campo observações ou notas).
* **Entrada Retroativa:** Se o dia clicado estiver vermelho e for no passado (anterior ao dia de hoje), exiba um botão "Lançar Manejo Retroativo" (que redirecionará o usuário ou exibirá uma mensagem).

### 3. E (Especificações Técnicas)
* **Sem dependências externas pesadas:** Crie a lógica da grade de dias do calendário usando JavaScript puro (`new Date()`, cálculo de dias do mês e dias da semana iniciais). Não instale bibliotecas como `react-calendar` para evitar quebras de bundling.
* **Offline-First:** Busque os registros diários usando as funções de leitura existentes em `src/firebase/services.js` (como `obterUltimosRegistros`). As queries do Firestore resolverão instantaneamente usando a persistência local (IndexedDB).
* **Aparência:** Seguir a paleta de cores Forest do design system. Células do calendário com bordas suaves, efeitos de hover sutis e cantos arredondados (`rounded-xl`). Cores de status de conformidade:
  * Verde: `bg-agriAlert-green/10 text-agriAlert-green border-agriAlert-green/30`
  * Amarelo: `bg-agriAlert-orange/10 text-agriAlert-orange border-agriAlert-orange/30`
  * Vermelho: `bg-agriAlert-red/10 text-agriAlert-red border-agriAlert-red/30`

### 4. P (Padrão de Output)
Retorne o código completo de `src/components/CalendarioManejo.jsx` pronto para ser inserido. O componente deve aceitar as propriedades:
* `id_fazenda` (string)
* `onVoltar` (função callback para voltar ao painel principal)

### 5. C (Cenários de Teste)
* **Sem Lotes:** Trate o caso onde o usuário não tem lotes ativos cadastrados (mostre uma mensagem informativa e bloqueie o calendário).
* **Troca de Mês:** Ao avançar ou recuar o mês, a grade de dias deve atualizar síncrona e corretamente, mapeando os registros diários correspondentes sem misturar dados.
* **Data Futura:** Dias posteriores à data de hoje devem aparecer desabilitados/neutros e não devem ficar vermelhos, pois o futuro ainda não pôde ser lançado.
