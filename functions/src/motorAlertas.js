/**
 * functions/src/motorAlertas.js
 *
 * Port (CommonJS) de agtech-hero/src/utils/motorAlertas.js — apenas a função
 * detectarAnomalias, que agora roda no Cloud Function `onRegistroDiarioEscrito`
 * (fonte única de disparo de alertas, ver auditoria_consolidacao_alertas.md).
 */

const { DIRETRIZES_ZOOTECNICAS } = require('./data/diretrizesZootecnicas');

/**
 * Compara o registro diário recém-salvo com as metas zootécnicas
 * (DIRETRIZES_ZOOTECNICAS) e com as configurações de alerta da fazenda,
 * retornando a lista de anomalias críticas detectadas.
 *
 * @param {Object} params
 * @param {Object} params.registroAtual    Dados numéricos recém-salvos (agua_litros, racao_kg, mortalidade_qtd, temp_max, temp_min...).
 * @param {Object|null} params.registroAnterior  Registro do dia anterior do mesmo lote (ou null).
 * @param {Object} params.lote     Documento do lote (linhagem, quantidade_inicial...).
 * @param {Object} params.fazenda  Documento da fazenda (alertas_config...).
 * @returns {Array<{tipo: 'mortalidade'|'temperatura'|'agua'|'racao'|'postura', detalhe: string, valor_medido: number, limite_definido: number, mensagem_gerada: string}>}
 */
function detectarAnomalias({ registroAtual, registroAnterior, lote, fazenda }) {
  const anomalias = [];
  const alertasConfig = fazenda?.alertas_config ?? {};
  const linhagem = lote?.linhagem ?? '';

  // 1. Mortalidade Diária Crítica
  // OBS: o percentual é calculado sobre `quantidade_inicial` (aves alojadas),
  // não sobre o plantel vivo no dia — a mesma base usada em
  // `calcularFechamentoLote` (fechamentoLote.js) para `mortalidade_pct`,
  // garantindo que o limite configurado em `alertas_config.mortalidade_critica`
  // seja comparável ao percentual consolidado no fechamento do lote.
  const populacaoInicial = lote?.quantidade_inicial ?? 0;
  if (populacaoInicial > 0 && alertasConfig.mortalidade_critica != null) {
    const percMortalidade = (Number(registroAtual.mortalidade_qtd) / populacaoInicial) * 100;
    if (percMortalidade >= alertasConfig.mortalidade_critica) {
      anomalias.push({
        tipo: 'mortalidade',
        detalhe: `Mortalidade de ${percMortalidade.toFixed(2)}% hoje (${registroAtual.mortalidade_qtd} aves)`,
        valor_medido: Number(percMortalidade.toFixed(2)),
        limite_definido: alertasConfig.mortalidade_critica,
        mensagem_gerada: `🚨 *Alerta de Mortalidade Crítica*\nO lote ${linhagem} registrou *${percMortalidade.toFixed(2)}%* de mortalidade hoje (${registroAtual.mortalidade_qtd} aves), acima do limite de ${alertasConfig.mortalidade_critica}% configurado.`,
      });
    }
  }

  // 2. Estresse Térmico (limites de conforto da linhagem)
  const tempConforto = DIRETRIZES_ZOOTECNICAS[linhagem]?.temp_conforto_celsius;
  if (tempConforto) {
    if (registroAtual.temp_max > tempConforto.max) {
      anomalias.push({
        tipo: 'temperatura',
        detalhe: `Temperatura máxima de ${registroAtual.temp_max}°C acima do limite de ${tempConforto.max}°C`,
        valor_medido: registroAtual.temp_max,
        limite_definido: tempConforto.max,
        mensagem_gerada: `🌡️ *Alerta de Estresse Térmico*\nA temperatura máxima do lote ${linhagem} atingiu *${registroAtual.temp_max}°C*, acima do limite de conforto (${tempConforto.max}°C).`,
      });
    }
    if (registroAtual.temp_min < tempConforto.min) {
      anomalias.push({
        tipo: 'temperatura',
        detalhe: `Temperatura mínima de ${registroAtual.temp_min}°C abaixo do limite de ${tempConforto.min}°C`,
        valor_medido: registroAtual.temp_min,
        limite_definido: tempConforto.min,
        mensagem_gerada: `🌡️ *Alerta de Estresse Térmico*\nA temperatura mínima do lote ${linhagem} caiu para *${registroAtual.temp_min}°C*, abaixo do limite de conforto (${tempConforto.min}°C).`,
      });
    }
  }

  // 3. Desvio de Consumo de Água (queda em relação ao dia anterior)
  if (registroAnterior?.agua_litros > 0 && alertasConfig.desvio_agua != null) {
    const variacaoPerc = ((registroAtual.agua_litros - registroAnterior.agua_litros) / registroAnterior.agua_litros) * 100;
    if (variacaoPerc <= -Math.abs(alertasConfig.desvio_agua)) {
      anomalias.push({
        tipo: 'agua',
        detalhe: `Queda de ${Math.abs(variacaoPerc).toFixed(1)}% no consumo de água em relação a ontem`,
        valor_medido: registroAtual.agua_litros,
        limite_definido: registroAnterior.agua_litros,
        mensagem_gerada: `💧 *Alerta de Consumo de Água*\nQueda de *${Math.abs(variacaoPerc).toFixed(1)}%* no consumo de água do lote ${linhagem} (de ${registroAnterior.agua_litros}L para ${registroAtual.agua_litros}L). Risco de doença ou falha no bebedouro.`,
      });
    }
  }

  // 4. Desvio de Consumo de Ração (queda em relação ao dia anterior)
  if (registroAnterior?.racao_kg > 0 && alertasConfig.desvio_racao != null) {
    const variacaoPerc = ((registroAtual.racao_kg - registroAnterior.racao_kg) / registroAnterior.racao_kg) * 100;
    if (variacaoPerc <= -Math.abs(alertasConfig.desvio_racao)) {
      anomalias.push({
        tipo: 'racao',
        detalhe: `Queda de ${Math.abs(variacaoPerc).toFixed(1)}% no consumo de ração em relação a ontem`,
        valor_medido: registroAtual.racao_kg,
        limite_definido: registroAnterior.racao_kg,
        mensagem_gerada: `🌾 *Alerta de Consumo de Ração*\nQueda de *${Math.abs(variacaoPerc).toFixed(1)}%* no consumo de ração do lote ${linhagem} (de ${registroAnterior.racao_kg}kg para ${registroAtual.racao_kg}kg).`,
      });
    }
  }

  // 5. Queda de Postura (apenas para lotes de postura)
  const aptidao = lote?.aptidao || 'corte';
  if (aptidao === 'postura' && registroAnterior?.producao_ovos_qtd > 0 && alertasConfig.queda_postura != null) {
    const variacaoPerc = ((registroAtual.producao_ovos_qtd - registroAnterior.producao_ovos_qtd) / registroAnterior.producao_ovos_qtd) * 100;
    if (variacaoPerc <= -Math.abs(alertasConfig.queda_postura)) {
      anomalias.push({
        tipo: 'postura',
        detalhe: `Queda de ${Math.abs(variacaoPerc).toFixed(1)}% na produção de ovos em relação a ontem`,
        valor_medido: registroAtual.producao_ovos_qtd,
        limite_definido: registroAnterior.producao_ovos_qtd,
        mensagem_gerada: `🥚 *Alerta de Queda de Postura*\nQueda de *${Math.abs(variacaoPerc).toFixed(1)}%* na produção de ovos do lote ${linhagem} (de ${registroAnterior.producao_ovos_qtd} para ${registroAtual.producao_ovos_qtd} ovos). Verifique nutrição, sanidade ou ambiência.`,
      });
    }
  }

  return anomalias;
}

module.exports = { detectarAnomalias };
