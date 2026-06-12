/**
 * functions/index.js
 *
 * Cloud Functions do Agtech (2ª geração / Node.js).
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');

initializeApp();
const db = getFirestore();

const PLANO_PADRAO = 'Essencial';

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Enviar Mensagem via Evolution API (WhatsApp)
// ─────────────────────────────────────────────────────────────────────────
async function sendWhatsAppMessage(phone, text) {
  const url = process.env.EVOLUTION_URL;
  const instance = process.env.EVOLUTION_INSTANCE;
  const apikey = process.env.EVOLUTION_API_KEY;

  if (!url || !instance || !apikey) {
    logger.warn('[Evolution API] Variáveis ausentes, webhook não configurado corretamente.');
    return;
  }

  // A Evolution API requer o DDI (ex: 55) para envio, sem o "+" e sem caracteres especiais.
  const number = phone.replace(/\D/g, '');

  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apikey,
      },
      body: JSON.stringify({
        number: number,
        options: { delay: 1200 },
        textMessage: { text },
      }),
    });
    if (!res.ok) {
      logger.error(`[Evolution API] Erro ao enviar para ${number}: ${res.status}`);
    } else {
      logger.info(`[Evolution API] Mensagem enviada para ${number} com sucesso.`);
    }
  } catch (err) {
    logger.error(`[Evolution API] Falha de rede:`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PUSH: Alertas Emergenciais Ativos (Mortalidade e Anomalias)
// ─────────────────────────────────────────────────────────────────────────
exports.onRegistroDiarioEscrito = onDocumentWritten(
  'fazendas/{id_fazenda}/registros_diarios/{id_registro}',
  async (event) => {
    const { id_fazenda, id_registro } = event.params;

    if (!event.data?.after?.exists) return;
    const registro = event.data.after.data();

    let fazenda;
    try {
      const fazendaSnap = await db.doc(`fazendas/${id_fazenda}`).get();
      if (!fazendaSnap.exists) return;
      fazenda = fazendaSnap.data();
    } catch (erro) {
      logger.error(`Falha ao ler a fazenda "${id_fazenda}":`, erro);
      return;
    }

    // 1. Verificar Anomalias e Predições (AgBoy Proativo)
    const qtdMortalidade = registro.mortalidade_qtd ?? 0;
    const qtdAgua = registro.agua_litros ?? 0;
    const qtdRacao = registro.racao_kg ?? 0;
    
    // Busca os últimos 3 registros do mesmo lote para calcular média móvel
    const ultimosRegistrosSnap = await db.collection(`fazendas/${id_fazenda}/registros_diarios`)
      .where('id_lote', '==', registro.id_lote)
      .where('data_str', '<', registro.data_str || '9999-99-99') // Pega os anteriores ao dia de hoje
      .orderBy('data_str', 'desc')
      .limit(3)
      .get();
      
    let mediaAgua = 0;
    let mediaRacao = 0;
    let registrosAnt = 0;
    
    ultimosRegistrosSnap.forEach(r => {
       const d = r.data();
       mediaAgua += (d.agua_litros || 0);
       mediaRacao += (d.racao_kg || 0);
       registrosAnt++;
    });
    
    if (registrosAnt > 0) {
       mediaAgua = mediaAgua / registrosAnt;
       mediaRacao = mediaRacao / registrosAnt;
    }
    
    const contatoAdmin = fazenda.contatos_autorizados?.[0] || fazenda.veterinario_responsavel?.whatsapp;
    
    let alertasAgBoy = [];
    
    // Regra 1: Mortalidade crítica (MVP: > 10 aves)
    if (qtdMortalidade > 10) {
      alertasAgBoy.push(`- Alta Mortalidade: ${qtdMortalidade} aves.`);
    }
    
    // Regra 2: Queda brusca de consumo de água (> 15% abaixo da média)
    if (registrosAnt > 0 && mediaAgua > 0 && qtdAgua < mediaAgua * 0.85) {
      alertasAgBoy.push(`- Queda de Consumo de Água: ${qtdAgua}L (Média: ${mediaAgua.toFixed(1)}L, queda > 15%). Possível estresse térmico ou enfermidade.`);
    }
    
    // Regra 3: Queda brusca de ração
    if (registrosAnt > 0 && mediaRacao > 0 && qtdRacao < mediaRacao * 0.85) {
      alertasAgBoy.push(`- Queda de Consumo de Ração: ${qtdRacao}kg (Média: ${mediaRacao.toFixed(1)}kg, queda > 15%).`);
    }
    
    if (alertasAgBoy.length > 0 && contatoAdmin) {
       const msg = `🚨 *ALERTA PROATIVO AGBOY* 🚨\n\nIdentifiquei anomalias nos registros de hoje (Lote ${registro.id_lote}):\n\n${alertasAgBoy.join('\n')}\n\nAcesse o painel para verificar os dados ou me envie uma foto se notar sintomas visíveis.`;
       await sendWhatsAppMessage(contatoAdmin, msg);
       
       // Grava no histórico de alertas da fazenda para o Dashboard Web ler
       await db.collection(`fazendas/${id_fazenda}/alertas_enviados`).add({
         tipo: 'anomalia_proativa',
         detalhe: 'Desvio de padrão detectado no manejo diário',
         mensagem_gerada: alertasAgBoy.join('\n'),
         data_envio: new Date(),
         status_envio: 'enviado',
         id_lote: registro.id_lote
       });
    }

    // 2. Disparo Legado n8n (opcional se ainda usar workflow)
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      const payload = {
        id_fazenda,
        nome_fazenda: fazenda.nome ?? '',
        plano: fazenda.plano ?? PLANO_PADRAO,
        contatos_autorizados: fazenda.contatos_autorizados ?? [],
        registro: {
          id_registro,
          id_lote: registro.id_lote ?? '',
          data_registro_str: registro.data_registro_str ?? '',
          agua_litros: registro.agua_litros ?? 0,
          racao_kg: registro.racao_kg ?? 0,
          mortalidade_qtd: registro.mortalidade_qtd ?? 0,
          temp_max: registro.temp_max ?? 0,
          temp_min: registro.temp_min ?? 0,
          observacoes: registro.observacoes ?? '',
        },
      };
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        // Ignora erros de rede pro n8n local
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// PULL: Chatbot Interativo via Webhook (AgBoy RAG)
// ─────────────────────────────────────────────────────────────────────────
exports.agboyWebhook = onRequest(async (req, res) => {
  try {
    const body = req.body;
    
    // Validar estrutura da Evolution API
    // { event: 'messages.upsert', data: { key: { remoteJid }, message: { conversation } } }
    if (!body || !body.data || !body.data.key) {
      return res.status(200).send('Ignorado');
    }

    const remoteJid = body.data.key.remoteJid;
    if (!remoteJid || remoteJid.includes('@g.us')) return res.status(200).send('Grupos ignorados');

    const msgObj = body.data.message;
    if (!msgObj) return res.status(200).send('Sem mensagem');

    const text = msgObj.conversation || msgObj.extendedTextMessage?.text || "";

    let media = null;
    if (msgObj.audioMessage) {
      media = {
        type: 'audio',
        mimeType: msgObj.audioMessage.mimetype,
        url: msgObj.audioMessage.url,
        base64: msgObj.audioMessage.base64 || body.data?.message?.base64
      };
    } else if (msgObj.imageMessage) {
      media = {
        type: 'image',
        mimeType: msgObj.imageMessage.mimetype,
        url: msgObj.imageMessage.url,
        base64: msgObj.imageMessage.base64 || body.data?.message?.base64
      };
    }

    if (!text && !media) return res.status(200).send('Sem texto ou midia');

    // Extrai número limpo
    const phone = remoteJid.split('@')[0];

    // 1. Identificar Fazenda do remetente
    const snapshot = await db.collection('fazendas').get();
    let targetFazenda = null;
    let targetFazendaId = null;

    snapshot.forEach(doc => {
      const data = doc.data();
      const contatos = data.contatos_autorizados || [];
      const vetPhone = data.veterinario_responsavel?.whatsapp?.replace(/\D/g, '');
      
      // Checa contatos
      const contatosLimpos = contatos.map(c => c.replace(/\D/g, ''));
      if (contatosLimpos.includes(phone) || vetPhone === phone) {
        targetFazenda = data;
        targetFazendaId = doc.id;
      }
    });

    if (!targetFazenda) {
      // Se for número não cadastrado, pode optar por responder ou não.
      // await sendWhatsAppMessage(phone, "Olá! Sou o AgBoy. Este número não está associado a nenhuma fazenda no sistema.");
      return res.status(200).send('Não autorizado');
    }

    // Apenas responde se o plano for Pro/Inteligente, ou responde com upsell
    if (targetFazenda.plano !== 'Inteligente' && targetFazenda.plano !== 'Pro') {
      await sendWhatsAppMessage(phone, "Olá! Sou o AgBoy. Vi que sua fazenda não possui o Plano Inteligente ativo. Acesse o painel web para fazer o upgrade e liberar o assistente no WhatsApp!");
      return res.status(200).send('Plano insuficiente');
    }

    // 2. Coletar Contexto do RAG (Últimos dados)
    const lotesSnap = await db.collection(`fazendas/${targetFazendaId}/lotes`).where('status', '==', 'ativo').get();
    let contexto = `FAZENDA: ${targetFazenda.nome}\nLOTES ATIVOS:\n`;
    
    for (let l of lotesSnap.docs) {
      const lData = l.data();
      contexto += `\nLote: ${lData.linhagem}\nIdade(aprox): ${(new Date() - lData.data_alojamento?.toDate()) / 86400000 | 0} dias.\n`;
      
      // Busca últimos 3 registros
      const regSnap = await db.collection(`fazendas/${targetFazendaId}/registros_diarios`)
        .where('id_lote', '==', l.id)
        .orderBy('data_str', 'desc')
        .limit(3)
        .get();
        
      if (!regSnap.empty) {
        contexto += `Últimos Manejos:\n`;
        regSnap.forEach(r => {
          const rData = r.data();
          contexto += `- ${rData.data_str}: ${rData.agua_litros || 0}L água, ${rData.racao_kg || 0}kg ração, Mort: ${rData.mortalidade_qtd || 0}. TempMax: ${rData.temp_max || '--'}\n`;
        });
      } else {
        contexto += `Sem manejos registrados.\n`;
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
      logger.error('Erro ao buscar Data Lake:', err);
    }

    // 3. Roteamento Multi-Agente (AgBoy Orchestrator)
    const isSOS = text && (text.trim().toLowerCase() === 'socorro' || text.trim().toLowerCase() === 'vet');
    if (isSOS) {
      const vetPhone = targetFazenda.veterinario_responsavel?.whatsapp;
      if (vetPhone) {
        const sosMsg = `🚨 *SOCORRO / EMERGÊNCIA SOLICITADA PELO PRODUTOR* 🚨\n\nFicha Técnica Rápida:\n${contexto}\n\nPor favor, entre em contato urgente com o produtor (${phone}).`;
        await sendWhatsAppMessage(vetPhone, sosMsg);
        await sendWhatsAppMessage(phone, "✅ Acabei de enviar a ficha técnica completa do seu lote para o WhatsApp do seu veterinário. Ele entrará em contato em breve.");
      } else {
        await sendWhatsAppMessage(phone, "❌ Nenhum veterinário está cadastrado na sua aba de Controle do AGboy. Acesse o painel para cadastrar.");
      }
      return res.status(200).send('SOS processado');
    }

    const { AgBoyOrchestrator } = require('./src/ai/orchestrator');
    const entrada = { text, media };
    const respostaIA = await AgBoyOrchestrator(entrada, contexto, targetFazendaId);
    let textoResposta = typeof respostaIA === 'string' ? respostaIA : respostaIA.text;

    if (respostaIA && respostaIA.alertaCritico) {
      const vetPhone = targetFazenda.veterinario_responsavel?.whatsapp;
      if (vetPhone && vetPhone.replace(/\D/g, '') !== phone) {
        const alertaMsg = `🚨 *ALERTA CLÍNICO CRÍTICO (AGboy IA)* 🚨\n\nIdentifiquei uma suspeita grave reportada pelo produtor (${phone}).\n\nResumo da Análise:\n${textoResposta}\n\nPor favor, entre em contato urgente.`;
        await sendWhatsAppMessage(vetPhone, alertaMsg);
      }
    }

    // 4. Devolver Resposta
    await sendWhatsAppMessage(phone, textoResposta);

    return res.status(200).send('Sucesso');
  } catch (err) {
    logger.error('Erro no webhook AgBoy:', err);
    return res.status(500).send('Erro interno');
  }
});

// PULL: Web Chat Inteligente (Callable da Plataforma)
exports.chatComAgBoy = onCall(async (request) => {
  let { mensagem, media, id_fazenda, mediaBase64, mediaType } = request.data;
  const uid = request.auth?.uid;

  // Unifica a estrutura de mídia vinda do web (flat) para o formato esperado pelo backend
  if (!media && mediaBase64) {
    media = {
      base64: mediaBase64,
      mimeType: mediaType,
      type: mediaType?.startsWith('image/') ? 'image' : 'audio'
    };
  }

  if (!uid || !id_fazenda || (!mensagem && !media)) {
    throw new Error('Parâmetros inválidos');
  }

  try {
    const fazendaSnap = await db.collection('fazendas').doc(id_fazenda).get();
    if (!fazendaSnap.exists) throw new Error('Fazenda não encontrada');
    const fazenda = fazendaSnap.data();

    // Contexto de RAG Básico
    const lotesSnap = await db.collection(`fazendas/${id_fazenda}/lotes`).where('status', '==', 'ativo').get();
    let contexto = `FAZENDA: ${fazenda.nome}\nLOTES ATIVOS:\n`;
    
    for (let l of lotesSnap.docs) {
      const lData = l.data();
      contexto += `\nLote: ${lData.linhagem} (Aptidão: ${lData.aptidao || 'corte'})\nIdade(aprox): ${(new Date() - lData.data_alojamento?.toDate()) / 86400000 | 0} dias.\n`;
      const regSnap = await db.collection(`fazendas/${id_fazenda}/registros_diarios`)
        .where('id_lote', '==', l.id)
        .orderBy('data_str', 'desc')
        .limit(7) // 7 dias de contexto para projeções de crescimento precisas
        .get();
      if (!regSnap.empty) {
        contexto += `Últimos 7 Manejos:\n`;
        regSnap.forEach(r => {
          const rData = r.data();
          contexto += `- ${rData.data_str}: Água: ${rData.agua_litros||0}L, Ração: ${rData.racao_kg||0}kg, Mort: ${rData.mortalidade_qtd||0}, PesoMédio: ${rData.peso_medio||'--'}, GPD: ${rData.gpd||'--'}, Ovos: ${rData.producao_ovos_qtd||'--'}\n`;
        });
      } else {
        contexto += `Sem manejos.\n`;
      }
    }

    const { AgBoyOrchestrator } = require('./src/ai/orchestrator');
    const entrada = { text: mensagem || "", media: media || null };
    const respostaIA = await AgBoyOrchestrator(entrada, contexto, id_fazenda);
    let textoResposta = typeof respostaIA === 'string' ? respostaIA : respostaIA.text;

    if (respostaIA && respostaIA.alertaCritico) {
      const vetPhone = fazenda.veterinario_responsavel?.whatsapp;
      if (vetPhone) {
        const alertaMsg = `🚨 *ALERTA CLÍNICO CRÍTICO (AGboy IA)* 🚨\n\nIdentifiquei uma suspeita grave pelo chat web.\n\nFazenda: ${fazenda.nome}\n\nResumo da Análise:\n${textoResposta}\n\nPor favor, entre em contato urgente.`;
        await sendWhatsAppMessage(vetPhone, alertaMsg);
      }
    }

    // Salva o log do chat
    await db.collection(`fazendas/${id_fazenda}/chat_agboy`).add({
      pergunta: mensagem || "[Mídia enviada]",
      media: media || null,
      resposta: textoResposta,
      uid: uid,
      timestamp: new Date()
    });

    return { resposta: textoResposta };
  } catch (error) {
    logger.error('Erro no chatComAgBoy:', error);
    throw new Error('Falha ao processar IA');
  }
});
