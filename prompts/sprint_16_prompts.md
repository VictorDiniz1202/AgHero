# Prompts da Sprint 16 (Sub-sprint 16.2 - Claude)

Copie e cole o prompt abaixo para o Claude iniciar o desenvolvimento dos Dashboards de Nutrição e Água, bem como a navegação e regras de limites.

---

```markdown
Você é a IA Frontend encarregada de implementar a Sub-sprint 16.2: Painéis de Nutrição e Água do AgTech Hero.

### 1. PROPÓSITO (Purpose)
Atualmente, o AgTech Hero centraliza todas as informações no `DashboardReal.jsx`, que está no limite de sua capacidade visual. Para acomodar novas métricas críticas e gerar valor comercial real para o produtor avícola, precisamos separar a gestão de Estoque/Nutrição (Silo Preditivo) e Monitoramento de Água (Reserva Hidráulica e Relação Água/Ração) em dois dashboards dedicados e independentes. Também precisamos implementar limites de uso da IA (Central de BI) baseados no plano da fazenda (Standard/Essencial vs Premium/Inteligente).

### 2. REQUISITOS (Requirements)
#### A. Dashboard de Nutrição & Silos (`src/components/DashboardNutricao.jsx`)
*   **Silo Virtual (Visual Premium):** Um card com uma representação visual elegante de um silo de ração (utilizando gradientes CSS e bordas em vidro do Glassmorphism). O nível de preenchimento deve refletir a porcentagem do estoque restante em relação à capacidade máxima (ex: 15.000 kg).
*   **Runway Preditivo:** Exibir em destaque a autonomia restante do silo em dias (ex: "5.4 dias restantes") e calcular/exibir a data estimada em que o silo esvaziará (ex: "Data prevista: 18/06/2026").
*   **Alerta de Estoque Crítico:** Piscar o silo em vermelho/laranja se a autonomia for inferior a 3 dias.
*   **Registrar Nova Carga:** Um botão que abre um modal simples para lançar o abastecimento do silo (campos: Quantidade em kg e Data). Ao salvar, chama a função de serviço do Firebase para persistir e atualiza o estado local.
*   **Componente de Relação Água/Ração:** Integrar uma visão comparativa do consumo do lote, exibindo a Conversão Alimentar (CA) acumulada.

#### B. Dashboard de Água (`src/components/DashboardAgua.jsx`)
*   **Consumo Hídrico:** Exibir consumo diário de água (litros/ave/dia) e comparar com o padrão de conforto térmico.
*   **Reserva Central de Água:** Exibir a autonomia do reservatório de água central da fazenda em horas ou dias (ex: "Em caso de pane na bomba, você possui 36 horas de água restantes para este lote").
*   **Relação Água/Ração (Fator de Ouro):** Exibir um medidor deslizante com a relação calculada (Litros de Água / kg de Ração).
    *   *Relação Ideal:* entre 1.8 e 2.2 (indicar em Verde).
    *   *Relação Baixa (< 1.8):* Indicar em Amarelo/Laranja ("Alerta: Risco de desidratação, bico entupido ou frio").
    *   *Relação Alta (> 2.2):* Indicar em Vermelho ("Alerta: Risco de vazamento de bico ou estresse térmico por calor extremo").
*   **Nipples Status:** Um card indicando se o fluxo está normal ou se há anomalias no sistema hidráulico de bicos.

#### C. Fluxo de Navegação & Roteamento (`src/AgHero.jsx`)
*   Adicionar as duas novas telas (`nutricao` e `agua`) ao seletor de rotas em `AgHero.jsx`.
*   Importar e renderizar os novos componentes passando as props de integração.

#### D. Atualização da Sidebar e Menus
*   Atualizar a sidebar em `DashboardReal.jsx`, `CentralBI.jsx`, `DashboardNutricao.jsx` e `DashboardAgua.jsx` para incluir os novos links com ícones consistentes (Nutrição & Silo, Consumo de Água).
*   Manter a sidebar idêntica em todas as páginas para manter a consistência de navegação.

#### E. Regra de Limites da Central de BI (`src/components/CentralBI.jsx`)
*   Limitar as consultas de IA para usuários com plano "Essencial" (Standard) a no máximo 3 requisições por dia.
*   Ao atingir o limite de 3 envios no dia, desabilitar o input de digitação e exibir uma mensagem chamando para o upgrade, abrindo o `ModalUpsell` ao clicar.

### 3. CONTEXTO EXISTENTE (Existing Context)
Os motores de cálculo no backend já foram criados/preparados nas seguintes localizações:
*   [siloPreditivo.js](file:///c:/Computa%C3%A7ao/AgTech/agtech-hero/src/utils/siloPreditivo.js) -> funções de cálculo de Runway e nível do silo.
*   [aguaPreditiva.js](file:///c:/Computa%C3%A7ao/AgTech/agtech-hero/src/utils/aguaPreditiva.js) -> funções de cálculo de reserva de água e relação água/ração.
*   [services.js](file:///c:/Computa%C3%A7ao/AgTech/agtech-hero/src/firebase/services.js) -> persistência no Firestore.

Use as seguintes classes de Glassmorphism e tema definidas em `index.css`:
*   `glass-panel` para os painéis principais.
*   Cores: `text-forest-dark`, `text-forest-light`, `bg-vivid-emerald`, `bg-vivid-lime`, `text-agriAlert-red`, `text-agriAlert-orange`.

### 4. PARÂMETROS E RESTRIÇÕES (Parameters & Constraints)
*   **Não remova comentários** que não pertençam às suas alterações.
*   **Não utilize TailwindCSS puro para tudo se quebrar a consistência**. Siga o padrão estético de glassmorphism premium do restante do aplicativo (vibrante, limpo, moderno).
*   **Mantenha o offline-first:** Se o Firestore estiver inacessível ou falhar, utilize fallback local elegante (ex: dados guardados ou aviso sutil de sincronização pendente).

### 5. ARQUIVOS QUE VOCÊ IRÁ MODIFICAR E CRIAR:
*   `[NEW]` `src/components/DashboardNutricao.jsx`
*   `[NEW]` `src/components/DashboardAgua.jsx`
*   `[MODIFY]` `src/AgHero.jsx` (adicionar telas no switch de rotas)
*   `[MODIFY]` `src/components/DashboardReal.jsx` (atualizar links e ícones da sidebar)
*   `[MODIFY]` `src/components/CentralBI.jsx` (atualizar sidebar + contador de limite de IA + trava com `ModalUpsell`)
```
