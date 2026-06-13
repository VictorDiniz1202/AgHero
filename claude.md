# PROJECT CONTEXT: AGTECH HERO (SaaS Multi-tenant)

Use este arquivo como o Guia de Contexto e Instruções Gerais do Projeto. Ele foi otimizado para a janela de contexto do Claude (Anthropic), estruturado para leitura estruturada e alinhamento tático de alta performance.

---

<project_identity>
  <name>AgTech Hero</name>
  <mission>SaaS premium Multi-tenant para gestão zootécnica de granjas (avicultura de corte e postura) e propriedades rurais, focado obstinadamente em gerar ROI para o produtor rural (economizar ração, prevenir mortalidade e otimizar fechamentos).</mission>
  <ux_philosophy>Mobile-first extremo, usabilidade bruta e alto contraste para operadores em campo (peões). Botões grandes (alvos de clique >= 48px) para uso com botas e luvas. Zero loadings de rede bloqueantes para o usuário final.</ux_philosophy>
</project_identity>

<technology_stack>
  <frontend>React (Vite), Tailwind CSS v4 (Mobile-first, Premium Glassmorphism)</frontend>
  <backend_db>Firebase Auth + Firebase Cloud Firestore (Multi-tenant seguro)</backend_db>
  <offline_architecture>Local-First / Offline-First real. Toda gravação do cliente é salva no cache persistente IndexedDB e sincronizada assincronamente pelo SDK.</offline_architecture>
  <pwa_plugin>vite-plugin-pwa (geração de Service Worker automatizada baseada em Workbox com registerType: 'prompt' para avisar novas versões)</pwa_plugin>
  <integrations>n8n (Webhooks, WhatsApp, envio de alertas de anomalias sanitárias e operacionais)</integrations>
  <predictive_engine>Python (Pandas, Numpy, Scikit-learn) em microsserviços para análise de séries temporais.</predictive_engine>
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
  <typography>Font-sans padrão do tema (Inter / Outfit / Plus Jakarta Sans)</typography>
</design_system>

<database_schema>
  <rules>
    Isolamento absoluto de dados entre fazendas (Multi-tenant) via subcoleções estruturadas no Firestore.
  </rules>
  
  <collections>
    <collection path="/fazendas/{id_fazenda}">
      <field name="nome" type="string" />
      <field name="tipo_producao" type="string" options="Corte | Postura" />
      <field name="contatos_autorizados" type="array of strings" description="Números de WhatsApp autorizados para receber alertas" />
      <field name="alertas_config" type="map" description="Limites de mortalidade e variação de consumo para alertas" />
      <field name="membros" type="map" schema="{ [uid_usuario]: 'dono' | 'peao' }" description="Mapeamento de permissões do Firestore" />
      <field name="plano" type="string" options="Essencial | Inteligente" description="Controles comerciais e IA" />
      <field name="latitude" type="number" optional="true" description="Coordenada geográfica de latitude" />
      <field name="longitude" type="number" optional="true" description="Coordenada geográfica de longitude" />

      <!-- SUBCOLEÇÃO: Lotes -->
      <subcollection path="/lotes/{id_lote}">
        <field name="linhagem" type="string" description="Ex: Cobb 500, Ross 308 (Corte) ou Lohmann LSL (Postura)" />
        <field name="data_alojamento" type="timestamp" />
        <field name="quantidade_inicial" type="number" />
        <field name="status" type="string" options="ativo | encerrado" />
        <field name="aptidao" type="string" options="corte | postura" />
        <field name="frequencia_pesagem" type="string" options="diaria | semanal | personalizada" />
        <field name="cronograma_pesagem_dias" type="array of numbers" description="Dias programados para pesagem manual" />
        
        <!-- Campo populado no encerramento do lote -->
        <field name="fechamento" type="map" description="Consolidado do ciclo zootécnico e financeiro">
          <field name="data_encerramento" type="string" format="ISO" />
          <field name="mortalidade_total" type="number" />
          <field name="mortalidade_pct" type="number" />
          <field name="viabilidade_final" type="number" />
          <field name="aves_final" type="number" />
          <field name="total_racao_kg" type="number" />
          <field name="ovos_total" type="number" description="Apenas Postura" />
          <field name="ovos_descarte_total" type="number" description="Apenas Postura" />
          <field name="peso_final_g" type="number" description="Apenas Corte" />
          <field name="fcr_final" type="number" description="Conversão Alimentar final" />
          <field name="receita_total" type="number" />
          <field name="despesa_total" type="number" />
          <field name="lucro_liquido" type="number" />
          <field name="custo_por_ave" type="number" description="Custo amortizado por ave alojada" />
        </field>

        <!-- SUBCOLEÇÃO DO LOTE: Sanidade (Histórico de Medicamentos, Vacinas e Sintomas) -->
        <subcollection path="/sanidade/{id_registro}">
          <field name="tipo" type="string" options="vacina | medicamento | sintoma" />
          <field name="data_str" type="string" format="YYYY-MM-DD" />
          <field name="nome" type="string" description="Nome da vacina/remédio ou descrição do sintoma" />
          <field name="via_aplicacao" type="string" options="spray | agua | injecao" optional="true" />
          <field name="status" type="string" options="agendada | aplicada" />
          <field name="idade_programada_dias" type="number" />
          <field name="sintomas" type="array of strings" optional="true" />
          <field name="suspeita_doenca" type="string" optional="true" />
          <field name="observacoes" type="string" optional="true" />
        </subcollection>

        <!-- SUBCOLEÇÃO DO LOTE: Transações Financeiras -->
        <subcollection path="/transacoes/{id_transacao}">
          <field name="tipo" type="string" options="receita | despesa" />
          <field name="valor" type="number" />
          <field name="descricao" type="string" />
          <field name="categoria" type="string" />
          <field name="data_str" type="string" format="YYYY-MM-DD" />
          <field name="timestamp_registro" type="timestamp" />
        </subcollection>

        <!-- SUBCOLEÇÃO DO LOTE: Cargas de Silo (Abastecimento de ração) -->
        <subcollection path="/cargas_silo/{id_carga}">
          <field name="quantidade_kg" type="number" />
          <field name="data_str" type="string" format="YYYY-MM-DD" />
          <field name="timestamp_registro" type="timestamp" />
        </subcollection>

        <!-- SUBCOLEÇÃO DO LOTE: Pesagens (Acompanhamento de peso manual) -->
        <subcollection path="/pesagens/{id_pesagem}">
          <field name="data_str" type="string" format="YYYY-MM-DD" />
          <field name="peso_medio_g" type="number" />
          <field name="uniformidade_pct" type="number" />
          <field name="idade_dias" type="number" />
          <field name="timestamp_registro" type="timestamp" />
        </subcollection>
      </subcollection>

      <!-- SUBCOLEÇÃO: Registros Diários (Manejo Diário dos Lotes) -->
      <subcollection path="/registros_diarios/{id_registro}">
        <!-- ID DETERMINÍSTICO DO DOCUMENTO: ${id_lote}_${data_registro_str} (Ex: LOTE123_2026-06-10) -->
        <document_id_pattern>${id_lote}_${data_registro_str}</document_id_pattern>
        
        <field name="id_lote" type="string" />
        <field name="data_registro" type="timestamp" />
        <field name="data_registro_str" type="string" format="YYYY-MM-DD" description="Data local para evitar fuso UTC" />
        <field name="agua_litros" type="number" />
        <field name="racao_kg" type="number" />
        <field name="mortalidade_qtd" type="number" />
        <field name="temp_max" type="number" />
        <field name="temp_min" type="number" />
        <field name="umidade_relativa" type="number" optional="true" description="Umidade relativa do ar (%)" />
        <field name="itu" type="number" optional="true" description="Índice de Temperatura e Umidade calculado para pico térmico" />
        <field name="peso_medio_g" type="number" description="Opcional. Registrado nos dias de pesagem" />
        <field name="producao_ovos_qtd" type="number" description="Opcional. Coleta diária de postura" />
        <field name="ovos_descarte_qtd" type="number" description="Opcional. Ovos impróprios coletados" />
        <field name="observacoes" type="string" optional="true" />
      </subcollection>

      <!-- SUBCOLEÇÃO: Alertas Enviados (Histórico de Disparos da IA) -->
      <subcollection path="/alertas_enviados/{id_alerta}">
        <field name="tipo_anomalia" type="string" options="mortalidade | consumo_agua | consumo_racao" />
        <field name="data_str" type="string" format="YYYY-MM-DD" />
        <field name="mensagem" type="string" />
        <field name="status_whatsapp" type="string" options="sucesso | falha" />
        <field name="timestamp" type="timestamp" />
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

  <constraint name="Print_Ready_CSS">
    Qualquer elemento de interface que não deva sair no relatório PDF (sidebar, menus de navegação, botão do chat da IA, botões de salvar, modais secundários) deve possuir a classe `no-print`. O CSS `@media print` em `src/index.css` formata e remove fundos cinzas/bordas desnecessárias no papel.
  </constraint>

  <constraint name="Visual_SVG_Charts">
    Gráficos embutidos (como o gráfico de peso corporal `GrowthChart` em `DashboardReal.jsx`) são gerados puramente em SVG reativo e contidos em `.svg-chart-container` para responsividade ideal sob sol forte no campo.
  </constraint>
</code_implementation_constraints>

<multi_agent_collaboration>
  <roles>
    <claude>Coder Principal do Frontend &amp; CLI Integrada. Executa comandos Git, cria componentes React e roda a suíte de testes locais.</claude>
    <gemini>Auditor Estratégico, Validador de Ideias e Guardião de Clean Code/Segurança. Valida as regras de negócio e a estrutura do banco antes da implementação.</gemini>
  </roles>
  <coder_auditor_loop>
    1. Gemini (Antigravity) cria o plano de implementação.
    2. Claude (Claude Code) audita o plano e propõe melhorias.
    3. Após aprovação do plano, Claude escreve os testes/specs (Fase Red) e implementa a lógica de código (Fase Green).
    4. Gemini realiza a auditoria de segurança pós-sessão de código.
    5. O resultado é registrado na seção "Histórico de Sprints Concluídas" de roadmap_claude.md.
  </coder_auditor_loop>
  <custom_skills>
    O Claude Code carrega habilidades customizadas locais. Sempre reuse as habilidades configuradas em `.claude/skills/auditoria_seguranca/` e `.claude/skills/validador_tdd/` para se guiar de forma autônoma.
  </custom_skills>
</multi_agent_collaboration>

---

## 🎯 Próximo Alvo: Sprints Futuras e Regras de Limpeza

Estamos iniciando o planejamento da próxima sprint:
* **Sprint 23:** Foco no checkout real (Stripe/Asaas), aba de Faturamento & Plano, e sincronização do status de ativação do Plano Inteligente.

> [!IMPORTANT]
> **REGRAS DE REFINAMENTO DE PROMPTS:**
> Ao final de cada sprint, o arquiteto/agente líder deve analisar o arquivo de planejamento de sprints futuras, refinar os prompts do Claude adicionando fluxos de erros, estados offline e mockups de APIs, e salvar o arquivo em `prompts/`.

> [!WARNING]
> **REGRAS DE CONSERVAÇÃO DO WORKSPACE:**
> Mantenha a pasta de artefatos (`brain/`) livre de poluição. Todos os prompts criados em Markdown para clonar componentes ou orientar integrações devem ser movidos para a pasta `/prompts` no repositório do projeto. Imagens temporárias devem ser apagadas ao fim de cada ciclo.
