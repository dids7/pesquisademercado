import { db } from "./firebase-config.js";
import { exigirLogin, logout } from "./auth.js";
import { escapeHtml } from "./comum.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const listaEl = document.getElementById("lista-projetos");
const areaNovaPesquisaEl = document.getElementById("area-nova-pesquisa");
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
  if (role === "admin") {
    await montarAreaNovaPesquisa();
  }
  await carregarProjetos(role);
});

// --- Nova pesquisa (admin) ---
// Formulário simples pra criar cliente + projeto sem precisar mexer direto no
// Firestore Console — antes só dava pra fazer isso manualmente (era assim que os
// dados de teste tinham que ser criados).

async function montarAreaNovaPesquisa() {
  const clientesSnap = await getDocs(collection(db, "clients"));
  const clientes = clientesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  areaNovaPesquisaEl.innerHTML = `
    <button class="btn" id="btn-abrir-nova-pesquisa" style="width:auto; margin-bottom: 20px;">+ Nova pesquisa</button>
    <div class="panel" id="form-nova-pesquisa" style="display:none; margin-bottom: 20px;">
      <h3>Nova pesquisa</h3>
      <div class="field">
        <label for="np-cliente">Cliente</label>
        <select id="np-cliente">
          ${clientes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
          <option value="__novo__">+ Novo cliente</option>
        </select>
      </div>
      <div class="field" id="np-campo-novo-cliente" style="display:${clientes.length === 0 ? "block" : "none"};">
        <label for="np-novo-cliente">Nome do novo cliente</label>
        <input type="text" id="np-novo-cliente" />
      </div>
      <div class="field">
        <label for="np-titulo">Título do projeto</label>
        <input type="text" id="np-titulo" placeholder="ex: Pesquisa piloto" />
      </div>
      <div class="field">
        <label for="np-tema">Tema</label>
        <input type="text" id="np-tema" placeholder="ex: Validação de app de delivery" />
      </div>
      <div class="field-inline">
        <div class="field">
          <label for="np-meta">Meta de respondentes</label>
          <input type="text" id="np-meta" inputmode="numeric" placeholder="ex: 80" />
        </div>
        <div class="field">
          <label for="np-status">Status inicial</label>
          <select id="np-status">
            ${Object.entries(STATUS_LABEL)
              .map(([valor, label]) => `<option value="${valor}" ${valor === "coleta_aberta" ? "selected" : ""}>${label}</option>`)
              .join("")}
          </select>
        </div>
      </div>
      <button class="btn" id="btn-criar-pesquisa" style="width:auto;">Criar</button>
      <button class="btn btn--secondary" id="btn-cancelar-nova-pesquisa" style="width:auto; margin-left: 8px;">Cancelar</button>
    </div>
  `;

  const formEl = document.getElementById("form-nova-pesquisa");
  const selectClienteEl = document.getElementById("np-cliente");
  const campoNovoClienteEl = document.getElementById("np-campo-novo-cliente");

  document.getElementById("btn-abrir-nova-pesquisa").addEventListener("click", () => {
    formEl.style.display = "block";
  });
  document.getElementById("btn-cancelar-nova-pesquisa").addEventListener("click", () => {
    formEl.style.display = "none";
  });
  selectClienteEl.addEventListener("change", () => {
    campoNovoClienteEl.style.display = selectClienteEl.value === "__novo__" ? "block" : "none";
  });
  document.getElementById("btn-criar-pesquisa").addEventListener("click", async () => {
    await criarPesquisa(clientes, selectClienteEl.value);
  });
}

async function criarPesquisa(clientes, clienteSelecionado) {
  const titulo = document.getElementById("np-titulo").value.trim();
  const tema = document.getElementById("np-tema").value.trim();
  const metaTexto = document.getElementById("np-meta").value.trim();
  const status = document.getElementById("np-status").value;
  const novoClienteNome = document.getElementById("np-novo-cliente").value.trim();

  if (!titulo) {
    alert("Escreva o título do projeto.");
    return;
  }
  if (clienteSelecionado === "__novo__" && !novoClienteNome) {
    alert("Escreva o nome do novo cliente.");
    return;
  }

  const btn = document.getElementById("btn-criar-pesquisa");
  btn.disabled = true;

  let clientId;
  let clientName;
  if (clienteSelecionado === "__novo__") {
    const novoClienteRef = await addDoc(collection(db, "clients"), {
      name: novoClienteNome,
      status: "ativo",
      createdAt: serverTimestamp(),
    });
    clientId = novoClienteRef.id;
    clientName = novoClienteNome;
  } else {
    clientId = clienteSelecionado;
    clientName = clientes.find((c) => c.id === clienteSelecionado)?.name || "";
  }

  await addDoc(collection(db, "clients", clientId, "projects"), {
    title: titulo,
    clientName,
    theme: tema || null,
    status,
    // targetRespondents fica null se o campo vier vazio ou não-numérico — ele só serve
    // de referência pro admin, nenhuma tela hoje trava sem esse valor.
    targetRespondents: metaTexto && !Number.isNaN(Number(metaTexto)) ? Number(metaTexto) : null,
    createdAt: serverTimestamp(),
  });

  window.location.reload();
}

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
    listaEl.appendChild(criarCardProjeto(docSnap, role));
  });
}

function criarCardProjeto(docSnap, role) {
  const projeto = docSnap.data();
  const card = document.createElement("div");
  card.className = "project-card";

  const statusClasse = `badge--${projeto.status}`;
  const statusTexto = STATUS_LABEL[projeto.status] || projeto.status;

  // O documento de projeto vive em clients/{clientId}/projects/{projectId}. Como a consulta
  // usa collectionGroup, o clientId não vem nos dados do documento — pegamos ele do caminho
  // do próprio snapshot (parent = coleção "projects", parent.parent = o documento do cliente).
  const clientId = docSnap.ref.parent.parent.id;
  const projectId = docSnap.id;
  const params = `?clientId=${encodeURIComponent(clientId)}&projectId=${encodeURIComponent(projectId)}`;

  // clientName vem duplicado (denormalizado) dentro do próprio documento de projeto.
  // O motivo: sem isso, mostrar o nome do cliente em cada card exigiria uma leitura
  // extra no Firestore por projeto (uma consulta pra achar o pai de cada item da lista).
  // Copiando o nome na hora de criar o projeto, a lista inteira carrega com as leituras
  // que já vieram na consulta principal — mais barato e mais rápido de exibir.
  card.innerHTML = `
    <div class="info">
      <h3>${projeto.title || "(sem título)"}</h3>
      <div class="client-name">${projeto.clientName || "Cliente não informado"}</div>
      <div class="card-actions">${linksDoCard(role, projeto.status, params)}</div>
    </div>
    <span class="badge ${statusClasse}">${statusTexto}</span>
  `;

  return card;
}

// Admin monta questionário e vê resultados agregados de todo mundo. Coletor só aplica a
// entrevista (e só quando a coleta está aberta) e vê o total que ele mesmo coletou.
function linksDoCard(role, status, params) {
  if (role === "admin") {
    return `
      <a href="questionarios.html${params}">Questionário</a>
      <a href="resultados.html${params}">Resultados</a>
    `;
  }
  if (status === "coleta_aberta") {
    return `<a href="coleta.html${params}">Coletar</a>`;
  }
  return "";
}
