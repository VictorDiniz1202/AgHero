# Sprint 25: Polimento Final, Onboarding Automático e Release Candidate

Esta é a Sprint final focada no polimento da experiência do usuário (UX), implementação do tutorial de "Primeiros Passos" e checagem final de performance para o lançamento do AgTech Hero v2.0.

## Visão Geral da Sprint
- **Objetivo:** Garantir uma primeira experiência perfeita para novos usuários, remover atritos e garantir que o PWA está 100% liso e sem gargalos.
- **Divisão:** 25.1 (Backend/Storage para Tutorial) e 25.2 (Frontend UI, Onboarding e Animações).

---

## Prompt 1: Sub-sprint 25.1 - Backend & Lógica de Onboarding (Antigravity)
**Instruções para o Agente Backend (Você):**
1. Atualize as `firestore.rules` (se necessário) para suportar uma flag no documento do usuário: `onboarding_concluido`.
2. Em `src/firebase/services.js`, crie as funções `verificarStatusOnboarding(uid)` e `concluirOnboarding(uid)` para ler e gravar essa flag de forma persistente.
3. Garanta que, ao criar um novo usuário no sistema, essa flag seja inicializada como `false` e só passe para `true` após ele completar o passo a passo.
4. Teste as lógicas chamando as funções em mock para validar o comportamento de leitura.

---

## Prompt 2: Sub-sprint 25.2 - Frontend Onboarding & Polimento UI (Claude Sonnet 4.6)
**Instruções para o Agente Frontend (Claude Sonnet 4.6):**
Execute as tarefas da Sub-sprint 25.2 assumindo seu papel de Especialista React+Tailwind:

1. **Tour Guiado Inicial (Onboarding.jsx):**
   - Crie o componente `src/components/Onboarding.jsx`. Ele deve ser um overlay modal que inicia automaticamente caso `onboarding_concluido` seja `false`.
   - Adicione 3 "telas" no carrossel do onboarding (Dica: utilize a estética Glassmorphism com animações suaves).
     * **Tela 1:** Bem-vindo! (Explicar os benefícios do app offline).
     * **Tela 2:** Aponte para onde cria um lote e registra manejos.
     * **Tela 3:** Como ver os alertas meteorológicos e Zootécnicos.
   - Adicione o botão "Vamos começar!" na última tela, que chama `concluirOnboarding(uid)` e fecha o modal.
2. **Integração no AgHero:**
   - Injete a checagem no `AgHero.jsx` para que, após o login, o componente `Onboarding` surja acima do Dashboard apenas na primeira vez.
3. **Polimento Visual Final:**
   - Verifique em `index.css` e aplique micro-transições em botões que ainda não tenham `hover:scale-105` ou `transition-all`.
   - Remova quaisquer console.logs esquecidos durante as Sprints anteriores que possam vazar dados de debug em produção.

Avise-me detalhadamente quando concluir a implementação para rodarmos o build final!
