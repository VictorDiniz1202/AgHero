# 📋 Guia de Engenharia de Frontend: Sprint 23 (Faturamento e Checkout Real) - REFINADO

Você é um Engenheiro Frontend Sênior React + Tailwind CSS v4. Sua tarefa é implementar as modificações da Sprint 23, que conecta o fluxo de upgrade para o **Plano Inteligente** através de um gateway de pagamento (Stripe/Asaas) e gerencia as faturas sob a estética Premium Glassmorphism.

Anexe/marque estes arquivos locais no chat do Claude:
*   [Configuracoes.jsx](file:///c:/Computaçao/AgTech/agtech-hero/src/components/Configuracoes.jsx)
*   [ModalUpsell.jsx](file:///c:/Computaçao/AgTech/agtech-hero/src/components/ModalUpsell.jsx)
*   [services.js](file:///c:/Computaçao/AgTech/agtech-hero/src/firebase/services.js)
*   [DashboardReal.jsx](file:///c:/Computaçao/AgTech/agtech-hero/src/components/DashboardReal.jsx)
*   [AgHero.jsx](file:///c:/Computaçao/AgTech/agtech-hero/src/AgHero.jsx)

---

## 🤖 Prompt Detalhado & Refinado (Claude)

```markdown
Você é um Engenheiro Frontend Sênior React + Tailwind CSS v4. Sua missão é implementar a interface de Checkout Real, o Painel de Faturamento nas Configurações e o desbloqueio dinâmico dos recursos premium no AgTech Hero.

Siga rigorosamente as diretrizes abaixo de UI, lógica, resiliência offline e tratamento de erros.

---

### 1. IMPLEMENTAÇÃO DE SERVIÇOS FICTÍCIOS / WEBHOOK SANDBOX (services.js)
Antes de construir a UI, certifique-se de que [services.js](file:///c:/Computaçao/AgTech/agtech-hero/src/firebase/services.js) fornece as assinaturas de funções corretas. Caso os endpoints de cloud function ou gateway real não existam no Firestore local, implemente o comportamento mock/sandbox abaixo para testes locais:

```javascript
/**
 * Simula a criação de uma sessão de checkout Stripe/Asaas
 */
export async function criarSessaoCheckout(id_fazenda, uid_usuario) {
  // Simula latência de rede
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  // Em produção, isso bateria em uma Cloud Function para obter a URL real do Stripe/Asaas
  // Para testes locais, retornamos uma URL simulada que altera o plano no Firestore após 3 segundos
  const urlSandbox = `https://checkout.stripe.com/pay/sandbox_${id_fazenda}`;
  console.log(`[Billing Sandbox] Sessão gerada para fazenda ${id_fazenda}. Redirecionando para ${urlSandbox}`);
  
  return {
    url: urlSandbox,
    id_sessao: `sess_${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * Retorna dados fictícios de faturamento baseados no plano da fazenda
 */
export async function obterStatusFaturamento(id_fazenda, planoAtual) {
  if (planoAtual !== 'Inteligente') {
    return {
      plano: 'Essencial',
      valor: 40.00,
      renovacao: null,
      metodoPagamento: null,
      recibos: []
    };
  }
  
  return {
    plano: 'Inteligente',
    valor: 110.00,
    renovacao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    metodoPagamento: 'Cartão de Crédito (Visa **** 4242)',
    recibos: [
      { id: 'inv_01', data: '10/05/2026', valor: 110.00, status: 'pago' },
      { id: 'inv_02', data: '10/04/2026', valor: 110.00, status: 'pago' }
    ]
  };
}
```

---

### 2. PAINEL DE FATURAMENTO & PLANOS (Configuracoes.jsx)
Crie uma nova aba de navegação lateral ou superior chamada **"Plano & Faturamento"** na tela de [Configuracoes.jsx](file:///c:/Computaçao/AgTech/agtech-hero/src/components/Configuracoes.jsx).

*   **Controle de Permissão:** Esta aba deve ser visível **exclusivamente** para usuários cuja role de colaborador seja `owner` (Dono). Operadores (`operator`) ou veterinários (`veterinarian`) não devem ver esta aba e, caso tentem acessar via URL/Rotas forçadas, mostre uma mensagem de erro ("Acesso Restrito: Apenas proprietários podem gerenciar faturamento").
*   **Aparência Estética:**
    - Utilize um layout de duas colunas no desktop (ou coluna única flexível no mobile).
    - O card de status do plano atual deve ser um `.glass-panel` elegante, com fundo translúcido e bordas brancas, exibindo o status do plano em destaque.
    - Se plano for `Inteligente`: Badge em gradiente de Verde Esmeralda para Azul Teal, com efeito pulso.
    - Se plano for `Essencial`: Badge cinza neutra, mostrando que está na licença de entrada.
*   **Fluxo de Upgrade (Plano Essencial):**
    - Exiba um card promocional detalhando os benefícios do upgrade:
      * 🚨 *Alertas Sanitários Instantâneos via WhatsApp* (notificação imediata de mortalidade e queda de ingestão).
      * 🌡️ *Monitoramento do Índice de Estresse Térmico (ITU)* preditivo de 3 dias.
      * 📊 *Central BI Completa* com análises de especialistas de IA.
    - Adicione um botão de ação com tamanho confortável (altura >= 48px), estilizado com `bg-gradient-to-r from-vivid-emerald to-vivid-lime hover:scale-105 transition-all text-white font-bold rounded-xl shadow-lg`.
*   **Gerenciamento do Plano Ativo (Plano Inteligente):**
    - Exiba informações sobre a renovação (ex: "Próxima cobrança em DD/MM/AAAA").
    - Adicione a tabela de Recibos/Histórico de Transações, permitindo simular o download do PDF clicando em um ícone de PDF.
    - Adicione o botão "Gerenciar Assinatura" que redirecionaria para o Customer Portal.

---

### 3. REDIRECIONAMENTO E FLUXO DE UPGRADE NO MODALUPSELL (ModalUpsell.jsx)
Modifique o [ModalUpsell.jsx](file:///c:/Computaçao/AgTech/agtech-hero/src/components/ModalUpsell.jsx) para tornar a conversão interativa:

1.  **Estado de Carregamento:** Ao clicar no botão "Falar com Consultor" (renomeie para "Ativar Plano Inteligente"), altere o estado do botão para `desabilitado` e exiba o texto *"Acessando Checkout Seguro..."* com um spinner animado de SVG.
2.  **Disparo do Checkout:** Chame a função `criarSessaoCheckout(id_fazenda, auth.currentUser.uid)`.
3.  **Redirecionamento:**
    - Em produção: Use `window.location.href = sessao.url` para redirecionar para a página do Stripe/Asaas.
    - Em desenvolvimento/sandbox: Exiba um modal overlay temporário contendo:
      * *"Simulador de Gateway de Pagamento"*
      * *"Aguardando confirmação do pagamento fictício..."*
      * Adicione um botão *"Confirmar Pagamento Simulado"* que atualize o plano da fazenda para `Inteligente` no Firestore e feche o modal, dando feedback instantâneo de sucesso para o usuário.

---

### 4. RESILIÊNCIA OFFLINE E TRATAMENTO DE ERROS
*   **Tratamento de Estado Offline:**
    - Se o navegador estiver offline (verifique via `navigator.onLine`), desabilite o botão de upgrade e exiba uma badge de alerta amarela: *"⚠️ Conexão de internet necessária para realizar transações financeiras."*
-   **Tratamento de Erros:**
    - Envolva as chamadas de rede em blocos `try/catch`.
    - Se a criação da sessão de checkout falhar por problemas de permissão (Firestore rules) ou rede, exiba um banner de erro vermelho no topo do modal por 4 segundos e reabilite o botão para que o usuário possa tentar novamente.

---

### 5. SINCRONIZAÇÃO DINÂMICA DE RECURSOS (DashboardReal.jsx & AgHero.jsx)
*   **Sem Trava Estática:** No [DashboardReal.jsx](file:///c:/Computaçao/AgTech/agtech-hero/src/components/DashboardReal.jsx), certifique-se de que a leitura do plano é obtida de forma reativa a partir do documento da fazenda (`fazenda.plano`). 
*   **Atualização Imediata:** Assim que o plano mudar para `Inteligente`, o listener do Firestore em `AgHero.jsx`/`DashboardReal.jsx` deve propagar o estado e:
    - Ocultar imediatamente todos os banners vermelhos de lock-in de anomalia.
    - Habilitar o acesso aos painéis preditivos e análises completas sem recarregar a página.
```
