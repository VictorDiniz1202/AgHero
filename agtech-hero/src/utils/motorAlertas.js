/**
 * src/utils/motorAlertas.js
 *
 * Motor de Detecção de Anomalias Zootécnicas + disparo não-bloqueante do
 * webhook n8n (WhatsApp).
 *
 * RESILIÊNCIA OFFLINE: o disparo do webhook NUNCA bloqueia a UI. Se o
 * dispositivo estiver sem rede (ou o `fetch` falhar), o payload é enfileirado
 * em `localStorage` (chave `alertas_pendentes_webhook`) e reenviado
 * automaticamente quando o evento `online` disparar.
 */

import { DIRETRIZES_ZOOTECNICAS } from '../data/DiretrizesZootecnicas';

const WEBHOOK_URL = 'https://n8n-n8n.tq2epq.easypanel.host/webhook-test/agtech-registro-diario';
const FILA_STORAGE_KEY = 'alertas_pendentes_webhook';

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

/**
 * Compara o registro diário recém-salvo com as metas zootécnicas
 * (DiretrizesZootecnicas) e com as configurações de alerta da fazenda,
 * retornando a lista de anomalias críticas detectadas.
 *
 * @param {Object} params
 * @param {Object} params.registroAtual    Dados numéricos recém-salvos (agua_litros, racao_kg, mortalidade_qtd, temp_max, temp_min...).
 * @param {Object|null} params.registroAnterior  Registro do dia anterior do mesmo lote (ou null).
 * @param {Object} params.lote     Documento do lote (linhagem, quantidade_inicial...).
 * @param {Object} params.fazenda  Documento da fazenda (alertas_config...).
 * @returns {Array<{tipo: 'mortalidade'|'temperatura'|'agua'|'racao', detalhe: string, valor_medido: number, limite_definido: number, mensagem_gerada: string}>}
 */
export function detectarAnomalias({ registroAtual, registroAnterior, lote, fazenda }) {
  const anomalias = [];
  const alertasConfig = fazenda?.alertas_config ?? {};
  const linhagem = lote?.linhagem ?? '';

  // 1. Mortalidade Diária Crítica
  // OBS: usa `quantidade_inicial` do lote como base de "aves ativas", já que
  // o esquema atual não mantém um contador corrente de aves vivas.
  const avesAtivas = lote?.quantidade_inicial ?? 0;
  if (avesAtivas > 0 && alertasConfig.mortalidade_critica != null) {
    const percMortalidade = (Number(registroAtual.mortalidade_qtd) / avesAtivas) * 100;
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

/**
 * Monta o payload do webhook n8n para uma anomalia detectada, no formato
 * esperado pelo fluxo de disparo de WhatsApp.
 */
export function montarPayloadAlerta({ id_fazenda, fazenda, id_lote, lote, idadeDias, anomalia }) {
  return {
    tipo: 'alerta_anomalia',
    id_fazenda,
    nome_fazenda: fazenda?.nome ?? '',
    id_lote,
    linhagem: lote?.linhagem ?? '',
    idade_dias: idadeDias,
    alerta: anomalia,
    contatos_destino: fazenda?.contatos_autorizados ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Fila offline + disparo do webhook
// ─────────────────────────────────────────────────────────────────────────

function lerFilaPendente() {
  try {
    const bruto = localStorage.getItem(FILA_STORAGE_KEY);
    return bruto ? JSON.parse(bruto) : [];
  } catch (error) {
    console.error('[MotorAlertas] Falha ao ler fila de alertas pendentes:', error);
    return [];
  }
}

function salvarFilaPendente(fila) {
  try {
    localStorage.setItem(FILA_STORAGE_KEY, JSON.stringify(fila));
  } catch (error) {
    console.error('[MotorAlertas] Falha ao persistir fila de alertas pendentes:', error);
  }
}

async function postarWebhook(payload) {
  const resposta = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    throw new Error(`Webhook respondeu com status ${resposta.status}`);
  }
}

/**
 * Dispara o alerta para o webhook n8n (WhatsApp) de forma não-bloqueante.
 * Se o dispositivo estiver offline ou o `fetch` falhar, o payload é
 * enfileirado em `localStorage` para reenvio automático assim que a conexão
 * voltar (evento `online`).
 *
 * @param {Object} payload
 * @param {(status: 'enviado'|'fila') => void} [aoFinalizar]  Callback com o status final do disparo.
 */
export function dispararAlertaWhatsapp(payload, aoFinalizar) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const fila = lerFilaPendente();
    fila.push(payload);
    salvarFilaPendente(fila);
    aoFinalizar?.('fila');
    return;
  }

  postarWebhook(payload)
    .then(() => aoFinalizar?.('enviado'))
    .catch((error) => {
      console.error('[MotorAlertas] Falha ao disparar webhook de alerta, enfileirando para reenvio:', error);
      const fila = lerFilaPendente();
      fila.push(payload);
      salvarFilaPendente(fila);
      aoFinalizar?.('fila');
    });
}

/**
 * Reprocessa a fila de alertas pendentes. Chamado automaticamente quando o
 * navegador volta a ficar online.
 */
export function processarFilaAlertasPendentes() {
  const fila = lerFilaPendente();
  if (fila.length === 0) return;

  // Limpa otimisticamente; itens que falharem novamente são re-enfileirados.
  salvarFilaPendente([]);

  fila.forEach((payload) => {
    postarWebhook(payload).catch((error) => {
      console.error('[MotorAlertas] Falha ao reenviar alerta da fila offline:', error);
      const filaAtual = lerFilaPendente();
      filaAtual.push(payload);
      salvarFilaPendente(filaAtual);
    });
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', processarFilaAlertasPendentes);
}
