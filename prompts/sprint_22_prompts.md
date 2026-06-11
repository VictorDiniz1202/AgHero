# Prompt para o Claude - Sprint 22: Multi-farm Scale & Permissões Customizadas (Sub-sprint 22.2)

Olá, Claude! O Antigravity já preparou todo o backend e as regras de segurança no Firestore para o controle de acesso de múltiplos usuários (Sub-sprint 22.1). Agora é sua vez de implementar a camada visual, a tela de gestão de equipe e as restrições de navegação na interface.

---

### 📅 Escopo de Trabalho (Sub-sprint 22.2)

#### 1. Gestão de Equipe (Configuracoes.jsx)
*   Na tela de **Configurações** (acessível apenas por `owner`), adicione uma nova seção premium com visual Glassmorphism intitulada **"Gestão da Equipe"**.
*   **Listagem de Membros:**
    *   Consuma a função `obterColaboradores(id_fazenda)` (já exportada em `services.js`) para carregar a lista de colaboradores ativos e convites pendentes.
    *   Exiba os membros com seus nomes, e-mails, badges coloridos indicando o cargo (`Proprietário`, `Veterinário`, `Operador`) e o status do vínculo (se `uid` for nulo, exiba um badge âmbar escrito *"Pendente - Aguardando Primeiro Acesso"*, se ativo exiba um badge esmeralda *"Ativo"*).
    *   Adicione um botão de lixeira (exclusão) ao lado de cada colaborador. Ao clicar, exiba um modal de confirmação e chame `removerColaborador(colabId)` para removê-lo.
*   **Adicionar Novo Colaborador (Convite):**
    *   Crie um botão ou formulário embutido *"Adicionar Membro"*.
    *   Campos do Formulário:
        1.  **Nome Completo** (Input de texto).
        2.  **E-mail** (Input de e-mail).
        3.  **Cargo/Permissão** (Select com as opções: `Dono (Acesso Total)`, `Veterinário (Acesso a Manejos & Sanidade)`, `Operador de Galpão (Apenas Manejo Diário)`).
    *   Ao salvar, valide os campos e chame `adicionarColaborador(id_fazenda, email, role, nome)` (onde role é `'owner'`, `'veterinarian'` ou `'operator'`). Limpe o formulário e atualize a listagem local.

#### 2. Restrição de Navegação & Sidebar (SidebarMenu.jsx & AgHero.jsx)
*   **Papéis do Usuário:** Os cargos no sistema agora são `'owner'` (antigo dono), `'veterinarian'` e `'operator'` (antigo peão).
*   **Atualização na Sidebar (`SidebarMenu.jsx`):**
    *   Oculte as abas financeiras e BI com base na role:
        *   `operator`: visualiza **apenas** *Dashboard*, *Calendário*, *Manejo Sanitário* e *Consumo de Água/Alimento*. Ocultar completamente *Gestão Financeira* e *Assistente IA (Central BI)*.
        *   `veterinarian`: visualiza tudo, **exceto** *Gestão Financeira*.
        *   `owner`: visualiza tudo.
*   **Trava de Rota em `AgHero.jsx`:**
    *   Atualize a resolução de fazenda para ler o campo normalizado de role (o Antigravity atualizou `obterFazendaDoUsuario(uid)` para retornar a role de forma transparente).
    *   Garanta que se um usuário com papel `operator` tentar acessar a tela de configurações ou finanças (seja por um clique acidental ou alteração de estado), a aplicação o redirecione imediatamente para o `"dashboard"`.

#### 3. Compatibilidade e Refatorações Visuais
*   Aproveite para varrer os componentes e atualizar as verificações legadas de cargo:
    *   Onde havia `papelUsuario === 'dono'`, atualize para suportar `owner` (`papelUsuario === 'dono' || papelUsuario === 'owner'`).
    *   Onde havia `papelUsuario === 'peao'`, atualize para suportar `operator` (`papelUsuario === 'peao' || papelUsuario === 'operator'`).
*   No modal de registro diário e gráficos, certifique-se de que nada quebre e que a interface permaneça com a estética premium Glassmorphism estabelecida.

Boa sorte! Avise quando terminar de ajustar a UI.
