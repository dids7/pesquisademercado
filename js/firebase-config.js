// Configuração do Firebase
//
// IMPORTANTE: esses valores NÃO são segredos. Diferente de uma senha ou chave de API
// tradicional, o firebaseConfig é seguro para ficar público no código do site — quem
// realmente protege os dados são as REGRAS DE SEGURANÇA do Firestore (é o nosso
// próximo passo depois deste).
const firebaseConfig = {
  apiKey: "AIzaSyDyVV5qweu2-GC0780Vsv_havrVnuQ3DoM",
  authDomain: "pesquisa-mercado-braganca.firebaseapp.com",
  projectId: "pesquisa-mercado-braganca",
  storageBucket: "pesquisa-mercado-braganca.firebasestorage.app",
  messagingSenderId: "959690051819",
  appId: "1:959690051819:web:a69511cfd4e9dc4c366eae",
};

// Carregamos o SDK do Firebase direto de um CDN (sem npm, sem build) porque o site
// vai rodar como arquivo estático no GitHub Pages. "type=module" é o que permite
// usar import/export normalmente no navegador, sem precisar de um bundler.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

// Exportamos "auth" e "db" prontos para uso, assim cada página só precisa importar
// deste arquivo em vez de repetir a inicialização em todo lugar.
export const auth = getAuth(app);
export const db = getFirestore(app);
