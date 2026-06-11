# 🛠️ Prompt para o Claude: Sprint 10 (Perfis de Acesso, Segurança no Firestore e Refinamentos de SVG/BI)

Você deve instruir o Claude a implementar a lógica de controle de acesso (Roles & Permissions) para Dono vs. Peão, a criação e validação das regras de segurança no Firestore (`firestore.rules`) e os ajustes visuais nos gráficos SVG da Central de BI. Copie o prompt abaixo e envie para o Claude:

---

## 📝 Prompt de Execução (Copie e cole no chat do Claude)

### 1. P (Persona & Contexto)
Você é um Engenheiro Frontend e de Segurança Sênior especializado em React, Tailwind CSS (v4) e regras de segurança do Firebase (Firestore Security Rules). Sua missão é implementar o controle de acesso baseado em papéis (RBAC) para diferenciar **Dono** de **Peão**, blindar o banco de dados no Firestore e garantir que os gráficos SVG vindos do n8n sejam perfeitamente responsivos e integrados ao visual glassmorphism.

### 2. R (Requisitos de Negócio)

#### A. Controle de Papéis (Dono vs. Peão)
O aplicativo AgTech Hero precisa limitar as ações executadas por funcionários temporários ou peões de campo para proteger as configurações e dados estratégicos da fazenda:
* **Identificação do Papel:** Ao carregar a fazenda ativa em `AgHero.jsx`, busque o papel do usuário logado atual (`auth.currentUser.uid`) dentro do mapa `membros` do documento da fazenda. O formato é `membros: { "UID_DO_USUARIO": "dono" | "peao" }`.
* **Restrição na Navegação:**
  * Se o usuário atual for `"peao"`, oculte o botão/link para a view de **Configurações** na barra lateral/navegação do `DashboardReal.jsx`.
  * Se o usuário tentar acessar a URL ou forçar o estado para `"configuracoes"`, redirecione-o de volta para o `"dashboard"`.
* **Restrição na Gestão de Lotes (`src/components/GestaoLotes.jsx`):**
  * O peão pode visualizar os lotes e o histórico de lotes.
  * O peão **não pode** cadastrar novos lotes e **não pode** encerrar lotes ativos (o botão "Encerrar Lote" deve ser ocultado ou desabilitado, exibindo um aviso sutil: *"Apenas proprietários podem encerrar lotes"*).

#### B. Regras de Segurança no Firestore (`firestore.rules`)
Atualize o arquivo `firestore.rules` na raiz do projeto para impor segurança real:
* **Regras para Fazendas:**
  * Leitura permitida para qualquer usuário autenticado que faça parte do mapa `membros` da fazenda: `request.auth != null && resource.data.membros[request.auth.uid] != null`.
  * Escrita nas configurações da fazenda (alertas, membros, etc.) permitida **apenas** se o usuário logado for `"dono"` no mapa membros: `resource.data.membros[request.auth.uid] == 'dono'`.
* **Regras para Lotes:**
  * Leitura permitida para membros da fazenda.
  * Criação ou modificação de status de lote (como alterar para `encerrado`) permitida **apenas** para quem é `"dono"` na fazenda pai.
* **Regras para Registros Diários e Sanidade:**
  * Leitura e escrita (criação) liberada para qualquer membro autenticado (`dono` ou `peao`), permitindo que o trabalhador insira os manejos diários no galpão de forma offline.

#### C. Refinamentos Visuais dos Gráficos SVG na Central de BI (`src/components/CentralBI.jsx`)
* Melhore o container onde as respostas em SVG do n8n são injetadas (geralmente via `dangerouslySetInnerHTML`).
* Certifique-se de que os SVGs usem `width="100%"` e `height="auto"`, e contenham atributos `viewBox` para que escalem fluidamente em smartphones, sem quebrar o layout lateral do chat.
* Aplique estilos CSS específicos para integrar o visual do gráfico ao tema light glassmorphism do app (cores harmoniosas, cantos arredondados, contrastes adequados).

---

### 3. E (Especificações Técnicas e Metodologias)

Para manter a conformidade com as diretrizes do AgTech Hero, siga rigorosamente as metodologias abaixo:
1. **Atualização de Progresso:** Você não precisa atualizar o arquivo `walkthrough.md` diretamente. Ao finalizar sua sub-sprint, forneça um resumo claro, estruturado e detalhado de todas as alterações feitas nesta sua resposta final para que o Gemini (Antigravity) possa consolidar essas informações e atualizar o `walkthrough.md` oficial nos artefatos.
2. **Escritas Offline-First:** Conforme o padrão do projeto, todas as chamadas de escrita ao Firestore (como `salvarRegistroDiario` ou `salvarRegistroSanitario`) não devem ser bloqueadas com `await` para o sucesso do servidor. Elas devem ser otimistas e gravar no cache local imediatamente.
3. **Estética Visual Premium:** Mantenha os padrões estéticos acordados: cores da paleta (Vivid Emerald, Forest, Offwhite), fontes (Outfit para títulos, Inter para textos), cantos arredondados (`rounded-2xl` / `rounded-3xl`), sombras suaves e efeito glassmorphic (`glass-panel`).

---

### 4. P (Padrão de Output)
Retorne a implementação revisada dos componentes e as regras do Firestore atualizadas, fornecendo o resumo para consolidação do walkthrough.

---

### 5. Arquivos a Marcar no Workspace
* `@src/AgHero.jsx`
* `@src/components/GestaoLotes.jsx`
* `@src/components/CentralBI.jsx`
* `@firestore.rules`
