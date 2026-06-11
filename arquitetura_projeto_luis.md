# ⚙️ AGENTS.md: CONTEXTO GERAL - SAAS AGTECH

## 1. IDENTIDADE E OBJETIVO
Você é um enxame de agentes de Engenharia de Software e Data Science. Nosso objetivo é construir o "Agtech", um SaaS Multi-tenant premium para gestão zootécnica e financeira de granjas (avicultura de corte e postura) e propriedades rurais.
O sistema deve ser robusto, "idiot-proof" no frontend (alta usabilidade para peões no campo) e inteligente no backend (análises preditivas assíncronas).

## 2. NOSSA STACK TECNOLÓGICA
- **Frontend:** React, Tailwind CSS (v4). Design System Industrial Premium com tokens mapeados em `src/index.css`:
    *   *Principais:* Forest (`#1B4332`), Forest Light (`#2D6A4F`), Forest Dark (`#081C15`), Off-white (`#F9FAFB`).
    *   *Semânticas:* Alerta Vermelho (`#EF4444` - Perigo/Mortalidade), Alerta Laranja (`#F59E0B` - Aviso/Offline), Alerta Verde (`#10B981` - Sucesso/Sync).
    *   *Neutras:* Cinza Borda (`#E5E7EB`), Cinza Texto (`#6B7280`), Cinza Título (`#111827`).
- **Backend & DB:** Firebase Cloud Firestore (Multi-tenant) e Firebase Auth. **Obrigatório o uso de persistência offline (IndexedDB).**
- **Orquestração e Integração:** n8n (Webhooks, WhatsApp, filas de processos).
- **Data Science Preditiva:** Python (Pandas, Numpy, Scikit-learn) rodando em Cloud Functions ou microserviços.

## 3. REGRAS DE DOMÍNIO E ZOOTECNIA (O que monitoramos)
Para que os motores de análise em Python funcionem, o sistema baseia-se nos seguintes pilares de coleta diária:

### 3.1. Dados Críticos de Coleta Diária (Frequência Alta)
1. **Consumo de Água (Litros):** É o indicador mais rápido de saúde. Quedas bruscas indicam doença ou cano entupido. Aumento brusco indica estresse térmico.
2. **Consumo de Ração (Kg):** Custo primário. A relação normal Água/Ração é aprox. 2:1.
3. **Mortalidade e Descarte (Cabeças):** Quantidade de aves mortas ou sacrificadas por dia.
4. **Produção (se postura):** Número de ovos recolhidos.
5. **Clima do Galpão:** Temperatura Máxima e Mínima do dia.

### 3.2. Dados de Coleta Periódica (Frequência Baixa)
1. **Pesagem (Amostragem):** Peso médio semanal do lote (GMD - Ganho de Peso Médio Diário).
2. **Sanidade:** Aplicação de vacinas e medicamentos (Data, Lote da vacina, Dosagem).
3. **Eventos Logísticos:** Falta de energia, quebra de exaustores, atraso na entrega de ração.

## 4. SCHEMA DE BANCO DE DADOS (Firestore)
*Isolamento estrito entre clientes via `id_fazenda`.*

* **`/fazendas/{id_fazenda}`**
  * `nome` (string)
  * `tipo_producao` (string: "Corte", "Postura")
  * `contatos_autorizados` (array de strings: números de WhatsApp permitidos)
  * `alertas_config` (map: limites de mortalidade e variação de consumo)
  * `membros` (mapa de segurança: `{ [uid_usuario]: "dono" | "peao" }`) - *Essencial para firestore.rules*
  * `plano` (string: "Essencial" | "Inteligente") - *Define os limites e gatilhos de IA/WhatsApp*
  * **Subcoleção: `/lotes/{id_lote}`**
    * `linhagem` (string - ex: Cobb, Ross)
    * `data_alojamento` (timestamp)
    * `quantidade_inicial` (number)
    * `status` (string: "ativo", "encerrado")
  * **Subcoleção: `/registros_diarios/{id_registro}`**
    * *Nota: O {id_registro} DEVE ser determinístico no formato: `${id_lote}_${data_registro_str}` (ex: `LOTE123_2026-06-10`) para evitar duplicatas em escritas offline.*
    * `id_lote` (referência/string)
    * `data_registro` (timestamp)
    * `data_registro_str` (string: "YYYY-MM-DD") - *Evita bugs de fuso horário UTC nas análises preditivas*
    * `agua_litros` (number)
    * `racao_kg` (number)
    * `mortalidade_qtd` (number)
    * `temp_max` (number)
    * `temp_min` (number)
    * `observacoes` (string)

## 5. REGRAS DE COMPORTAMENTO DOS AGENTES
1. **Offline-First e Escritas Determinísticas:** Qualquer componente React que interaja com o Firestore DEVE considerar que a rede pode estar inativa. Use `setDoc` com `{ merge: true }` para salvar documentos com IDs determinísticos (como em `registros_diarios`) em vez de confiar em IDs gerados aleatoriamente pelo Firestore, evitando duplicidades de sincronização.
2. **Segurança Multi-tenant:** Toda leitura/escrita exige validação de que o `request.auth.uid` está presente no mapa `membros` do documento `/fazendas/{id_fazenda}`.
3. **Data e Fusos Horários:** Sempre use o formato de data string local `YYYY-MM-DD` (`data_registro_str`) para indexar e agrupar registros diários. Nunca dependa apenas de objetos Date/Timestamps para agrupar coletas em séries temporais diárias.
4. **Python e Pandas:** Quando for escrever lógicas de IA ou detecção de anomalias, utilize DataFrames do Pandas para calcular médias móveis (ex: `rolling(window=3).mean()`) do consumo de água/ração. Se a variação do dia atual fugir do desvio padrão, o script deve formatar um alerta Json.
5. **Sem Alucinações:** Não invente bibliotecas ou ferramentas fora da nossa stack. Mantenha o código limpo, semântico e modular. Divida grandes problemas em pequenos componentes/arquivos.