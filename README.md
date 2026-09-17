# GustaShare

Compartilhamento de tela em tempo real, ponto a ponto (P2P), sem servidor próprio.

Há duas formas de usar:

- **Desktop (Windows)**: app Electron (instalador `.exe`) — tela, câmera, microfone, chat.
- **Web**: o mesmo app em `https://gustashare.vercel.app` — assistir e chat. Convites (`/room/CODIGO`) abrem direto no navegador.

## Como funciona 

- Não existe backend rodando na nuvem. O único componente externo é o
  broker público e gratuito do [PeerJS](https://peerjs.com/) (`0.peerjs.com`),
  usado apenas para a sinalização inicial (troca de SDP/ICE) — vídeo, áudio
  e tela sempre trafegam direto entre as máquinas dos participantes (WebRTC).
- Cada sala tem um "host" que só serve para distribuir a lista de
  participantes (quem está na sala). O host é escolhido automaticamente
  (o primeiro a entrar com aquele código de sala). Se ele sair, outro
  participante assume esse papel sozinho — as conexões de mídia entre os
  demais não são afetadas, então ninguém percebe a troca.
- Quem está no **desktop** compartilha tela/câmera/microfone. Quem está na
  **web** só recebe essa mídia e usa o chat.

## Rodando em desenvolvimento

App desktop (Electron + Vite):

```bash
npm install
npm run dev
```

Só a versão web (navegador em `http://localhost:5173`):

```bash
npm install
npm run dev:web
```

## Gerando o executável portátil (.exe) para Windows

```bash
npm install
npm run build
```

O instalador fica em `release/GustaShare-Setup.exe`.

> Gerar `.exe` para Windows a partir de Linux/WSL pode exigir `wine`
> instalado. Se o build falhar por causa disso, rode `npm run build`
> diretamente em uma máquina Windows — o restante do projeto já está pronto.

## Auto-update

O app desktop checa `https://gustashare.vercel.app/latest.json` toda vez
que abre. Se a versão de lá for maior que a instalada, ele baixa o
instalador no **GitHub Releases** (o arquivo passa de 100MB e a Vercel
Hobby recusa). O updater segue o redirect de
`https://gustashare.vercel.app/GustaShare-Setup.exe`.

Isso só funciona no app instalado; em `npm run dev` o update é ignorado.

O `.exe` **não** fica commitado no git nem na Vercel. O GitHub Actions
builda em Windows e publica um Release (não draft). O site na Vercel é
só o app web + `latest.json`. O repositório precisa ser **público**,
senão o link de download dá 404.

No Vercel, configure:

- **Framework Preset**: `Other`
- **Root Directory**: **vazio** (raiz do repositório — **não** use `update-server`)
- Build Command / Output Directory: o `vercel.json` da raiz já define
  (`vite build --base /` → `dist`)

`git push` publica a versão web. O `.exe` só sobe no workflow de
release.

### Enviando código

```bash
npm run publish
```

Isso só roda `git add . && git pull && git commit -m "publish" && git push`.
Não mexe em versão, não builda o `.exe`, não dispara o workflow de release.

### Publicando uma nova versão (gerando o .exe)

A versão só muda quando você realmente builda. Vai em **Actions** no
GitHub e roda manualmente o workflow **Build and release GustaShare**
(botão "Run workflow"). Ele:
1. Bumpa a versão (patch) em `package.json`.
2. Builda o `.exe` num runner Windows real (sem wine).
3. Publica `GustaShare-Setup.exe` num GitHub Release (`vX.Y.Z`, latest).
4. Gera o site web + `latest.json` e faz `vercel deploy --prod` (sem o
   `.exe`).
5. Commita `package.json` + `latest.json` de volta pro repo
   (`[skip ci] [skip vercel]`).

O auto-updater passa a enxergar a nova versão assim que o Release e o
deploy na Vercel terminarem.

#### Configurando o deploy pra Vercel

O workflow precisa de 3 segredos em **Settings → Secrets and variables →
Actions** no GitHub:

- **`VERCEL_TOKEN`**: vercel.com → avatar → **Settings** → **Tokens** →
  criar um novo token.
- **`VERCEL_ORG_ID`** e **`VERCEL_PROJECT_ID`**: dentro da pasta
  `update-server/`, rode `npx vercel link` uma vez localmente (loga com
  sua conta, aponta pro projeto `gustashare` já existente na Vercel) —
  isso cria `update-server/.vercel/project.json` com os dois IDs. Copie
  `orgId` e `projectId` de lá pros dois segredos. (Esse arquivo pode ser
  apagado depois — só precisava dele pra descobrir os IDs.)
