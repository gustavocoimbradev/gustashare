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
