/**
 * src/utils/aguaPreditiva.js
 * 
 * Lógica preditiva para consumo hídrico, cálculo da relação crítica de 
 * Água/Ração (Fator de Ouro) e estimativa de autonomia do reservatório.
 */

/**
 * Calcula a relação entre o consumo de água e o consumo de ração.
 * 
 * @param {number} aguaLitros - Total de água consumida (em litros) no dia
 * @param {number} racaoKg - Total de ração consumida (em kg) no dia
 * @returns {Object} Objeto com o valor da relação, status ('baixa', 'normal', 'alta') e diagnóstico.
 */
export function analisarRelacaoAguaRacao(aguaLitros, racaoKg) {
  if (!aguaLitros || aguaLitros <= 0 || !racaoKg || racaoKg <= 0) {
    return {
      relacao: 0,
      status: 'indefinido',
      diagnostico: 'Dados insuficientes para calcular a relação Água/Ração.'
    };
  }

  const relacao = aguaLitros / racaoKg;
  let status = 'normal';
  let diagnostico = 'Relação ideal. Consumo equilibrado indicando saúde e ambiente adequados.';

  if (relacao < 1.6) {
    status = 'baixa';
    diagnostico = 'Risco crítico! Indício de desidratação, entupimento na linha de nipples ou aves sofrendo estresse por frio intenso.';
  } else if (relacao >= 1.6 && relacao < 1.8) {
    status = 'baixa_alerta';
    diagnostico = 'Atenção: Aves bebendo um pouco menos que o normal. Monitore o fluxo de água.';
  } else if (relacao > 2.2 && relacao <= 2.5) {
    status = 'alta_alerta';
    diagnostico = 'Atenção: Aves bebendo mais do que o esperado. Monitore vazamentos pequenos ou calor moderado.';
  } else if (relacao > 2.5) {
    status = 'alta';
    diagnostico = 'Risco crítico! Indício de estresse térmico severo por calor, enterites (diarreia) ou vazamentos significativos nos bicos.';
  }

  return {
    relacao: Number(relacao.toFixed(2)),
    status,
    diagnostico
  };
}

/**
 * Calcula a autonomia restante do reservatório central de água.
 * 
 * @param {number} capacidadeReservatorioLitros - Capacidade de água do reservatório (em litros)
 * @param {number} consumoMedioDiarioLitros - Consumo médio diário das aves (em litros)
 * @returns {Object} Objeto com os dias e horas restantes de autonomia em caso de pane na bomba.
 */
export function calcularAutonomiaReserva(capacidadeReservatorioLitros, consumoMedioDiarioLitros) {
  if (!capacidadeReservatorioLitros || capacidadeReservatorioLitros <= 0) return { dias: 0, horas: 0, runway: 0 };
  if (!consumoMedioDiarioLitros || consumoMedioDiarioLitros <= 0) return { dias: 99, horas: 0, runway: 99 };
  
  const runwayDias = capacidadeReservatorioLitros / consumoMedioDiarioLitros;
  const diasInt = Math.floor(runwayDias);
  const horasExtras = Math.floor((runwayDias - diasInt) * 24);
  
  return {
    dias: diasInt,
    horas: horasExtras,
    runway: Number(runwayDias.toFixed(1))
  };
}

/**
 * Calcula a média de consumo de água dos últimos N dias.
 * 
 * @param {Array} historico - Array de registros diários do lote
 * @param {number} dias - Número de dias para considerar na média (default: 3)
 * @returns {number} Média diária de consumo de água em litros.
 */
export function calcularConsumoMedioAgua(historico, dias = 3) {
  if (!historico || historico.length === 0) return 0;
  
  const ultimosRegistros = historico.slice(-dias);
  const somaConsumo = ultimosRegistros.reduce((acc, reg) => acc + (reg.agua_litros || 0), 0);
  
  const diasValidos = ultimosRegistros.filter(r => r.agua_litros > 0).length || ultimosRegistros.length;
  
  return diasValidos > 0 ? somaConsumo / diasValidos : 0;
}
