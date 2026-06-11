/**
 * src/utils/fechamentoLote.js
 *
 * Utilitário de agregação para a Ficha de Fechamento de Lote (histórico de
 * lotes encerrados). Recebe o histórico diário (registros_diarios) e as
 * transações financeiras de um lote e devolve os totais acumulados prontos
 * para gravação (campo `fechamento` do lote) e exibição na UI.
 */

import { calcularResumoFinanceiro } from "./financeiroLote";

/**
 * @param {Object} params
 * @param {Object} params.lote - Documento do lote (id, aptidao, quantidade_inicial, ...).
 * @param {Array} params.historico - Registros diários do lote (registros_diarios).
 * @param {Array} params.transacoes - Transações financeiras do lote (subcoleção transacoes).
 * @returns {Object} Acumulados do ciclo prontos para a Ficha de Fechamento.
 */
export function calcularFechamentoLote({ lote, historico = [], transacoes = [] }) {
  const aptidao = lote?.aptidao || "corte";
  const qtdInicial = Number(lote?.quantidade_inicial) || 0;

  const mortalidade_total = historico.reduce((sum, r) => sum + (Number(r.mortalidade_qtd) || 0), 0);
  const mortalidade_pct = qtdInicial > 0 ? (mortalidade_total / qtdInicial) * 100 : 0;
  const viabilidade_final = Math.max(0, 100 - mortalidade_pct);
  const aves_final = Math.max(0, qtdInicial - mortalidade_total);

  const total_racao_kg = historico.reduce((sum, r) => sum + (Number(r.racao_kg) || 0), 0);

  let ovos_total = 0;
  let ovos_descarte_total = 0;
  let peso_final_g = 0;
  let fcr_final = null;

  if (aptidao === "postura") {
    ovos_total = historico.reduce((sum, r) => sum + (Number(r.producao_ovos_qtd) || 0), 0);
    ovos_descarte_total = historico.reduce((sum, r) => sum + (Number(r.ovos_descarte_qtd) || 0), 0);
  } else {
    const ultimoComPeso = [...historico].reverse().find(
      (r) => typeof r.peso_medio_g === "number" && r.peso_medio_g > 0
    );
    peso_final_g = ultimoComPeso ? ultimoComPeso.peso_medio_g : 0;

    if (peso_final_g > 0 && aves_final > 0) {
      const ganhoPesoKg = aves_final * (peso_final_g / 1000 - 0.042);
      if (ganhoPesoKg > 0 && total_racao_kg > 0) {
        fcr_final = total_racao_kg / ganhoPesoKg;
      }
    }
  }

  const { receitaTotal, despesaTotal, lucroLiquido, custoPorAve } = calcularResumoFinanceiro(transacoes, qtdInicial);

  return {
    data_encerramento: new Date().toISOString(),
    mortalidade_total,
    mortalidade_pct: Number(mortalidade_pct.toFixed(2)),
    viabilidade_final: Number(viabilidade_final.toFixed(2)),
    aves_final,
    total_racao_kg: Number(total_racao_kg.toFixed(2)),
    ovos_total,
    ovos_descarte_total,
    peso_final_g,
    fcr_final: fcr_final !== null ? Number(fcr_final.toFixed(2)) : null,
    receita_total: receitaTotal,
    despesa_total: despesaTotal,
    lucro_liquido: lucroLiquido,
    custo_por_ave: Number(custoPorAve.toFixed(2)),
  };
}
