/**
 * Utilitário para exportação de relatórios zootécnicos e financeiros
 * em formato CSV, otimizado para o Microsoft Excel com BOM UTF-8.
 */

const CSV_BOM = '\uFEFF';

/**
 * Converte um array de objetos em string CSV.
 */
function compilarCSV(cabecalhos, linhas) {
  const linhaCabecalho = cabecalhos.join(';');
  const corpo = linhas.map(linha => 
    linha.map(celula => `"${String(celula).replace(/"/g, '""')}"`).join(';')
  ).join('\n');
  return `${CSV_BOM}${linhaCabecalho}\n${corpo}`;
}

/**
 * Gera o CSV baseado no tipo do relatório solicitado.
 * @param {string} tipoRelatorio - "Sanitário", "Consumo" ou "Completo"
 * @param {Object} registros - Dados compilados dos serviços (diarios, sanitarios, pesagens, etc)
 * @param {string} aptidaoLote - "corte" ou "postura"
 */
export function gerarCSV(tipoRelatorio, registros, aptidaoLote) {
  if (tipoRelatorio === 'Sanitário') {
    const cabecalhos = ['Data', 'Idade (Dias)', 'Tipo de Intervenção', 'Produto/Vacina', 'Dosagem', 'Observações'];
    const linhas = (registros.sanitarios || []).map(r => [
      r.data_registro_str || r.data_aplicacao_str || '',
      r.idadeDias || '',
      r.tipo || 'Aplicação/Tratamento',
      r.produto || r.vacina || '',
      r.dosagem || r.ml_dose || '',
      r.observacoes || ''
    ]);
    return compilarCSV(cabecalhos, linhas);
  }

  if (tipoRelatorio === 'Consumo') {
    const cabecalhos = ['Data', 'Idade (Dias)', 'Mortalidade', 'Consumo de Água (L)', 'Consumo Ração (kg)', 'Temp Máxima (°C)', 'Umidade (%)', 'ITU'];
    const linhas = (registros.diarios || []).map(r => [
      r.data_registro_str || '',
      r.idadeDias || '',
      r.mortalidade || 0,
      r.consumo_agua || 0,
      r.consumo_racao || 0,
      r.temperatura_max || '',
      r.umidade_relativa || '',
      r.itu || ''
    ]);
    return compilarCSV(cabecalhos, linhas);
  }

  if (tipoRelatorio === 'Completo') {
    // Para tabela zootécnica completa, juntamos todos os dias que possuem dados diários.
    const cabecalhos = [
      'Data', 'Idade (Dias)', 'Mortalidade', 'Ração (kg)', 'Água (L)', 
      aptidaoLote === 'postura' ? 'Ovos Produzidos' : 'Peso Médio (g)',
      aptidaoLote === 'postura' ? '% Postura' : 'GPD (g)',
      'Temp Máx', 'Umidade', 'ITU'
    ];

    const linhas = (registros.diarios || []).map(r => [
      r.data_registro_str || '',
      r.idadeDias || '',
      r.mortalidade || 0,
      r.consumo_racao || 0,
      r.consumo_agua || 0,
      aptidaoLote === 'postura' ? (r.ovos_produzidos || 0) : (r.peso_medio || 0),
      aptidaoLote === 'postura' ? (r.taxa_postura || 0) : (r.gpd || 0),
      r.temperatura_max || '',
      r.umidade_relativa || '',
      r.itu || ''
    ]);
    return compilarCSV(cabecalhos, linhas);
  }

  return '';
}
