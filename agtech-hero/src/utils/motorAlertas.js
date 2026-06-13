/**
 * src/utils/motorAlertas.js
 *
 * Utilitários de manejo usados pelo formulário diário. O motor de detecção
 * de anomalias e o disparo de alertas via WhatsApp foram consolidados no
 * Cloud Function `onRegistroDiarioEscrito` (functions/index.js +
 * functions/src/motorAlertas.js) — ver auditoria_consolidacao_alertas.md.
 */

/**
 * Calcula a idade (em dias) de um lote a partir da data de alojamento.
 *
 * @param {Date|import('firebase/firestore').Timestamp} dataAlojamento
 * @param {Date} dataReferencia
 * @returns {number}
 */
export function calcularIdadeDias(dataAlojamento, dataReferencia) {
  if (!dataAlojamento) return 0;
  const inicio = typeof dataAlojamento.toDate === 'function' ? dataAlojamento.toDate() : new Date(dataAlojamento);
  const diffMs = dataReferencia.getTime() - inicio.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
