// Configuração do Firebase
//
// IMPORTANTE: esses valores NÃO são segredos. Diferente de uma senha ou chave de API
// tradicional, o firebaseConfig é seguro para ficar público no código do site — quem
// realmente protege os dados são as REGRAS DE SEGURANÇA do Firestore (ainda não
// escritas; é o próximo passo depois destas telas).
//
// Onde pegar esses valores: Firebase Console > Configurações do projeto >
// "Seus apps" > ícone de engrenagem > "Config" (ou crie um app da Web se ainda não tiver um).
const firebaseConfig = {
  apiKey: "SUBSTITUA_AQUI",
  authDomain: "SUBSTITUA_AQUI.firebaseapp.com",
  projectId: "SUBSTITUA_AQUI",
  storageBucket: "SUBSTITUA_AQUI.appspot.com",
  messagingSenderId: "SUBSTITUA_AQUI",
  appId: "SUBSTITUA_AQUI",
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
