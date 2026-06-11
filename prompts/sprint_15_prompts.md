# Prompts da Sprint 15: Integração Climática Preditiva (OpenMeteo)

*Instruções para iniciar o Claude (Agente Secundário) na Sub-sprint 15.2.*

---

### Prompt 1: Widget de Previsão Térmica (Sub-sprint 15.2)

**P (Persona & Contexto):** Você é um Tech Lead Sênior e Especialista em React e TailwindCSS trabalhando no projeto AgTech Hero. O Gemini (CTO) já concluiu a Sub-sprint 15.1 criando o módulo de integração de previsão do tempo `src/utils/climaPreditivo.js`. Sua missão agora é integrar essa funcionalidade na interface principal do usuário.

**R (Requisitos de Negócio):** 
O produtor avícola sofre grandes perdas com ondas de calor ou frio inesperadas. Queremos alertá-lo com antecedência cruzando a previsão dos próximos 3 dias com a zona de conforto da ave. Isso deve ser exibido como um "Widget de Previsão Térmica" bem no topo da tela do Dashboard, chamando muita atenção caso haja um alerta severo.

**E (Especificações Técnicas):**
No arquivo `DashboardReal.jsx`:
1.  **Integração:** Importe `obterPrevisaoClimatica(linhagem, idadeDias)` de `../utils/climaPreditivo.js`. No `useEffect` que carrega as estatísticas iniciais, chame esse método passando a linhagem do `loteAtual` e a `idadeDias` calculada. Guarde a resposta no estado `previsaoClimatica`.
2.  **Desenho do Widget:** Acima do painel principal de KPIs (ou acima do bloco de Lotes e Configurações), adicione um card horizontal Glassmorphism mostrando a previsão do tempo dos próximos 3 dias.
3.  **Alertas Visuais:** O objeto de previsão retorna `data_curta`, `temp_max`, `temp_min`, `alerta` e `severidade`. Para cada dia:
    * Se `severidade === 'critico'`, o card daquele dia deve pulsar em tons de vermelho vibrante, exibindo a mensagem de alerta.
    * Se `severidade === 'alerta'`, usar tom de laranja (atenção).
    * Se `normal`, mostrar um layout limpo esmeralda/branco indicando que está dentro da zona de conforto (cruzado com `conforto_atual`).
4. **Resiliência:** Como é uma chamada externa (geojs e open-meteo), se a requisição falhar ou demorar muito, não trave a tela de Dashboard. Renderize graciosamente ou oculte o painel em caso de erro.

**P (Padrão de Output):**
Edite o arquivo `DashboardReal.jsx` inserindo os imports, os states de clima e o JSX correspondente ao "Painel de Clima Preditivo". Mantenha o design refinado em glassmorphism.

**C (Cenários de Teste):**
1. Simule `previsaoClimatica` sendo nulo (offline ou falha de API).
2. Ocultação/Exibição: Verifique o alinhamento desse widget em telas mobile (celular do peão na roça).

**Arquivos a Marcar na Contextualização:**
- `@DashboardReal.jsx`
- `@climaPreditivo.js`
- `@sprint_15_planning.md`
