/**
 * src/utils/siloPreditivo.js
 * 
 * Lógica preditiva para estimar níveis de ração, dias restantes (runway) e 
 * calcular datas críticas de reabastecimento.
 */

/**
 * Calcula a porcentagem atual de preenchimento do silo.
 * 
 * @param {number} estoqueAtualKg - Quantidade atual de ração no silo (em kg)
 * @param {number} capacidadeMaxKg - Capacidade máxima do silo (em kg)
 * @returns {number} Porcentagem (0 a 100) do nível do silo.
 */
export function calcularNivelSilo(estoqueAtualKg, capacidadeMaxKg) {
  if (!capacidadeMaxKg || capacidadeMaxKg <= 0) return 0;
  if (!estoqueAtualKg || estoqueAtualKg < 0) return 0;
  
  let porcentagem = (estoqueAtualKg / capacidadeMaxKg) * 100;
  return Math.min(Math.max(porcentagem, 0), 100);
}

/**
 * Calcula a autonomia restante do silo com base no consumo médio diário.
 * 
 * @param {number} estoqueAtualKg - Quantidade de ração disponível (em kg)
 * @param {number} consumoMedioKg - Média de consumo diário (em kg)
 * @returns {number} Quantidade de dias restantes (runway).
 */
export function calcularDiasRestantesSilo(estoqueAtualKg, consumoMedioKg) {
  if (!estoqueAtualKg || estoqueAtualKg <= 0) return 0;
  if (!consumoMedioKg || consumoMedioKg <= 0) return 99; // Retorna 99 se o consumo for 0 para evitar Infinity
  
  return estoqueAtualKg / consumoMedioKg;
}

/**
 * Projeta a data exata em que a ração do silo acabará.
 * 
 * @param {number} diasRestantes - O número de dias até acabar a ração.
 * @returns {Date} Data estimada de esgotamento.
 */
export function calcularDataEsgotamento(diasRestantes) {
  const dataEstimada = new Date();
  dataEstimada.setDate(dataEstimada.getDate() + Math.floor(diasRestantes));
  return dataEstimada;
}

/**
 * Calcula a média de consumo de ração dos últimos N dias.
 * 
 * @param {Array} historico - Array de registros diários do lote
 * @param {number} dias - Número de dias para considerar na média (default: 3)
 * @returns {number} Média diária de consumo de ração em kg.
 */
export function calcularConsumoMedio(historico, dias = 3) {
  if (!historico || historico.length === 0) return 0;
  
  const ultimosRegistros = historico.slice(-dias);
  const somaConsumo = ultimosRegistros.reduce((acc, reg) => acc + (reg.racao_kg || 0), 0);
  
  // Se houver registros mas o consumo for zero, tentamos procurar registros anteriores não zerados,
  // ou simplesmente retornamos a média dos dias disponíveis (evita divisão por 0)
  const diasValidos = ultimosRegistros.filter(r => r.racao_kg > 0).length || ultimosRegistros.length;
  
  return diasValidos > 0 ? somaConsumo / diasValidos : 0;
}
