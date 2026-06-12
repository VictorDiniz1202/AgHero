// Mocking do Firebase Admin ANTES de importar qualquer código
const adminApp = require('firebase-admin/app');
adminApp.initializeApp = () => {}; // Evita erro de duplicidade e conexões reais

const firestoreApi = require('firebase-admin/firestore');
// Mock em memória do Firestore
let inMemoryDB = {};

const firestoreMock = {
  collection: (path) => ({
    doc: (docPath) => firestoreMock.doc(`${path}/${docPath}`),
    where: () => firestoreMock.collection(path),
    orderBy: () => firestoreMock.collection(path),
    limit: () => firestoreMock.collection(path),
    get: async () => {
      // Retorna docs simulados dependendo do path
      if (path.includes('registros_diarios')) {
        return {
          empty: false,
          docs: [{ data: () => ({ mortalidade_qtd: 15, agua_litros: 1000, racao_kg: 500 }) }],
          forEach: function(cb) { this.docs.forEach(cb); }
        };
      }
      if (path.includes('alertas_enviados')) {
        return {
          empty: false,
          docs: [{ data: () => inMemoryDB['ultimo_alerta'] || { mensagem_gerada: "Alta Mortalidade\nQueda de Consumo de Água" } }],
          forEach: function(cb) { this.docs.forEach(cb); }
        };
      }
      return { empty: true, docs: [], forEach: function() {} };
    },
    add: async (data) => {
      if (path.includes('alertas_enviados')) {
        inMemoryDB['ultimo_alerta'] = data;
      }
    }
  }),
  doc: (path) => ({
    collection: (colPath) => firestoreMock.collection(`${path}/${colPath}`),
    set: async (data) => {
      inMemoryDB[path] = data;
    },
    get: async () => {
      if (path.includes('rascunho_agboy/atual')) {
        return {
          exists: !!inMemoryDB[path],
          data: () => inMemoryDB[path]
        };
      }
      return {
        exists: true,
        data: () => ({ nome: "Fazenda Mock", plano: "Inteligente", contatos_autorizados: ["5511999999999"] })
      };
    },
    delete: async () => {
      delete inMemoryDB[path];
    }
  })
};

firestoreApi.getFirestore = () => firestoreMock;

// Mock do Gemini AI
const { GoogleGenerativeAI } = require('@google/generative-ai');
process.env.GEMINI_API_KEY = 'test_mock_key';

let mockSupervisorResponse = '';
let mockAgentResponse = '';

GoogleGenerativeAI.prototype.getGenerativeModel = function(options) {
  return {
    generateContent: async (promptParts) => {
      const promptTxt = JSON.stringify(promptParts);
      if (promptTxt.includes('Sua função é avaliar o pedido do produtor')) {
        return { response: { text: () => mockSupervisorResponse } };
      }
      if (promptTxt.includes('Você é o AgBoy, a IA da AgTech Hero')) {
         return { response: { text: () => `[Consolidado] ${mockAgentResponse}` } };
      }
      return { response: { text: () => mockAgentResponse } };
    }
  };
};

// Mock do Firebase Functions v2 ANTES de importar index.js
const moduleLib = require('module');
const originalRequire = moduleLib.prototype.require;
moduleLib.prototype.require = function() {
  if (arguments[0] === 'firebase-functions/v2/firestore') {
    return {
      onDocumentWritten: (path, handler) => handler // Retorna o callback cru
    };
  }
  return originalRequire.apply(this, arguments);
};

// Importar os módulos para testar AGORA (após os mocks estarem injetados)
const { AgBoyOrchestrator } = require('../src/ai/orchestrator');
const { onRegistroDiarioEscrito } = require('../index');

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FALHOU:', message);
    process.exit(1);
  }
  console.log('✅ PASSOU:', message);
}

// SUITE DE TESTES EM MEMÓRIA
async function runTests() {
  console.log('🚀 Iniciando Bateria de Testes (Mocked/In-Memory) do AgBoy 2.0...\n');
  const idFazenda = 'fazenda_test_123';

  // TESTE A.1: Entrada de Dados - Criar Rascunho
  console.log('--- TESTE A.1: DATA_CLERK (Criar Rascunho) ---');
  mockSupervisorResponse = JSON.stringify({ delegar_para: ["DATA_CLERK"], motivo: "registro", resposta_direta: null });
  mockAgentResponse = JSON.stringify({
    comando: "RASCUNHO",
    dados_extraidos: { lote: "Lote A", mortalidade_qtd: 15 },
    mensagem_usuario: "Anotado: 15 mortes. Posso salvar?"
  });

  const res1 = await AgBoyOrchestrator({ text: "Anota 15 mortes" }, "Contexto", idFazenda);
  assert(res1.includes("Posso salvar?"), "Orquestrador retornou a confirmação.");
  assert(inMemoryDB[`fazendas/${idFazenda}/rascunho_agboy/atual`].dados_extraidos.mortalidade_qtd === 15, "Rascunho gravado no BD em memória.");

  // TESTE A.2: Entrada de Dados - Confirmar Rascunho
  console.log('\n--- TESTE A.2: DATA_CLERK (Confirmar Rascunho) ---');
  mockAgentResponse = JSON.stringify({ comando: "SALVAR", dados_extraidos: {}, mensagem_usuario: "Dados salvos!" });

  const res2 = await AgBoyOrchestrator({ text: "Sim" }, "Contexto", idFazenda);
  assert(res2.includes("Dados salvos!"), "Orquestrador confirmou salvamento.");
  assert(!inMemoryDB[`fazendas/${idFazenda}/rascunho_agboy/atual`], "Rascunho deletado do BD em memória.");

  // TESTE B: Diagnóstico Clínico
  console.log('\n--- TESTE B: CLINICO (Diagnóstico Visual) ---');
  mockSupervisorResponse = JSON.stringify({ delegar_para: ["CLINICO"], motivo: "imagem", resposta_direta: null });
  mockAgentResponse = "Parece Coccidiose. *Aviso: Consulte o Médico Veterinário*";

  const res3 = await AgBoyOrchestrator({ media: { type: 'image', base64: 'fake' } }, "Contexto", idFazenda);
  assert(res3.includes("Coccidiose"), "A IA Clínica detectou a doença na imagem fake.");
  assert(res3.includes("Consulte o Médico Veterinário"), "Disclaimer legal embutido.");

  // TESTE C: Alertas Proativos
  console.log('\n--- TESTE C: TRIGGER DE ANOMALIA (Push) ---');
  const fakeEvent = {
    params: { id_fazenda: idFazenda, id_registro: 'reg_hoje' },
    data: {
      after: {
        exists: true,
        data: () => ({ id_lote: "Lote", agua_litros: 600, racao_kg: 510, mortalidade_qtd: 12 })
      }
    }
  };

  await onRegistroDiarioEscrito(fakeEvent);
  
  const alertaSalvo = inMemoryDB['ultimo_alerta'];
  assert(alertaSalvo != null, "Gatilho registrou o alerta de anomalia.");
  assert(alertaSalvo.mensagem_gerada.includes("Alta Mortalidade"), "Alerta pegou mortalidade crítica.");
  assert(alertaSalvo.mensagem_gerada.includes("Queda de Consumo de Água"), "Alerta pegou queda de água.");

  console.log('\n🏆 BATERIA DE TESTES CONCLUÍDA COM SUCESSO! 100% PASS.');
  process.exit(0);
}

runTests().catch(err => {
  console.error("Erro fatal nos testes:", err);
  process.exit(1);
});
