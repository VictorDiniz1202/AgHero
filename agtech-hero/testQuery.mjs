import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCSgQ4zVlHtV7jSJMMj2e73a9-XzL3K_FA",
  authDomain: "agtech-90fb5.firebaseapp.com",
  projectId: "agtech-90fb5",
  storageBucket: "agtech-90fb5.firebasestorage.app",
  messagingSenderId: "816907964031",
  appId: "1:816907964031:web:e670f04c035e242bba794a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, "luisguilherme@teste.com.br", "1234567");
    const uid = userCredential.user.uid;
    console.log("Logged in UID:", uid);

    try {
      console.log("Querying all farms...");
      const q = query(collection(db, 'fazendas'));
      const snapshot = await getDocs(q);
      console.log("Farms found:", snapshot.docs.length);
    } catch (e) {
      console.error("Error querying farms:", e.message);
    }

  } catch (error) {
    console.error("Login failed:", error.message);
  }
  process.exit(0);
}

test();
