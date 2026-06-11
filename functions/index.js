/**
 * functions/index.js
 *
 * Cloud Functions do Agtech (2ª geração / Node.js).
 *
 * `onRegistroDiarioEscrito`
 * -------------------------
 * Dispara sempre que um documento em
 * `fazendas/{id_fazenda}/registros_diarios/{id_registro}` é criado ou
 * atualizado (inclusive quando a sincronização offline do app finalmente
 * grava no servidor). Busca os dados da fazenda mãe (nome, plano e
 * contatos de WhatsApp) e envia tudo para o Webhook do n8n, que decide
 * a rota comercial/preditiva (Plano Essencial vs. Inteligente).
 *
 * IDEMPOTÊNCIA: cada registro diário tem ID determinístico
 * (`${id_lote}_${data_registro_str}`), então cada dia/lote dispara este
 * gatilho de forma isolada — sincronizar 3 dias offline gera 3 invocações
 * independentes, uma por documento. Se o mesmo registro for atualizado de
 * novo (ex.: peão corrige um valor), a função roda novamente e reenvia o
 * payload atualizado; o n8n deve tratar `registro.id_registro` como chave
 * de upsert/dedupe do lado dele.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const PLANO_PADRAO = 'Essencial';

exports.onRegistroDiarioEscrito = onDocumentWritten(
  'fazendas/{id_fazenda}/registros_diarios/{id_registro}',
  async (event) => {
    const { id_fazenda, id_registro } = event.params;

    // Documento removido (delete): não há o que notificar ao n8n.
    if (!event.data?.after?.exists) {
      logger.info(`[onRegistroDiarioEscrito] ${id_registro}: documento removido, nada a fazer.`);
      return;
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.error(
        '[onRegistroDiarioEscrito] Variável N8N_WEBHOOK_URL não configurada — webhook não enviado.'
      );
      return;
    }

    const registro = event.data.after.data();

    // Busca os dados da fazenda mãe (nome, plano, contatos de WhatsApp).
    let fazenda;
    try {
      const fazendaSnap = await db.doc(`fazendas/${id_fazenda}`).get();
      if (!fazendaSnap.exists) {
        logger.error(`[onRegistroDiarioEscrito] Fazenda "${id_fazenda}" não encontrada — webhook não enviado.`);
        return;
      }
      fazenda = fazendaSnap.data();
    } catch (erro) {
      logger.error(`[onRegistroDiarioEscrito] Falha ao ler a fazenda "${id_fazenda}":`, erro);
      return;
    }

    const payload = {
      id_fazenda,
      nome_fazenda: fazenda.nome ?? '',
      // Cadastro de fazendas pode não ter `plano` definido ainda
      // (campo não faz parte do schema original) — assume "Essencial".
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

    // Falhas de rede no disparo do webhook são apenas logadas: nunca
    // relançadas. Um `throw` aqui faria o Cloud Functions tratar a
    // execução como falha (e potencialmente reagendar/retentar o gatilho
    // do Firestore), criando um loop de reprocessamento do mesmo
    // documento sem necessidade.
    try {
      const resposta = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resposta.ok) {
        logger.error(
          `[onRegistroDiarioEscrito] n8n respondeu ${resposta.status} para "${id_registro}".`
        );
        return;
      }

      logger.info(`[onRegistroDiarioEscrito] Webhook enviado para "${id_registro}" (fazenda "${id_fazenda}").`);
    } catch (erro) {
      logger.error(`[onRegistroDiarioEscrito] Falha de rede ao chamar o webhook do n8n para "${id_registro}":`, erro);
    }
  }
);
