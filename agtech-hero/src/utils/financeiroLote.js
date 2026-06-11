/**
 * Calcula o resumo financeiro a partir das transações de um lote.
 * 
 * @param {Array} transacoes - Lista de transações (objetos com { tipo, valor, ... }).
 * @param {number} quantidadeInicial - Quantidade inicial de aves no lote.
 * @returns {Object} Objeto contendo { receitaTotal, despesaTotal, lucroLiquido, custoPorAve }.
 */
export const calcularResumoFinanceiro = (transacoes, quantidadeInicial) => {
  let receitaTotal = 0;
  let despesaTotal = 0;

  if (Array.isArray(transacoes)) {
    transacoes.forEach(t => {
      const valor = Number(t.valor) || 0;
      if (t.tipo === 'receita') {
        receitaTotal += valor;
      } else if (t.tipo === 'despesa') {
        despesaTotal += valor;
      }
    });
  }

  const lucroLiquido = receitaTotal - despesaTotal;
  
  // Calcula o custo por ave baseado nas despesas totais divididas pela quantidade inicial
  const qtd = Number(quantidadeInicial) > 0 ? Number(quantidadeInicial) : 1;
  const custoPorAve = despesaTotal / qtd;

  return {
    receitaTotal,
    despesaTotal,
    lucroLiquido,
    custoPorAve
  };
};
