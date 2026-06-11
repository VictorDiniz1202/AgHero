# 🛠️ Prompts para a Sprint 12: Notificações de Alertas IA & Integração WhatsApp (n8n)

Este arquivo divide as responsabilidades e prepara os prompts de execução para o **Gemini** (Sub-sprint 12.1) e para o **Claude** (Sub-sprint 12.2) para implementar a lógica de detecção de anomalias, envio de webhooks via n8n para o WhatsApp do produtor/veterinário e o painel de histórico de alertas na UI.

---

## 🚀 Sub-sprint 12.1: Gemini (Antigravity) - Configuração de Banco, Serviços de Log & Validação

### 📝 Prompt de Execução para o Gemini (Você mesmo na próxima etapa)

#### 1. Contexto e Objetivos
Adicionar suporte de persistência local (IndexedDB) e nuvem (Firestore) para registrar o histórico de alertas disparados pelo sistema. O banco precisa armazenar a data do alerta, o tipo de anomalia (estresse térmico, queda brusca de água, mortalidade crítica), a mensagem enviada e o status da notificação.

#### 2. Requisitos de Código (Firestore & Services)
1.  **Novas Funções de Serviços (`src/firebase/services.js`):**
    *   `salvarAlertaEnviado(id_fazenda, alertaData)`:
        *   Cria um novo documento na subcoleção `/fazendas/{id_fazenda}/alertas_enviados`.
        *   Campos a persistir:
            *   `id`: gerado automaticamente.
            *   `data_envio`: Timestamp corrente do Firestore.
            *   `id_lote`: ID do lote que disparou o alerta.
            *   `tipo_anomalia`: `"mortalidade"` | `"temperatura"` | `"agua"` | `"racao"`.
            *   `mensagem`: texto completo formatado do alerta.
            *   `valor_medido`: valor real registrado no dia.
            *   `limite_configurado`: limite configurado na época do disparo.
            *   `status_envio`: `"pendente"` | `"enviado"` | `"erro"`.
        *   Seguir o princípio **Offline-first**: disparar o `setDoc` sem `await` e tratar possíveis erros com log simples.
    *   `obterAlertasEnviados(id_fazenda, limite = 15)`:
        *   Recupera os alertas enviados de uma fazenda ordenados por `data_envio` descendente (mais recente primeiro).
2.  **Validação da Tela de Configurações (`src/components/Configuracoes.jsx`):**
    *   Garantir que as variáveis de limite de alerta (`mortalidade_critica`, `desvio_agua`, `desvio_racao`) e a lista de `contatos_autorizados` estejam sendo salvas e lidas corretamente a partir de `/fazendas/{id_fazenda}`.

---

## 🤖 Sub-sprint 12.2: Claude - Motor de Gatilhos de Alerta, Chamada de Webhook & Histórico de Notificações

### 📝 Prompt de Execução (Copie e cole no chat do Claude após a Sub-sprint 12.1)

#### 1. P (Persona & Contexto)
Você é um Engenheiro Frontend Sênior com profundo conhecimento em React, PWA offline-first, integração com APIs e design de interfaces premium (Light Glassmorphic). Sua missão é criar o motor lógico que analisa os manejos salvos pelo usuário, detecta anomalias graves comparando com as metas zootécnicas e com as configurações do produtor, dispara de forma assíncrona/não-bloqueante o webhook n8n para WhatsApp e implementa a visualização histórica de alertas.

#### 2. R (Requisitos de Negócio & Lógica)

##### A. Lógica de Detecção de Anomalias (Gatilho)
Sempre que um novo registro diário de manejo for salvo com sucesso no `FormularioManejo.jsx` (ou na função de salvamento do `AgHero.jsx`), o sistema deve rodar uma verificação em segundo plano comparando o registro com:
1.  **Mortalidade Diária Crítica:** Se `(mortalidade_qtd / aves_ativas_inicio_dia) * 100` for maior ou igual ao `mortalidade_critica` configurado na fazenda (ex: `0.15%`).
2.  **Estresse Térmico (Temperatura Crítica):** Se `temp_max` estiver acima do limite máximo ou `temp_min` abaixo do limite mínimo da linhagem correspondente do lote em `src/data/DiretrizesZootecnicas.js` (Ex: Cobb 500 limite max = 28°C).
3.  **Desvio de Consumo de Água:** Se a variação de consumo em litros em relação ao dia anterior for inferior ao limite de desvio configurado (ex: queda > `10%`).
4.  **Desvio de Consumo de Ração:** Se a variação de consumo em kg em relação ao dia anterior for inferior ao limite de desvio configurado (ex: queda > `8%`).

##### B. Disparo Não-Bloqueante do Webhook n8n
Se alguma anomalia crítica for identificada:
1.  **Chamada de Webhook:** Fazer uma requisição `POST` assíncrona (usando `fetch`) para:
    *   `https://n8n-n8n.tq2epq.easypanel.host/webhook-test/agtech-registro-diario`
2.  **Payload do POST:**
    ```json
    {
      "id_fazenda": "id_da_fazenda",
      "nome_fazenda": "Nome da Fazenda",
      "id_lote": "id_do_lote",
      "linhagem": "Linhagem do Lote",
      "idade_dias": 24, // idade calculada em dias
      "alerta": {
        "tipo": "mortalidade | temperatura | agua | racao",
        "detalhe": "Queda de 12% no consumo de água",
        "valor_medido": 2200,
        "limite_definido": 2500,
        "mensagem_gerada": "Texto explicativo gerado pela IA ou formatado pelo front"
      },
      "contatos_destino": ["+5511999998888", "+5511999997777"] // contatos autorizados
    }
    ```
3.  **Resiliência Offline:** O disparo do fetch **não pode travar** a experiência do usuário. Caso o usuário esteja sem internet, salvar a chamada em uma fila local (por exemplo, no `localStorage` com `alertas_pendentes_webhook`) para disparar assim que a conexão retornar (utilizando o evento `window.addEventListener('online')` ou verificações de rede do Firestore).
4.  **Registro de Log:** Independentemente de ter rede ou não no momento do webhook, chamar `salvarAlertaEnviado` para salvar o alerta no Firestore local (que será sincronizado com a nuvem automaticamente quando houver conexão).

##### C. Interface de Histórico de Alertas Recentes (`src/components/CentralBI.jsx` ou Painel do Lote)
1.  Adicionar um sub-painel elegante chamado **"🚨 Histórico de Alertas da IA"**.
2.  Esse componente deve renderizar uma lista dos alertas obtidos por `obterAlertasEnviados(id_fazenda)`.
3.  Cada card de alerta deve ter:
    *   Ícone colorido de acordo com o tipo (ex: 🌡️ para temperatura, 💧 para água, 💀 para mortalidade).
    *   Texto descritivo do alerta e a mensagem disparada para o WhatsApp.
    *   Badge de status: 🟢 "Enviado por WhatsApp" ou 🟠 "Aguardando conexão (Fila offline)".
    *   Data e horário legíveis do envio.

#### 3. E (Especificações Técnicas e Metodologias)
1.  **Não alterar arquivos de documentação diretamente** (ex: `walkthrough.md`). Devolver um relatório estruturado no final do chat.
2.  **Seguir o Design System:** Usar fundo glassmorphic translúcido, bordas suaves, e alertas em vermelho/laranja zootécnicos premium.
3.  **Performance:** Manter as computações de variação de consumo otimizadas em cache ou no state do lote para evitar múltiplas leituras custosas ao salvar o formulário.

#### 4. P (Padrão de Output)
Retornar os arquivos alterados com comentários claros sobre as alterações de lógica de verificação.

#### 5. Arquivos a Marcar no Workspace
*   `@src/components/FormularioManejo.jsx`
*   `@src/components/CentralBI.jsx` (ou onde for centralizado o histórico)
*   `@src/firebase/services.js` (para uso)
