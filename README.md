# App de pesquisa de mercado — Fase 1

Cinco telas: login, lista de projetos, montagem de questionário, coleta (entrevista)
e resultados. Sem build, sem npm — é HTML, CSS e JS puro, pensado para rodar direto
no GitHub Pages.

## 1. Configurar o Firebase

1. No [Firebase Console](https://console.firebase.google.com), crie o projeto (ou use um existente).
2. Ative **Authentication > Sign-in method > E-mail/senha**.
3. Ative o **Firestore Database** (modo produção — as regras de segurança ficam para a próxima etapa).
4. Em **Configurações do projeto > Seus apps**, crie um "app da Web" e copie os valores gerados.
5. Cole esses valores em `js/firebase-config.js`, substituindo os `"SUBSTITUA_AQUI"`.

## 2. Criar os 3 usuários

Por enquanto não existe tela de cadastro — a criação de usuário e a definição de
papel (role) são manuais, feitas por um admin direto no console:

1. Em **Authentication > Users**, adicione um usuário com e-mail e senha para cada um dos 3 sócios.
2. Copie o **UID** de cada usuário criado.
3. No **Firestore**, crie a coleção `users` com um documento por pessoa, usando o UID como ID do documento:
   ```
   users/{uid}
     name: "Nome da pessoa"
     role: "admin"     (ou "coletor")
     active: true
   ```

## 3. Criar um projeto de teste

Para a tela de projetos mostrar algo, crie manualmente no Firestore:
```
clients/{qualquer-id}
  name: "Nome do cliente"
  status: "ativo"
  createdAt: (timestamp de agora)

clients/{mesmo-id}/projects/{qualquer-id}
  title: "Pesquisa piloto"
  clientName: "Nome do cliente"   <- mesmo texto do campo acima, duplicado de propósito
  theme: "Validação de app de delivery"
  status: "coleta_aberta"
  targetRespondents: 80
  createdAt: (timestamp de agora)
```

## 4. Publicar as Firestore Security Rules

O conteúdo já está pronto em [`firestore.rules`](firestore.rules) — implementa o modelo
admin (acesso total) / coletor (só projetos com `coleta_aberta`, só as próprias respostas).
Como é um arquivo solto (não usamos o Firebase CLI pra deploy aqui), publique manualmente:

1. No [Firebase Console](https://console.firebase.google.com), abra o projeto e vá em
   **Firestore Database > Regras**.
2. Apague o conteúdo atual e cole o conteúdo de `firestore.rules`.
3. Clique em **Publicar**.

Sem isso publicado, o banco continua com as regras padrão (bloqueiam tudo) e nenhuma
tela consegue ler ou gravar nada.

## 5. Rodar localmente

Como as páginas usam `type="module"`, abrir o `index.html` direto no navegador
(`file://...`) não funciona — módulos JS exigem um servidor, mesmo que local.
Rode um servidor simples na pasta do projeto:

```bash
python3 -m http.server 8000
```

E acesse `http://localhost:8000` no navegador.

## 6. Publicar no GitHub Pages

Suba esta pasta para um repositório no GitHub e ative o GitHub Pages nas
configurações do repositório, apontando para a branch principal.

## Como as 5 telas se conectam

- **index.html** — login.
- **projetos.html** — lista de projetos filtrada por papel; cada card linka para as
  telas abaixo (admin vê "Questionário" e "Resultados"; coletor vê "Coletar" apenas
  quando o projeto está com `coleta_aberta`).
- **questionarios.html** *(admin)* — monta o questionário do projeto puxando perguntas
  do banco reutilizável (`questionBank`) ou criando novas na hora. Publicar grava uma
  versão em `.../versions/{id}` (nunca edita o texto de uma versão já publicada — se já
  existe resposta na versão atual, publicar de novo cria a próxima versão automaticamente).
- **coleta.html** *(coletor/admin)* — aplica a entrevista. Cada resposta é salva a cada
  mudança de campo (offline-first, via a persistência do Firestore habilitada em
  `firebase-config.js`), permitindo pausar e retomar depois.
- **resultados.html** — admin vê contagem/porcentagem por pergunta de todos os
  entrevistadores, com exportação em CSV (lista fixa de campos, sem `interviewerId` ou
  outros campos internos); coletor vê só o total que ele mesmo coletou.

## O que falta (próximas etapas, fora do escopo desta fase)

- Criação de usuário pelo próprio app (hoje é manual, via console).
- Tela dedicada de gestão do banco de perguntas (hoje só dá pra criar pergunta nova
  dentro da tela de montagem de questionário — não dá pra editar/arquivar uma existente).
- Tudo que é Fase 2 (rede de entrevistadores externos, geofencing, pagamento por
  validação) — os campos já existem no modelo de dados (`deviceGeo`, `qualityFlags`,
  `duplicateAssignmentGroup`), mas ficam `null` e sem uso nesta fase.
