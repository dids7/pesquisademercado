import { db } from "./firebase-config.js";
import { logout } from "./auth.js";
import { exigirPapel, lerParametrosUrl, carregarProjeto, escapeHtml, ID_QUESTIONARIO_PRINCIPAL } from "./comum.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const TIPO_LABEL = {
  single_choice: "Escolha única",
  multi_choice: "Múltipla escolha",
  scale_1_5: "Escala 1 a 5",
  yes_no: "Sim/Não",
  free_text: "Texto livre",
};

// Tipos com opções fixas (não vêm do campo "options" digitado pelo admin).
const OPCOES_FIXAS = {
  scale_1_5: ["1", "2", "3", "4", "5"],
  yes_no: ["Sim", "Não"],
};

document.getElementById("btn-logout").addEventListener("click", logout);

const { clientId, projectId } = lerParametrosUrl();
const conteudoEl = document.getElementById("conteudo");

if (!clientId || !projectId) {
  conteudoEl.innerHTML = `<p class="empty-state">Link inválido — faltam parâmetros de projeto.</p>`;
} else {
  exigirPapel(["admin"], async (user) => {
    document.getElementById("user-info").textContent = user.email;
    uidAtual = user.uid;
    await iniciar();
  });
}

// Estado local do "rascunho" de montagem — só vira dado permanente quando o admin
// clica em Publicar. Não existe autosave de rascunho aqui (diferente da tela de coleta):
// montar questionário é uma tarefa de mesa, não de campo, então não precisa de
// persistência offline — só de não perder o trabalho por engano antes de publicar.
let draft = [];
let bancoDePerguntas = [];
let questionarioRef = null;
let versaoAtualRef = null;
let versaoAtualNumero = 0;
let versaoAtualTemResposta = false;
let uidAtual = null;

async function iniciar() {
  const projeto = await carregarProjeto(clientId, projectId);
  if (!projeto) {
    conteudoEl.innerHTML = `<p class="empty-state">Projeto não encontrado.</p>`;
    return;
  }
  document.getElementById("titulo-projeto").textContent = projeto.data.title || "(sem título)";
  document.getElementById("subtitulo-projeto").textContent = projeto.data.clientName || "";

  const [bancoSnap, questionarioSnap] = await Promise.all([
    getDocs(query(collection(db, "questionBank"), orderBy("category"))),
    getDoc(doc(db, "clients", clientId, "projects", projectId, "questionnaires", ID_QUESTIONARIO_PRINCIPAL)),
  ]);

  bancoDePerguntas = bancoSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (questionarioSnap.exists()) {
    questionarioRef = questionarioSnap.ref;
    const versaoId = questionarioSnap.data().currentVersion;
    versaoAtualRef = doc(db, questionarioRef.path, "versions", versaoId);
    const versaoSnap = await getDoc(versaoAtualRef);
    if (versaoSnap.exists()) {
      versaoAtualNumero = versaoSnap.data().versionNumber || 0;
      draft = (versaoSnap.data().questions || []).map((q) => ({ ...q }));

      const respostasSnap = await getDocs(
        query(collection(db, versaoAtualRef.path, "responses"), limit(1))
      );
      versaoAtualTemResposta = !respostasSnap.empty;
    }
  }

  render();
}

function render() {
  conteudoEl.innerHTML = `
    <div class="panel" style="margin-bottom: 20px;">
      ${statusPublicacaoHtml()}
      <button class="btn" id="btn-publicar" style="width:auto; margin-top: 10px;">
        ${versaoAtualRef ? "Publicar alterações" : "Publicar questionário"}
      </button>
    </div>

    <div class="builder-layout">
      <div class="panel">
        <h3>Banco de perguntas</h3>
        ${bancoHtml()}
        <hr class="divider" />
        <h3>Nova pergunta</h3>
        ${formNovaPerguntaHtml()}
      </div>

      <div class="panel">
        <h3>Perguntas do questionário (${draft.length})</h3>
        ${draftHtml()}
      </div>
    </div>
  `;

  ligarEventosBanco();
  ligarEventosDraft();
  ligarFormNovaPergunta();
  document.getElementById("btn-publicar").addEventListener("click", publicar);
  atualizarCamposTipo();
}

function statusPublicacaoHtml() {
  if (!versaoAtualRef) {
    return `<p class="hint">Nenhuma versão publicada ainda. Monte as perguntas ao lado e publique quando estiver pronto.</p>`;
  }
  const avisoNovaVersao = versaoAtualTemResposta
    ? `<p class="hint">Já existem respostas nesta versão — publicar agora criará a <strong>versão ${versaoAtualNumero + 1}</strong> automaticamente (a versão atual continua preservada, sem editar respostas já dadas).</p>`
    : `<p class="hint">Ainda sem respostas nesta versão — publicar agora atualiza a versão ${versaoAtualNumero} no lugar.</p>`;
  return `<p class="hint">Versão atual publicada: <strong>v${versaoAtualNumero}</strong></p>${avisoNovaVersao}`;
}

function bancoHtml() {
  if (bancoDePerguntas.length === 0) {
    return `<p class="hint">Nenhuma pergunta cadastrada ainda. Crie uma abaixo.</p>`;
  }
  return bancoDePerguntas
    .map(
      (p) => `
      <div class="bank-item">
        <div class="bank-item-text">
          ${escapeHtml(p.text)}
          <span class="bank-item-meta">${escapeHtml(p.category || "sem categoria")} · ${TIPO_LABEL[p.type] || p.type}</span>
        </div>
        <button class="btn-small btn-small--accent" data-add-bank="${p.id}">+ Adicionar</button>
      </div>
    `
    )
    .join("");
}

function formNovaPerguntaHtml() {
  return `
    <div class="field">
      <label for="novo-texto">Texto da pergunta</label>
      <input type="text" id="novo-texto" />
    </div>
    <div class="field-inline">
      <div class="field">
        <label for="novo-tipo">Tipo</label>
        <select id="novo-tipo">
          ${Object.entries(TIPO_LABEL)
            .map(([valor, label]) => `<option value="${valor}">${label}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label for="novo-categoria">Categoria</label>
        <input type="text" id="novo-categoria" placeholder="ex: hábitos de consumo" />
      </div>
    </div>
    <div class="field" id="campo-opcoes">
      <label for="novo-opcoes">Opções (separadas por vírgula)</label>
      <input type="text" id="novo-opcoes" placeholder="ex: Sim, Não, Talvez" />
    </div>
    <button class="btn" id="btn-nova-pergunta" style="width:auto;">Adicionar ao banco</button>
  `;
}

function draftHtml() {
  if (draft.length === 0) {
    return `<p class="hint">Nenhuma pergunta adicionada ainda. Use o banco ao lado.</p>`;
  }
  return draft
    .map(
      (item, indice) => `
      <div class="draft-item">
        <div class="draft-item-row">
          <div>
            <strong>${indice + 1}.</strong> ${escapeHtml(item.textSnapshot)}
            <span class="bank-item-meta">${TIPO_LABEL[item.type] || item.type}</span>
          </div>
          <div class="draft-item-buttons">
            <button class="btn-small" data-mover="${indice}" data-direcao="-1" ${indice === 0 ? "disabled" : ""}>&uarr;</button>
            <button class="btn-small" data-mover="${indice}" data-direcao="1" ${indice === draft.length - 1 ? "disabled" : ""}>&darr;</button>
            <button class="btn-small btn-small--danger" data-remover="${indice}">Remover</button>
          </div>
        </div>
      </div>
    `
    )
    .join("");
}

function ligarEventosBanco() {
  conteudoEl.querySelectorAll("[data-add-bank]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pergunta = bancoDePerguntas.find((p) => p.id === btn.dataset.addBank);
      if (!pergunta) return;
      draft.push({
        questionBankId: pergunta.id,
        order: draft.length,
        textSnapshot: pergunta.text,
        type: pergunta.type,
        optionsSnapshot: pergunta.options || null,
      });
      render();
    });
  });
}

function ligarEventosDraft() {
  conteudoEl.querySelectorAll("[data-mover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const indice = Number(btn.dataset.mover);
      const direcao = Number(btn.dataset.direcao);
      const alvo = indice + direcao;
      if (alvo < 0 || alvo >= draft.length) return;
      [draft[indice], draft[alvo]] = [draft[alvo], draft[indice]];
      render();
    });
  });
  conteudoEl.querySelectorAll("[data-remover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      draft.splice(Number(btn.dataset.remover), 1);
      render();
    });
  });
}

function ligarFormNovaPergunta() {
  document.getElementById("novo-tipo").addEventListener("change", atualizarCamposTipo);
  document.getElementById("btn-nova-pergunta").addEventListener("click", criarNovaPergunta);
}

function atualizarCamposTipo() {
  const tipo = document.getElementById("novo-tipo").value;
  const campoOpcoes = document.getElementById("campo-opcoes");
  // Só single_choice e multi_choice usam a lista de opções digitada à mão — os outros
  // tipos têm opções fixas (escala 1-5, sim/não) ou não têm opções (texto livre).
  campoOpcoes.style.display = tipo === "single_choice" || tipo === "multi_choice" ? "block" : "none";
}

async function criarNovaPergunta() {
  const text = document.getElementById("novo-texto").value.trim();
  const type = document.getElementById("novo-tipo").value;
  const category = document.getElementById("novo-categoria").value.trim();
  const opcoesDigitadas = document.getElementById("novo-opcoes").value
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!text) {
    alert("Escreva o texto da pergunta antes de adicionar.");
    return;
  }
  if ((type === "single_choice" || type === "multi_choice") && opcoesDigitadas.length === 0) {
    alert("Informe ao menos uma opção para este tipo de pergunta.");
    return;
  }

  const options = OPCOES_FIXAS[type] || (opcoesDigitadas.length ? opcoesDigitadas : null);

  const btn = document.getElementById("btn-nova-pergunta");
  btn.disabled = true;
  const novaRef = await addDoc(collection(db, "questionBank"), {
    text,
    type,
    options,
    category: category || null,
    createdBy: uidAtual,
    createdAt: serverTimestamp(),
  });

  bancoDePerguntas.push({ id: novaRef.id, text, type, options, category });
  draft.push({
    questionBankId: novaRef.id,
    order: draft.length,
    textSnapshot: text,
    type,
    optionsSnapshot: options,
  });
  render();
}

async function publicar() {
  if (draft.length === 0) {
    alert("Adicione ao menos uma pergunta antes de publicar.");
    return;
  }

  const btn = document.getElementById("btn-publicar");
  btn.disabled = true;
  btn.textContent = "Publicando...";

  // Congela o texto/opções no momento da publicação (textSnapshot/optionsSnapshot), e
  // recalcula "order" pela posição final na lista — é assim que a ordem escolhida no
  // reordenamento vira o que a tela de coleta de fato mostra.
  const perguntas = draft.map((item, indice) => ({ ...item, order: indice }));

  if (!questionarioRef) {
    questionarioRef = doc(db, "clients", clientId, "projects", projectId, "questionnaires", ID_QUESTIONARIO_PRINCIPAL);
    await setDoc(questionarioRef, {
      title: "Questionário principal",
      currentVersion: "v1",
      status: "ativo",
    });
    versaoAtualRef = doc(db, questionarioRef.path, "versions", "v1");
    await setDoc(versaoAtualRef, {
      versionNumber: 1,
      status: "ativa",
      createdAt: serverTimestamp(),
      questions: perguntas,
    });
    versaoAtualNumero = 1;
  } else if (!versaoAtualTemResposta) {
    await updateDoc(versaoAtualRef, { questions: perguntas });
  } else {
    const novoNumero = versaoAtualNumero + 1;
    const novaVersaoId = `v${novoNumero}`;
    await updateDoc(versaoAtualRef, { status: "encerrada" });
    const novaVersaoRef = doc(db, questionarioRef.path, "versions", novaVersaoId);
    await setDoc(novaVersaoRef, {
      versionNumber: novoNumero,
      status: "ativa",
      createdAt: serverTimestamp(),
      questions: perguntas,
    });
    await updateDoc(questionarioRef, { currentVersion: novaVersaoId });
    versaoAtualRef = novaVersaoRef;
    versaoAtualNumero = novoNumero;
  }

  versaoAtualTemResposta = false;
  render();
}
