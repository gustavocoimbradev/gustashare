# 🎥 GustaShare

**Compartilhamento de tela em tempo real. Simples, rápido, sem servidor.**

![GustaShare Preview](./public/og.png)

## O Que é?

GustaShare é uma plataforma para compartilhar sua tela com outras pessoas **em tempo real**. Perfeito para:

- 👥 Reuniões e apresentações
- 💻 Pair programming e debugging remoto
- 🎮 Transmissão de gameplay
- 📚 Aulas e tutoriais
- 💬 Chat integrado para comunicação

Sem necessidade de conta, download de software pesado ou servidor privado. Abra, compartilhe o código, pronto!

## ✨ Destaques

- **Zero Setup** — Crie uma sala em um click, compartilhe o código
- **Privado P2P** — Seu áudio, vídeo e tela vão direto para os participantes (sem passa por servidor)
- **Desktop + Web** — Use o app Windows ou acesse pelo navegador
- **Chat Integrado** — Converse sem sair da sala
- **Auto-Update** — App desktop sempre atualizado automaticamente
- **Sem Limite de Participantes** — Convide quantas pessoas quiser

## 🚀 Como Usar

### Desktop (Windows)

1. Baixe o [GustaShare-Setup.exe](https://gustashare.vercel.app)
2. Abra o app, escolha seu nome
3. Clique "Criar Sala" e compartilhe o código
4. Outros entram usando o mesmo código

### Web

Acesse **https://gustashare.vercel.app** e entre em uma sala.

> **Dica:** Convites automáticos funcionam com `https://gustashare.vercel.app/room/CODIGO`

## 📊 O Que Você Pode Compartilhar

| Plataforma | Tela | Câmera | Microfone | Chat |
|:-----------|:----:|:------:|:--------:|:----:|
| **Desktop** | ✅ | ✅ | ✅ | ✅ |
| **Web** | ❌ | ❌ | ❌ | ✅ |

> Quem está na web pode ver e ouvir, usar o chat, mas não pode compartilhar.

## 🔒 Privacidade

- ✅ **Sem servidor próprio** — Sua conversa não passa por nós
- ✅ **Criptografia WebRTC** — Conexão ponto a ponto autenticada
- ✅ **Sem registro** — Sem criar conta, sem dados pessoais
- ✅ **Código aberto** — [Veja o código no GitHub](https://github.com)

## 🛠️ Desenvolvendo

Quer compilar ou melhorar? Fácil:

```bash
git clone <repo>
cd gustashare
npm install
npm run dev
```

Acessa `http://localhost:5173` no navegador.

## 📦 Compilar para Windows

```bash
npm run build
```

O instalador fica em `release/GustaShare-Setup.exe`.

## 📝 Licença

[MIT](LICENSE)

---

**Feito com ❤️ para compartilhamento sem fricção.**
