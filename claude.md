# PROJECT CONTEXT: AGTECH (SaaS Multi-tenant)

Use este arquivo como o Guia de Contexto e Instruções Gerais do Projeto. Ele foi otimizado para a janela de contexto do Claude (Anthropic), estruturado com tags XML para máxima fidelidade de leitura.

<project_identity>
  <name>Agtech</name>
  <mission>SaaS premium Multi-tenant para gestão zootécnica de granjas (avicultura de corte e postura) e propriedades rurais.</mission>
  <ux_philosophy>Mobile-first extremo, usabilidade bruta e alto contraste para operadores em campo (peões). Zero loadings de rede bloqueantes para o usuário final.</ux_philosophy>
</project_identity>

<technology_stack>
  <frontend>React (Vite), Tailwind CSS v4 (Mobile-first)</frontend>
  <backend_db>Firebase Auth + Firebase Cloud Firestore (Multi-tenant seguro)</backend_db>
  <offline_architecture>Local-First / Offline-First real. Toda gravação do cliente é salva no cache persistente IndexedDB e sincronizada assincronamente pelo SDK.</offline_architecture>
  <integrations>n8n (Webhooks, WhatsApp, automações de disparo de mensagens)</integrations>
  <predictive_engine>Python (Pandas, Numpy, Scikit-learn) rodando em microsserviços para análise de séries temporais.</predictive_engine>
</technology_stack>

<design_system>
  <colors_theme_v4>
    <!-- Mapeadas em src/index.css como --color-* -->
    <color name="forest">#1B4332 (Verde Floresta / Cor primária)</color>
    <color name="forest-light">#2D6A4F (Verde acento)</color>
    <color name="forest-dark">#081C15 (Verde escuro / contraste)</color>
    <color name="offwhite">#F9FAFB (Cor de fundo principal / tela limpa)</color>
    
    <!-- Semânticas de Alerta -->
    <color name="alerta-vermelho">#EF4444 (Perigo / Mortalidade alta / Estresse térmico)</color>
    <color name="alerta-laranja">#F59E0B (Aviso / Estado offline / Moderação)</color>
    <color name="alerta-verde">#10B981 (Sucesso / Estado sincronizado / Normalidade)</color>
    
    <!-- Tons Neutros -->
    <color name="cinza-borda">#E5E7EB</color>
    <color name="cinza-texto">#6B7280</color>
    <color name="cinza-titulo">#111827</color>
  </colors_theme_v4>
  <typography>Font-sans padrão do tema (Inter / Plus Jakarta Sans)</typography>
</design_system>

<database_schema>
  <rules>
    Isolamento absoluto de dados entre fazendas (Multi-tenant) via subcoleções.
  </rules>
  
  <collections>
    <collection path="/fazendas/{id_fazenda}">
      <field name="nome" type="string" />
      <field name="tipo_producao" type="string" options="Corte | Postura" />
      <field name="contatos_autorizados" type="array of strings" description="Números de WhatsApp autorizados" />
      <field name="alertas_config" type="map" description="Limites de mortalidade e variação de consumo" />
      <field name="membros" type="map" schema="{ [uid_usuario]: 'dono' | 'peao' }" description="Mapeamento de permissões do Firestore" />
      <field name="plano" type="string" options="Essencial | Inteligente" description="Controles comerciais e IA" />

      <subcollection path="/lotes/{id_lote}">
        <field name="linhagem" type="string" description="Ex: Cobb 500, Ross 308" />
        <field name="data_alojamento" type="timestamp" />
        <field name="quantidade_inicial" type="number" />
        <field name="status" type="string" options="ativo | encerrado" />
      </subcollection>

      <subcollection path="/registros_diarios/{id_registro}">
        <!-- CRÍTICO: ID DETERMINÍSTICO -->
        <document_id_pattern>${id_lote}_${data_registro_str} (Ex: LOTE123_2026-06-10)</document_id_pattern>
        
        <field name="id_lote" type="string" />
        <field name="data_registro" type="timestamp" />
        <field name="data_registro_str" type="string" format="YYYY-MM-DD" description="Data local para evitar fuso horário UTC em relatórios preditivos" />
        <field name="agua_litros" type="number" />
        <field name="racao_kg" type="number" />
        <field name="mortalidade_qtd" type="number" />
        <field name="temp_max" type="number" />
        <field name="temp_min" type="number" />
        <field name="observacoes" type="string" optional="true" />
      </subcollection>
    </collection>
  </collections>
</database_schema>

<firestore_security_rules>
  <logic>
    1. Apenas membros autenticados acessam dados da sua própria fazenda.
    2. Funções auxiliares (isMemberOfFarm e isOwnerOfFarm) buscam o documento da fazenda pai via get().
    3. Segmentação de Permissões:
       - Membros (dono e peao) podem ler fazendas/lotes e ler/gravar registros diários.
       - Apenas Donos ('dono') podem atualizar/excluir dados cadastrais, gerenciar (alojar/encerrar) lotes e excluir registros históricos.
  </logic>
</firestore_security_rules>

<code_implementation_constraints>
  <constraint name="HMR_Safe_Vite">
    Firebase config deve tratar a re-inicialização do Firestore. Em caso de erro "already initialized" (comum no HMR do Vite), recupere a instância ativa usando `getFirestore(app)` em vez de tentar recriar a conexão.
  </constraint>
  <constraint name="Optimistic_Writes">
    Funções de escrita (salvar registros, criar lotes) NÃO devem ser "await-adas" se o objetivo for atualizar a UI. O SDK do Firebase enfileira as escritas localmente no IndexedDB de forma síncrona. Retorne os dados otimistas imediatamente e trate erros de replicação em background para evitar travar o fluxo do peão sem internet.
  </constraint>
  <constraint name="Timezone_Safety">
    Agrupamentos e indexação diária de manejo sempre usam `data_registro_str` (formato local "YYYY-MM-DD") em vez de derivar datas de Timestamps/Date do sistema, contornando desvios de fuso horário UTC na nuvem.
  </constraint>
</code_implementation_constraints>
