const fs = require('fs');
const path = require('path');
const envStr = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const match = envStr.match(/GEMINI_API_KEY=(.+)/);
if (match) process.env.GEMINI_API_KEY = match[1].trim();

// Mock do Firebase Admin
const firestore = require('firebase-admin/firestore');
firestore.getFirestore = () => {
  return {
    collection: (colName) => ({
      doc: (docName) => ({
        collection: (subCol) => ({
          doc: (subDoc) => ({
            set: async (data, opts) => {
              console.log(`[MOCK FIRESTORE] SET on ${colName}/${docName}/${subCol}/${subDoc} com dados:`, JSON.stringify(data), opts || '');
            },
            get: async () => ({
              exists: true,
              data: () => ({
                timestamp: { toMillis: () => Date.now() },
                dados_extraidos: {
                  lote: 'LoteTeste',
                  mortalidade_qtd: 5,
                  racao_kg: 100
                }
              })
            }),
            delete: async () => {
              console.log(`[MOCK FIRESTORE] DELETE on ${colName}/${docName}/${subCol}/${subDoc}`);
            }
          })
        }),
        get: async () => {
          if (colName === 'config' && docName === 'agboy') {
             return { exists: false };
          }
          return { exists: true, data: () => ({}) };
        }
      })
    })
  };
};

firestore.FieldValue = {
  serverTimestamp: () => 'SERVER_TIMESTAMP'
};

const { AgBoyOrchestrator } = require('../src/ai/orchestrator.js');

async function runTests() {
  console.log("=== TESTE 1: CRIANDO RASCUNHO DE MANEJO ===");
  const res1 = await AgBoyOrchestrator(
    { text: "Morreram 5 aves e dei 100kg de racao pro lote 2 hoje.", userId: 'victor123' },
    "Fazenda Feliz, 2 Lotes ativos",
    "fazenda_1"
  );
  console.log("RESPOSTA 1:", res1.text);
  
  console.log("\n=== TESTE 2: CONFIRMANDO SALVAMENTO ===");
  const res2 = await AgBoyOrchestrator(
    { text: "Pode salvar.", userId: 'victor123' },
    "Fazenda Feliz, 2 Lotes ativos",
    "fazenda_1"
  );
  console.log("RESPOSTA 2:", res2.text);
}

runTests().catch(console.error);
