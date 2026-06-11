# Arquitetura do Frontend: AgTech

Este documento consolida as diretrizes técnicas e de design aplicadas no frontend da AgTech. É fundamental para o onboarding de novos programadores (humanos ou IAs).

## 1. Filosofia de Design: Premium Light Glassmorphism
O visual da AgTech segue o conceito **Premium Light Glassmorphism**, projetado para transmitir inovação (SaaS moderno) sem perder a robustez necessária para o agronegócio.
*   **Cores Base:** Off-white (`#F9FAFB`) como fundo principal e Verde Floresta (`#1B4332` / `#081C15`) para contrastes profundos.
*   **Cores de Destaque:** Verde Esmeralda (`#10B981`) e Limão (`#84CC16`) para botões, glows e indicações de IA.
*   **Glassmorphism (Efeito Vidro):** Usamos extensivamente fundos semitransparentes com desfoque traseiro (backdrop-blur) sobre fundos com brilho orgânico (organic blobs).
    *   *Classe Utilitária:* `.glass-panel` (definida no `index.css`).
    *   *Exemplo Tailwind:* `bg-white/60 backdrop-blur-md border border-white/80 shadow-sm`.

## 2. Estrutura da Landing Page (Single-Page Scroll)
Em vez de separar a página de marketing em múltiplas rotas baseadas em cliques ("Funcionalidades", "Planos", "Sobre"), adotamos uma **Landing Page de Rolagem Contínua (Single-Page Vertical Scroll)**.
*   Isso maximiza a conversão e aplica fluidez na narrativa.
*   A `Navbar` utiliza a rolagem suave baseada em `id` HTML (`#planos`, `#sobre`), injetando a função nativa `scrollIntoView({ behavior: 'smooth' })`.

## 3. Animações Nativas de Revelação (Zero-Dependency)
Para evitar o inchaço do pacote com bibliotecas pesadas de animação (como GSAP) no ecossistema de campo, as animações ao rolar a página utilizam o **IntersectionObserver** nativo do navegador.
*   **Como funciona:** Qualquer elemento marcado com a classe `.reveal` começa invisível (`opacity: 0`, `translateY(20px)`). Quando o elemento cruza o limite do viewport, um script React injeta a classe `.reveal-visible`, disparando uma transição de CSS suave de 900ms.
*   **Escalabilidade:** O hook `useIntersectionObserver` interno aplica delays automáticos (staggering) se múltiplos elementos entrarem na tela simultaneamente.

## 4. Entrada no Sistema (Smooth System Access)
Quando o usuário clica em "Acessar Sistema", o estado da aplicação desmonta a landing page e monta a estrutura real (`DashboardReal`).
*   **Animação:** Um efeito nativo de transição da esquerda para a direita foi criado para transmitir velocidade. Essa classe (`system-enter`) é gerenciada via animações CSS (`@keyframes slide-in-right`) com easing agressivo.

## 5. Estratégia "Field-Ready" (Pronto para o Campo)
A aplicação foca estritamente em **Offline-First**. O frontend otimista executa e salva inputs de formulário localmente via Firebase SDK (IndexedDB cache) de maneira síncrona. 
*   **Regra de Ouro UI:** Jamais use "loaders bloqueantes" (spinners em tela cheia) ao salvar dados de manejo. Sempre aplique *Optimistic UI* atualizando o gráfico/lista primeiro.

## 6. Referências de Componentização
A arquitetura visual moderna foi derivada e inspirada na conversão de layouts premium B2B SaaS (estilo Pulsedesk e Nexus), combinando painéis "Bento Box" com tipografia clean e interfaces de alto contraste para o sol (botões > 48px).
