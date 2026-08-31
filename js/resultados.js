import { db } from "./firebase-config.js";
import { logout } from "./auth.js";
import { exigirPapel, lerParametrosUrl, carregarProjeto, escapeHtml, ID_QUESTIONARIO_PRINCIPAL } from "./comum.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const TIPO_LABEL = {
  single_choice: "Escolha única",
  multi_choice: "Múltipla escolha",
  scale_1_5: "Escala 1 a 5",
  yes_no: "Sim/Não",
  free_text: "Texto livre",
};

document.getElementById("btn-logout").addEventListener("click", logout);

const { clientId, projectId } = lerParametrosUrl();
const conteudoEl = document.getElementById("conteudo");

if (!clientId || !projectId) {
  conteudoEl.innerHTML = `<p class="empty-state">Link inválido — faltam parâmetros de projeto.</p>`;
} else {
  exigirPapel(["admin", "coletor"], async (user, role) => {
    document.getElementById("user-info").textContent = user.email;
    await iniciar(user.uid, role);
  });
}

async function iniciar(uid, role) {
  const projeto = await carregarProjeto(clientId, projectId);
  if (!projeto) {
    conteudoEl.innerHTML = `<p class="empty-state">Projeto não encontrado.</p>`;
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
  const perguntas = [...(versaoSnap.data().questions || [])].sort((a, b) => a.order - b.order);

  const respostasRef = collection(db, versaoRef.path, "responses");
  const consulta =
    role === "admin"
      ? query(respostasRef, where("status", "==", "concluida"))
      : query(respostasRef, where("interviewerId", "==", uid), where("status", "==", "concluida"));

  let snap;
  try {
    snap = await getDocs(consulta);
  } catch (erro) {
    console.error(erro);
    conteudoEl.innerHTML = `<p class="empty-state">Não foi possível carregar os resultados. Veja o console do navegador.</p>`;
    return;
  }
  const respostas = snap.docs.map((d) => d.data());

  if (role === "coletor") {
    renderVisaoColetor(respostas);
  } else {
    renderVisaoAdmin(perguntas, respostas);
  }
}

function renderVisaoColetor(respostas) {
  conteudoEl.innerHTML = `
    <div class="summary-strip">
      <div class="summary-tile">
        <div class="value">${respostas.length}</div>
        <div class="label">Entrevistas concluídas por você</div>
      </div>
    </div>
  `;
}

function renderVisaoAdmin(perguntas, respostas) {
  const total = respostas.length;

  const blocos = perguntas.map((p) => blocoPerguntaHtml(p, respostas, total)).join("");

  conteudoEl.innerHTML = `
    <div class="summary-strip">
      <div class="summary-tile">
        <div class="value">${total}</div>
        <div class="label">Entrevistas concluídas (todos os entrevistadores)</div>
      </div>
    </div>
    <button class="btn" id="btn-exportar" style="width:auto; margin-bottom: 20px;">Exportar CSV</button>
    ${total === 0 ? `<p class="empty-state">Nenhuma entrevista concluída ainda.</p>` : blocos}
  `;

  const btnExportar = document.getElementById("btn-exportar");
  if (btnExportar) btnExportar.addEventListener("click", () => exportarCsv(perguntas, respostas));
}

function blocoPerguntaHtml(pergunta, respostas, total) {
  const valores = respostas.map((r) => (r.answers || []).find((a) => a.questionId === pergunta.questionBankId)?.value);

  if (pergunta.type === "free_text") {
    const textos = valores.filter((v) => typeof v === "string" && v.trim() !== "");
    return `
      <div class="result-question">
        <h4>${escapeHtml(pergunta.textSnapshot)} <span class="bank-item-meta">${TIPO_LABEL[pergunta.type]} · ${textos.length} de ${total} responderam</span></h4>
        <p class="hint">Texto livre pode conter informação pessoal por engano — evite exportar ou compartilhar essas respostas fora da equipe.</p>
        ${textos.map((t) => `<div class="free-text-answer">${escapeHtml(t)}</div>`).join("") || `<p class="hint">Nenhuma resposta de texto ainda.</p>`}
      </div>
    `;
  }

  // single_choice, yes_no, scale_1_5 e multi_choice são todos contagem por opção —
  // a diferença é só de onde vem a lista de opções possíveis.
  const opcoes = pergunta.optionsSnapshot || (pergunta.type === "scale_1_5" ? ["1", "2", "3", "4", "5"] : ["Sim", "Não"]);
  const contagem = {};
  opcoes.forEach((op) => (contagem[op] = 0));
  valores.forEach((v) => {
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item in contagem) contagem[item] += 1;
      });
    } else if (v in contagem) {
      contagem[v] += 1;
    }
  });

  const barras = opcoes
    .map((op) => {
      const qtd = contagem[op];
      const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
      return `
        <div class="result-bar-row">
          <div class="result-bar-label"><span>${escapeHtml(op)}</span><span>${qtd} (${pct}%)</span></div>
          <div class="result-bar-track"><div class="result-bar-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="result-question">
      <h4>${escapeHtml(pergunta.textSnapshot)} <span class="bank-item-meta">${TIPO_LABEL[pergunta.type]}</span></h4>
      ${barras}
    </div>
  `;
}

// Lista explícita de campos exportados — de propósito nunca "exportar tudo". Ficam de fora
// interviewerId, o id do documento e os campos reservados pra Fase 2 (deviceGeo, qualityFlags,
// duplicateAssignmentGroup): nenhum deles deveria sair do Firestore num relatório de cliente.
function exportarCsv(perguntas, respostas) {
  const cabecalho = ["Faixa etária", "Gênero", "Região", "Iniciado em", "Concluído em", ...perguntas.map((p) => p.textSnapshot)];

  const linhas = respostas.map((r) => {
    const base = [
      r.demographics?.ageRange || "",
      r.demographics?.gender || "",
      r.demographics?.neighborhood || "",
      formatarData(r.startedAt),
      formatarData(r.completedAt),
    ];
    const respostasPorPergunta = perguntas.map((p) => {
      const valor = (r.answers || []).find((a) => a.questionId === p.questionBankId)?.value;
      if (Array.isArray(valor)) return valor.join("; ");
      return valor ?? "";
    });
    return [...base, ...respostasPorPergunta];
  });

  const csv = [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "resultados.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function campoCsv(valor) {
  const texto = String(valor ?? "");
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function formatarData(timestamp) {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleString("pt-BR");
}
