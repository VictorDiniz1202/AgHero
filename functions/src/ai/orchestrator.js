const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const { PROMPTS } = require('./prompts');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

let genAI = null;
let anthropic = null;

async function inicializarModelos() {
  let geminiKey = process.env.GEMINI_API_KEY;
  let anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!geminiKey || geminiKey === 'dummy_key' || !anthropicKey || anthropicKey === 'dummy_key') {
    const db = getFirestore();
    const configSnap = await db.collection('config').doc('agboy').get();
    if (configSnap.exists) {
      const configData = configSnap.data();
      if (!geminiKey || geminiKey === 'dummy_key') {
        geminiKey = configData.gemini_api_key;
      }
      if (!anthropicKey || anthropicKey === 'dummy_key') {
        anthropicKey = configData.anthropic_api_key;
      }
    }
  }

  if (geminiKey && geminiKey !== 'dummy_key') {
    genAI = new GoogleGenerativeAI(geminiKey);
  }
  if (anthropicKey && anthropicKey !== 'dummy_key') {
    anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  if (!genAI && !anthropic) {
    throw new Error('Nenhuma API Key (Gemini ou Anthropic) configurada.');
  }
}

// Definição das ferramentas no formato original do Gemini
const AGBOY_TOOLS_GEMINI = [
  {
    functionDeclarations: [
      {
        name: 'criar_rascunho_manejo',
        description: 'Cria um rascunho de manejo diário a ser confirmado.',
        parameters: {
          type: 'object',
          properties: {
            lote: { type: 'string', description: 'ID do lote' },
            mortalidade_qtd: { type: 'number' },
            racao_kg: { type: 'number' },
            agua_litros: { type: 'number' },
            temp_max: { type: 'number' },
            temp_min: { type: 'number' },
            umidade_relativa: { type: 'number' },
            exaustores: { type: 'string' },
            outros_dados: { type: 'string' },
            observacoes: { type: 'string' }
          },
          required: ['lote']
        }
      },
      {
        name: 'salvar_rascunho_manejo_confirmado',
        description: 'Salva definitivamente o rascunho de manejo.'
      },
      {
        name: 'cancelar_rascunho_manejo',
        description: 'Deleta o rascunho de manejo ativo.'
      },
      {
        name: 'criar_rascunho_financeiro',
        description: 'Cria um rascunho de transação financeira.',
        parameters: {
          type: 'object',
          properties: {
            tipo: { type: 'string', description: 'receita ou despesa' },
            valor: { type: 'number' },
            descricao: { type: 'string' },
            data: { type: 'string' },
            lote: { type: 'string' },
            confianca_extracao: { type: 'string', description: 'Alta, Media ou Baixa baseada na legibilidade da imagem ou PDF da nota fiscal' }
          },
          required: ['tipo', 'valor', 'descricao', 'confianca_extracao']
        }
      },
      {
        name: 'salvar_rascunho_financeiro_confirmado',
        description: 'Salva definitivamente o rascunho financeiro ativo.'
      },
      {
        name: 'cancelar_rascunho_financeiro',
        description: 'Deleta o rascunho financeiro ativo.'
      }
    ]
  }
];

// Converte dinamicamente as ferramentas do Gemini para o formato da Anthropic (Claude)
const AGBOY_TOOLS_ANTHROPIC = AGBOY_TOOLS_GEMINI[0].functionDeclarations.map(fd => {
  const tool = {
    name: fd.name,
    description: fd.description
  };
  if (fd.parameters) {
    tool.input_schema = fd.parameters;
  } else {
    tool.input_schema = {
      type: 'object',
      properties: {}
    };
  }
  return tool;
});

/**
 * escolherProvedor
 * Retorna qual provedor usar dependendo da preferência ('gemini' ou 'anthropic') e disponibilidade das chaves.
 */
function escolherProvedor(preferencia) {
  if (preferencia === 'anthropic' && anthropic) return 'anthropic';
  if (preferencia === 'gemini' && genAI) return 'gemini';
  return genAI ? 'gemini' : (anthropic ? 'anthropic' : null);
}

// Mimetypes de imagem aceitos pela API de mensagens da Anthropic (Claude).
// Qualquer outro tipo (ex: áudio, PDF) é ignorado no bloco de imagem para evitar
// TypeError (mimeType undefined/null) e erros 400 da API por tipo não suportado.
const CLAUDE_IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * comTimeout
 * Envolve uma Promise em um timeout para evitar que as functions sejam mortas
 * pelo limite global de tempo.
 */
function comTimeout(promessa, ms = 90000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT_LLM')), ms);
  });
  return Promise.race([promessa, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * callLLM
 * Helper unificado para chamadas de IA de turno único (Single-turn)
 */
async function callLLM({ provider, systemPrompt, prompt, media, responseMimeType }) {
  if (provider === 'gemini') {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: responseMimeType === "application/json" ? { responseMimeType: "application/json" } : undefined
    });

    const promptParts = [systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt];
    if (media && media.base64) {
      promptParts.push({
        inlineData: {
          data: media.base64,
          mimeType: media.mimeType
        }
      });
    }

    const result = await comTimeout(model.generateContent(promptParts), 45000);
    return result.response.text();
  } 
  
  if (provider === 'anthropic') {
    const messages = [];
    const content = [];

    // Anthropic só suporta imagens via base64 na API de mensagens diretamente
    if (media && media.base64 && media.mimeType && CLAUDE_IMAGE_MIMETYPES.includes(media.mimeType)) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: media.mimeType,
          data: media.base64
        }
      });
    }

    content.push({
      type: 'text',
      text: prompt
    });

    messages.push({
      role: 'user',
      content: content
    });

    const response = await comTimeout(anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: systemPrompt || undefined,
      messages: messages
    }), 45000);

    const textBlock = response.content.find(c => c.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  throw new Error("Provedor inválido ou não inicializado.");
}

/**
 * callLLMComFallback
 * Executa callLLM no provedor preferido; se a chamada falhar por erro de rede/API
 * (timeout, 5xx, rate-limit, etc.), tenta automaticamente o provedor alternativo
 * (Gemini <-> Claude) antes de propagar o erro.
 */
async function callLLMComFallback(params) {
  const providerPrimario = params.provider;
  try {
    return await callLLM(params);
  } catch (error) {
    console.error(`[callLLM] Falha no provedor '${providerPrimario}':`, error.message);
    const providerAlternativo = providerPrimario === 'gemini' ? 'anthropic' : 'gemini';
    if (escolherProvedor(providerAlternativo) !== providerAlternativo) {
      throw error; // Sem provedor alternativo disponível, propaga o erro original
    }
    console.warn(`[callLLM] Tentando fallback para '${providerAlternativo}'...`);
    return await callLLM({ ...params, provider: providerAlternativo });
  }
}

/**
 * executarFerramentaDataClerk
 * Função que interage com o banco de dados conforme a tool solicitada pelo LLM.
 */
async function executarFerramentaDataClerk(nomeFerramenta, args, idFazenda, userId) {
  const db = getFirestore();
  const baseId = String(userId || '').trim();
  if (!baseId) {
    return { sucesso: false, mensagem: "Não foi possível identificar o remetente." };
  }
  
  const docRef = db.collection('fazendas').doc(idFazenda).collection('rascunho_agboy').doc(baseId);
  const docFinRef = db.collection('fazendas').doc(idFazenda).collection('rascunho_agboy').doc(`${baseId}_financeiro`);

  try {
    if (nomeFerramenta === 'criar_rascunho_manejo') {
      await docRef.set({
        dados_extraidos: args,
        timestamp: new Date()
      });
      return { sucesso: true, mensagem: "Rascunho de manejo criado. Solicite confirmação." };
    } 
    else if (nomeFerramenta === 'salvar_rascunho_manejo_confirmado') {
      const rascunhoSnap = await docRef.get();
      if (!rascunhoSnap.exists) {
        return { sucesso: false, mensagem: "Não encontrei nenhum rascunho pendente para salvar." };
      }
      const rascunho = rascunhoSnap.data();
      const tsMillis = rascunho.timestamp && rascunho.timestamp.toMillis ? rascunho.timestamp.toMillis() : (rascunho.timestamp ? new Date(rascunho.timestamp).getTime() : 0);
      if (Date.now() - tsMillis > 600000) {
        await docRef.delete();
        return { sucesso: false, mensagem: "O rascunho expirou (mais de 10 minutos)." };
      }

      const dadosExtraidos = rascunho.dados_extraidos || {};
      const id_lote = dadosExtraidos.lote || 'desconhecido';
      const data_str = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      const idRegistro = `${id_lote}_${data_str}`;

      const payload = {
        id_lote: id_lote,
        data_str: data_str,
        data_registro_str: data_str,
        data_registro: FieldValue.serverTimestamp(),
        timestamp: FieldValue.serverTimestamp()
      };

      // Campos cumulativos do dia: somam ao que já foi lançado (várias entradas/dia),
      // em vez de sobrescrever o total já registrado.
      ['mortalidade_qtd', 'racao_kg', 'agua_litros'].forEach((campo) => {
        if (dadosExtraidos[campo]) {
          payload[campo] = FieldValue.increment(dadosExtraidos[campo]);
        }
      });

      // Campos de estado/observação: só sobrescrevem se informados neste lançamento,
      // preservando valores já registrados anteriormente no dia.
      ['temp_max', 'temp_min', 'umidade_relativa', 'exaustores', 'outros_dados', 'observacoes'].forEach((campo) => {
        if (dadosExtraidos[campo] !== undefined && dadosExtraidos[campo] !== null) {
          payload[campo] = dadosExtraidos[campo];
        }
      });

      await db.collection('fazendas').doc(idFazenda).collection('registros_diarios').doc(idRegistro).set(payload, { merge: true });

      await docRef.delete();
      return { sucesso: true, mensagem: "Manejo salvo com sucesso no banco de dados." };
    }
    else if (nomeFerramenta === 'cancelar_rascunho_manejo') {
      await docRef.delete();
      return { sucesso: true, mensagem: "Rascunho de manejo cancelado." };
    }
    else if (nomeFerramenta === 'criar_rascunho_financeiro') {
      if (args.valor <= 0) {
        return { sucesso: false, mensagem: "O valor não pode ser menor ou igual a zero. Peça ao usuário o valor correto." };
      }
      
      const confianca = args.confianca_extracao ? args.confianca_extracao.toLowerCase() : 'alta';
      const avisoConfianca = confianca !== 'alta' ? " \n⚠️ A IA teve dificuldade em ler os dados originais. Confira os valores atentamente antes de confirmar." : "";

      await docFinRef.set({
        dados_extraidos: { financeiro: args, lote: args.lote },
        timestamp: new Date()
      });
      return { sucesso: true, mensagem: `Rascunho financeiro criado. Solicite confirmação.${avisoConfianca}` };
    }
    else if (nomeFerramenta === 'salvar_rascunho_financeiro_confirmado') {
      const rascunhoSnap = await docFinRef.get();
      if (!rascunhoSnap.exists) {
        return { sucesso: false, mensagem: "Não encontrei nenhuma transação pendente para salvar." };
      }
      const rascunho = rascunhoSnap.data();
      const tsMillis = rascunho.timestamp && rascunho.timestamp.toMillis ? rascunho.timestamp.toMillis() : (rascunho.timestamp ? new Date(rascunho.timestamp).getTime() : 0);
      if (Date.now() - tsMillis > 600000) {
        await docFinRef.delete();
        return { sucesso: false, mensagem: "O rascunho financeiro expirou." };
      }
      const financeiro = rascunho.dados_extraidos?.financeiro;
      if (financeiro && financeiro.valor) {
        const idTransacao = 'trans_' + Date.now();
        const idLote = rascunho.dados_extraidos?.lote || 'geral';
        await db.collection('fazendas').doc(idFazenda).collection('lotes').doc(idLote).collection('transacoes').doc(idTransacao).set({
          id_lote: idLote,
          tipo: financeiro.tipo || 'despesa',
          valor: financeiro.valor,
          descricao: financeiro.descricao || 'Lançamento via IA',
          data_str: financeiro.data || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
          timestamp_registro: FieldValue.serverTimestamp()
        });
        await docFinRef.delete();
        return { sucesso: true, mensagem: "Transação salva com sucesso." };
      }
      return { sucesso: false, mensagem: "Dados incompletos no rascunho." };
    }
    else if (nomeFerramenta === 'cancelar_rascunho_financeiro') {
      await docFinRef.delete();
      return { sucesso: true, mensagem: "Rascunho financeiro cancelado." };
    }
    return { sucesso: false, mensagem: `Tool desconhecida: ${nomeFerramenta}` };
  } catch (error) {
    console.error("Erro na execucao da tool:", error);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * executarDataClerkGemini
 * Loop de function-calling do DATA_CLERK usando Gemini (chat multi-turno nativo).
 * Pode lançar (throw) em caso de erro de rede/API do Gemini, permitindo que o
 * chamador faça fallback para o Claude.
 */
async function executarDataClerkGemini(promptEspecialista, entrada, idFazenda) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: AGBOY_TOOLS_GEMINI
  });
  const chat = model.startChat();
  let iteracoes = 0;

  const partesEspecialista = [promptEspecialista];
  if (entrada.media && entrada.media.base64) {
    partesEspecialista.push({
      inlineData: {
        data: entrada.media.base64,
        mimeType: entrada.media.mimeType
      }
    });
  }

  let result = await comTimeout(chat.sendMessage(partesEspecialista), 45000);
  let response = result.response;

  while (true) {
    const functionCalls = response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) break;

    if (++iteracoes > 5) {
      console.warn("[DATA_CLERK] Limite de tool calling atingido.");
      break;
    }

    const functionResponseParts = await Promise.all(
      functionCalls.map(async (call) => {
        const toolResult = await executarFerramentaDataClerk(call.name, call.args, idFazenda, entrada.userId);
        return {
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        };
      })
    );

    result = await comTimeout(chat.sendMessage(functionResponseParts), 45000);
    response = result.response;
  }

  return `[Insight do DATA_CLERK]:\n${response.text()}`;
}

/**
 * executarDataClerkClaude
 * Loop de tool-use do DATA_CLERK usando Claude (mensagens + tool_result manuais).
 * Pode lançar (throw) em caso de erro de rede/API da Anthropic.
 */
async function executarDataClerkClaude(contextoFazenda, textoUsuario, entrada, idFazenda) {
  const messages = [];
  const content = [];

  if (entrada.media && entrada.media.base64 && entrada.media.mimeType && CLAUDE_IMAGE_MIMETYPES.includes(entrada.media.mimeType)) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: entrada.media.mimeType,
        data: entrada.media.base64
      }
    });
  }
  content.push({
    type: 'text',
    text: `=== DADOS DA FAZENDA ===\n${contextoFazenda}\n\nPEDIDO DO USUÁRIO: "${textoUsuario}"`
  });

  messages.push({
    role: 'user',
    content: content
  });

  let iteracoes = 0;
  while (true) {
    const response = await comTimeout(anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      system: PROMPTS.DATA_CLERK,
      messages: messages,
      tools: AGBOY_TOOLS_ANTHROPIC
    }), 45000);

    messages.push({
      role: 'assistant',
      content: response.content
    });

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find(c => c.type === 'text');
      return `[Insight do DATA_CLERK]:\n${textBlock ? textBlock.text : ''}`;
    }

    if (++iteracoes > 5) {
      console.warn("[DATA_CLERK] Limite de tool calling atingido no Claude.");
      const textBlock = response.content.find(c => c.type === 'text');
      return `[Insight do DATA_CLERK]:\n${textBlock ? textBlock.text : 'Aviso: limite de iterações atingido.'}`;
    }

    const toolUses = response.content.filter(c => c.type === 'tool_use');
    const toolResults = await Promise.all(
      toolUses.map(async (toolUse) => {
        const toolResult = await executarFerramentaDataClerk(toolUse.name, toolUse.input, idFazenda, entrada.userId);
        return {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult)
        };
      })
    );

    messages.push({
      role: 'user',
      content: toolResults
    });
  }
}

/**
 * AgBoyOrchestrator
 * Avalia o pedido e delega para os sub-agentes apropriados, ou responde diretamente se for trivial.
 */
async function AgBoyOrchestrator(entrada, contextoFazenda, idFazenda) {
  try {
    await inicializarModelos();
  } catch (error) {
    return { text: "Ops! Estou offline no momento (Falta a API Key no servidor). Avise o suporte!", alertaCritico: false };
  }

  let textoUsuario = entrada.text || "[Mídia Enviada]";
  if (entrada.media && entrada.media.error) {
    textoUsuario += `\n[AVISO AO AGBOY]: O usuário enviou uma mídia, mas houve falha técnica ao baixá-la. Informe-o amigavelmente e peça para enviar novamente. Erro técnico: ${entrada.media.error}`;
  }
  
  // Decidir provedor para o Supervisor
  const providerSupervisor = escolherProvedor('gemini');
  if (!providerSupervisor) {
    return { text: "Erro: Nenhum provedor de IA (Gemini ou Claude) está ativo no momento.", alertaCritico: false };
  }

  try {
    // 1. O Supervisor (Orquestrador) avalia o pedido
    const supResText = await callLLMComFallback({
      provider: providerSupervisor,
      systemPrompt: PROMPTS.SUPERVISOR,
      prompt: `PEDIDO DO USUÁRIO: "${textoUsuario}"`,
      media: entrada.media,
      responseMimeType: "application/json"
    });
    
    let decisao = {};
    try {
      let cleanJson = supResText.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }
      decisao = JSON.parse(cleanJson);
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

      if (isDataClerk) {
        const ehPdf = !!(entrada.media && entrada.media.mimeType === 'application/pdf');
        let providerDataClerk = ehPdf ? 'gemini' : escolherProvedor('gemini');

        if (providerDataClerk === 'gemini') {
          try {
            return await executarDataClerkGemini(promptEspecialista, entrada, idFazenda);
          } catch (e) {
            console.error("Erro no DATA_CLERK Gemini:", e);
            if (escolherProvedor('anthropic') === 'anthropic') {
              console.warn("[DATA_CLERK] Tentando fallback para Claude...");
              providerDataClerk = 'anthropic';
            } else {
              return "[Insight do DATA_CLERK]: Falha ao processar comando via Gemini.";
            }
          }
        }

        if (providerDataClerk === 'anthropic') {
          try {
            return await executarDataClerkClaude(contextoFazenda, textoUsuario, entrada, idFazenda);
          } catch (e) {
            console.error("Erro no DATA_CLERK Claude:", e);
            return "[Insight do DATA_CLERK]: Falha ao processar comando via Claude.";
          }
        }
      }

      // Outros especialistas (Clínico, Zootecnista, Financeiro)
      // O Clínico só usa Claude (mais caro) quando há IMAGEM para análise visual.
      // Perguntas clínicas em texto puro vão para o Gemini (mais barato), preservando
      // o orçamento de IA por cliente (meta ~R$1,39/mês/cliente).
      const temImagemParaClaude = !!(entrada.media && entrada.media.base64 && entrada.media.mimeType && CLAUDE_IMAGE_MIMETYPES.includes(entrada.media.mimeType));
      const ehPdf = !!(entrada.media && entrada.media.mimeType === 'application/pdf');
      const prefProvedor = (agenteNome === 'CLINICO' && temImagemParaClaude) ? 'anthropic' : (ehPdf ? 'gemini' : 'gemini');
      const providerAgente = escolherProvedor(prefProvedor);

      try {
        const textoResp = await callLLMComFallback({
          provider: providerAgente,
          systemPrompt: PROMPTS[agenteNome] || PROMPTS.ZOOTECNISTA,
          prompt: `=== DADOS DA FAZENDA ===\n${contextoFazenda}\n\nPEDIDO DO USUÁRIO: "${textoUsuario}"\n\nResponda focando na sua especialidade de forma clara, profissional e com base estrita nos dados ou diretrizes técnicas.`,
          media: entrada.media
        });
        return `[Insight do ${agenteNome}]:\n${textoResp}`;
      } catch (e) {
        console.error(`Erro no subagente ${agenteNome}:`, e);
        return `[Insight do ${agenteNome}]: Falha de processamento no subagente.`;
      }
    });

    const resultados = await Promise.allSettled(promessas);
    const insights = resultados
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    // Log rejections
    resultados.forEach((r, idx) => {
      if (r.status === 'rejected') {
        console.error(`Falha no subagente ${agentesAtivos[idx]}:`, r.reason);
      }
    });

    if (insights.length === 0) {
      return { text: "Ops, ocorreu um erro interno de conexão ao analisar sua solicitação. Por favor, tente novamente.", alertaCritico: false };
    }

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
    const providerConsolidador = escolherProvedor('gemini');
    const consolidacaoPrompt = `Você é o AgBoy, a IA da AgTech Hero.
Um produtor enviou a seguinte mensagem: "${textoUsuario}"

Você consultou seus sub-agentes especialistas em paralelo. Aqui estão os relatórios deles:
${insightsString}

SUA TAREFA:
Crie uma resposta unificada, em texto super amigável, direto e profissional, fundindo esses insights. 
Como você atua tanto na plataforma Web quanto no WhatsApp, formate sua resposta com markdown simples (negrito, listas) e use emojis pertinentes. Não diga frases como "baseado no relatório dos especialistas", apenas dê a resposta consolidada como se fosse sua mente única. IMPORTANTE: Remova a palavra "[ALERTA CRÍTICO]" do seu texto caso ela apareça.`;
    
    const consolidadoText = await callLLMComFallback({
      provider: providerConsolidador,
      prompt: consolidacaoPrompt
    });

    textResult = consolidadoText.replace(/\[ALERTA CRÍTICO\]/gi, '').trim();
    return { text: textResult, alertaCritico };

  } catch (error) {
    console.error("Erro no Orquestrador:", error);
    return { text: "Enfrentei um erro temporário nos meus circuitos ao processar seu pedido. Tente novamente em breve.", alertaCritico: false };
  }
}

module.exports = { AgBoyOrchestrator };
