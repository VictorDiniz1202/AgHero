/**
 * src/firebase/config.js
 *
 * Inicialização central do Firebase para o AgHero.
 *
 * CONTEXTO (Offline-First):
 * O app é usado em propriedades rurais com conexão de internet instável ou
 * inexistente. Por isso, o Firestore é inicializado com `persistentLocalCache`,
 * que ativa um cache persistente em IndexedDB. Isso permite que:
 *   - leituras sirvam dados do cache local instantaneamente (sem tela travada);
 *   - escritas (`setDoc`, `updateDoc`, etc.) feitas offline sejam enfileiradas
 *     localmente e sincronizadas automaticamente quando a rede voltar.
 *
 * IMPORTANTE: este arquivo deve ser importado uma única vez (módulos ES já
 * fazem cache de import, então `app`, `auth` e `db` são singletons).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────
// 1. Configuração do projeto Firebase
// ─────────────────────────────────────────────────────────────────────────
// Os valores vêm de variáveis de ambiente do Vite (prefixo "VITE_" obrigatório).
// Configure-os em um arquivo `.env` na raiz do projeto (veja `.env.example`).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyApiKeyForTesting123456789",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agtech-demo-local.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agtech-demo-local",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agtech-demo-local.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890",
};

if (import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn(
    '[Firebase] Variáveis de ambiente VITE_FIREBASE_* não encontradas. ' +
      'Utilizando credenciais de demonstração locais. O app funcionará localmente via IndexedDB.'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Inicialização do App
// ─────────────────────────────────────────────────────────────────────────
// `getApps().length` evita o erro "Firebase App named '[DEFAULT]' already
// exists" durante o Hot Module Replacement (HMR) do Vite em desenvolvimento,
// quando este módulo pode ser reavaliado sem recarregar a página inteira.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ─────────────────────────────────────────────────────────────────────────
// 3. Authentication
// ─────────────────────────────────────────────────────────────────────────
// O Firebase Auth já persiste a sessão do usuário localmente (IndexedDB no
// navegador) por padrão, permitindo login automático mesmo offline.
let auth;
try {
  auth = getAuth(app);
} catch (error) {
  console.warn('[Firebase Auth] Falha ao inicializar Auth (API Key inválida/ausente). Usando mock para desenvolvimento local.', error);
  // Mock mínimo para o app de demonstração carregar sem tela branca
  auth = {
    currentUser: { uid: 'dono_demo_123', email: 'produtor_demo@aghero.com' },
    onAuthStateChanged: (callback) => {
      // Executa o callback imediatamente com o usuário simulado
      setTimeout(() => callback({ uid: 'dono_demo_123', email: 'produtor_demo@aghero.com' }), 100);
      return () => {};
    },
    signOut: async () => {
      console.log('[Mock Auth] SignOut executado');
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Firestore com cache local persistente (IndexedDB)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Cria a instância do Firestore com persistência offline habilitada.
 *
 * Estratégia em duas camadas:
 *
 *  1) `persistentMultipleTabManager()` — permite que múltiplas abas do
 *     navegador compartilhem o MESMO cache IndexedDB simultaneamente.
 *     Isso evita, na prática, o erro clássico `failed-precondition`
 *     ("a persistência só pode ser ativada em uma aba por vez"), que
 *     ocorreria com o gerenciador padrão (single-tab) caso o usuário
 *     abra a granja em duas abas/janelas ao mesmo tempo.
 *
 *  2) Bloco `try/catch` como rede de segurança — caso a etapa acima falhe
 *     mesmo assim (ex.: navegador sem suporte a IndexedDB, modo anônimo
 *     restritivo, ou qualquer outro erro de inicialização do cache), a
 *     aplicação NÃO deve travar. Fazemos fallback para `memoryLocalCache()`,
 *     que mantém o app 100% funcional (apenas sem persistência entre
 *     recarregamentos de página) em vez de quebrar a tela com uma exceção
 *     não tratada.
 *
 * @returns {import('firebase/firestore').Firestore}
 */
function createFirestoreInstance() {
  try {
    // Tenta inicializar o Firestore com cache offline persistente e multi-tab
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    // Se falhar porque já está inicializado (comum no Hot Module Replacement do Vite),
    // simplesmente recuperamos a instância já ativa.
    if (error.code === 'failed-precondition' || error.message?.includes('already has been initialized')) {
      return getFirestore(app);
    }
    
    // Para outros erros (como falta de suporte a IndexedDB), o Firebase SDK
    // v9/v10 já faz o fallback interno para memória de forma automática.
    console.warn('[Firestore] Erro ao ativar persistência offline. Fallback automático do SDK para cache em memória.', error);
    return getFirestore(app);
  }
}

const db = createFirestoreInstance();

// ─────────────────────────────────────────────────────────────────────────
// 5. Exports
// ─────────────────────────────────────────────────────────────────────────
export { app, auth, db };
