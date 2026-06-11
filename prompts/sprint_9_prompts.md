# 🛠️ Prompt para o Claude: Sprint 9 (Sanidade, Integração n8n, Corte vs. Postura & Timeline)

Você deve instruir o Claude a implementar a parte do Frontend e a lógica local do módulo de Sanidade, a conexão real com a API de BI do n8n, a diferenciação entre lotes de Corte e Postura, e a nova Linha do Tempo visual de produção. Copie o prompt abaixo e envie para o Claude:

---

## 📝 Prompt de Execução (Copie e cole no chat do Claude)

### 1. P (Persona & Contexto)
Você é um Engenheiro Frontend Sênior especializado em React, Tailwind CSS (v4) e integração com Firebase. Sua missão é implementar o Módulo de Sanidade, conectar a interface da Central de BI à API real do n8n, adaptar os fluxos do sistema para Corte vs. Postura, e criar a Linha do Tempo visual de produção no dashboard.

### 2. R (Requisitos de Negócio)

#### A. Adaptação Dinâmica: Corte (Carne) vs. Postura (Ovo)
Ao criar um lote ou visualizar o dashboard da fazenda, o sistema deve adaptar sua interface baseando-se no tipo de produção da fazenda (`tipo_producao` que pode ser "Corte" ou "Postura" obtido das configurações da fazenda):
* **Se Corte (Broilers):**
  * O dashboard exibe KPIs de GMD (Ganho Médio Diário), CA (Conversão Alimentar), IEP (Índice de Eficiência Produtiva) e Desvio Cobb 500.
  * O formulário diário de manejo foca em Água, Ração, Mortalidade, Clima e Peso Médio.
* **Se Postura (Layers):**
  * O dashboard exibe KPIs de % de Postura Diária (ovos recolhidos / aves ativas * 100), CA por Dúzia de Ovos (ração total em kg / dúzias de ovos coletados) e Viabilidade do lote.
  * O formulário de manejo diário ganha dois novos campos numéricos: `producao_ovos_qtd` (ovos comerciais) e `ovos_descarte_qtd` (ovos quebrados/sujos).

#### B. Módulo de Sanidade (`src/components/ManejoSanitario.jsx`)
* Permitir o agendamento de vacinas e registro de aplicações de vacinas e medicamentos (campos: nome, data, dosagem, via de aplicação: spray, água ou injeção).
* Checklist de sintomas observados e suspeita de doença (ex: Coriza, Newcastle).
* **Offline-First:** Persistir na subcoleção `/fazendas/{id_fazenda}/lotes/{id_lote}/sanidade`.
* **Integração no Calendário:** No modal de detalhes do dia do `CalendarioManejo.jsx`, carregar os registros de sanidade e listá-los ordenadamente.
* **Alertas no Dashboard:** Exibir banners preventivos se houver vacinas atrasadas (idade atual > idade programada de vacinação e sem registro de aplicação).

#### C. Linha do Tempo de Produção (Timeline)
* Criar um componente visual de linha do tempo na parte inferior de `DashboardReal.jsx`:
  * Para **Corte**: Uma linha de 1 a 49 dias, marcando o dia atual do lote. Muda de cor com base na eficiência (peso real comparado à curva Cobb 500): Verde (dentro de ±5% ou superior), Laranja (desvio de -5% a -12%), Vermelho (crítico: desvio > -12% ou mortalidade acumulada crítica).
  * Para **Postura**: Uma linha dividida em fases: Cria (Dia 1 a 6 sem), Recria (Sem 7 a 17) e Produção (Sem 18 a 80+), marcando a semana atual do lote.
  * Renderizar pequenos marcadores (ícones) na linha do tempo para dias/semanas contendo pesagens planejadas (⚖️) ou vacinas programadas (💉).

#### D. Planejador Flexível de Pesagens
* Nas configurações ou alojamento do lote, permitir que o usuário defina a frequência de pesagem: **Semanal (padrão)**, **Diário** ou **Personalizado** (dias específicos selecionados pelo usuário).
* Se no dia agendado o produtor não lançar a pesagem, exibir um alerta piscante em laranja na linha do tempo: *"⚖️ Pesagem pendente para o dia X. Registre o peso médio para liberar o cálculo de CA e IEP."*

#### E. Chat de BI Real com n8n Webhook
* No `src/components/CentralBI.jsx`, atualizar a função de envio para disparar um request POST HTTP para a URL do n8n:
  `https://n8n-n8n.tq2epq.easypanel.host/webhook-test/agtech-registro-diario`
* **Payload multi-tenant:** Enviar no JSON:
  ```json
  {
    "numeroid": "primeiro_contato_da_fazenda_ou_5500000000000",
    "conversa": "pergunta do usuario",
    "nomeuser": "Nome do Usuário",
    "empresa": "Nome da Fazenda",
    "tipo": "text",
    "message_id": "wamid.chatweb_timestamp",
    "audio_id": null
  }
  ```
* **Renderização de Gráficos SVG:** Se a resposta do webhook do n8n contiver uma propriedade `dados` em formato JSON de gráfico (com `modo: "grafico"`, `tipo: "bar"|"line"`, e uma lista de categorias/valores em `dados`), desenhar um pequeno gráfico elegante em SVG integrado na bolha de resposta do chat.

### 3. E (Especificações Técnicas)
* **Design:** Premium Glassmorphism.
* **Offline-First:** Salvar e carregar dados usando as funções existentes em `src/firebase/services.js`.
* **Sem quebras:** Tratar cenários onde não há conexão de internet com banners sutis e reter mensagens falhas para reenvio.

### 4. P (Padrão de Output)
Retorne as modificações completas dos arquivos e crie `ManejoSanitario.jsx` pronto para ser integrado.

### 5. C (Cenários de Teste)
* **Troca de Aptidão da Fazenda:** Trocar o tipo da fazenda nas Configurações de "Corte" para "Postura" deve refletir instantaneamente a mudança de layout de todo o painel (KPIs, linha do tempo e formulário diário).
* **Ausência de Pesagens:** Se o lote for de corte e não houver pesagens registradas para calcular CA/IEP reais, exibir badges com indicações de estimativas e instruções educadas sobre como registrar o peso.
* **Sem Contatos de WhatsApp:** Se a fazenda não tiver contatos cadastrados, envie um `numeroid` padrão mockado ("5500000000000") no payload do chat.

### 6. Arquivos a Marcar no Workspace
* `@src/components/CentralBI.jsx`
* `@src/components/CalendarioManejo.jsx`
* `@src/components/DashboardReal.jsx`
* `@src/components/FormularioManejo.jsx`
* `@src/firebase/services.js`
* `@workflowbi.json`
