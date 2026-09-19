import Peer from 'peerjs';
import { isDesktop } from './platform.js';
import { PEER_OPTIONS, prepareScreenTrack, tuneScreenSender, screenBitrateForViewers } from './webrtc.js';

const HOST_PREFIX = 'gsh1_';

export class PublicRoomsRegistry {
  static KEY = 'gsh_public_rooms';

  static add(roomCode, hostName, participantCount) {
    const rooms = this.getAll();
    rooms[roomCode] = {
      roomCode,
      hostName,
      participantCount,
      createdAt: Date.now(),
    };
    localStorage.setItem(this.KEY, JSON.stringify(rooms));
  }

  static remove(roomCode) {
    const rooms = this.getAll();
    delete rooms[roomCode];
    localStorage.setItem(this.KEY, JSON.stringify(rooms));
  }

  static getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '{}');
    } catch {
      return {};
    }
  }

  static updateParticipantCount(roomCode, count) {
    const rooms = this.getAll();
    if (rooms[roomCode]) {
      rooms[roomCode].participantCount = count;
      localStorage.setItem(this.KEY, JSON.stringify(rooms));
    }
  }

  static cleanup() {
    const rooms = this.getAll();
    const now = Date.now();
    const expiredRooms = Object.keys(rooms).filter((code) => now - rooms[code].createdAt > 24 * 60 * 60 * 1000);
    expiredRooms.forEach((code) => delete rooms[code]);
    localStorage.setItem(this.KEY, JSON.stringify(rooms));
  }
}

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
    this.platform = isDesktop ? 'desktop' : 'web';
    this.roomCode = roomCode;
    this.hostId = hostIdFor(roomCode);
    this.peer = null;
    this.isHost = false;
    this.isPublic = false;
    this.hostPeerId = null;
    this.hostConn = null;
    this.memberConns = new Map();
    this.roster = [];
    this.outgoingCalls = new Map();
    this.localStreams = { screen: null, cam: null, mic: null };
    this.stopped = false;
    this._rosterInitialized = false;
    this.cameraPositions = new Map(); // peerId -> 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    this._lastSeen = new Map();
    this._heartbeatTimer = null;
    this._pageLeaveHandler = null;
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  start() {
    this._bindPageLeave();
    return this._becomeHostOrJoin();
  }

  _bindPageLeave() {
    if (this._pageLeaveHandler || typeof window === 'undefined') return;
    this._pageLeaveHandler = () => this.leave();
    window.addEventListener('pagehide', this._pageLeaveHandler);
    window.addEventListener('beforeunload', this._pageLeaveHandler);
  }

  _unbindPageLeave() {
    if (!this._pageLeaveHandler || typeof window === 'undefined') return;
    window.removeEventListener('pagehide', this._pageLeaveHandler);
    window.removeEventListener('beforeunload', this._pageLeaveHandler);
    this._pageLeaveHandler = null;
  }

  _becomeHostOrJoin() {
    return new Promise((resolve) => {
      const hostPeer = new Peer(this.hostId, PEER_OPTIONS);
      let settled = false;

      const settleHost = () => {
        if (settled || this.stopped) return;
        settled = true;
        this.peer = hostPeer;
        this.isHost = true;
        this.hostPeerId = this.peer.id;
        this._setupHostPeer();
        this.roster = [this._selfMember()];
        this.emit('roster', this.roster);
        this.emit('host-info', this.hostPeerId);
        resolve();
      };

      const settleMember = () => {
        if (settled || this.stopped) return;
        settled = true;
        try {
          hostPeer.destroy();
        } catch {
          // ignore
        }
        this._joinAsMember().then(resolve);
      };

      hostPeer.on('open', () => {
        if (this.stopped) {
          hostPeer.destroy();
          return;
        }
        settleHost();
      });

      hostPeer.on('error', (err) => {
        if (settled) return;
        if (err.type === 'unavailable-id') settleMember();
      });

      setTimeout(() => {
        if (settled || this.stopped) return;
        settleMember();
      }, 7000);
    });
  }

  _joinAsMember() {
    return new Promise((resolve) => {
      const peer = new Peer(PEER_OPTIONS);
      let opened = false;
      peer.on('open', () => {
        if (this.stopped) {
          peer.destroy();
          return;
        }
        opened = true;
        this.peer = peer;
        this.isHost = false;
        this._setupCommonPeerHandlers();
        this.roster = [this._selfMember()];
        this.emit('roster', this.roster);
        resolve();
        this._connectToHost();
      });
      peer.on('error', () => {
        if (opened || this.stopped) return;
        setTimeout(() => this._joinAsMember().then(resolve), 900);
      });
    });
  }

  _connectToHost() {
    if (this.stopped || this.isHost || !this.peer) return;
    try {
      this.hostConn?.close();
    } catch {
      // ignore
    }
    clearTimeout(this._hostWaitTimer);
    const conn = this.peer.connect(this.hostId, { reliable: true });
    this.hostConn = conn;
    let firstDone = false;

    const sendHello = () => {
      if (this.stopped || firstDone || this.isHost || !conn.open) return;
      conn.send({ type: 'hello', nickname: this.nickname, platform: this.platform });
    };

    const finishJoin = () => {
      if (firstDone) return;
      firstDone = true;
      clearInterval(conn._helloIv);
      clearTimeout(this._hostWaitTimer);
      this._announceMediaReady();
      // Sempre que a conexão com o host (re)nasce — primeiro join ou
      // reconexão após queda — o Peer subjacente pode ter sido recriado,
      // o que derruba as chamadas de mídia diretas com os demais membros
      // mesmo que o roster continue "igual" (ninguém saiu, do ponto de
      // vista do diff). Reempurra tudo que estamos compartilhando pra
      // quem já conhecemos, sem depender de detectar alguém como "novo".
      this._resyncStreamsWithRoster();
    };

    conn.on('open', () => {
      this._reconnecting = false;
      this.hostPeerId = conn.peer;
      this.emit('host-info', this.hostPeerId);
      sendHello();
      clearInterval(conn._helloIv);
      conn._helloIv = setInterval(sendHello, 1000);
      this._startHeartbeat();
      this._watchDisconnect(conn, () => {
        if (!this.stopped) this._onHostLost();
      });
    });

    conn.on('data', (data) => {
      if (data.type === 'roster') {
        const incomingPositions = Object.entries(data.cameraPositions || {});
        for (const [peerId, position] of incomingPositions) {
          this.cameraPositions.set(peerId, position);
        }
        const rosterIds = new Set(data.roster.map((m) => m.id));
        for (const peerId of this.cameraPositions.keys()) {
          if (!rosterIds.has(peerId)) {
            this.cameraPositions.delete(peerId);
          }
        }
        this.emit('camera-positions', Object.fromEntries(this.cameraPositions));
        this._applyRoster(data.roster);
        const listed = data.roster?.some((m) => m.id === this.peer.id);
        if (listed) finishJoin();
        else sendHello();
      } else if (data.type === 'chat') {
        this.emit('chat', data);
      } else if (data.type === 'media-ready') {
        this._callPeerWithActiveStreams(data.id);
      }
    });

    conn.on('error', () => {
      if (this.stopped || firstDone) return;
      setTimeout(() => {
        if (!this.stopped && !this.isHost && !firstDone) this._onHostLost();
      }, 400);
    });

    conn.on('close', () => {
      clearInterval(conn._helloIv);
      if (this.stopped) return;
      this._onHostLost();
    });

    this._hostWaitTimer = setTimeout(() => {
      if (this.stopped || firstDone || this.isHost) return;
      this._onHostLost();
    }, 5500);
  }

  _setupHostPeer() {
    this._setupCommonPeerHandlers();
    this._startHeartbeat();
    this.peer.on('connection', (conn) => {
      conn.on('data', (data) => this._onHostData(conn, data));
      conn.on('open', () => {
        this.memberConns.set(conn.peer, conn);
        this._watchDisconnect(conn, () => this._onMemberLeft(conn.peer));
        if (conn.open) {
          conn.send({
            type: 'roster',
            roster: this.roster,
            cameraPositions: Object.fromEntries(this.cameraPositions),
          });
        }
      });
      conn.on('close', () => this._onMemberLeft(conn.peer));
      conn.on('error', () => this._onMemberLeft(conn.peer));
    });
  }

  _onHostData(conn, data) {
    this._lastSeen.set(conn.peer, Date.now());
    if (data.type === 'hello') {
      this.memberConns.set(conn.peer, conn);
      this.roster = this.roster.filter((m) => m.id !== conn.peer);
      this.roster.push(this._member(conn.peer, data.nickname, data.platform));
      this._callPeerWithActiveStreams(conn.peer);
      this._broadcastRoster();
      this.emit('roster', this.roster);
      this.emit('peer-joined', this._member(conn.peer, data.nickname, data.platform));
    } else if (data.type === 'media-ready') {
      this._onPeerMediaReady(conn.peer);
    } else if (data.type === 'bye') {
      this._onMemberLeft(conn.peer);
    } else if (data.type === 'ping') {
      // lastSeen já atualizado
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
    const conn = this.memberConns.get(peerId);
    const inRoster = this.roster.some((m) => m.id === peerId);
    if (!conn && !inRoster) return;
    this.memberConns.delete(peerId);
    this._lastSeen.delete(peerId);
    this.cameraPositions.delete(peerId);
    this._closeCallsWith(peerId);
    try {
      conn?.close();
    } catch {
      // já fechou
    }
    const left = this.roster.find((m) => m.id === peerId) || { id: peerId };
    this.roster = this.roster.filter((m) => m.id !== peerId);
    this._broadcastRoster();
    this.emit('roster', this.roster);
    this.emit('peer-left', left);
    this._retuneScreenCalls();
  }

  _closeCallsWith(peerId) {
    for (const key of [...this.outgoingCalls.keys()]) {
      if (!key.startsWith(`${peerId}:`)) continue;
      const call = this.outgoingCalls.get(key);
      try {
        call?.close();
      } catch {
        // ignore
      }
      this.outgoingCalls.delete(key);
    }
  }

  _watchDisconnect(conn, onGone) {
    const pc = conn.peerConnection;
    if (!pc) return;
    let gone = false;
    const fire = () => {
      if (gone || this.stopped) return;
      gone = true;
      onGone();
    };
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') fire();
      if (pc.connectionState === 'disconnected') {
        clearTimeout(conn._dropTimer);
        conn._dropTimer = setTimeout(() => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') fire();
        }, 8000);
      } else {
        clearTimeout(conn._dropTimer);
      }
    });
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') fire();
    });
  }

  _startHeartbeat() {
    if (this._heartbeatTimer) return;
    this._heartbeatTimer = setInterval(() => {
      if (this.stopped) return;
      if (this.isHost) {
        this._pruneStaleMembers();
        this._broadcastRoster();
      } else if (this.hostConn?.open) {
        try {
          this.hostConn.send({ type: 'ping' });
        } catch {
          // conexão já caiu
        }
      } else if (!this._reconnecting) {
        this._onHostLost();
      }
    }, 4000);
  }

  _stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
  }

  _pruneStaleMembers() {
    const now = Date.now();
    for (const [peerId, conn] of this.memberConns) {
      if (conn?.open) {
        this._lastSeen.set(peerId, now);
        continue;
      }
      const seen = this._lastSeen.get(peerId) || 0;
      if (now - seen > 20000) this._onMemberLeft(peerId);
    }
  }

  _broadcastRoster() {
    const cameraPositions = Object.fromEntries(this.cameraPositions);
    for (const conn of this.memberConns.values()) {
      if (conn.open) conn.send({ type: 'roster', roster: this.roster, cameraPositions });
    }
    if (this.isPublic) {
      PublicRoomsRegistry.updateParticipantCount(this.roomCode, this.roster.length);
    }
  }

  _broadcastChat(msg, excludeConn) {
    for (const conn of this.memberConns.values()) {
      if (conn === excludeConn) continue;
      if (conn.open) conn.send(msg);
    }
  }

  // ----- Chat -----

  sendChat(text, extra = {}) {
    const msg = {
      type: 'chat',
      id: this.peer.id,
      nickname: this.nickname,
      platform: this.platform,
      text,
      ts: Date.now(),
      ...extra,
    };
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
    const prevRoster = this.roster;
    const prevIds = new Set(prevRoster.map((m) => m.id));
    const currentIds = new Set(roster.map((m) => m.id));
    const wasInitialized = this._rosterInitialized;
    this._rosterInitialized = true;

    this.roster = roster;
    this.emit('roster', this.roster);

    for (const m of roster) {
      if (m.id !== this.peer.id && !prevIds.has(m.id)) {
        if (wasInitialized) {
          this.emit('peer-joined', m);
          this._callPeerWithActiveStreams(m.id);
        } else {
          this._callPeerWithActiveStreams(m.id);
        }
      }
    }
    for (const id of prevIds) {
      if (currentIds.has(id)) continue;
      const left = prevRoster.find((m) => m.id === id) || { id };
      // Sem isso, a call de saída pra quem saiu fica pra sempre no mapa
      // (nunca mais usada, mas nunca limpa) — e infla artificialmente a
      // contagem de espectadores da tela usada pra dividir a banda.
      this._closeCallsWith(id);
      this.emit('peer-left', left);
    }
    this._retuneScreenCalls();
  }

  _announceMediaReady() {
    if (this.stopped || this.isHost) return;
    if (this.hostConn?.open) this.hostConn.send({ type: 'media-ready' });
  }

  _onPeerMediaReady(peerId) {
    this._callPeerWithActiveStreams(peerId);
    for (const conn of this.memberConns.values()) {
      if (conn.peer === peerId || !conn.open) continue;
      conn.send({ type: 'media-ready', id: peerId });
    }
  }

  _setupCommonPeerHandlers() {
    this.peer.on('call', (call) => {
      call.on('stream', (stream) => {
        this.emit('stream', { peerId: call.peer, type: call.metadata?.type, stream });
      });
      call.answer();
      call.on('close', () => {
        this.emit('stream-removed', { peerId: call.peer, type: call.metadata?.type });
      });
    });
    this.peer.on('disconnected', () => {
      if (this.stopped) return;
      try {
        this.peer.reconnect();
      } catch {
        // ignore
      }
    });
  }

  // Reempurra nossas streams ativas (tela/cam/mic) pra todo mundo que já
  // está no roster — não só pra quem acabou de "entrar". Necessário depois
  // de qualquer reconexão, já que destruir/recriar o Peer local derruba as
  // RTCPeerConnections com todo mundo, não só com o host.
  _resyncStreamsWithRoster() {
    for (const m of this.roster) {
      if (!this.peer || m.id === this.peer.id) continue;
      this._callPeerWithActiveStreams(m.id);
    }
  }

  _callPeerWithActiveStreams(peerId) {
    if (!peerId || peerId === this.peer?.id) return;
    ['screen', 'cam', 'mic'].forEach((type, i) => {
      if (!this.localStreams[type]) return;
      const stream = this.localStreams[type];
      if (!stream) return;
      setTimeout(() => {
        if (this.stopped) return;
        this._callPeer(peerId, type, stream);
      }, 80 + i * 160);
    });
  }

  // Quantas vezes tenta de novo (0-indexado) antes de desistir e avisar
  // quem está compartilhando que aquele espectador específico não está
  // recebendo a mídia — ver `stream-failed` em RoomView.
  static MAX_CALL_ATTEMPTS = 5;

  _callPeer(peerId, type, stream, attempt = 0) {
    if (this.stopped || !this.peer || peerId === this.peer.id) return;
    if (!stream || stream.getTracks().every((t) => t.readyState === 'ended')) return;

    const key = `${peerId}:${type}`;
    const prev = this.outgoingCalls.get(key);
    if (prev) {
      try {
        prev.close();
      } catch {
        // ignore
      }
      this.outgoingCalls.delete(key);
    }

    if (type === 'screen') prepareScreenTrack(stream);
    const call = this.peer.call(peerId, stream, { metadata: { type } });
    if (!call) {
      if (attempt < RoomClient.MAX_CALL_ATTEMPTS) {
        setTimeout(() => this._callPeer(peerId, type, this.localStreams[type], attempt + 1), 700);
      } else {
        this._giveUpOnCall(peerId, type);
      }
      return;
    }

    this.outgoingCalls.set(key, call);
    call.on('error', () => {
      if (this.outgoingCalls.get(key) !== call) return;
      this.outgoingCalls.delete(key);
      if (attempt < RoomClient.MAX_CALL_ATTEMPTS && this.localStreams[type]) {
        setTimeout(() => this._callPeer(peerId, type, this.localStreams[type], attempt + 1), 800);
      } else {
        this._giveUpOnCall(peerId, type);
      }
    });
    this._watchCallHealth(call, key, peerId, type, attempt);

    if (type === 'screen') {
      setTimeout(() => {
        if (this.outgoingCalls.get(key) === call) this._retuneScreenCalls();
      }, 500);
    }
  }

  // Avisa quem está compartilhando (via evento, a UI decide como mostrar)
  // que um espectador específico não está recebendo aquela mídia — em vez
  // de deixar a UI parecer que deu tudo certo quando não deu.
  _giveUpOnCall(peerId, type) {
    this.emit('stream-failed', { peerId, type });
  }

  // Mesh puro sem TURN/SFU: compartilhar tela sobe uma cópia do vídeo pra
  // CADA espectador — sem isso, o upload de quem compartilha satura assim
  // que a 2ª ou 3ª pessoa entra numa rede residencial comum, e a conexão
  // "trava"/"não conecta" mesmo com o sinal WebRTC ok. Divide o orçamento
  // de banda entre quem está de fato assistindo agora.
  _screenViewerCount() {
    let n = 0;
    for (const key of this.outgoingCalls.keys()) {
      if (key.endsWith(':screen')) n++;
    }
    return n;
  }

  _retuneScreenCalls() {
    const viewers = this._screenViewerCount();
    if (!viewers) return;
    const bitrate = screenBitrateForViewers(viewers);
    for (const [key, call] of this.outgoingCalls) {
      if (key.endsWith(':screen')) tuneScreenSender(call, bitrate);
    }
  }

  // `call.on('error')` só cobre falhas de protocolo do PeerJS — quando a
  // negociação ICE trava ou falha (NAT ruim, rede instável), a call fica
  // "pendurada" sem nunca emitir erro, e quem entrou depois nunca vê a
  // tela/câmera. Observa o estado da RTCPeerConnection e refaz a call.
  _watchCallHealth(call, key, peerId, type, attempt) {
    setTimeout(() => {
      if (this.outgoingCalls.get(key) !== call) return;
      const pc = call.peerConnection;
      if (!pc) return;
      let settled = false;
      const onConnected = () => {
        if (settled || this.stopped) return;
        if (pc.connectionState !== 'connected') return;
        // Não trava esse listener: uma conexão "connected" pode cair de
        // novo depois (rede instável) e precisamos saber disso também.
        this.emit('stream-recovered', { peerId, type });
      };
      const retry = () => {
        if (settled || this.stopped) return;
        if (pc.connectionState !== 'failed' && pc.iceConnectionState !== 'failed') return;
        settled = true;
        if (this.outgoingCalls.get(key) !== call) return;
        this.outgoingCalls.delete(key);
        try {
          call.close();
        } catch {
          // ignore
        }
        if (attempt < RoomClient.MAX_CALL_ATTEMPTS && this.localStreams[type]) {
          this._callPeer(peerId, type, this.localStreams[type], attempt + 1);
        } else {
          this._giveUpOnCall(peerId, type);
        }
      };
      pc.addEventListener('connectionstatechange', retry);
      pc.addEventListener('iceconnectionstatechange', retry);
      pc.addEventListener('connectionstatechange', onConnected);
    }, 150);
  }

  // ----- Reeleicao de host -----

  _onHostLost() {
    if (this.stopped || this._reconnecting) return;
    this._reconnecting = true;
    const hostGone = this.hostId;
    const hostMember = this.roster.find((m) => m.id === hostGone);
    if (hostMember) {
      this.roster = this.roster.filter((m) => m.id !== hostGone);
      this.emit('roster', this.roster);
      this.emit('peer-left', hostMember);
    }
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
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    const hostPeer = new Peer(this.hostId, PEER_OPTIONS);
    hostPeer.on('open', () => {
      if (this.stopped) {
        hostPeer.destroy();
        return;
      }
      this.peer = hostPeer;
      this.isHost = true;
      this._reconnecting = false;
      this.memberConns = new Map();
      const othersFromPreviousRoster = this.roster.filter((m) => m.id !== this.peer.id);
      this.roster = [this._selfMember(), ...othersFromPreviousRoster];
      this._setupHostPeer();
      this.emit('roster', this.roster);
      // Viramos host com um Peer novo (id fixo, mas objeto recriado) — as
      // chamadas de mídia diretas que tínhamos com os demais membros, de
      // quando éramos um membro comum, morreram junto. Reestabelece.
      this._resyncStreamsWithRoster();
    });
    hostPeer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        this._reconnecting = false;
        setTimeout(() => this._retryJoin(), 400);
      } else if (attempt < 10) {
        setTimeout(() => this._tryBecomeHost(attempt + 1), 400);
      }
    });
  }

  // Reconecta como membro comum. Tenta reaproveitar o MESMO id de peer que
  // já tínhamos — se trocarmos de id a cada reconexão, todo mundo na sala
  // vê a gente "sair e entrar de novo" (o id antigo some do roster, um novo
  // aparece), mesmo sem ter saído de verdade. Só cai pra um id novo se o
  // broker ainda não liberou o antigo.
  _retryJoin(useFreshId = false) {
    if (this.stopped) return;
    const previousId = !useFreshId && !this.isHost ? this.peer?.id : null;
    try {
      this.peer?.destroy();
    } catch {
      // ignore
    }
    const peer = previousId ? new Peer(previousId, PEER_OPTIONS) : new Peer(PEER_OPTIONS);
    peer.on('open', () => {
      if (this.stopped) {
        peer.destroy();
        return;
      }
      this.peer = peer;
      this.isHost = false;
      this._setupCommonPeerHandlers();
      this._connectToHost();
    });
    peer.on('error', (err) => {
      if (previousId && err.type === 'unavailable-id') {
        // id antigo ainda preso no broker — tenta de novo já com um novo id
        setTimeout(() => this._retryJoin(true), 400);
        return;
      }
      setTimeout(() => this._retryJoin(useFreshId), 800);
    });
  }

  _selfMember() {
    return this._member(this.peer.id, this.nickname, this.platform);
  }

  _member(id, nickname, platform) {
    return {
      id,
      nickname,
      platform: platform === 'desktop' || platform === 'web' ? platform : null,
    };
  }

  // ----- Midia local -----

  // Usado quando a tela veio da captura nativa (native/gustashare-capture)
  // em vez de getDisplayMedia — o stream já chega pronto.
  setScreenFromStream(stream) {
    prepareScreenTrack(stream);
    this._setLocalStream('screen', stream);
  }

  // `choice` vem do nosso ScreenPickerModal (mostrado ANTES dessa chamada,
  // via window.gustashare.listScreenSources/setScreenPickerChoice) — pedir
  // audio:true quando a fonte é uma janela (que nunca tem áudio) faz o
  // Electron rejeitar o pedido inteiro, então só pedimos o áudio que
  // realmente vamos conseguir entregar.
  async setScreen(on, choice) {
    if (on) {
      const wantsAudio = choice ? !!choice.shareAudio : true;
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: wantsAudio,
      });
      prepareScreenTrack(stream);
      stream.getVideoTracks()[0].addEventListener('ended', () => this.setScreen(false));
      this._setLocalStream('screen', stream);
    } else {
      this._setLocalStream('screen', null);
    }
  }

  async setCam(on) {
    if (on) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => this.setCam(false));
      });
      this._setLocalStream('cam', stream);
    } else {
      this._setLocalStream('cam', null);
    }
  }

  async setMic(on) {
    if (on) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', () => this.setMic(false));
      });
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
        try {
          oldCall.close();
        } catch {
          // ignore
        }
        this.outgoingCalls.delete(key);
      }
      if (stream) this._callPeer(m.id, type, stream);
    }

    if (old) old.getTracks().forEach((t) => t.stop());
  }

  setPublic(isPublic) {
    if (!this.isHost) return;
    this.isPublic = isPublic;
    this.emit('public-toggle', this.isPublic);
    if (isPublic) {
      PublicRoomsRegistry.add(this.roomCode, this.nickname, this.roster.length);
    } else {
      PublicRoomsRegistry.remove(this.roomCode);
    }
  }

  leave() {
    if (this.stopped) return;
    this.stopped = true;
    this._unbindPageLeave();
    this._stopHeartbeat();
    clearTimeout(this._hostWaitTimer);
    if (this.isPublic) {
      PublicRoomsRegistry.remove(this.roomCode);
    }
    try {
      if (!this.isHost && this.hostConn?.open) {
        this.hostConn.send({ type: 'bye', id: this.peer?.id });
      }
    } catch {
      // aba fechando — o bye é best-effort
    }
    for (const type of ['screen', 'cam', 'mic']) {
      const s = this.localStreams[type];
      if (s) s.getTracks().forEach((t) => t.stop());
    }
    try {
      this.hostConn?.close();
    } catch {
      // ignore
    }
    try {
      if (this.peer) this.peer.destroy();
    } catch {
      // ignore
    }
  }
}
