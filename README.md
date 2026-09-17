# GustaShare

Compartilhamento de tela em tempo real, ponto a ponto (P2P), sem servidor próprio.

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
- Cada usuário compartilha sua própria tela/câmera/microfone usando a
  própria internet — ninguém depende da conexão de um único "servidor".

## Rodando em desenvolvimento

```bash
npm install
npm run dev
```

## Gerando o executável portátil (.exe) para Windows

```bash
npm install
npm run build
```

O `.exe` portátil (não precisa instalar) fica em `release/GustaShare-Portable.exe`.

> Gerar `.exe` para Windows a partir de Linux/WSL pode exigir `wine`
> instalado. Se o build falhar por causa disso, rode `npm run build`
> diretamente em uma máquina Windows — o restante do projeto já está pronto.

## Auto-update

O app checa `https://gustashare.vercel.app/latest.json` toda vez que abre.
Se a versão de lá for maior que a instalada, ele baixa o novo `.exe`
sozinho (com uma barra de progresso bloqueando o fechamento da janela) e
já reabre na versão nova — sem passar pelo navegador.

Isso só funciona no `.exe` portátil empacotado (usa a variável de ambiente
`PORTABLE_EXECUTABLE_FILE` que o electron-builder expõe para saber qual
arquivo substituir); em modo `npm run dev` o update é ignorado.

O `.exe` **não** fica commitado no git (passa dos 100MB, limite do
GitHub) — ele é buildado por um GitHub Actions em Windows real (sem
precisar de wine) e deployado **direto na Vercel via CLI**, sem nunca
passar pelo git. `update-server/` é o projeto Vercel: `latest.json`
(versão atual), `room.html` (página de convite) e o próprio
`GustaShare-Portable.exe` (só existe lá publicado, nunca no repositório).
No Vercel, configure:
- **Framework Preset**: `Other`
- **Root Directory**: `update-server`
- **Git deploys desligados** (o `vercel.json` já manda `git.deploymentEnabled: false`).
  Se o GitHub estiver conectado no projeto, um `git push` tenta rodar
  `npm run build` na raiz — electron-builder de Windows em Linux da
  Vercel — e ainda pode publicar o `update-server/` **sem** o `.exe`.
  Só o workflow **Build and release GustaShare** deve publicar na Vercel.

### Enviando código

```bash
npm run publish
```

Isso só roda `git add . && git pull && git commit -m "publish" && git push`.
Não mexe em versão, não builda nada, não dispara nada sozinho — é só pra
mandar código pro GitHub normalmente.

### Publicando uma nova versão (gerando o .exe)

A versão só muda quando você realmente builda. Vai em **Actions** no
GitHub e roda manualmente o workflow **Build and release GustaShare**
(botão "Run workflow"). Ele:
1. Bumpa a versão (patch) em `package.json`.
2. Builda o `.exe` num runner Windows real (sem wine).
3. Copia o `.exe` pra `update-server/` e atualiza `update-server/latest.json`.
4. Faz `vercel deploy --prod` direto da pasta `update-server/` (o `.exe`
   vai junto nesse deploy, sem passar pelo git).
5. Commita só `package.json` + `latest.json` de volta pro repo (o `.exe`
   fica de fora, com `[skip ci]` pra não disparar o workflow de novo).

O auto-updater do app passa a enxergar a nova versão assim que o deploy
na Vercel terminar.

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
