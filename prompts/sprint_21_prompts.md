# PROMPT PARA CLAUDE — SPRINT 21 (SUB-SPRINT 21.2)

Olá! Acabamos de concluir a Sub-sprint 21.1 de backend e matemática zootécnica.
O Firestore e os helpers de clima já foram adaptados e estão salvando:
1. `latitude` e `longitude` no perfil da fazenda.
2. `umidade_relativa` (%) e `itu` (Índice de Temperatura e Umidade) nos registros diários de manejo.
3. Previsão de clima em `climaPreditivo.js` (`obterPrevisaoClimatica`) que agora consome a latitude/longitude da fazenda (com fallback via IP) e calcula o `itu` previsto para os próximos 3 dias.

Sua tarefa na **Sub-sprint 21.2** é criar a interface de monitoramento climático e alertas de estresse térmico no Dashboard do AgTech Hero.

## 🛠️ Suas Tarefas (Interface & Experiência):

1. **Card de Estresse Térmico / ITU no DashboardPrincipal / DashboardReal:**
   - Criar um widget elegante com estilo Glassmorphism que mostre o **ITU do último registro diário** do lote ativo.
   - O indicador de ITU deve mudar de cor dependendo da severidade:
     - **ITU < 74 (Confortável):** Verde esmeralda.
     - **74 <= ITU < 79 (Alerta):** Amarelo/Laranja.
     - **79 <= ITU < 84 (Emergência):** Laranja/Vermelho.
     - **ITU >= 84 (Crítico):** Vermelho pulsante.

2. **Previsão Climática com ITU:**
   - Renderizar o widget de clima de 3 dias no dashboard (utilizando `obterPrevisaoClimatica` do arquivo `src/utils/climaPreditivo.js`), exibindo além da temperatura máxima/mínima, o **ITU preditivo** calculado para cada dia.

3. **Painel de Recomendação de Manejo Ativo:**
   - Exibir um card dinâmico de sugestões de manejo quando o ITU previsto ou atual do lote (com idade > 14 dias) indicar alerta ou estado crítico.
   - **Exemplo de sugestão:** 
     - *"⚠️ ITU de Alerta (80): Risco moderado de estresse térmico. Ligue exaustores nas horas mais quentes e verifique vazão de bebedouros."*
     - *"🚨 ITU Crítico (${itu}): Risco extremo de mortalidade por calor! Nebulizadores devem estar ligados, evite manuseio das aves e reduza a densidade de cortinas."*

4. **Integração nas Telas:**
   - Garantir que a chamada de `obterPrevisaoClimatica` passe a `latitude` e `longitude` da fazenda ativa obtida do Firestore para gerar a previsão climatológica precisa da geolocalização do produtor.

Siga fielmente o design premium (Tailwind CSS v4, Glassmorphism, forest and emerald accents) e verifique se o build (`npm run build`) continua passando de primeira. Bom trabalho!
