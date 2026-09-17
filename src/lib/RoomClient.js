import Peer from 'peerjs';

const HOST_PREFIX = 'gsh1_';

function hostIdFor(roomCode) {
  const clean = roomCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${HOST_PREFIX}${clean || 'sala'}`;
}

/**
 * Gerencia a sala em P2P puro via PeerJS.
 *
 * Nao existe servidor proprio: o unico componente externo e o broker
 * publico do PeerJS (cloud gratuito), usado so para trocar SDP/ICE
 * (sinalizacao). Todo audio/video/tela trafega direto entre as maquinas
 * dos participantes.
 *
 * "Host" aqui e so quem guarda a lista de participantes (roster) da sala,
 * para os outros se descobrirem. Se o host sair, o proximo da lista assume
 * o id do host automaticamente — as conexoes de midia entre os demais
 * participantes nao sao afetadas, entao ninguem percebe a troca.
 */
export default class RoomClient extends EventTarget {
  constructor(nickname, roomCode) {
    super();
    this.nickname = nickname;
    this.roomCode = roomCode;
    this.hostId = hostIdFor(roomCode);
    this.peer = null;
    this.isHost = false;
    this.hostConn = null;
    this.memberConns = new Map();
    this.roster = [];
    this.outgoingCalls = new Map();
    this.localStreams = { screen: null, cam: null, mic: null };
    this.stopped = false;
    this._rosterInitialized = false;
    this.cameraPositions = new Map(); // peerId -> 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  start() {
    return this._becomeHostOrJoin();
  }

  _becomeHostOrJoin() {
    return new Promise((resolve) => {
      const hostPeer = new Peer(this.hostId);
      let settled = false;

      hostPeer.on('open', () => {
        settled = true;
        this.peer = hostPeer;
        this.isHost = true;
        this._setupHostPeer();
        this.roster = [{ id: this.peer.id, nickname: this.nickname }];
        this.emit('roster', this.roster);
        resolve();
      });

      hostPeer.on('error', (err) => {
        if (settled) return;
        if (err.type === 'unavailable-id') {
          hostPeer.destroy();
          this._joinAsMember().then(resolve);
        }
      });
    });
  }

  _joinAsMember() {
    return new Promise((resolve) => {
      const peer = new Peer();
      peer.on('open', () => {
        this.peer = peer;
        this.isHost = false;
        this._setupCommonPeerHandlers();
        this._connectToHost(resolve);
      });
    });
  }

  _connectToHost(onFirstRoster) {
    const conn = this.peer.connect(this.hostId, { reliable: true });
    this.hostConn = conn;
    let firstDone = false;

    conn.on('open', () => {
      conn.send({ type: 'hello', nickname: this.nickname });
    });

    conn.on('data', (data) => {
      if (data.type === 'roster') {
        this.cameraPositions = new Map(Object.entries(data.cameraPositions || {}));
        this.emit('camera-positions', Object.fromEntries(this.cameraPositions));
        this._applyRoster(data.roster);
        if (!firstDone) {
          firstDone = true;
          if (onFirstRoster) onFirstRoster();
        }
      } else if (data.type === 'chat') {
        this.emit('chat', data);
      }
    });

    conn.on('close', () => {
      if (this.stopped) return;
      this._onHostLost();
    });
  }

  _setupHostPeer() {
    this._setupCommonPeerHandlers();
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        conn.on('data', (data) => this._onHostData(conn, data));
      });
      conn.on('close', () => this._onMemberLeft(conn.peer));
    });
  }

  _onHostData(conn, data) {
    if (data.type === 'hello') {
      this.memberConns.set(conn.peer, conn);
      this.roster = this.roster.filter((m) => m.id !== conn.peer);
      this.roster.push({ id: conn.peer, nickname: data.nickname });
      this._broadcastRoster();
      this.emit('roster', this.roster);
      this.emit('peer-joined', { id: conn.peer, nickname: data.nickname });
      this._callPeerWithActiveStreams(conn.peer);
    } else if (data.type === 'chat') {
      this.emit('chat', data);
      this._broadcastChat(data, conn);
    } else if (data.type === 'camera-position') {
      this.cameraPositions.set(data.id, data.position);
      this.emit('camera-positions', Object.fromEntries(this.cameraPositions));
      this._broadcastRoster();
    }
  }

  _onMemberLeft(peerId) {
    if (!this.memberConns.has(peerId)) return;
    this.memberConns.delete(peerId);
    this.roster = this.roster.filter((m) => m.id !== peerId);
    this._broadcastRoster();
    this.emit('roster', this.roster);
    this.emit('peer-left', peerId);
  }

  _broadcastRoster() {
    const cameraPositions = Object.fromEntries(this.cameraPositions);
    for (const conn of this.memberConns.values()) {
      if (conn.open) conn.send({ type: 'roster', roster: this.roster, cameraPositions });
    }
  }

  _broadcastChat(msg, excludeConn) {
    for (const conn of this.memberConns.values()) {
      if (conn === excludeConn) continue;
      if (conn.open) conn.send(msg);
    }
  }

  // ----- Chat -----

  sendChat(text) {
    const msg = { type: 'chat', id: this.peer.id, nickname: this.nickname, text, ts: Date.now() };
    this.emit('chat', msg);
    if (this.isHost) {
      this._broadcastChat(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  // ----- Posição da câmera (PiP sobre a tela compartilhada) -----

  sendCameraPosition(position) {
    this.cameraPositions.set(this.peer.id, position);
    this.emit('camera-positions', Object.fromEntries(this.cameraPositions));
    if (this.isHost) {
      this._broadcastRoster();
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: 'camera-position', id: this.peer.id, position });
    }
  }

  _applyRoster(roster) {
    const prevIds = new Set(this.roster.map((m) => m.id));
    const currentIds = new Set(roster.map((m) => m.id));
    const wasInitialized = this._rosterInitialized;
    this._rosterInitialized = true;

    this.roster = roster;
    this.emit('roster', this.roster);

    for (const m of roster) {
      if (m.id !== this.peer.id && !prevIds.has(m.id)) {
        // No primeiro roster recebido (snapshot de quem já estava na sala),
        // não é uma "entrada" de verdade — não toca som pra isso.
        if (wasInitialized) this.emit('peer-joined', m);
        this._callPeerWithActiveStreams(m.id);
      }
    }
    for (const id of prevIds) {
      if (!currentIds.has(id)) this.emit('peer-left', id);
    }
  }

  _setupCommonPeerHandlers() {
    this.peer.on('call', (call) => {
      call.answer();
      call.on('stream', (stream) => {
        this.emit('stream', { peerId: call.peer, type: call.metadata?.type, stream });
      });
      call.on('close', () => {
        this.emit('stream-removed', { peerId: call.peer, type: call.metadata?.type });
      });
    });
  }

  _callPeerWithActiveStreams(peerId) {
    for (const type of ['screen', 'cam', 'mic']) {
      const stream = this.localStreams[type];
      if (stream) this._callPeer(peerId, type, stream);
    }
  }

  _callPeer(peerId, type, stream) {
    const call = this.peer.call(peerId, stream, { metadata: { type } });
    if (!call) return;
    this.outgoingCalls.set(`${peerId}:${type}`, call);
  }

  // ----- Reeleicao de host -----

  _onHostLost() {
    const others = this.roster.filter((m) => m.id !== this.peer.id).map((m) => m.id);
    const candidates = [this.peer.id, ...others].sort();
    if (candidates[0] === this.peer.id) {
      this._tryBecomeHost();
    } else {
      setTimeout(() => this._retryJoin(), 500 + Math.random() * 500);
    }
  }

  _tryBecomeHost(attempt = 0) {
    if (this.stopped) return;
    this.peer.destroy();
    const hostPeer = new Peer(this.hostId);
    hostPeer.on('open', () => {
      this.peer = hostPeer;
      this.isHost = true;
      this.memberConns = new Map();
      this.roster = [{ id: this.peer.id, nickname: this.nickname }];
      this._setupHostPeer();
      this.emit('roster', this.roster);
    });
    hostPeer.on('error', (err) => {
      if (err.type === 'unavailable-id' && attempt < 10) {
        setTimeout(() => this._tryBecomeHost(attempt + 1), 400);
      }
    });
  }

  _retryJoin() {
    if (this.stopped) return;
    const peer = new Peer();
    peer.on('open', () => {
      this.peer = peer;
      this.isHost = false;
      this._setupCommonPeerHandlers();
      this._connectToHost();
    });
    peer.on('error', () => {
      setTimeout(() => this._retryJoin(), 800);
    });
  }

  // ----- Midia local -----

  // Usado quando a tela veio da captura nativa (native/gustashare-capture)
  // em vez de getDisplayMedia — o stream já chega pronto.
  setScreenFromStream(stream) {
    this._setLocalStream('screen', stream);
  }

  // `choice` vem do nosso ScreenPickerModal (mostrado ANTES dessa chamada,
  // via window.gustashare.listScreenSources/setScreenPickerChoice) — pedir
  // audio:true quando a fonte é uma janela (que nunca tem áudio) faz o
  // Electron rejeitar o pedido inteiro, então só pedimos o áudio que
  // realmente vamos conseguir entregar.
  async setScreen(on, choice) {
    if (on && !window.gustashare) {
      throw new Error('compartilhar tela só no desktop');
    }
    if (on) {
      const wantsAudio = !!(choice && choice.shareAudio);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: wantsAudio });
      stream.getVideoTracks()[0].addEventListener('ended', () => this.setScreen(false));
      this._setLocalStream('screen', stream);
    } else {
      this._setLocalStream('screen', null);
    }
  }

  async setCam(on) {
    if (on && !window.gustashare) {
      throw new Error('câmera só no desktop');
    }
    if (on) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this._setLocalStream('cam', stream);
    } else {
      this._setLocalStream('cam', null);
    }
  }

  async setMic(on) {
    if (on && !window.gustashare) {
      throw new Error('microfone só no desktop');
    }
    if (on) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._setLocalStream('mic', stream);
    } else {
      this._setLocalStream('mic', null);
    }
  }

  _setLocalStream(type, stream) {
    const old = this.localStreams[type];
    this.localStreams[type] = stream;
    this.emit('self-stream', { type, stream });

    for (const m of this.roster) {
      if (m.id === this.peer.id) continue;
      const key = `${m.id}:${type}`;
      const oldCall = this.outgoingCalls.get(key);
      if (oldCall) {
        oldCall.close();
        this.outgoingCalls.delete(key);
      }
      if (stream) this._callPeer(m.id, type, stream);
    }

    if (old) old.getTracks().forEach((t) => t.stop());
  }

  leave() {
    this.stopped = true;
    for (const type of ['screen', 'cam', 'mic']) {
      const s = this.localStreams[type];
      if (s) s.getTracks().forEach((t) => t.stop());
    }
    if (this.peer) this.peer.destroy();
  }
}
