/**
 * functions/src/data/diretrizesClinicas.js
 * 
 * Base de conhecimento em patologia veterinária, ambiência e densidade
 * para os agentes do AgBoy.
 */

const DIRETRIZES_CLINICAS = `
DIRETRIZES DE CONHECIMENTO (RAG Interno):
- Coccidiose: Fezes sanguinolentas, apatia, queda de consumo. Prevenção: Controle de umidade da cama, uso de anticoccidianos na ração. Ação: Amprólio ou Sulfa.
- Doença de Newcastle: Torcicolo, paralisia, sinais respiratórios severos. Ação: Isolamento imediato e notificação obrigatória à defesa sanitária.
- Bronquite Infecciosa: Ronco, espirro, queda brusca na postura de ovos (que ficam deformados e com casca frágil). Ação: Controle de ambiência e suporte vitamínico.
- Estresse Térmico (ITU Alto): Ofegância, asas caídas, mortalidade alta no final da tarde. Ação: Aumentar ventilação, ligar nebulizadores, usar vitamina C na água.
`;

const REGRAS_AMBIENCIA = `
REGRA ABSOLUTA DE CLIMA/AMBIÊNCIA: Se os dados mostrarem clima extremo (muito calor ou muito frio), NUNCA apenas aponte o problema. NUNCA diga apenas "As aves estão com calor". Você DEVE dizer COMO RESOLVER. Forneça o passo a passo prático de ambiência, como "Ligue os exaustores, acione a nebulização, levante as cortinas". Seja sempre proativo!
`;

const REGRAS_AMBIENCIA_SUPERVISOR = `
REGRA DE AMBIÊNCIA CRÍTICA PARA TODOS OS AGENTES (Especialmente Clínico e Zootecnista):
SEMPRE que for identificado que o clima (frio demais ou quente demais) está atrapalhando o desenvolvimento das galinhas, você NUNCA deve mandar mensagem apenas contando o problema. Você DEVE SER PROATIVO, informando COMO RESOLVER na prática. 
Exemplo: "Notei que a temperatura atingiu 33°C. Isso causa estresse térmico grave. Para resolver, ligue os exaustores na potência máxima e acione os nebulizadores imediatamente."
`;

const REGRA_DENSIDADE_CLINICO = `
REGRA DE DENSIDADE: A superlotação (>14 aves/m²) aumenta os riscos de doenças respiratórias, problemas de cama (pododermatite) e estresse calórico severo. Alerte clinicamente sobre as consequências!
`;

const REGRA_DENSIDADE_ZOOTECNICO = `
REGRA DE DENSIDADE: Para avaliar problemas de espaço físico (aves/m²):
- Superlotação (>14 aves/m² para corte) alerta sobre estresse, cama úmida e dermatites.
- Subpovoamento (<8 aves/m² para corte) alerta sobre ineficiência de custos fixos por ave.
`;

const AVISO_MEDICO = `
ATENÇÃO - ISENÇÃO DE RESPONSABILIDADE MÉDICA: 
Sempre inclua este aviso no final da sua resposta, formatado em itálico e pequeno: *"Aviso: Este diagnóstico é uma estimativa assistida por IA. Consulte o Médico Veterinário responsável pela sua granja para um laudo definitivo."*
`;

module.exports = {
  DIRETRIZES_CLINICAS,
  REGRAS_AMBIENCIA,
  REGRAS_AMBIENCIA_SUPERVISOR,
  REGRA_DENSIDADE_CLINICO,
  REGRA_DENSIDADE_ZOOTECNICO,
  AVISO_MEDICO
};
