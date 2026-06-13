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
      if (inMemoryDB[path]) {
        return {
          exists: true,
          data: () => inMemoryDB[path]
        };
      }
      if (path.includes('config/agboy')) {
        return {
          exists: true,
          data: () => ({
            gemini_api_key: 'test_mock_key',
            anthropic_api_key: 'test_mock_key'
          })
        };
      }
      if (path.includes('/lotes/')) {
        return {
          exists: true,
          data: () => ({ linhagem: "Cobb", quantidade_inicial: 1000, quantidade: 1000, status: 'ativo' })
        };
      }
      return {
        exists: true,
        data: () => ({
          nome: "Fazenda Mock",
          plano: "Inteligente",
          contatos_autorizados: ["5511999999999"],
          alertas_config: {
            mortalidade_critica: 1,
            desvio_agua: 10,
            desvio_racao: 10
          }
        })
      };
    },
    delete: async () => {
      delete inMemoryDB[path];
    }
  })
};

firestoreApi.getFirestore = () => firestoreMock;
firestoreApi.FieldValue = {
  serverTimestamp: () => 'SERVER_TIMESTAMP'
};

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
    },
    startChat: function() {
      return {
        sendMessage: async (content) => {
          const contentStr = JSON.stringify(content);
          if (contentStr.includes('Anota 15 mortes')) {
            return {
              response: {
                functionCalls: () => [
                  {
                    name: 'criar_rascunho_manejo',
                    args: { lote: 'Lote A', mortalidade_qtd: 15 }
                  }
                ],
                text: () => "Rascunho criado."
              }
            };
          }
          if (contentStr.includes('Sim') || contentStr.includes('confirmado')) {
            return {
              response: {
                functionCalls: () => [
                  {
                    name: 'salvar_rascunho_manejo_confirmado',
                    args: {}
                  }
                ],
                text: () => "Dados salvos!"
              }
            };
          }
          return {
            response: {
              functionCalls: () => [],
              text: () => "Processado."
            }
          };
        }
      };
    }
  };
};

// Mock do Anthropic AI via require cache wrapper
class MockAnthropic {
  constructor(options) {
    this.apiKey = options.apiKey;
    this.messages = {
      create: async (body) => {
        const promptTxt = JSON.stringify(body);

        if (body.system && body.system.includes('Sua função é avaliar o pedido do produtor')) {
          return {
            content: [{ type: 'text', text: mockSupervisorResponse }],
            stop_reason: 'end_turn'
          };
        }

        if (promptTxt.includes('Anota 15 mortes')) {
          return {
            content: [
              {
                type: 'tool_use',
                id: 'tool_123',
                name: 'criar_rascunho_manejo',
                input: { lote: 'Lote A', mortalidade_qtd: 15 }
              }
            ],
            stop_reason: 'tool_use'
          };
        }

        if (promptTxt.includes('Sim')) {
          return {
            content: [
              {
                type: 'tool_use',
                id: 'tool_456',
                name: 'salvar_rascunho_manejo_confirmado',
                input: {}
              }
            ],
            stop_reason: 'tool_use'
          };
        }

        let textResult = mockAgentResponse;
        if (promptTxt.includes('Você é o AgBoy, a IA da AgTech Hero')) {
          textResult = `[Consolidado] ${mockAgentResponse}`;
        }

        return {
          content: [{ type: 'text', text: textResult }],
          stop_reason: 'end_turn'
        };
      }
    };
  }
}

// Injetar MockAnthropic no cache de modulos do Node.js
const anthropicPath = require.resolve('@anthropic-ai/sdk');
require('@anthropic-ai/sdk'); // Carrega no cache primeiro
require.cache[anthropicPath].exports = MockAnthropic;

// Mock do Firebase Functions v2 ANTES de importar index.js
const moduleLib = require('module');
const originalRequire = moduleLib.prototype.require;
moduleLib.prototype.require = function() {
  if (arguments[0] === 'firebase-functions/v2/firestore') {
    return {
      onDocumentWritten: (path, handler) => handler, // Retorna o callback cru
      onDocumentCreated: (path, handler) => handler
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
  const userId = '5511999999999';

  // TESTE A.1: Entrada de Dados - Criar Rascunho
  console.log('--- TESTE A.1: DATA_CLERK (Criar Rascunho) ---');
  mockSupervisorResponse = JSON.stringify({ delegar_para: ["DATA_CLERK"], motivo: "registro", resposta_direta: null });
  mockAgentResponse = "Anotado: 15 mortes. Posso salvar?";

  const res1 = await AgBoyOrchestrator({ text: "Anota 15 mortes", userId }, "Contexto", idFazenda);
  assert(inMemoryDB[`fazendas/${idFazenda}/rascunho_agboy/${userId}`] != null, "Rascunho gravado no BD em memória.");
  assert(inMemoryDB[`fazendas/${idFazenda}/rascunho_agboy/${userId}`].dados_extraidos.mortalidade_qtd === 15, "Dados extraídos corretamente.");

  // TESTE A.2: Entrada de Dados - Confirmar Rascunho
  console.log('\n--- TESTE A.2: DATA_CLERK (Confirmar Rascunho) ---');
  mockAgentResponse = "Dados salvos com sucesso!";

  const res2 = await AgBoyOrchestrator({ text: "Sim", userId }, "Contexto", idFazenda);
  assert(!inMemoryDB[`fazendas/${idFazenda}/rascunho_agboy/${userId}`], "Rascunho deletado do BD em memória após confirmação.");

  // TESTE B: Diagnóstico Clínico
  console.log('\n--- TESTE B: CLINICO (Diagnóstico Visual) ---');
  mockSupervisorResponse = JSON.stringify({ delegar_para: ["CLINICO"], motivo: "imagem", resposta_direta: null });
  mockAgentResponse = "Parece Coccidiose. *Aviso: Consulte o Médico Veterinário*";

  const res3 = await AgBoyOrchestrator({ media: { type: 'image', mimeType: 'image/png', base64: 'fake' }, userId }, "Contexto", idFazenda);
  assert(res3.text.includes("Coccidiose"), "A IA Clínica detectou a doença.");

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

  console.log('\n🏆 BATERIA DE TESTES CONCLUÍDA COM SUCESSO! 100% PASS.');
  process.exit(0);
}

runTests().catch(err => {
  console.error("Erro fatal nos testes:", err);
  process.exit(1);
});
