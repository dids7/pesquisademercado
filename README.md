# App de pesquisa de mercado — Fase 1

Duas telas prontas: login e lista de projetos. Sem build, sem npm — é HTML, CSS e
JS puro, pensado para rodar direto no GitHub Pages.

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

## 4. Rodar localmente

Como as páginas usam `type="module"`, abrir o `index.html` direto no navegador
(`file://...`) não funciona — módulos JS exigem um servidor, mesmo que local.
Rode um servidor simples na pasta do projeto:

```bash
python3 -m http.server 8000
```

E acesse `http://localhost:8000` no navegador.

## 5. Publicar no GitHub Pages

Suba esta pasta para um repositório no GitHub e ative o GitHub Pages nas
configurações do repositório, apontando para a branch principal.

## O que falta (próximas etapas, fora do escopo destas duas telas)

- **Firestore Security Rules** — hoje o banco está com as regras padrão de
  produção, que bloqueiam tudo. Elas ainda não refletem a lógica de admin vs.
  coletor que desenhamos (isso é o próximo passo natural).
- Telas de questionários, coleta e resultados.
- Criação de usuário pelo próprio app (hoje é manual, via console).
