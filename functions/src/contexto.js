const logger = require('firebase-functions/logger');

/**
 * Constrói o contexto em texto claro sobre a fazenda e seus lotes
 * para ser injetado no prompt do LLM.
 * 
 * @param {Object} db - Instância do Firestore
 * @param {string} id_fazenda - ID da fazenda
 * @param {string} fazendaNome - Nome da fazenda
 * @returns {Promise<string>} Contexto em texto
 */
async function construirContextoFazenda(db, id_fazenda, fazendaNome) {
  const lotesSnap = await db.collection(`fazendas/${id_fazenda}/lotes`).where('status', '==', 'ativo').get();
  let contexto = `FAZENDA: ${fazendaNome}\nLOTES ATIVOS:\n`;
  
  for (let l of lotesSnap.docs) {
    const lData = l.data();
    const aptidao = lData.aptidao || 'corte';
    const idadeDias = lData.data_alojamento ? ((new Date() - lData.data_alojamento.toDate()) / 86400000 | 0) : 'Desconhecida';
    contexto += `\nLote: ${lData.linhagem} (Aptidão: ${aptidao})\nIdade(aprox): ${idadeDias} dias.\n`;
    
    // Busca todos os registros para calcular mortalidade acumulada
    const todosRegSnap = await db.collection(`fazendas/${id_fazenda}/registros_diarios`)
      .where('id_lote', '==', l.id)
      .get();
      
    let mortalidadeAcumulada = 0;
    todosRegSnap.forEach(r => {
       mortalidadeAcumulada += (r.data().mortalidade_qtd || 0);
    });
    const avesIniciais = lData.quantidade || 0;
    const avesAtivas = avesIniciais - mortalidadeAcumulada;
    
    contexto += `Aves Alojadas: ${avesIniciais}, Mortalidade Acumulada: ${mortalidadeAcumulada}, Aves Ativas: ${avesAtivas}\n`;
    
    if (lData.area_galpao_m2) {
        const densidade = avesAtivas / lData.area_galpao_m2;
        contexto += `Área do Galpão: ${lData.area_galpao_m2} m², Densidade Atual: ${densidade.toFixed(2)} aves/m²\n`;
    }

    // Busca últimos 7 registros (contexto de histórico)
    const regSnap = await db.collection(`fazendas/${id_fazenda}/registros_diarios`)
      .where('id_lote', '==', l.id)
      .orderBy('data_str', 'desc')
      .limit(7)
      .get();
      
    if (!regSnap.empty) {
      contexto += `Últimos 7 Manejos:\n`;
      regSnap.forEach(r => {
        const rData = r.data();
        contexto += `- ${rData.data_str}: Água: ${rData.agua_litros || 0}L, Ração: ${rData.racao_kg || 0}kg, Mort: ${rData.mortalidade_qtd || 0}, Temp: ${rData.temp_max || '--'}/${rData.temp_min || '--'}, Ovos: ${rData.producao_ovos_qtd || '--'}\n`;
      });
    } else {
      contexto += `Sem manejos.\n`;
    }
  }

  // 2.5 Buscar Benchmarks do Data Lake (Sprint 30)
  try {
    const lakeSnap = await db.collection('benchmarks_anonimos').orderBy('timestamp_exportacao', 'desc').limit(5).get();
    if (!lakeSnap.empty) {
      contexto += `\nBENCHMARK REGIONAL (Data Lake - Inteligência Coletiva):\n`;
      let count = 1;
      lakeSnap.forEach(b => {
        const bData = b.data();
        contexto += `Lote Fechado ${count++} -> CA: ${bData.ca || 'N/A'}, Mortalidade: ${bData.mortalidade || 'N/A'}%, GPD: ${bData.gpd || 'N/A'}g\n`;
      });
      contexto += `Use estes dados do Data Lake anonimizado para comparar o desempenho atual da fazenda do usuário e sugerir melhorias de ROI e CA se ele perguntar.\n`;
    }
  } catch (err) {
    logger.error('Erro ao buscar Data Lake no contexto:', err);
  }

  return contexto;
}

module.exports = {
  construirContextoFazenda
};
