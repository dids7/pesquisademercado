import { db } from "./firebase-config.js";
import { logout } from "./auth.js";
import {
  exigirPapel,
  lerParametrosUrl,
  carregarProjeto,
  escapeHtml,
  ID_QUESTIONARIO_PRINCIPAL,
  FAIXAS_ETARIAS,
  GENEROS,
  REGIOES,
} from "./comum.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

document.getElementById("btn-logout").addEventListener("click", logout);

const { clientId, projectId } = lerParametrosUrl();
const conteudoEl = document.getElementById("conteudo");

if (!clientId || !projectId) {
  conteudoEl.innerHTML = `<p class="empty-state">Link inválido — faltam parâmetros de projeto.</p>`;
} else {
  exigirPapel(["coletor", "admin"], async (user) => {
    document.getElementById("user-info").textContent = user.email;
    uidAtual = user.uid;
    await iniciar();
  });
}

let uidAtual = null;
let perguntas = []; // questions da versão atual publicada
let respostaAtualRef = null;
let respostaAtualAnswers = []; // [{ questionId, type, value }]
let respostasEmAndamentoRef = null; // coleção de responses, pra reusar em várias funções

async function iniciar() {
  const projeto = await carregarProjeto(clientId, projectId);
  if (!projeto) {
    conteudoEl.innerHTML = `<p class="empty-state">Projeto não encontrado (ou sem coleta aberta no momento).</p>`;
    return;
  }
  document.getElementById("titulo-projeto").textContent = projeto.data.title || "(sem título)";
  document.getElementById("subtitulo-projeto").textContent = projeto.data.clientName || "";

  const questionarioRef = doc(db, "clients", clientId, "projects", projectId, "questionnaires", ID_QUESTIONARIO_PRINCIPAL);
  const questionarioSnap = await getDoc(questionarioRef);
  if (!questionarioSnap.exists()) {
    conteudoEl.innerHTML = `<p class="empty-state">Nenhum questionário publicado para este projeto ainda.</p>`;
    return;
  }
  const versaoRef = doc(db, questionarioRef.path, "versions", questionarioSnap.data().currentVersion);
  const versaoSnap = await getDoc(versaoRef);
  if (!versaoSnap.exists()) {
    conteudoEl.innerHTML = `<p class="empty-state">Nenhum questionário publicado para este projeto ainda.</p>`;
    return;
  }
  perguntas = [...(versaoSnap.data().questions || [])].sort((a, b) => a.order - b.order);
  respostasEmAndamentoRef = collection(db, versaoRef.path, "responses");

  await mostrarLista();
}

async function mostrarLista() {
  respostaAtualRef = null;
  respostaAtualAnswers = [];

  const consulta = query(
    respostasEmAndamentoRef,
    where("interviewerId", "==", uidAtual),
    where("status", "==", "rascunho"),
    orderBy("lastUpdatedAt", "desc")
  );
  let rascunhos;
  try {
    rascunhos = await getDocs(consulta);
  } catch (erro) {
    console.error(erro);
    conteudoEl.innerHTML = `<p class="empty-state">Não foi possível carregar suas entrevistas em andamento.
      Veja o console — pode ser um índice composto pendente de criação no Firestore.</p>`;
    return;
  }

  const itensHtml = rascunhos.empty
    ? `<p class="hint">Nenhuma entrevista pausada no momento.</p>`
    : rascunhos.docs
        .map((d) => {
          const dado = d.data();
          const respondidas = (dado.answers || []).length;
          return `
          <div class="entrevista-item">
            <span>Em andamento — ${respondidas} de ${perguntas.length} perguntas respondidas</span>
            <button class="btn-small btn-small--accent" data-continuar="${d.id}">Continuar</button>
          </div>
        `;
        })
        .join("");

  conteudoEl.innerHTML = `
    <div class="panel" style="margin-bottom: 20px;">
      <h3>Entrevistas em andamento</h3>
      ${itensHtml}
    </div>
    <button class="btn" id="btn-nova-entrevista">Nova entrevista</button>
  `;

  conteudoEl.querySelectorAll("[data-continuar]").forEach((btn) => {
    btn.addEventListener("click", () => continuarEntrevista(btn.dataset.continuar));
  });
  document.getElementById("btn-nova-entrevista").addEventListener("click", mostrarFormularioDemografia);
}

function mostrarFormularioDemografia() {
  conteudoEl.innerHTML = `
    <div class="panel">
      <h3>Nova entrevista</h3>
      <p class="hint">Dados amplos, sem identificar a pessoa — nada de nome, CPF ou contato.</p>
      <div class="field">
        <label for="dem-idade">Faixa etária</label>
        <select id="dem-idade">${opcoesSelect(FAIXAS_ETARIAS)}</select>
      </div>
      <div class="field">
        <label for="dem-genero">Gênero</label>
        <select id="dem-genero">${opcoesSelect(GENEROS)}</select>
      </div>
      <div class="field">
        <label for="dem-regiao">Região</label>
        <select id="dem-regiao">${opcoesSelect(REGIOES)}</select>
      </div>
      <button class="btn" id="btn-comecar">Começar entrevista</button>
      <button class="btn btn--secondary" id="btn-cancelar" style="margin-top: 8px;">Cancelar</button>
    </div>
  `;
  document.getElementById("btn-comecar").addEventListener("click", comecarEntrevista);
  document.getElementById("btn-cancelar").addEventListener("click", mostrarLista);
}

function opcoesSelect(valores) {
  return valores.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

async function comecarEntrevista() {
  const demographics = {
    ageRange: document.getElementById("dem-idade").value,
    gender: document.getElementById("dem-genero").value,
    neighborhood: document.getElementById("dem-regiao").value,
  };

  const novaRef = await addDoc(respostasEmAndamentoRef, {
    status: "rascunho",
    interviewerId: uidAtual,
    startedAt: serverTimestamp(),
    completedAt: null,
    lastUpdatedAt: serverTimestamp(),
    demographics,
    answers: [],
    // Reservado para a Fase 2 (entrevistadores externos e prevenção de fraude) — nesta
    // fase fica sempre null, o app ainda não coleta nada disso.
    deviceGeo: null,
    qualityFlags: null,
    duplicateAssignmentGroup: null,
  });

  respostaAtualRef = novaRef;
  respostaAtualAnswers = [];
  mostrarFormularioPerguntas();
}

async function continuarEntrevista(responseId) {
  const ref = doc(db, respostasEmAndamentoRef.path, responseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await mostrarLista();
    return;
  }
  respostaAtualRef = ref;
  respostaAtualAnswers = [...(snap.data().answers || [])];
  mostrarFormularioPerguntas();
}

function respostaDe(questionId) {
  return respostaAtualAnswers.find((a) => a.questionId === questionId);
}

function mostrarFormularioPerguntas() {
  const cards = perguntas.map((p) => cardPerguntaHtml(p)).join("");

  conteudoEl.innerHTML = `
    <div class="warning-banner">
      Nas perguntas de texto livre, evite anotar nomes ou qualquer informação que
      identifique a pessoa entrevistada — a pesquisa é anônima.
    </div>
    ${cards}
    <p class="autosave-status" id="autosave-status">Respostas salvas automaticamente a cada resposta.</p>
    <div class="sticky-actions">
      <button class="btn btn--secondary" id="btn-pausar">Pausar (voltar depois)</button>
      <button class="btn" id="btn-concluir">Concluir entrevista</button>
    </div>
  `;

  perguntas.forEach((p) => ligarEventosPergunta(p));
  document.getElementById("btn-pausar").addEventListener("click", () => mostrarLista());
  document.getElementById("btn-concluir").addEventListener("click", concluirEntrevista);
}

function cardPerguntaHtml(pergunta) {
  const existente = respostaDe(pergunta.questionBankId);
  const valor = existente ? existente.value : pergunta.type === "multi_choice" ? [] : "";

  let corpo = "";
  if (pergunta.type === "single_choice" || pergunta.type === "yes_no") {
    const opcoes = pergunta.optionsSnapshot || ["Sim", "Não"];
    corpo = opcoes
      .map(
        (op) => `
        <label class="option-row">
          <input type="radio" name="q_${pergunta.questionBankId}" value="${escapeHtml(op)}" ${valor === op ? "checked" : ""} />
          ${escapeHtml(op)}
        </label>
      `
      )
      .join("");
  } else if (pergunta.type === "multi_choice") {
    const opcoes = pergunta.optionsSnapshot || [];
    corpo = opcoes
      .map(
        (op) => `
        <label class="option-row">
          <input type="checkbox" name="q_${pergunta.questionBankId}" value="${escapeHtml(op)}" ${Array.isArray(valor) && valor.includes(op) ? "checked" : ""} />
          ${escapeHtml(op)}
        </label>
      `
      )
      .join("");
  } else if (pergunta.type === "scale_1_5") {
    corpo = `<div class="scale-options">${["1", "2", "3", "4", "5"]
      .map(
        (n) => `
        <label>
          <input type="radio" name="q_${pergunta.questionBankId}" value="${n}" ${valor === n ? "checked" : ""} />
          <span>${n}</span>
        </label>
      `
      )
      .join("")}</div>`;
  } else {
    corpo = `<textarea rows="3" name="q_${pergunta.questionBankId}">${escapeHtml(valor)}</textarea>`;
  }

  return `
    <div class="question-card">
      <p class="question-text">${escapeHtml(pergunta.textSnapshot)}</p>
      ${corpo}
    </div>
  `;
}

function ligarEventosPergunta(pergunta) {
  const campos = conteudoEl.querySelectorAll(`[name="q_${pergunta.questionBankId}"]`);
  campos.forEach((campo) => {
    const evento = campo.tagName === "TEXTAREA" ? "input" : "change";
    let debounceId = null;
    campo.addEventListener(evento, () => {
      if (evento === "input") {
        clearTimeout(debounceId);
        debounceId = setTimeout(() => salvarResposta(pergunta), 600);
      } else {
        salvarResposta(pergunta);
      }
    });
  });
}

async function salvarResposta(pergunta) {
  const campos = conteudoEl.querySelectorAll(`[name="q_${pergunta.questionBankId}"]`);
  let valor;
  if (pergunta.type === "multi_choice") {
    valor = [...campos].filter((c) => c.checked).map((c) => c.value);
  } else if (pergunta.type === "free_text") {
    valor = campos[0].value;
  } else {
    const marcado = [...campos].find((c) => c.checked);
    valor = marcado ? marcado.value : "";
  }

  const entrada = { questionId: pergunta.questionBankId, type: pergunta.type, value: valor };
  const indiceExistente = respostaAtualAnswers.findIndex((a) => a.questionId === pergunta.questionBankId);
  if (indiceExistente >= 0) {
    respostaAtualAnswers[indiceExistente] = entrada;
  } else {
    respostaAtualAnswers.push(entrada);
  }

  const statusEl = document.getElementById("autosave-status");
  if (statusEl) statusEl.textContent = "Salvando...";
  try {
    await updateDoc(respostaAtualRef, { answers: respostaAtualAnswers, lastUpdatedAt: serverTimestamp() });
    if (statusEl) statusEl.textContent = "Respostas salvas automaticamente a cada resposta.";
  } catch {
    // Sem sinal de internet: a escrita fica só no cache local (IndexedDB) e o Firestore
    // sincroniza sozinho assim que a conexão voltar — é exatamente o comportamento
    // offline-first que a persistência habilitada em firebase-config.js proporciona.
    if (statusEl) statusEl.textContent = "Sem conexão — salvo localmente, será sincronizado depois.";
  }
}

async function concluirEntrevista() {
  const btn = document.getElementById("btn-concluir");
  btn.disabled = true;
  await updateDoc(respostaAtualRef, {
    status: "concluida",
    completedAt: serverTimestamp(),
    lastUpdatedAt: serverTimestamp(),
  });
  await mostrarLista();
}
