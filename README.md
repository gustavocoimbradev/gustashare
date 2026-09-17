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

`update-server/` é um projeto Vercel separado e propositalmente simples —
só serve `latest.json` e o `.exe` da versão atual como arquivos estáticos,
sem nenhum backend. No Vercel, configure:
- **Framework Preset**: `Other`
- **Root Directory**: `update-server`

### Publicando uma nova versão

```bash
npm run publish
```

Isso, em sequência:
1. Bumpa a versão (patch) em `package.json` automaticamente — não precisa informar nada.
2. Builda o app (`vite build` + `electron-builder --win portable`).
3. Copia o `.exe` novo para `update-server/` e atualiza `update-server/latest.json`
   (apaga o `.exe` da versão anterior do diretório de trabalho, pra não acumular
   binário a cada publish).
4. Roda `git add . && git pull && git commit -m "publish" && git push`.

O push aciona o deploy automático na Vercel (se o projeto estiver
conectado ao repositório), o que atualiza `latest.json` e o `.exe`
publicados — e o auto-updater do app passa a enxergar a nova versão.

> Cada publish comita um `.exe` novo (~70MB) no histórico do git. Isso
> cresce o repositório com o tempo; se isso virar um problema, migrar
> `update-server/` para Git LFS resolve, mas não fiz isso agora pra manter
> o fluxo simples.
