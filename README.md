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
GitHub) nem hospedado na Vercel — ele é publicado como
[GitHub Release](https://github.com/gustavocoimbradev/gustashare/releases),
buildado por um GitHub Actions em Windows real (sem precisar de wine).
`update-server/` continua na Vercel, mas só com arquivos pequenos:
`latest.json` (aponta pra URL do Release da versão atual) e `room.html`
(página de convite). No Vercel, configure:
- **Framework Preset**: `Other`
- **Root Directory**: `update-server`

### Publicando uma nova versão

```bash
npm run publish
```

Isso bumpa a versão (patch) em `package.json` automaticamente e roda
`git add . && git pull && git commit -m "publish" && git push`. Só isso —
não builda nada localmente.

O push (por mudar `package.json`) dispara o workflow
`.github/workflows/release.yml`, que builda o `.exe` num runner Windows,
publica como GitHub Release na tag `v<versão>`, e commita de volta
`update-server/latest.json` apontando pra essa release (com `[skip ci]`
pra não disparar o workflow de novo). Esse segundo push aciona o deploy
automático na Vercel, atualizando `latest.json` publicado — e o
auto-updater do app passa a enxergar a nova versão.
