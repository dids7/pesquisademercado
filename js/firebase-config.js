// Configuração do Firebase
//
// IMPORTANTE: esses valores NÃO são segredos. Diferente de uma senha ou chave de API
// tradicional, o firebaseConfig é seguro para ficar público no código do site — quem
// realmente protege os dados são as REGRAS DE SEGURANÇA do Firestore (é o nosso
// próximo passo depois deste).
const firebaseConfig = {
  apiKey: "AIzaSyCdsK3wEiFFVYHbTX3uvyv42SeSrQf6_y4",
  authDomain: "pesquisa-de-mercado-c87b1.firebaseapp.com",
  projectId: "pesquisa-de-mercado-c87b1",
  storageBucket: "pesquisa-de-mercado-c87b1.firebasestorage.app",
  messagingSenderId: "594407849253",
  appId: "1:594407849253:web:c275abcacf059d86ba2ecc",
};

// Carregamos o SDK do Firebase direto de um CDN (sem npm, sem build) porque o site
// vai rodar como arquivo estático no GitHub Pages. "type=module" é o que permite
// usar import/export normalmente no navegador, sem precisar de um bundler.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

// Exportamos "auth" e "db" prontos para uso, assim cada página só precisa importar
// deste arquivo em vez de repetir a inicialização em todo lugar.
export const auth = getAuth(app);
export const db = getFirestore(app);

// Persistência offline: sem isso, o Firestore só guarda dados em memória e qualquer
// leitura/escrita em campo sem sinal falha na hora. Com isso ligado, o SDK grava tudo
// no IndexedDB do navegador primeiro (a tela de coleta lê/escreve local instantaneamente)
// e sincroniza sozinho quando a conexão volta — é a base do "offline-first" da coleta.
enableIndexedDbPersistence(db).catch((erro) => {
  if (erro.code === "failed-precondition") {
    // Acontece quando o app está aberto em mais de uma aba ao mesmo tempo — o Firestore
    // só permite uma aba "dona" do cache local. Não é um erro grave, só avisamos no console.
    console.warn("Persistência offline desativada: app aberto em outra aba.");
  } else if (erro.code === "unimplemented") {
    console.warn("Este navegador não suporta persistência offline do Firestore.");
  }
});
