import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Traduz os códigos de erro do Firebase (que vêm em inglês, tipo "auth/wrong-password")
// para uma mensagem que faz sentido pra quem está usando o app.
function traduzErro(codigo) {
  const mensagens = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet. Verifique o sinal e tente novamente.",
  };
  return mensagens[codigo] || "Não foi possível entrar. Tente novamente.";
}

// Chamado pelo formulário de login em index.html
export async function login(email, senha) {
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: traduzErro(erro.code) };
  }
}

export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}

// Usada em toda página que exige login (por enquanto, projetos.html).
// Se ninguém estiver logado, manda de volta pra tela de login.
// Se estiver logado, devolve o objeto "user" do Firebase pra quem chamou.
export function exigirLogin(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    callback(user);
  });
}

// Usada na própria tela de login: se a pessoa já estiver logada e abrir
// index.html de novo, pula direto pra tela de projetos em vez de mostrar o formulário.
export function redirecionarSeJaLogado() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "projetos.html";
    }
  });
}
