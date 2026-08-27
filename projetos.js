import { db } from "./firebase-config.js";
import { exigirLogin, logout } from "./auth.js";
import {
  doc,
  getDoc,
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const listaEl = document.getElementById("lista-projetos");
const userInfoEl = document.getElementById("user-info");
const btnLogout = document.getElementById("btn-logout");

btnLogout.addEventListener("click", logout);

// Nomes amigáveis para cada status de projeto (o valor salvo no Firestore
// fica em snake_case, sem acento, pra não dar dor de cabeça em queries).
const STATUS_LABEL = {
  coleta_aberta: "Coleta aberta",
  em_analise: "Em análise",
  encerrada: "Encerrada",
  relatorio_entregue: "Relatório entregue",
};

exigirLogin(async (user) => {
  userInfoEl.textContent = user.email;

  // O papel (role) do usuário mora em users/{uid}. Por enquanto esse documento
  // é criado manualmente no Firebase Console — não existe tela de cadastro ainda.
  //
  // ATENÇÃO: esta leitura decide só o que aparece NA TELA. Ela não substitui a
  // regra de segurança do Firestore (ainda não escrita). Um usuário mal-intencionado
  // poderia, em teoria, editar o JavaScript no navegador e pedir os dados de admin
  // mesmo sendo coletor — quem impede isso de verdade são as Firestore Rules, que
  // ficam para a próxima etapa. Esta tela só cuida da experiência do usuário normal.
  const usuarioSnap = await getDoc(doc(db, "users", user.uid));

  if (!usuarioSnap.exists()) {
    listaEl.innerHTML = `<p class="empty-state">Seu usuário ainda não tem um perfil configurado.
      Peça para um admin criar o documento em <code>users/${user.uid}</code>.</p>`;
    return;
  }

  const { role } = usuarioSnap.data();
  await carregarProjetos(role);
});

async function carregarProjetos(role) {
  // "projects" é uma subcoleção dentro de cada cliente (clients/{clientId}/projects/{id}).
  // Para listar projetos de TODOS os clientes de uma vez, usamos collectionGroup —
  // ele busca em qualquer subcoleção chamada "projects", não importa o cliente pai.
  //
  // Admin vê tudo. Coletor só vê projetos com coleta em aberto — não faz sentido
  // mostrar pra ele um projeto já encerrado ou ainda em relatório.
  const projetosRef = collectionGroup(db, "projects");
  const consulta =
    role === "admin"
      ? query(projetosRef, orderBy("createdAt", "desc"))
      : query(projetosRef, where("status", "==", "coleta_aberta"), orderBy("createdAt", "desc"));

  let resultado;
  try {
    resultado = await getDocs(consulta);
  } catch (erro) {
    // O erro mais comum aqui na primeira vez é o Firestore pedindo para criar um
    // índice composto (necessário sempre que se combina where + orderBy). O console
    // do navegador mostra um link pronto pra criar o índice com um clique.
    console.error(erro);
    listaEl.innerHTML = `<p class="empty-state">Não foi possível carregar os projetos.
      Veja o console do navegador — se for a primeira vez, o Firestore provavelmente
      está pedindo para criar um índice (o link vem no próprio erro).</p>`;
    return;
  }

  if (resultado.empty) {
    listaEl.innerHTML = `<p class="empty-state">Nenhum projeto encontrado no momento.</p>`;
    return;
  }

  listaEl.innerHTML = "";
  resultado.forEach((docSnap) => {
    listaEl.appendChild(criarCardProjeto(docSnap.data()));
  });
}

function criarCardProjeto(projeto) {
  const card = document.createElement("div");
  card.className = "project-card";

  const statusClasse = `badge--${projeto.status}`;
  const statusTexto = STATUS_LABEL[projeto.status] || projeto.status;

  // clientName vem duplicado (denormalizado) dentro do próprio documento de projeto.
  // O motivo: sem isso, mostrar o nome do cliente em cada card exigiria uma leitura
  // extra no Firestore por projeto (uma consulta pra achar o pai de cada item da lista).
  // Copiando o nome na hora de criar o projeto, a lista inteira carrega com as leituras
  // que já vieram na consulta principal — mais barato e mais rápido de exibir.
  card.innerHTML = `
    <div class="info">
      <h3>${projeto.title || "(sem título)"}</h3>
      <div class="client-name">${projeto.clientName || "Cliente não informado"}</div>
    </div>
    <span class="badge ${statusClasse}">${statusTexto}</span>
  `;

  return card;
}
