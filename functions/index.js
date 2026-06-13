/**
 * functions/index.js
 *
 * Cloud Functions do Agtech (2ª geração / Node.js).
 */

const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { detectarAnomalias } = require('./src/motorAlertas');
const { construirContextoFazenda } = require('./src/contexto');

initializeApp();
const db = getFirestore();

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
    const { id_fazenda } = event.params;

    if (!event.data?.after?.exists) return;
    const registro = event.data.after.data();
    if (!registro.id_lote) return;

    let fazenda;
    try {
      const fazendaSnap = await db.doc(`fazendas/${id_fazenda}`).get();
      if (!fazendaSnap.exists) return;
      fazenda = fazendaSnap.data();
    } catch (erro) {
      logger.error(`Falha ao ler a fazenda "${id_fazenda}":`, erro);
      return;
    }

    let lote;
    try {
      const loteSnap = await db.doc(`fazendas/${id_fazenda}/lotes/${registro.id_lote}`).get();
      if (!loteSnap.exists) return;
      lote = loteSnap.data();
    } catch (erro) {
      logger.error(`Falha ao ler o lote "${registro.id_lote}" da fazenda "${id_fazenda}":`, erro);
      return;
    }

    // Busca o registro do dia anterior do mesmo lote, usado pelo motor de
    // anomalias para comparar a variação de consumo de água/ração/postura.
    let registroAnterior = null;
    try {
      const anteriorSnap = await db.collection(`fazendas/${id_fazenda}/registros_diarios`)
        .where('id_lote', '==', registro.id_lote)
        .where('data_registro_str', '<', registro.data_registro_str || '9999-99-99')
        .orderBy('data_registro_str', 'desc')
        .limit(1)
        .get();
      if (!anteriorSnap.empty) registroAnterior = anteriorSnap.docs[0].data();
    } catch (erro) {
      logger.error(`Falha ao buscar registro anterior do lote "${registro.id_lote}":`, erro);
    }

    const anomalias = detectarAnomalias({ registroAtual: registro, registroAnterior, lote, fazenda });
    if (anomalias.length === 0) return;

    const isPro = fazenda.plano === 'Inteligente';

    const contatos = (fazenda.contatos_autorizados ?? []).filter(Boolean);
    if (fazenda.veterinario_responsavel?.whatsapp) {
      contatos.push(fazenda.veterinario_responsavel.whatsapp);
    }

    for (const anomalia of anomalias) {
      if (isPro) {
        await Promise.all(contatos.map((contato) => sendWhatsAppMessage(contato, anomalia.mensagem_gerada)));
      }

      await db.collection(`fazendas/${id_fazenda}/alertas_enviados`).add({
        tipo: anomalia.tipo,
        detalhe: anomalia.detalhe,
        valor_medido: anomalia.valor_medido,
        limite_definido: anomalia.limite_definido,
        mensagem_gerada: anomalia.mensagem_gerada,
        data_envio: new Date(),
        status_envio: isPro ? 'enviado' : 'bloqueado_plano',
        id_lote: registro.id_lote,
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// SYNC: Manter lookup whatsapp_contacts
// ─────────────────────────────────────────────────────────────────────────
exports.syncWhatsappContacts = onDocumentWritten('fazendas/{id_fazenda}', async (event) => {
  const { id_fazenda } = event.params;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;

  const getNumbers = (data) => {
    if (!data) return [];
    const contatos = data.contatos_autorizados || [];
    let vetPhone = null;
    if (data.veterinario_responsavel && data.veterinario_responsavel.whatsapp) {
      vetPhone = data.veterinario_responsavel.whatsapp;
    }
    const arr = [...contatos];
    if (vetPhone) arr.push(vetPhone);
    return arr.map(c => c.replace(/\D/g, '')).filter(c => c);
  };

  const beforeNumbers = getNumbers(before);
  const afterNumbers = getNumbers(after);

  await db.runTransaction(async (transaction) => {
    // Removals — todas as leituras ANTES de qualquer escrita na transação
    // (Firestore exige que todos os transaction.get() ocorram antes do
    // primeiro transaction.set()/delete(), em toda a callback)
    const removed = beforeNumbers.filter(n => !afterNumbers.includes(n));
    const removedRefs = removed.map(num => db.collection('whatsapp_contacts').doc(num));
    const removedDocs = await Promise.all(removedRefs.map(ref => transaction.get(ref)));

    removedDocs.forEach((doc, idx) => {
      if (doc.exists && doc.data().id_fazenda === id_fazenda) {
        transaction.delete(removedRefs[idx]);
      }
    });

    // Additions
    const added = afterNumbers.filter(n => !beforeNumbers.includes(n));
    for (const num of added) {
      const docRef = db.collection('whatsapp_contacts').doc(num);
      transaction.set(docRef, {
        id_fazenda,
        timestamp: new Date()
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Resolver Media Base64 a partir de URL
// ─────────────────────────────────────────────────────────────────────────
async function resolverMediaBase64(mediaObj) {
  if (!mediaObj) return null;
  if (mediaObj.base64) return mediaObj;
  if (!mediaObj.url) return mediaObj;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(mediaObj.url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 8 * 1024 * 1024) {
      throw new Error('File too large (> 8MB)');
    }

    // signal continua ativo durante o consumo do body (arrayBuffer),
    // garantindo que o timeout de 15s cubra o download completo
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 8 * 1024 * 1024) {
      throw new Error('File too large (> 8MB)');
    }

    mediaObj.base64 = Buffer.from(arrayBuffer).toString('base64');
  } catch (err) {
    logger.error('Erro ao baixar mídia da url:', err);
    mediaObj.base64 = null;
    mediaObj.error = err.message;
  } finally {
    clearTimeout(timeoutId);
  }
  return mediaObj;
}

// ─────────────────────────────────────────────────────────────────────────
// PULL: Chatbot Interativo via Webhook (AgBoy RAG)
// ─────────────────────────────────────────────────────────────────────────
exports.agboyWebhook = onRequest({ timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
  if (req.headers['x-webhook-secret'] !== process.env.EVOLUTION_WEBHOOK_SECRET) {
    return res.status(401).send('Não autorizado');
  }

  try {
    const body = req.body;
    if (!body || !body.data || !body.data.key) return res.status(200).send('Ignorado');

    const remoteJid = body.data.key.remoteJid;
    if (!remoteJid || remoteJid.includes('@g.us')) return res.status(200).send('Grupos ignorados');

    const msgObj = body.data.message;
    if (!msgObj) return res.status(200).send('Sem mensagem');

    const text = msgObj.conversation || msgObj.extendedTextMessage?.text || "";

    let media = null;
    if (msgObj.audioMessage) {
      media = { type: 'audio', mimeType: msgObj.audioMessage.mimetype, url: msgObj.audioMessage.url, base64: msgObj.audioMessage.base64 || body.data?.message?.base64 || null };
    } else if (msgObj.imageMessage) {
      media = { type: 'image', mimeType: msgObj.imageMessage.mimetype, url: msgObj.imageMessage.url, base64: msgObj.imageMessage.base64 || body.data?.message?.base64 || null };
    } else if (msgObj.documentMessage) {
      media = { type: 'document', mimeType: msgObj.documentMessage.mimetype, url: msgObj.documentMessage.url, base64: msgObj.documentMessage.base64 || body.data?.message?.base64 || null };
    }

    if (!text && !media) return res.status(200).send('Sem texto ou midia');

    const phone = remoteJid.split('@')[0];

    const contactDoc = await db.collection('whatsapp_contacts').doc(phone).get();
    if (!contactDoc.exists) return res.status(200).send('Não autorizado');
    
    const targetFazendaId = contactDoc.data().id_fazenda;
    const fazendaDoc = await db.collection('fazendas').doc(targetFazendaId).get();
    if (!fazendaDoc.exists) return res.status(200).send('Fazenda invalida');
    
    const targetFazenda = fazendaDoc.data();
    if (targetFazenda.plano !== 'Inteligente') {
      await sendWhatsAppMessage(phone, "Olá! Sou o AgBoy. Vi que sua fazenda não possui o Plano Inteligente ativo. Acesse o painel web para fazer o upgrade e liberar o assistente no WhatsApp!");
      return res.status(200).send('Plano insuficiente');
    }

    const jobId = body.data.key.id || `job_${Date.now()}`;
    await db.collection(`fazendas/${targetFazendaId}/agboy_jobs`).doc(jobId).set({
      phone,
      text,
      media,
      status: 'pendente',
      timestamp: FieldValue.serverTimestamp()
    });

    return res.status(200).send('Sucesso');
  } catch (err) {
    logger.error('Erro no webhook AgBoy:', err);
    return res.status(500).send('Erro interno');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// WORKER: Processamento Assíncrono do AgBoy (Vídeos, Áudios, RAG)
// ─────────────────────────────────────────────────────────────────────────
exports.processarAgBoyJob = onDocumentCreated(
  { document: 'fazendas/{id_fazenda}/agboy_jobs/{id_job}', timeoutSeconds: 120, memory: '512MiB' },
  async (event) => {
    const jobSnap = event.data;
    if (!jobSnap) return;
    const job = jobSnap.data();
    const { id_fazenda, id_job } = event.params;

    let alreadyProcessed = false;
    await db.runTransaction(async (t) => {
      const freshJobRef = db.collection(`fazendas/${id_fazenda}/agboy_jobs`).doc(id_job);
      const freshJobSnap = await t.get(freshJobRef);
      if (!freshJobSnap.exists || freshJobSnap.data().status !== 'pendente') {
        alreadyProcessed = true;
        return;
      }
      t.update(freshJobRef, { status: 'processando' });
    });

    if (alreadyProcessed) {
      return; // Retorno silencioso conforme auditoria (evita log de erro inútil)
    }

    try {
      const { phone, text } = job;
      let media = job.media;

      const fazendaDoc = await db.collection('fazendas').doc(id_fazenda).get();
      if (!fazendaDoc.exists) return;
      const targetFazenda = fazendaDoc.data();

      // Resolve mídia
      media = await resolverMediaBase64(media);

      const contexto = await construirContextoFazenda(db, id_fazenda, targetFazenda.nome);

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
        await jobSnap.ref.update({ status: 'concluido', isSOS: true });
        return;
      }

      const { AgBoyOrchestrator } = require('./src/ai/orchestrator');
      const entrada = { text, media, userId: phone };
      const respostaIA = await AgBoyOrchestrator(entrada, contexto, id_fazenda);
      let textoResposta = typeof respostaIA === 'string' ? respostaIA : respostaIA.text;

      if (respostaIA && respostaIA.alertaCritico) {
        const vetPhone = targetFazenda.veterinario_responsavel?.whatsapp;
        if (vetPhone && vetPhone.replace(/\D/g, '') !== phone) {
          const alertaMsg = `🚨 *ALERTA CLÍNICO CRÍTICO (AGboy IA)* 🚨\n\nIdentifiquei uma suspeita grave reportada pelo produtor (${phone}).\n\nResumo da Análise:\n${textoResposta}\n\nPor favor, entre em contato urgente.`;
          await sendWhatsAppMessage(vetPhone, alertaMsg);
        }
      }

      await sendWhatsAppMessage(phone, textoResposta);

      const mediaMeta = media ? { type: media.type, mimeType: media.mimeType, sizeBytes: media.base64 ? Buffer.byteLength(media.base64, 'base64') : 0 } : null;
      await db.collection(`fazendas/${id_fazenda}/chat_agboy`).add({
        pergunta: text || "[Mídia enviada via WhatsApp]",
        mediaMeta: mediaMeta,
        resposta: textoResposta,
        uid: phone,
        timestamp: FieldValue.serverTimestamp()
      });

      await jobSnap.ref.update({ status: 'concluido' });
    } catch (err) {
      logger.error(`Erro ao processar AgBoy Job ${id_job}:`, err);
      await jobSnap.ref.update({ status: 'falha', erro: err.message });
    }
  }
);

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

    const isMembro = fazenda.membros?.[uid] !== undefined;
    let autorizado = isMembro;
    if (!autorizado) {
      const colab = await db.collection('collaborators').doc(uid).get();
      autorizado = colab.exists && colab.data().farmId === id_fazenda;
    }
    if (!autorizado) throw new Error('Acesso não autorizado a esta fazenda.');

    // Verificação de Cota AgBoy (Server-side Enforcement)
    const plano = fazenda.plano ? fazenda.plano.toLowerCase() : 'essencial';
    if (plano !== 'inteligente') {
      const hoje = new Date().toISOString().split('T')[0];
      const limitRef = db.collection('fazendas').doc(id_fazenda).collection('limites_bi').doc(hoje);
      const limitSnap = await limitRef.get();
      let enviosHoje = 0;
      if (limitSnap.exists) {
        enviosHoje = limitSnap.data().envios || 0;
      }
      
      if (enviosHoje >= 3) {
        throw new Error('Limite diário de 3 mensagens atingido. Faça upgrade para o plano Inteligente.');
      }
      // Incremento atômico no backend
      const { FieldValue } = require('firebase-admin/firestore');
      await limitRef.set({ envios: FieldValue.increment(1), data: hoje }, { merge: true });
    }

    // Contexto de RAG Básico
    const contexto = await construirContextoFazenda(db, id_fazenda, fazenda.nome);

    const { AgBoyOrchestrator } = require('./src/ai/orchestrator');
    const entrada = { text: mensagem || "", media: media || null, userId: uid };
    const respostaIA = await AgBoyOrchestrator(entrada, contexto, id_fazenda);
    let textoResposta = typeof respostaIA === 'string' ? respostaIA : respostaIA.text;

    if (respostaIA && respostaIA.alertaCritico) {
      const vetPhone = fazenda.veterinario_responsavel?.whatsapp;
      if (vetPhone) {
        const alertaMsg = `🚨 *ALERTA CLÍNICO CRÍTICO (AGboy IA)* 🚨\n\nIdentifiquei uma suspeita grave pelo chat web.\n\nFazenda: ${fazenda.nome}\n\nResumo da Análise:\n${textoResposta}\n\nPor favor, entre em contato urgente.`;
        await sendWhatsAppMessage(vetPhone, alertaMsg);
      }
    }

    const mediaMeta = media ? { type: media.type, mimeType: media.mimeType, sizeBytes: media.base64 ? Buffer.byteLength(media.base64, 'base64') : 0 } : null;

    // Salva o log do chat
    await db.collection(`fazendas/${id_fazenda}/chat_agboy`).add({
      pergunta: mensagem || "[Mídia enviada]",
      mediaMeta: mediaMeta,
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

// ─────────────────────────────────────────────────────────────────────────
// PUSH: Endpoint IoT (Telemetria)
// ─────────────────────────────────────────────────────────────────────────
exports.registrarTelemetria = onRequest({ timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
  const deviceKey = req.headers['x-device-key'];
  if (!deviceKey) return res.status(401).send('Missing device key');

  const payload = req.body;
  const { id_fazenda, id_dispositivo, id_lote, leituras } = payload || {};
  
  if (!id_fazenda || !id_dispositivo || !id_lote || !leituras || !leituras.length) {
    return res.status(400).send('Payload invalido');
  }

  const leituraMaisRecente = leituras.reduce((prev, curr) => {
    if (!prev) return curr;
    if (!curr) return prev;
    return (curr.ts > prev.ts) ? curr : prev;
  }, null);

  if (!leituraMaisRecente || typeof leituraMaisRecente.temp !== 'number' || typeof leituraMaisRecente.umidade !== 'number') {
    return res.status(400).send('Payload invalido: leituras vazias ou nao numericas');
  }

  const { temp, umidade } = leituraMaisRecente;

  try {
    // 1. Validar a chave do dispositivo
    const deviceSnap = await db.collection(`fazendas/${id_fazenda}/dispositivos_iot`).doc(id_dispositivo).get();
    if (!deviceSnap.exists) return res.status(403).send('Dispositivo nao registrado');
    const deviceData = deviceSnap.data();
    if (deviceData.api_key_hash !== deviceKey) return res.status(403).send('Chave invalida');

    const sensorRef = db.collection(`fazendas/${id_fazenda}/sensores`).doc(id_dispositivo);
    
    // Limite genérico simplificado (Em um app real, viria do lote -> linhagem)
    const limiteTempMax = 28;
    const limiteTempMin = 20;
    const foraDaFaixa = temp > limiteTempMax || temp < limiteTempMin;

    let enviarWhatsapp = false;
    let msgWhatsapp = '';

    await db.runTransaction(async (transaction) => {
      const sensorDoc = await transaction.get(sensorRef);
      let estadoAnterior = 'normal';
      let alertaInicio = null;
      let lastLogTs = 0;
      let lastTemp = temp;
      let lastUmidade = umidade;

      if (sensorDoc.exists) {
        const dados = sensorDoc.data();
        estadoAnterior = dados.estado || 'normal';
        alertaInicio = dados.alerta_inicio || null;
        lastLogTs = dados.last_log_ts || 0;
        lastTemp = dados.last_temp || temp;
        lastUmidade = dados.last_umidade || umidade;
      }

      let novoEstado = estadoAnterior;
      // Reset por tentativa da transacao
      enviarWhatsapp = false;
      msgWhatsapp = '';
      
      const agora = Date.now();

      if (foraDaFaixa) {
        if (estadoAnterior === 'normal') {
          novoEstado = 'alerta_pendente';
          alertaInicio = agora;
        } else if (estadoAnterior === 'alerta_pendente') {
          const tempoPendenteMinutos = (agora - alertaInicio) / 60000;
          if (tempoPendenteMinutos >= 5) {
            novoEstado = 'alerta_disparado';
            enviarWhatsapp = true;
            msgWhatsapp = `🚨 *Alerta IoT* 🚨\nA temperatura do lote no galpão está em *${temp}°C* há mais de 5 minutos (fora do ideal de ${limiteTempMin}-${limiteTempMax}°C).\nRecomendo ajustar a ventilação imediatamente!`;
          }
        }
      } else {
        novoEstado = 'normal';
        alertaInicio = null;
        if (estadoAnterior === 'alerta_disparado') {
            enviarWhatsapp = true;
            msgWhatsapp = `✅ *Normalizado* ✅\nA temperatura do lote voltou ao normal (${temp}°C). Bom trabalho no manejo!`;
        }
      }

      // Salvar estado atual do sensor
      transaction.set(sensorRef, {
        id_lote,
        temp,
        umidade,
        ts: agora,
        estado: novoEstado,
        alerta_inicio: alertaInicio,
        last_log_ts: lastLogTs,
        last_temp: lastTemp,
        last_umidade: lastUmidade
      });

      // Salvamento esparso do histórico
      const tempoDesdeLastLog = (agora - lastLogTs) / 60000;
      const variacaoTemp = Math.abs(temp - lastTemp);
      const variacaoUmid = Math.abs(umidade - lastUmidade);

      if (tempoDesdeLastLog >= 5 || variacaoTemp >= 0.5 || variacaoUmid >= 5) {
        const historicoRef = sensorRef.collection('historico').doc();
        transaction.set(historicoRef, {
          temp,
          umidade,
          ts: agora
        });
        
        transaction.update(sensorRef, {
            last_log_ts: agora,
            last_temp: temp,
            last_umidade: umidade
        });
      }
    });

    if (enviarWhatsapp) {
      const targetFazendaDoc = await db.collection('fazendas').doc(id_fazenda).get();
      if (targetFazendaDoc.exists) {
          const fData = targetFazendaDoc.data();
          const contatosParaNotificar = [...(fData.contatos_autorizados || [])];
          if (fData.veterinario_responsavel && fData.veterinario_responsavel.whatsapp) {
              contatosParaNotificar.push(fData.veterinario_responsavel.whatsapp);
          }
          await Promise.all(contatosParaNotificar.map(c => sendWhatsAppMessage(c.replace(/\D/g, ''), msgWhatsapp)));
      }
    }

    return res.status(200).send('Recebido');
  } catch (err) {
    logger.error('Erro no registrarTelemetria:', err);
    return res.status(500).send('Erro interno');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// CRON: Briefing Diário Proativo
// ─────────────────────────────────────────────────────────────────────────
exports.briefingDiario = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'America/Sao_Paulo', timeoutSeconds: 540, memory: '512MiB' },
  async (event) => {
    const dataStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

    try {
      // Pega fazendas com plano Inteligente
      const fazendasSnap = await db.collection('fazendas')
        .where('plano', '==', 'Inteligente')
        .get();

      if (fazendasSnap.empty) return;

      const fazendasDocs = fazendasSnap.docs;
      const lotes = [];
      // Dividir em lotes de 5
      for (let i = 0; i < fazendasDocs.length; i += 5) {
        lotes.push(fazendasDocs.slice(i, i + 5));
      }

      for (const lote of lotes) {
        await Promise.allSettled(lote.map(async (fDoc) => {
          const id_fazenda = fDoc.id;
          try {
            const targetFazenda = fDoc.data();

            // Checa Idempotência
            const idempotencyRef = fDoc.ref.collection('briefings_enviados').doc(dataStr);
            const idempotencySnap = await idempotencyRef.get();
            if (idempotencySnap.exists) {
              logger.info(`Briefing já enviado hoje para a fazenda ${id_fazenda}`);
              return;
            }

            const contatos = targetFazenda.contatos_autorizados || [];
            const numerosParaEnviar = new Set(contatos);
            
            if (numerosParaEnviar.size === 0) return;

            // Contexto
            const contexto = await construirContextoFazenda(db, id_fazenda, targetFazenda.nome);

            // Prompt
            const prompt = `Gere o Briefing Diário Matinal (Bom dia!) para a fazenda ${targetFazenda.nome}.
DADOS: ${contexto}
Seja encorajador, resuma os destaques e indique o foco do dia. Use emojis. Não mencione [ALERTA CRÍTICO].`;

            // Gerar via Gemini
            const { AgBoyOrchestrator } = require('./src/ai/orchestrator');
            const respostaIA = await AgBoyOrchestrator({ text: prompt, media: null, userId: 'cron' }, contexto, id_fazenda);
            const textoResposta = typeof respostaIA === 'string' ? respostaIA : respostaIA.text;

            // Enviar
            for (const phone of numerosParaEnviar) {
               const cleanPhone = phone.replace(/\D/g, '');
               await sendWhatsAppMessage(cleanPhone, textoResposta);
            }

            // Salvar idempotência
            await idempotencyRef.set({ data: dataStr, timestamp: FieldValue.serverTimestamp() });
          } catch (err) {
            logger.error(`Erro ao gerar briefing para fazenda ${id_fazenda}:`, err);
          }
        }));

        // Delay de 12s entre lotes (Evolution API e Limite LLM)
        await new Promise(resolve => setTimeout(resolve, 12000));
      }

    } catch (err) {
      logger.error('Erro no briefingDiario:', err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// CRON: Sweeper de Jobs Travados
// ─────────────────────────────────────────────────────────────────────────
exports.limparJobsPendentes = onSchedule(
  { schedule: '*/15 * * * *', timeZone: 'America/Sao_Paulo', timeoutSeconds: 60, memory: '256MiB' },
  async (event) => {
    try {
      const agora = new Date();
      // Consideramos travados jobs com status 'pendente' ou 'processando' com mais de 5 minutos
      const limiteTempo = new Date(agora.getTime() - 5 * 60 * 1000);

      // Precisamos fazer uma query collectionGroup pois os jobs estão em fazendas/{id_fazenda}/agboy_jobs/{id_job}
      // .limit(200) evita varreduras gigantes caso uma instabilidade prolongada acumule muitos jobs travados
      const jobsSnap = await db.collectionGroup('agboy_jobs')
        .where('status', 'in', ['pendente', 'processando'])
        .where('timestamp', '<', limiteTempo)
        .limit(200)
        .get();

      if (jobsSnap.empty) return;

      // Promise.allSettled + try/catch por item: uma falha isolada (ex: doc já
      // removido, erro no WhatsApp) não pode interromper o tratamento dos demais jobs
      const promessas = jobsSnap.docs.map(async (docSnap) => {
        try {
          const job = docSnap.data();
          logger.warn(`Job travado detectado: ${docSnap.ref.path}. Marcando como falha.`);

          await docSnap.ref.update({
            status: 'falha',
            erro: 'Timeout de processamento (Sweeper)',
            timestamp_atualizado: FieldValue.serverTimestamp()
          });

          if (job.phone) {
            await sendWhatsAppMessage(
              job.phone,
              "⚠️ Desculpe, não consegui processar sua mensagem devido a uma oscilação temporária de rede. Por favor, tente enviar novamente!"
            );
          }
        } catch (err) {
          logger.error(`Erro ao limpar job travado ${docSnap.ref.path}:`, err);
        }
      });

      await Promise.allSettled(promessas);
    } catch (err) {
      logger.error('Erro no limparJobsPendentes sweeper:', err);
    }
  }
);
