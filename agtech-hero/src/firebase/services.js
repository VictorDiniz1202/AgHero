/**
 * src/firebase/services.js
 *
 * Camada de serviços (CRUD) do AgHero sobre o Firestore.
 *
 * PRINCÍPIO OFFLINE-FIRST:
 * O `db` (de `./config.js`) é inicializado com `persistentLocalCache`, ou
 * seja, toda escrita (`setDoc`) é aplicada IMEDIATAMENTE ao cache local em
 * IndexedDB e fica visível para queries/listeners locais na hora — mesmo
 * sem rede. Porém, a Promise retornada por `setDoc()` só resolve quando o
 * servidor confirma o recebimento; se o dispositivo estiver offline, essa
 * Promise pode ficar pendente por tempo indeterminado.
 *
 * Por isso, as funções de escrita abaixo NÃO usam `await` na chamada ao
 * Firestore. Elas disparam a escrita (que já foi aplicada ao cache local de
 * forma síncrona pelo SDK) e retornam imediatamente os dados otimistas para
 * a UI, enquanto a sincronização com o servidor acontece em segundo plano.
 * Erros de sincronização são apenas logados via `console.error` — eles não
 * devem travar a interface, pois a fila de sincronização do Firestore tenta
 * novamente sozinha assim que a rede voltar.
 */

import { db } from './config';
import { calcularFechamentoLote } from '../utils/fechamentoLote';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────
// Typedefs (JSDoc) — apenas para documentação/autocomplete, sem TypeScript.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Fazenda
 * @property {string} id
 * @property {string} nome
 * @property {'Corte'|'Postura'} tipo_producao
 * @property {string[]} contatos_autorizados
 * @property {Object} alertas_config
 * @property {Object<string, 'dono'|'peao'>} membros
 */

/**
 * @typedef {Object} Lote
 * @property {string} id
 * @property {string} linhagem
 * @property {Date|Timestamp} data_alojamento
 * @property {number} quantidade_inicial
 * @property {'ativo'|'encerrado'} status
 */

/**
 * @typedef {Object} RegistroDiario
 * @property {string} id
 * @property {string} id_lote
 * @property {Timestamp} data_registro
 * @property {string} data_registro_str  Formato "YYYY-MM-DD"
 * @property {number} agua_litros
 * @property {number} racao_kg
 * @property {number} mortalidade_qtd
 * @property {number} temp_max
 * @property {number} temp_min
 * @property {string} [observacoes]
 */

// ─────────────────────────────────────────────────────────────────────────
// Fazendas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cria uma nova fazenda, registrando o usuário criador como "dono".
 *
 * O ID do documento é gerado no cliente via `doc(collection(...))`, que usa
 * o mesmo algoritmo de IDs aleatórios do `addDoc` mas funciona 100% offline
 * (não depende de round-trip ao servidor).
 *
 * @param {string} nome
 * @param {'Corte'|'Postura'} tipoProducao
 * @param {string[]} contatos  Números de WhatsApp autorizados.
 * @param {string} donoUid     UID (Firebase Auth) do usuário dono.
 * @returns {Promise<Fazenda>}
 */
export async function criarFazenda(nome, tipoProducao, contatos, donoUid) {
  const fazendaRef = doc(db, 'fazendas', 'fazenda_' + donoUid);

  const fazendaData = {
    nome,
    tipo_producao: tipoProducao,
    contatos_autorizados: contatos ?? [],
    // Limites de alerta (mortalidade/variação de consumo) ficam vazios na
    // criação e podem ser configurados depois pelo dono.
    alertas_config: {},
    membros: { [donoUid]: 'dono' },
  };

  setDoc(fazendaRef, fazendaData).catch((error) => {
    console.error(`[Firestore] Falha ao sincronizar criação da fazenda "${fazendaRef.id}":`, error);
  });

  // Salva também na nova estrutura de Collaborators
  const colabRef = doc(db, 'collaborators', donoUid);
  setDoc(colabRef, {
    uid: donoUid,
    farmId: fazendaRef.id,
    role: 'owner',
    email: auth.currentUser?.email || '',
    nome: auth.currentUser?.displayName || nome || 'Dono'
  }).catch(console.error);

  return { id: fazendaRef.id, ...fazendaData };
}

// ─────────────────────────────────────────────────────────────────────────
// Lotes
// ─────────────────────────────────────────────────────────────────────────

/**
 * Adiciona um novo lote à fazenda informada.
 *
 * @param {string} id_fazenda
 * @param {Object} loteData
 * @param {string} loteData.linhagem          Ex: "Cobb", "Ross".
 * @param {Date|Timestamp} loteData.data_alojamento
 * @param {number} loteData.quantidade_inicial
 * @param {'ativo'|'encerrado'} [loteData.status='ativo']
 * @returns {Promise<Lote>}
 */
export async function adicionarLote(id_fazenda, loteData) {
  const loteRef = doc(collection(db, 'fazendas', id_fazenda, 'lotes'));

  const data = {
    status: 'ativo',
    ...loteData,
  };

  setDoc(loteRef, data).catch((error) => {
    console.error(`[Firestore] Falha ao sincronizar lote "${loteRef.id}" da fazenda "${id_fazenda}":`, error);
  });

  return { id: loteRef.id, ...data };
}

/**
 * Recupera os lotes com `status == "ativo"` de uma fazenda.
 *
 * Graças ao cache persistente, se o dispositivo estiver offline esta query
 * é resolvida com os dados disponíveis localmente (último estado conhecido).
 *
 * @param {string} id_fazenda
 * @returns {Promise<Lote[]>}
 */
export async function obterLotesAtivos(id_fazenda) {
  try {
    const lotesRef = collection(db, 'fazendas', id_fazenda, 'lotes');
    const q = query(lotesRef, where('status', '==', 'ativo'));
    const snapshot = await getDocs(q);

    let list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    // Auto-seed para a fazenda de demonstração para viabilizar testes instantâneos
    if (list.length === 0 && id_fazenda === 'fazenda_demo_123') {
      // Garantir que o documento da fazenda pai exista para a trigger da Cloud Function funcionar
      const fazendaRef = doc(db, 'fazendas', id_fazenda);
      await setDoc(fazendaRef, {
        nome: "Fazenda Progresso (Demo)",
        tipo_producao: "Corte",
        contatos_autorizados: ["+5511999999999"], // Número de teste
        plano: "Inteligente",
        membros: { "dono_demo_123": "dono" }
      }, { merge: true }).catch((error) => {
        console.error(`[Firestore] Falha ao auto-semear documento de fazenda "${id_fazenda}":`, error);
      });

      const lote1 = await adicionarLote(id_fazenda, {
        linhagem: 'Cobb 500',
        data_alojamento: Timestamp.fromDate(new Date()),
        quantidade_inicial: 22000,
        status: 'ativo'
      });
      const lote2 = await adicionarLote(id_fazenda, {
        linhagem: 'Ross 308',
        data_alojamento: Timestamp.fromDate(new Date()),
        quantidade_inicial: 18500,
        status: 'ativo'
      });
      list = [lote1, lote2];
    }

    return list;
  } catch (error) {
    console.error(`[Firestore] Falha ao obter lotes ativos da fazenda "${id_fazenda}":`, error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Registros Diários
// ─────────────────────────────────────────────────────────────────────────

const DATA_REGISTRO_STR_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cria ou atualiza o registro diário de manejo de um lote.
 *
 * ID DETERMINÍSTICO: `${id_lote}_${registroData.data_registro_str}`.
 * Combinado com `setDoc(..., { merge: true })`, isso garante idempotência:
 * registrar o mesmo lote/dia múltiplas vezes (ex.: app reaberto offline e o
 * usuário reenvia o formulário) sempre atualiza o MESMO documento, em vez de
 * criar duplicatas.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Object} registroData
 * @param {string} registroData.data_registro_str  Obrigatório, formato "YYYY-MM-DD".
 * @param {Date|Timestamp} registroData.data_registro  Obrigatório.
 * @param {number} [registroData.agua_litros]
 * @param {number} [registroData.racao_kg]
 * @param {number} [registroData.mortalidade_qtd]
 * @param {number} [registroData.temp_max]
 * @param {number} [registroData.temp_min]
 * @param {string} [registroData.observacoes]
 * @returns {Promise<RegistroDiario>}
 */
export async function salvarRegistroDiario(id_fazenda, id_lote, registroData) {
  const { data_registro_str, data_registro } = registroData ?? {};

  if (!data_registro_str || !DATA_REGISTRO_STR_REGEX.test(data_registro_str)) {
    throw new Error(
      'salvarRegistroDiario: "data_registro_str" é obrigatório no formato "YYYY-MM-DD".'
    );
  }

  if (!data_registro) {
    throw new Error('salvarRegistroDiario: "data_registro" (timestamp) é obrigatório.');
  }

  // Aceita tanto um `Timestamp` do Firestore quanto um `Date` do JS.
  const dataRegistroTimestamp =
    data_registro instanceof Timestamp ? data_registro : Timestamp.fromDate(new Date(data_registro));

  const id_registro = `${id_lote}_${data_registro_str}`;
  const registroRef = doc(db, 'fazendas', id_fazenda, 'registros_diarios', id_registro);

  const data = {
    ...registroData,
    id_lote,
    data_registro: dataRegistroTimestamp,
  };

  setDoc(registroRef, data, { merge: true }).catch((error) => {
    console.error(
      `[Firestore] Falha ao sincronizar registro diário "${id_registro}" da fazenda "${id_fazenda}":`,
      error
    );
  });

  return { id: id_registro, ...data };
}

/**
 * Busca os registros diários mais recentes de uma fazenda, ordenados por
 * `data_registro` decrescente (mais recente primeiro) — pronto para
 * alimentar os gráficos de consumo (água/ração/mortalidade).
 *
 * @param {string} id_fazenda
 * @param {number} limite  Quantidade máxima de registros a retornar.
 * @returns {Promise<RegistroDiario[]>}
 */
export async function obterUltimosRegistros(id_fazenda, limite) {
  try {
    const registrosRef = collection(db, 'fazendas', id_fazenda, 'registros_diarios');
    const q = query(registrosRef, orderBy('data_registro', 'desc'), limit(limite));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter últimos registros da fazenda "${id_fazenda}":`, error);
    return [];
  }
}

/**
 * Busca o registro diário de um lote em uma data específica, usando o ID
 * determinístico `${id_lote}_${data_registro_str}`. Usado pelo motor de
 * alertas para comparar o consumo de hoje com o do dia anterior sem
 * precisar de uma query extra.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {string} data_registro_str  Formato "YYYY-MM-DD".
 * @returns {Promise<RegistroDiario|null>}
 */
export async function obterRegistroPorData(id_fazenda, id_lote, data_registro_str) {
  try {
    const id_registro = `${id_lote}_${data_registro_str}`;
    const registroRef = doc(db, 'fazendas', id_fazenda, 'registros_diarios', id_registro);
    const docSnap = await getDoc(registroRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error(`[Firestore] Falha ao obter registro "${id_lote}_${data_registro_str}" da fazenda "${id_fazenda}":`, error);
    return null;
  }
}

/**
 * Obtém os dados de uma fazenda específica pelo ID.
 *
 * @param {string} id_fazenda
 * @returns {Promise<Fazenda|null>}
 */
export async function obterFazenda(id_fazenda) {
  try {
    const docRef = doc(db, 'fazendas', id_fazenda);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error(`[Firestore] Falha ao obter dados da fazenda "${id_fazenda}":`, error);
    return null;
  }
}

/**
 * Atualiza campos parciais de uma fazenda.
 *
 * @param {string} id_fazenda
 * @param {Partial<Fazenda>} dadosAtualizados
 * @returns {Promise<void>}
 */
export async function atualizarFazenda(id_fazenda, dadosAtualizados) {
  const docRef = doc(db, 'fazendas', id_fazenda);

  setDoc(docRef, dadosAtualizados, { merge: true }).catch((error) => {
    console.error(`[Firestore] Falha ao atualizar dados da fazenda "${id_fazenda}":`, error);
  });
}

/**
 * Obtém os lotes inativos (encerrados) de uma fazenda.
 *
 * @param {string} id_fazenda
 * @returns {Promise<Lote[]>}
 */
export async function obterLotesInativos(id_fazenda) {
  try {
    const lotesRef = collection(db, 'fazendas', id_fazenda, 'lotes');
    const q = query(lotesRef, where('status', '==', 'encerrado'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter lotes inativos da fazenda "${id_fazenda}":`, error);
    return [];
  }
}

/**
 * Atualiza o plano vacinal customizado de um lote específico.
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Array} planoVacinal
 */
export async function atualizarPlanoVacinalLote(id_fazenda, id_lote, planoVacinal) {
  try {
    const loteRef = doc(db, 'fazendas', id_fazenda, 'lotes', id_lote);
    await updateDoc(loteRef, { plano_vacinal: planoVacinal });
  } catch (error) {
    console.error(`[Firestore] Falha ao atualizar plano vacinal do lote ${id_lote}:`, error);
    throw error;
  }
}

/**
 * Obtém todos os registros diários de um lote específico, ordenados por data.
 *
 * Diferente de `obterUltimosRegistros` (que pagina os registros mais recentes
 * de toda a fazenda), esta função busca o histórico completo de um único
 * lote via `where('id_lote', '==', id_lote)` — usada pela Ficha de
 * Fechamento e pelo agregador `calcularFechamentoLote`.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @returns {Promise<RegistroDiario[]>}
 */
export async function obterRegistrosDiarios(id_fazenda, id_lote) {
  try {
    const registrosRef = collection(db, 'fazendas', id_fazenda, 'registros_diarios');
    const q = query(registrosRef, where('id_lote', '==', id_lote));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (a.data_registro_str || '').localeCompare(b.data_registro_str || ''));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter registros diários do lote "${id_lote}" da fazenda "${id_fazenda}":`, error);
    return [];
  }
}

/**
 * Encerra um lote alterando seu status para "encerrado" e computa os dados zootécnicos e financeiros.
 *
 * @param {string} id_fazenda
 * @param {Object} lote Objeto do lote contendo id e quantidade_inicial
 * @returns {Promise<void>}
 */
export async function encerrarLote(id_fazenda, lote) {
  try {
    const registros = await obterRegistrosDiarios(id_fazenda, lote.id);
    const transacoes = await obterTransacoesLote(id_fazenda, lote.id);

    const fechamento = calcularFechamentoLote({ lote, historico: registros, transacoes });

    const loteRef = doc(db, 'fazendas', id_fazenda, 'lotes', lote.id);
    await setDoc(loteRef, { status: 'encerrado', fechamento }, { merge: true });
  } catch (error) {
    console.error(`[Firestore] Falha ao encerrar lote "${lote.id}" da fazenda "${id_fazenda}":`, error);
  }
}

/**
 * Atualiza campos parciais de um lote (ex: planejador de pesagens).
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Object} dadosAtualizados
 * @returns {Promise<void>}
 */
export async function atualizarLote(id_fazenda, id_lote, dadosAtualizados) {
  const loteRef = doc(db, 'fazendas', id_fazenda, 'lotes', id_lote);

  setDoc(loteRef, dadosAtualizados, { merge: true }).catch((error) => {
    console.error(`[Firestore] Falha ao atualizar lote "${id_lote}" da fazenda "${id_fazenda}":`, error);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Sanidade (Vacinas, Medicamentos e Sintomas)
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RegistroSanitario
 * @property {string} id
 * @property {'vacina'|'sintoma'} tipo
 * @property {string} nome
 * @property {string} data_str  Formato "YYYY-MM-DD"
 * @property {Timestamp} data
 * @property {string} [dosagem]
 * @property {'spray'|'agua'|'injecao'} [via_aplicacao]
 * @property {'agendada'|'aplicada'} [status]
 * @property {number} [idade_programada_dias]
 * @property {string[]} [sintomas]
 * @property {string} [suspeita_doenca]
 * @property {string} [observacoes]
 */

/**
 * Cria ou atualiza um registro sanitário (vacina/medicamento ou sintoma) na
 * subcoleção `/fazendas/{id_fazenda}/lotes/{id_lote}/sanidade`.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Object} registroData
 * @returns {Promise<RegistroSanitario>}
 */
export async function salvarRegistroSanitario(id_fazenda, id_lote, registroData) {
  const { id, ...dadosLimpos } = registroData ?? {};
  const id_registro = id || doc(collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'sanidade')).id;
  const sanidadeRef = doc(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'sanidade', id_registro);

  setDoc(sanidadeRef, dadosLimpos, { merge: true }).catch((error) => {
    console.error(`[Firestore] Falha ao sincronizar registro sanitário "${id_registro}" do lote "${id_lote}":`, error);
  });

  return { id: id_registro, ...dadosLimpos };
}

/**
 * Recupera todos os registros sanitários (vacinas, medicamentos e sintomas)
 * de um lote.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @returns {Promise<RegistroSanitario[]>}
 */
export async function obterRegistrosSanitarios(id_fazenda, id_lote) {
  try {
    const sanidadeRef = collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'sanidade');
    const snapshot = await getDocs(sanidadeRef);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter registros sanitários do lote "${id_lote}":`, error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Histórico de Alertas (IA & WhatsApp)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Salva um registro de alerta enviado no histórico da fazenda.
 * Segue a abordagem offline-first: a promessa não bloqueia a execução, e
 * a UI pode ser atualizada otimisticamente.
 *
 * @param {string} id_fazenda
 * @param {Object} alertaData
 * @returns {Promise<Object>}
 */
export async function salvarAlertaEnviado(id_fazenda, alertaData) {
  const docRef = doc(collection(db, 'fazendas', id_fazenda, 'alertas_enviados'));

  const data = {
    ...alertaData,
    data_envio: Timestamp.now(),
  };

  setDoc(docRef, data).catch((error) => {
    console.error(`[Firestore] Falha ao sincronizar log de alerta na fazenda "${id_fazenda}":`, error);
  });

  return { id: docRef.id, ...data };
}

/**
 * Recupera o histórico de alertas disparados ordenados por data decrescente.
 *
 * @param {string} id_fazenda
 * @param {number} limite_items
 * @returns {Promise<Object[]>}
 */
export async function obterAlertasEnviados(id_fazenda, limite_items = 15) {
  try {
    const alertasRef = collection(db, 'fazendas', id_fazenda, 'alertas_enviados');
    const q = query(alertasRef, orderBy('data_envio', 'desc'), limit(limite_items));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter histórico de alertas da fazenda "${id_fazenda}":`, error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Autenticação e Resolução de Fazenda (Auth)
// ─────────────────────────────────────────────────────────────────────────
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './config';

export async function loginComEmail(email, senha) {
  if (!auth.signInWithEmailAndPassword && auth.currentUser?.uid === 'dono_demo_123') {
    // Mock handler
    return auth.currentUser;
  }
  const userCredential = await signInWithEmailAndPassword(auth, email, senha);
  return userCredential.user;
}

export async function criarConta(email, senha, nomeFazenda = "Minha Granja", tipoProducao = "Corte") {
  if (!auth.createUserWithEmailAndPassword && auth.currentUser?.uid === 'dono_demo_123') {
    return auth.currentUser;
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
  const user = userCredential.user;
  
  // Initialize onboarding flag sem await (evita race condition no rules do firestore)
  const userDocRef = doc(db, 'usuarios', user.uid);
  setDoc(userDocRef, { onboarding_concluido: false }, { merge: true }).catch(e => console.warn('Aviso ignorado ao criar conta (race condition no rules):', e));

  // Create a default farm for the new user
  await criarFazenda(nomeFazenda, tipoProducao, [], user.uid);
  
  return user;
}

export async function deslogar() {
  await signOut(auth);
}

/**
 * Busca a fazenda onde o usuário logado é membro ou dono.
 * Como o Firestore não permite uma query simples em chaves dinâmicas de mapas (membros.UID),
 * no caso do MVP, buscaremos todas as fazendas (ou usaremos um campo indexado 'ownerId' se crescer)
 * e filtraremos. Para otimização futura, o 'ownerId' deve ser adicionado ao doc de criação.
 */
export async function obterFazendaDoUsuario(uid) {
  // 1. Busca direta garantida (Contas novas e Admin)
  try {
    const adminFarmRef = doc(db, 'fazendas', `fazenda_${uid}`);
    const adminFarmSnap = await getDoc(adminFarmRef);
    if (adminFarmSnap.exists()) {
      const data = adminFarmSnap.data();
      const role = data.membros?.[uid] === 'dono' ? 'owner' : 'operator';
      return { id: adminFarmSnap.id, id_fazenda: adminFarmSnap.id, ...data, papelColaborador: role };
    }
  } catch (error) {
    console.warn('[Firestore] Fallback busca direta falhou:', error.code);
  }

  // 2. Tenta buscar na nova coleção de colaboradores
  try {
    const colabRef = doc(db, 'collaborators', uid);
    const colabSnap = await getDoc(colabRef);
    if (colabSnap.exists()) {
      const colabData = colabSnap.data();
      const farmRef = doc(db, 'fazendas', colabData.farmId);
      const farmSnap = await getDoc(farmRef);
      if (farmSnap.exists()) {
        return { id: farmSnap.id, id_fazenda: farmSnap.id, ...farmSnap.data(), papelColaborador: colabData.role };
      }
    }
  } catch (error) {
    console.warn('[Firestore] Fallback collaborators falhou:', error.code);
  }

  // 3. Fallback para compatibilidade com o mapa de membros (MVP antigo / Demo)
  try {
    const q = query(collection(db, 'fazendas'));
    const snapshot = await getDocs(q);
    const fazenda = snapshot.docs.find(docSnap => docSnap.data().membros?.[uid]);
    if (fazenda) {
      const role = fazenda.data().membros[uid] === 'dono' ? 'owner' : 'operator';
      return { id: fazenda.id, id_fazenda: fazenda.id, ...fazenda.data(), papelColaborador: role };
    }
  } catch (error) {
    console.warn('[Firestore] Fallback query geral falhou:', error.code);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Gestão de Equipe (Collaborators)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Obtém todos os colaboradores associados a uma fazenda.
 * @param {string} id_fazenda 
 * @returns {Promise<Object[]>}
 */
export async function obterColaboradores(id_fazenda) {
  try {
    const colabRef = collection(db, 'collaborators');
    const q = query(colabRef, where('farmId', '==', id_fazenda));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter colaboradores da fazenda ${id_fazenda}:`, error);
    return [];
  }
}

/**
 * Adiciona um convite de colaborador.
 * Cria o registro com ID automático e `uid: null`.
 * @param {string} id_fazenda 
 * @param {string} email 
 * @param {string} role 'owner' | 'veterinarian' | 'operator'
 * @param {string} nome 
 */
export async function adicionarColaborador(id_fazenda, email, role, nome) {
  const colabsRef = collection(db, 'collaborators');
  const docRef = doc(colabsRef);
  const data = {
    uid: null,
    farmId: id_fazenda,
    email,
    role,
    nome
  };
  setDoc(docRef, data).catch(console.error);
  return { id: docRef.id, ...data };
}

/**
 * Remove um colaborador da equipe.
 * @param {string} id_colaborador 
 */
export async function removerColaborador(id_colaborador) {
  try {
    const docRef = doc(db, 'collaborators', id_colaborador);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`[Firestore] Falha ao remover colaborador ${id_colaborador}:`, error);
  }
}

/**
 * Auto-vínculo de E-mail/UID no login.
 * Executado ao se autenticar para transformar o convite num membro ativo indexado pelo UID.
 * @param {string} uid 
 * @param {string} email 
 * @param {string} displayName 
 */
export async function vincularColaboradorSePendente(uid, email, displayName) {
  try {
    // Procura convites pendentes para este e-mail
    const colabsRef = collection(db, 'collaborators');
    const q = query(colabsRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      if (!data.uid) {
        // Vincula criando novo documento com o UID correto e deletando o temporário
        const colabDocRef = doc(db, 'collaborators', uid);
        await setDoc(colabDocRef, {
          ...data,
          uid: uid,
          nome: data.nome || displayName || email.split('@')[0]
        });
        if (docSnap.id !== uid) {
          await deleteDoc(docSnap.ref);
        }
      }
    } else {
      // Criação inicial caso seja o dono recém cadastrado que não passou por convite
      const colabRef = doc(db, 'collaborators', uid);
      const colabSnap = await getDoc(colabRef);
      if (!colabSnap.exists()) {
        const qFarms = query(collection(db, 'fazendas'));
        const farmsSnap = await getDocs(qFarms);
        const legacyFarm = farmsSnap.docs.find(d => d.data().membros?.[uid] === 'dono');
        if (legacyFarm) {
          await setDoc(colabRef, {
            uid,
            farmId: legacyFarm.id,
            role: 'owner',
            email,
            nome: displayName || email.split('@')[0]
          });
        }
      }
    }
  } catch (error) {
    console.error('[Firestore] Erro ao vincular colaborador pendente:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Estoque e Nutrição Preditiva
// ─────────────────────────────────────────────────────────────────────────

/**
 * Salva um registro de carga/abastecimento no silo.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Object} cargaData
 * @param {number} cargaData.quantidade_kg
 * @param {string} cargaData.data_str Formato "YYYY-MM-DD"
 * @returns {Promise<Object>}
 */
export async function registrarCargaSilo(id_fazenda, id_lote, cargaData) {
  const docRef = doc(collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'cargas_silo'));

  const data = {
    ...cargaData,
    timestamp_registro: Timestamp.now(),
  };

  setDoc(docRef, data).catch((error) => {
    console.error(`[Firestore] Falha ao registrar carga no lote "${id_lote}":`, error);
  });

  return { id: docRef.id, ...data };
}

/**
 * Recupera o histórico de cargas do silo.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @returns {Promise<Object[]>}
 */
export async function obterCargasSilo(id_fazenda, id_lote) {
  try {
    const cargasRef = collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'cargas_silo');
    const q = query(cargasRef, orderBy('data_str', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter histórico de cargas do lote "${id_lote}":`, error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Limites de Inteligência Artificial e Configurações Zootécnicas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Registra/incrementa o limite diário de uso da IA para o plano Essencial.
 * @param {string} id_fazenda 
 * @returns {Promise<void>}
 */
export async function incrementarUsoIA(id_fazenda) {
  const hoje = new Date().toISOString().split('T')[0];
  const limitRef = doc(db, 'fazendas', id_fazenda, 'limites_bi', hoje);

  try {
    const docSnap = await getDoc(limitRef);
    const currentEnvios = docSnap.exists() ? docSnap.data().envios || 0 : 0;
    
    setDoc(limitRef, { envios: currentEnvios + 1, data: hoje }, { merge: true }).catch(error => {
      console.error(`[Firestore] Falha offline ao incrementar IA na fazenda "${id_fazenda}":`, error);
    });
  } catch (e) {
    console.error(`[Firestore] Erro leitura incrementarUsoIA`, e);
  }
}

/**
 * Atualiza os parâmetros de configuração preditiva (Capacidade do Silo e Caixa D'água).
 * @param {string} id_fazenda 
 * @param {string} id_lote 
 * @param {Object} configData 
 * @returns {Promise<void>}
 */
export async function atualizarConfiguracaoPreditiva(id_fazenda, id_lote, configData) {
  const loteRef = doc(db, 'fazendas', id_fazenda, 'lotes', id_lote);
  setDoc(loteRef, configData, { merge: true }).catch(error => {
    console.error(`[Firestore] Falha ao atualizar conf preditiva no lote "${id_lote}":`, error);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Financeiro (Transações)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Registra uma nova transação financeira (receita ou despesa) vinculada a um lote.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Object} transacaoData
 * @param {string} transacaoData.tipo - 'receita' ou 'despesa'
 * @param {number} transacaoData.valor
 * @param {string} transacaoData.descricao
 * @param {string} transacaoData.categoria
 * @param {string} [transacaoData.data_str] Formato YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function registrarTransacao(id_fazenda, id_lote, transacaoData) {
  const docRef = doc(collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'transacoes'));

  const data = {
    ...transacaoData,
    timestamp_registro: Timestamp.now(),
  };

  setDoc(docRef, data).catch((error) => {
    console.error(`[Firestore] Falha ao registrar transacao no lote "${id_lote}":`, error);
  });

  return { id: docRef.id, ...data };
}

/**
 * Recupera o histórico de transações de um lote.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @returns {Promise<Object[]>}
 */
export async function obterTransacoesLote(id_fazenda, id_lote) {
  try {
    const transacoesRef = collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'transacoes');
    const q = query(transacoesRef, orderBy('timestamp_registro', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter transacoes do lote "${id_lote}":`, error);
    return [];
  }
}

/**
 * Deleta uma transação específica de um lote.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {string} id_transacao
 * @returns {Promise<void>}
 */
export async function deletarTransacao(id_fazenda, id_lote, id_transacao) {
  try {
    const docRef = doc(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'transacoes', id_transacao);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`[Firestore] Falha ao deletar transacao "${id_transacao}" do lote "${id_lote}":`, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Gestão de Pesagens (Peso Médio / Uniformidade)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Registra ou atualiza uma pesagem (amostragem) vinculada a um lote.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Object} pesagemData
 * @param {string} pesagemData.data_str Formato YYYY-MM-DD
 * @param {number} pesagemData.peso_medio_g
 * @param {number} [pesagemData.uniformidade_pct]
 * @param {number} [pesagemData.idade_dias] Idade do lote no dia da pesagem
 * @param {string} [id_existente] Opcional. Se passado, atualiza. Senão, cria novo.
 * @returns {Promise<Object>}
 */
export async function salvarPesagem(id_fazenda, id_lote, pesagemData, id_existente = null) {
  const pesagensRef = collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'pesagens');
  const docRef = id_existente ? doc(pesagensRef, id_existente) : doc(pesagensRef);

  const data = {
    ...pesagemData,
    timestamp_registro: Timestamp.now(),
  };

  setDoc(docRef, data, { merge: true }).catch((error) => {
    console.error(`[Firestore] Falha ao salvar pesagem no lote "${id_lote}":`, error);
  });

  return { id: docRef.id, ...data };
}

/**
 * Recupera o histórico de pesagens de um lote.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @returns {Promise<Object[]>}
 */
export async function obterPesagens(id_fazenda, id_lote) {
  try {
    const pesagensRef = collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'pesagens');
    const q = query(pesagensRef, orderBy('data_str', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error(`[Firestore] Falha ao obter pesagens do lote "${id_lote}":`, error);
    return [];
  }
}

/**
 * Deleta um registro de pesagem específico.
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {string} id_pesagem
 * @returns {Promise<void>}
 */
export async function deletarPesagem(id_fazenda, id_lote, id_pesagem) {
  try {
    const docRef = doc(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'pesagens', id_pesagem);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`[Firestore] Falha ao deletar pesagem "${id_pesagem}" do lote "${id_lote}":`, error);
  }
}

// ─── FATURAMENTO E CHECKOUT (SANDBOX) ────────────────────────────────────────────

/**
 * Simula a criação de uma sessão de checkout Stripe/Asaas
 */
export async function criarSessaoCheckout(id_fazenda, uid_usuario) {
  // Simula latência de rede
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  // Em produção, isso bateria em uma Cloud Function para obter a URL real do Stripe/Asaas
  // Para testes locais, retornamos uma URL simulada que altera o plano no Firestore após 3 segundos
  const urlSandbox = `https://checkout.stripe.com/pay/sandbox_${id_fazenda}`;
  console.log(`[Billing Sandbox] Sessão gerada para fazenda ${id_fazenda}. Redirecionando para ${urlSandbox}`);
  
  return {
    url: urlSandbox,
    id_sessao: `sess_${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * Retorna dados fictícios de faturamento baseados no plano da fazenda
 */
export async function obterStatusFaturamento(id_fazenda, planoAtual) {
  if (planoAtual !== 'Inteligente') {
    return {
      plano: 'Essencial',
      valor: 40.00,
      renovacao: null,
      metodoPagamento: null,
      recibos: []
    };
  }
  
  return {
    plano: 'Inteligente',
    valor: 110.00,
    renovacao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    metodoPagamento: 'Cartão de Crédito (Visa **** 4242)',
    recibos: [
      { id: 'inv_01', data: '10/05/2026', valor: 110.00, status: 'pago' },
      { id: 'inv_02', data: '10/04/2026', valor: 110.00, status: 'pago' }
    ]
  };
}

/**
 * Atualiza o plano da fazenda
 */
export async function atualizarPlanoFazenda(id_fazenda, plano) {
  try {
    const fazendaRef = doc(db, 'fazendas', id_fazenda);
    await updateDoc(fazendaRef, { plano });
  } catch (error) {
    console.error(`[Firestore] Falha ao atualizar plano para ${plano} na fazenda ${id_fazenda}:`, error);
    throw error;
  }
}

// ─── AUDITORIA E EXPORTAÇÃO ───────────────────────────────────────────────────

/**
 * Registra a auditoria de geração de relatório CSV
 */
export async function registrarExportacao(id_fazenda, uid_usuario, tipoRelatorio, filtros = {}) {
  try {
    const exportRef = collection(db, 'fazendas', id_fazenda, 'logs_exportacao');
    await addDoc(exportRef, {
      uid_usuario,
      tipoRelatorio,
      filtros,
      data_exportacao: serverTimestamp()
    });
  } catch (error) {
    console.error(`[Firestore] Falha ao registrar log de exportação na fazenda ${id_fazenda}:`, error);
  }
}

/**
 * Registra a auditoria de sincronização de dados offline
 */
export async function registrarSyncOffline(id_fazenda, uid_usuario, logsSync = {}) {
  try {
    const syncRef = collection(db, 'fazendas', id_fazenda, 'logs_sync');
    await addDoc(syncRef, {
      uid_usuario,
      transacoesSync: logsSync,
      data_sync: serverTimestamp()
    });
  } catch (error) {
    console.error(`[Firestore] Falha ao registrar log de sync offline na fazenda ${id_fazenda}:`, error);
  }
}

// ─── ONBOARDING E UX ──────────────────────────────────────────────────────────

/**
 * Verifica se o usuário concluiu o onboarding. Retorna falso por padrão.
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function verificarStatusOnboarding(uid) {
  try {
    const userDocRef = doc(db, 'usuarios', uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data().onboarding_concluido === true;
    }
    return false;
  } catch (error) {
    console.error(`[Firestore] Erro ao verificar onboarding para uid ${uid}:`, error);
    return false;
  }
}

/**
 * Marca o onboarding como concluído para o usuário.
 * @param {string} uid
 */
export async function concluirOnboarding(uid) {
  try {
    const userDocRef = doc(db, 'usuarios', uid);
    await setDoc(userDocRef, { onboarding_concluido: true }, { merge: true });
  } catch (error) {
    console.error(`[Firestore] Erro ao concluir onboarding para uid ${uid}:`, error);
  }
}

// ─── IMPORTADOR DE DADOS E DATA LAKE (SPRINT 30) ─────────────────────────────

/**
 * Importa registros e transações financeiras em massa para um lote.
 * 
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @param {Array} registros - Lista de objetos com dados de registro diário.
 * @param {Array} transacoes - Lista de objetos com dados financeiros.
 */
export async function importarDadosLote(id_fazenda, id_lote, registros = [], transacoes = []) {
  try {
    // Registros diários
    for (const r of registros) {
      if (!r.data_str) continue;
      const ref = doc(collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'registros_diarios'));
      setDoc(ref, {
        id_lote: id_lote,
        ...r,
        data_registro: Timestamp.now()
      }).catch(err => console.error('Erro na gravação otimista de registro:', err));
    }

    // Transações financeiras
    for (const t of transacoes) {
      if (!t.valor) continue;
      const ref = doc(collection(db, 'fazendas', id_fazenda, 'lotes', id_lote, 'transacoes'));
      setDoc(ref, {
        ...t,
        timestamp_registro: Timestamp.now()
      }).catch(err => console.error('Erro na gravação otimista de transação:', err));
    }
  } catch (error) {
    console.error(`[Firestore] Erro na importação em lote na fazenda ${id_fazenda}:`, error);
    throw error;
  }
}

/**
 * Atualiza o opt-in de compartilhamento de dados anônimos (Data Lake).
 * @param {string} id_fazenda
 * @param {boolean} optIn
 */
export async function atualizarCompartilhamentoDados(id_fazenda, optIn) {
  try {
    const fazendaRef = doc(db, 'fazendas', id_fazenda);
    await setDoc(fazendaRef, { compartilhar_dados_ia: optIn }, { merge: true });
  } catch (error) {
    console.error(`[Firestore] Erro ao atualizar opt-in de IA na fazenda ${id_fazenda}:`, error);
  }
}

/**
 * Exporta sumário anônimo de lote fechado para o Data Lake de Benchmarking.
 * Só exporta se o opt-in estiver true na fazenda.
 * @param {string} id_fazenda
 * @param {Object} sumarioLote - Objeto com CA, Mortalidade, CEP parcial, etc.
 */
export async function exportarLoteParaDataLake(id_fazenda, sumarioLote) {
  try {
    const fazendaRef = doc(db, 'fazendas', id_fazenda);
    const docSnap = await getDoc(fazendaRef);
    if (!docSnap.exists() || docSnap.data().compartilhar_dados_ia !== true) {
      return; // Opt-in não ativado, não compartilha dados
    }

    const lakeRef = collection(db, 'benchmarks_anonimos');
    await setDoc(doc(lakeRef), {
      ...sumarioLote,
      timestamp_exportacao: Timestamp.now()
    });
  } catch (error) {
    console.error(`[Firestore] Erro ao exportar para o Data Lake:`, error);
  }
}

/**
 * Recupera o histórico do AgBoy para a fazenda.
 * @param {string} id_fazenda
 * @returns {Promise<Array>}
 */
export async function recuperarHistoricoChat(id_fazenda) {
  try {
    const chatRef = collection(db, `fazendas/${id_fazenda}/chat_agboy`);
    const q = query(chatRef, orderBy('timestamp', 'asc'), limit(50));
    const querySnapshot = await getDocs(q);
    const mensagens = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // O banco salva pergunta e resposta no mesmo doc, então vamos separar para a UI de chat
      mensagens.push({
        id: doc.id + '_q',
        role: 'user',
        texto: data.pergunta,
        timestamp: data.timestamp?.toDate().toISOString() || new Date().toISOString()
      });
      mensagens.push({
        id: doc.id + '_a',
        role: 'assistant',
        texto: data.resposta,
        timestamp: data.timestamp?.toDate().toISOString() || new Date().toISOString()
      });
    });
    
    return mensagens;
  } catch (error) {
    console.error(`[Firestore] Erro ao recuperar histórico do AgBoy:`, error);
    return [];
  }
}
