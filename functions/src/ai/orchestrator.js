const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PROMPTS } = require('./prompts');
const { getFirestore } = require('firebase-admin/firestore');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

// Configurações dos Modelos
const modelSupervisor = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: { responseMimeType: "application/json" }
});

const modelEspecialista = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash"
});

/**
 * processarDataClerk
 * Função utilitária para salvar o rascunho de entrada de dados ou confirmá-lo.
 */
async function processarDataClerk(dados, idFazenda) {
  const db = getFirestore();
  const docRef = db.collection('fazendas').doc(idFazenda).collection('rascunho_agboy').doc('atual');

  if (dados.comando === 'RASCUNHO') {
    await docRef.set({
      dados_extraidos: dados.dados_extraidos,
      timestamp: new Date()
    });
    return `[Insight do DATA_CLERK]:\n${dados.mensagem_usuario}`;
  } 
  else if (dados.comando === 'SALVAR') {
    const rascunhoSnap = await docRef.get();
    if (!rascunhoSnap.exists) {
      return `[Insight do DATA_CLERK]:\nNão encontrei nenhum rascunho pendente para salvar.`;
    }
    const rascunho = rascunhoSnap.data();
    
    const idRegistro = 'reg_' + Date.now();
    await db.collection('fazendas').doc(idFazenda).collection('registros_diarios').doc(idRegistro).set({
      id_lote: rascunho.dados_extraidos?.lote || 'desconhecido',
      mortalidade_qtd: rascunho.dados_extraidos?.mortalidade_qtd || 0,
      racao_kg: rascunho.dados_extraidos?.racao_kg || 0,
      agua_litros: rascunho.dados_extraidos?.agua_litros || 0,
      data_str: new Date().toISOString().split('T')[0],
      data_registro_str: new Date().toISOString(),
      timestamp: new Date()
    });

    await docRef.delete();
    return `[Insight do DATA_CLERK]:\n${dados.mensagem_usuario || 'Dados salvos com sucesso no banco de dados!'}`;
  }
  else if (dados.comando === 'CANCELAR') {
    await docRef.delete();
    return `[Insight do DATA_CLERK]:\n${dados.mensagem_usuario || 'Rascunho cancelado.'}`;
  }

  return `[Insight do DATA_CLERK]:\n${dados.mensagem_usuario || 'Não entendi o comando.'}`;
}

/**
 * AgBoyOrchestrator
 * Avalia o pedido e delega para os sub-agentes apropriados, ou responde diretamente se for trivial.
 */
async function AgBoyOrchestrator(entrada, contextoFazenda, idFazenda) {
  if (!process.env.GEMINI_API_KEY) {
    return { text: "Ops! Estou offline no momento (Falta a API Key no servidor). Avise o suporte!", alertaCritico: false };
  }

  const textoUsuario = entrada.text || "[Mídia Enviada]";
  const supervisorPrompt = `${PROMPTS.SUPERVISOR}\n\nPEDIDO DO USUÁRIO: "${textoUsuario}"`;

  const partesSupervisor = [supervisorPrompt];
  if (entrada.media && entrada.media.base64) {
    partesSupervisor.push({
      inlineData: {
        data: entrada.media.base64,
        mimeType: entrada.media.mimeType
      }
    });
  }

  try {
    // 1. O Supervisor (Orquestrador) avalia o pedido
    const supResult = await modelSupervisor.generateContent(partesSupervisor);
    const supResText = supResult.response.text();
    
    let decisao = {};
    try {
      decisao = JSON.parse(supResText);
    } catch(e) {
      console.error("Erro no parse do supervisor JSON:", supResText);
      return { text: "Minha mente está um pouco confusa agora. Pode repetir a pergunta?", alertaCritico: false };
    }

    console.log("[AgBoy Supervisor] Decisão:", decisao);

    // Se o array estiver vazio, o supervisor acha que é trivial (saudação)
    if (!decisao.delegar_para || !Array.isArray(decisao.delegar_para) || decisao.delegar_para.length === 0) {
      return { text: decisao.resposta_direta || "Olá! Em que posso ajudar?", alertaCritico: false };
    }

    const agentesAtivos = decisao.delegar_para;
    console.log(`[AgBoy Supervisor] Delegando para: ${agentesAtivos.join(', ')}. Motivo: ${decisao.motivo}`);

    // 2. Executa os Agentes Delegados em paralelo
    const promessas = agentesAtivos.map(async (agenteNome) => {
      const isDataClerk = agenteNome === 'DATA_CLERK';
      
      const promptEspecialista = `${PROMPTS[agenteNome] || PROMPTS.ZOOTECNISTA}

=== DADOS DA FAZENDA ===
${contextoFazenda}
========================

PEDIDO DO USUÁRIO: "${textoUsuario}"
${isDataClerk ? "" : "Responda focando na sua especialidade de forma clara, profissional e com base estrita nos dados ou diretrizes técnicas."}`;
      
      const model = isDataClerk 
        ? genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } }) 
        : modelEspecialista;

      const partesEspecialista = [promptEspecialista];
      if (entrada.media && entrada.media.base64) {
        partesEspecialista.push({
          inlineData: {
            data: entrada.media.base64,
            mimeType: entrada.media.mimeType
          }
        });
      }
      
      const resAgente = await model.generateContent(partesEspecialista);
      const textoResp = resAgente.response.text();

      if (isDataClerk) {
        try {
          const dados = JSON.parse(textoResp);
          return await processarDataClerk(dados, idFazenda);
        } catch (e) {
          console.error("Erro no DATA_CLERK parse:", textoResp, e);
          return "[Insight do DATA_CLERK]: Não entendi muito bem. Pode repetir?";
        }
      }

      return `[Insight do ${agenteNome}]:\n${textoResp}`;
    });

    const insights = await Promise.all(promessas);

    let alertaCritico = false;
    let textResult = "";

    const insightsString = insights.join('\n\n');
    if (insightsString.includes('[ALERTA CRÍTICO]')) {
      alertaCritico = true;
    }

    // Se tiver apenas 1 agente, devolve a resposta dele "limpa"
    if (insights.length === 1) {
      textResult = insights[0].replace(/\[Insight do .*\]:\n/, '').replace(/\[ALERTA CRÍTICO\]/gi, '').trim();
      return { text: textResult, alertaCritico };
    }

    // 3. Consolidação Final
    // Se mais de 1 agente foi chamado, o Orquestrador junta as respostas num texto coeso.
    const consolidacaoPrompt = `Você é o AgBoy, a IA da AgTech Hero.
Um produtor enviou a seguinte mensagem: "${textoUsuario}"

Você consultou seus sub-agentes especialistas em paralelo. Aqui estão os relatórios deles:
${insightsString}

SUA TAREFA:
Crie uma resposta unificada, em texto super amigável, direto e profissional, fundindo esses insights. 
Como você atua tanto na plataforma Web quanto no WhatsApp, formate sua resposta com markdown simples (negrito, listas) e use emojis pertinentes. Não diga frases como "baseado no relatório dos especialistas", apenas dê a resposta consolidada como se fosse sua mente única. IMPORTANTE: Remova a palavra "[ALERTA CRÍTICO]" do seu texto caso ela apareça.`;
    
    const consResult = await modelEspecialista.generateContent(consolidacaoPrompt);
    textResult = consResult.response.text().replace(/\[ALERTA CRÍTICO\]/gi, '').trim();
    return { text: textResult, alertaCritico };

  } catch (error) {
    console.error("Erro no Orquestrador:", error);
    return { text: "Enfrentei um erro temporário nos meus circuitos ao processar seu pedido. Tente novamente em breve.", alertaCritico: false };
  }
}

module.exports = { AgBoyOrchestrator };
