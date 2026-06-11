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
  const fazendaRef = doc(collection(db, 'fazendas'));

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
 * Encerra um lote alterando seu status para "encerrado".
 *
 * @param {string} id_fazenda
 * @param {string} id_lote
 * @returns {Promise<void>}
 */
export async function encerrarLote(id_fazenda, id_lote) {
  const loteRef = doc(db, 'fazendas', id_fazenda, 'lotes', id_lote);

  setDoc(loteRef, { status: 'encerrado' }, { merge: true }).catch((error) => {
    console.error(`[Firestore] Falha ao encerrar lote "${id_lote}" da fazenda "${id_fazenda}":`, error);
  });
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
  try {
    const q = query(collection(db, 'fazendas'));
    const snapshot = await getDocs(q);
    
    // Find the first farm where the user is in the 'membros' map
    const fazenda = snapshot.docs.find(docSnap => {
      const data = docSnap.data();
      return data.membros && data.membros[uid];
    });

    if (fazenda) {
      return { id: fazenda.id, ...fazenda.data() };
    }
    return null;
  } catch (error) {
    console.error('[Firestore] Falha ao obter fazenda do usuário:', error);
    return null;
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
