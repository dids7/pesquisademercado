import { db } from "./firebase-config.js";
import { exigirLogin } from "./auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Categorias fixas de demografia (nunca texto livre) — decisão de privacidade: com
// categorias amplas fica muito mais difícil reidentificar alguém cruzando
// bairro + faixa etária + gênero numa amostra pequena.
export const FAIXAS_ETARIAS = ["18-24", "25-34", "35-44", "45-59", "60+"];
export const GENEROS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
// Regiões amplas em vez de bairros nomeados — ajustem esta lista para os bairros/regiões
// reais que fizerem sentido pra vocês em Bragança Paulista. Mantivemos genérico aqui de
// propósito, pra não travar o código num bairro que pode não bater com a divisão real da cidade.
export const REGIOES = [
  "Centro",
  "Zona Norte",
  "Zona Sul",
  "Zona Leste",
  "Zona Oeste",
  "Zona Rural",
  "Outra cidade",
];

// Por enquanto cada projeto tem só UM questionário (id fixo "principal"). Isso simplifica
// bastante a Fase 1 — nenhuma tela precisa listar/escolher entre vários questionários do
// mesmo projeto. Se um dia isso deixar de ser verdade, este é o único lugar a mudar.
export const ID_QUESTIONARIO_PRINCIPAL = "principal";

export function lerParametrosUrl() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("clientId");
  const projectId = params.get("projectId");
  return { clientId, projectId };
}

// Versão de exigirLogin() que também busca o papel (role) do usuário e barra quem não
// tem um dos papéis permitidos na tela. Usada por questionarios.js, coleta.js e resultados.js
// pra não duplicar essa checagem em cada arquivo.
export function exigirPapel(papeisPermitidos, callback) {
  exigirLogin(async (user) => {
    const usuarioSnap = await getDoc(doc(db, "users", user.uid));
    if (!usuarioSnap.exists()) {
      document.body.innerHTML = `<p class="empty-state">Seu usuário ainda não tem um perfil configurado.
        Peça para um admin criar o documento em <code>users/${user.uid}</code>.</p>`;
      return;
    }
    const { role } = usuarioSnap.data();
    if (!papeisPermitidos.includes(role)) {
      document.body.innerHTML = `<p class="empty-state">Você não tem permissão para acessar esta página.
        <br /><a href="projetos.html">Voltar para projetos</a></p>`;
      return;
    }
    callback(user, role);
  });
}

export async function carregarProjeto(clientId, projectId) {
  const ref = doc(db, "clients", clientId, "projects", projectId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ref, data: snap.data() };
  } catch {
    // As Firestore Rules bloqueiam a leitura de projetos fora do papel do usuário (ex:
    // coletor tentando abrir um projeto sem coleta aberta via link direto). Tratamos
    // como "não encontrado" — a tela não precisa distinguir os dois casos pro usuário.
    return null;
  }
}

export function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}
