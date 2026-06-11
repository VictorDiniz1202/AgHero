# Prompts para o Claude: Sprint B (Configurações, Alertas & WhatsApp)

Este documento contém o prompt estruturado sob o framework **PREP-C** (Persona, Requisitos, Especificações, Output, Cenários de Teste) para guiar o Claude no desenvolvimento do componente de Configurações da Fazenda.

---

### **Recomendações de Execução**
* **Modelo Recomendado:** Claude 3.5 Sonnet
* **Nível de Esforço:** Médio (Interface de Formulários + Integração Firebase Local-First + Validação de Campos)
* **Arquivos do Contexto a Anexar ao Claude:**
  1. `arquitetura_projeto_luis.md` (Estrutura do banco de dados)
  2. `claude.md` (Contexto visual e diretrizes)
  3. `src/index.css` (Tokens e Tailwind v4)
  4. `src/firebase/services.js` (Camada de persistência Firestore)

---

## Sub-Prompt 1: Componente de Configurações da Fazenda (`Configuracoes.jsx`)

Copie e cole o texto abaixo no Claude:

```markdown
### PERSONA & CONTEXTO (P)
Você é um desenvolvedor frontend React especialista em Tailwind CSS (v4) e integração local-first com Firebase. Estamos construindo o painel de configurações para o "Agtech", um SaaS premium de avicultura de corte/postura. O painel deve seguir estritamente o design system "Premium Light Glassmorphism" da nossa marca (fundos limpos off-white, cards translúcidos, tipografia marcante com fontes Inter e Outfit, e cores de acento vivas).

### REQUISITOS DE NEGÓCIO (R)
O produtor rural precisa gerenciar as regras de funcionamento da sua fazenda. Como a internet no campo é ruim, a gravação deve ser instantânea (offline-first) e não-bloqueante.
O componente de Configurações deve conter:
1. **Dados Gerais da Fazenda**: Permite editar o Nome da Fazenda e alternar o Tipo de Produção ("Corte" ou "Postura").
2. **Configuração de Limites de Alerta**:
   - Mortalidade Diária Crítica (%): Limite de mortes diárias que aciona o aviso visual no painel.
   - Desvio de Consumo de Água (%): Variação aceitável antes de alertar sobre queda ou estresse térmico.
   - Variação de Consumo de Ração (%): Variação aceitável em relação à média móvel de 3 dias.
3. **Contatos de WhatsApp Autorizados**:
   - Um campo para cadastrar e excluir números de WhatsApp (no formato internacional DDI + DDD + Número) que receberão mensagens automáticas do n8n em caso de anomalias detectadas.
4. **Plano de Assinatura (Lock-in/Upsell)**:
   - Exibir o plano atual do usuário ("Essencial" ou "Inteligente").
   - Se o plano for "Essencial", exibir um card premium com gradiente e efeitos de vidro promovendo o upgrade para o "Plano Inteligente" (detalhando benefícios como análises de IA explicativa e alertas diretos no celular do veterinário).

### ESPECIFICAÇÕES TÉCNICAS (E)
1. Crie o arquivo `src/components/Configuracoes.jsx`.
2. Consuma as funções do arquivo `src/firebase/services.js`:
   - Use `obterFazenda(id_fazenda)` em um `useEffect` para carregar as configurações atuais.
   - Use `atualizarFazenda(id_fazenda, dadosAtualizados)` para salvar as edições do usuário.
3. Tratamento de Estado Local & Escrita Otimista:
   - Gerencie o formulário localmente. Ao salvar, chame `atualizarFazenda` sem travar a UI (não dê `await` de rede de forma bloqueante; confie no cache offline local do Firestore que atualiza imediatamente).
   - Mostre um indicador sutil de salvamento (ex: "Configurações salvas localmente e sincronizando..." usando a cor `colors.alerta-laranja` ou `colors.alerta-verde` após confirmação).
4. Validação de Dados:
   - Números de telefone de WhatsApp devem ser formatados e validados por Regex para seguir o padrão `+5511999998888`.
   - Impedir o cadastro de números duplicados na lista de contatos.
5. Ações da Tela:
   - Botão para voltar à tela anterior (`onVoltar()`).
   - Layout dividido em Abas Limpas ou Cards Segmentados para que a experiência mobile-first seja limpa e intuitiva.

### PADRÃO DE OUTPUT (P)
O código completo e limpo de `src/components/Configuracoes.jsx` em React. Utilize apenas Tailwind CSS (v4) e os tokens configurados em `@theme` (como `.glass-panel`, `font-heading`, `text-forest-dark` e degradês vivid).

### CENÁRIOS DE TESTE (C)
1. Fazenda sem limite de alertas configurado: iniciar o formulário com placeholders e valores padrão seguros (ex: Mortalidade 0.15%, Desvio de Água 10%, Ração 8%).
2. Tentativa de adicionar número de WhatsApp inválido: exibir feedback visual de erro sem travar o estado.
3. Usuário no plano "Essencial" clica no card de Upsell: exibir um modal premium de "Fale com nosso consultor comercial para ativar a IA" ou callback equivalente.
```
