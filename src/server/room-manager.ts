import { generateRoomCode } from './code-generator';
import type { RoomState, Player } from '@/shared/types';

interface Session {
  token: string;
  playerId: string;
  roomCode: string;
}

interface RoomMeta {
  createdAt: number;
  lastActivityAt: number;
}

const MAX_PLAYERS = 12;
const ROOM_TTL_MS = 2 * 60 * 60_000;       // 2h
const DISCONNECTED_TTL_MS = 10 * 60_000;    // 10min

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private sessions = new Map<string, Session>();
  private meta = new Map<string, RoomMeta>();
  private disconnectedAt = new Map<string, number>(); // playerId → timestamp
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  createRoom(nick: string): { state: RoomState; playerId: string; token: string } {
    let code: string;
    let attempts = 0;
    do {
      code = generateRoomCode();
      attempts++;
      if (attempts > 5) throw new Error('Nie można wygenerować unikalnego kodu');
    } while (this.rooms.has(code));

    const now = Date.now();
    const playerId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const player: Player = {
      id: playerId,
      nick,
      joinedAt: now,
      sips: 0,
      isConnected: true,
    };
    const state: RoomState = {
      code,
      players: [player],
      hostId: playerId,
      status: 'waiting',
      deck: [],
      currentTurnPlayerId: null,
      drawnCards: [],
    };
    this.rooms.set(code, state);
    this.meta.set(code, { createdAt: now, lastActivityAt: now });
    this.sessions.set(token, { token, playerId, roomCode: code });
    return { state, playerId, token };
  }

  joinRoom(
    code: string,
    nick: string,
  ): { state: RoomState; playerId: string; token: string } {
    const room = this.rooms.get(code);
    if (!room) throw new Error('no_room');
    if (room.players.length >= MAX_PLAYERS) throw new Error('room_full');

    const now = Date.now();
    const playerId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const player: Player = {
      id: playerId,
      nick,
      joinedAt: now,
      sips: 0,
      isConnected: true,
    };
    const newState: RoomState = {
      ...room,
      players: [...room.players, player],
    };
    this.rooms.set(code, newState);
    this.meta.set(code, { ...this.meta.get(code)!, lastActivityAt: now });
    this.sessions.set(token, { token, playerId, roomCode: code });
    return { state: newState, playerId, token };
  }

  rejoin(token: string): { state: RoomState; playerId: string } | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    const room = this.rooms.get(session.roomCode);
    if (!room) return null;

    const newState = this.setConnected(room, session.playerId, true);
    this.rooms.set(session.roomCode, newState);
    this.disconnectedAt.delete(session.playerId);
    this.meta.set(session.roomCode, {
      ...this.meta.get(session.roomCode)!,
      lastActivityAt: Date.now(),
    });
    return { state: newState, playerId: session.playerId };
  }

  leaveRoom(playerId: string, code: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const newPlayers = room.players.filter((p) => p.id !== playerId);

    for (const [t, session] of this.sessions) {
      if (session.playerId === playerId) {
        this.sessions.delete(t);
        break;
      }
    }
    this.disconnectedAt.delete(playerId);

    if (newPlayers.length === 0) {
      this.rooms.delete(code);
      this.meta.delete(code);
      return null;
    }

    const newHostId =
      room.hostId === playerId ? newPlayers[0].id : room.hostId;
    const newCurrentTurn =
      room.currentTurnPlayerId === playerId
        ? newPlayers[0].id
        : room.currentTurnPlayerId;

    const newState: RoomState = {
      ...room,
      players: newPlayers,
      hostId: newHostId,
      currentTurnPlayerId: newCurrentTurn,
    };
    this.rooms.set(code, newState);
    this.meta.set(code, {
      ...this.meta.get(code)!,
      lastActivityAt: Date.now(),
    });
    return newState;
  }

  markDisconnected(playerId: string, code: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const newState = this.setConnected(room, playerId, false);
    this.rooms.set(code, newState);
    this.disconnectedAt.set(playerId, Date.now());
    return newState;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  updateRoom(code: string, state: RoomState): void {
    this.rooms.set(code, state);
    const existing = this.meta.get(code);
    if (existing) {
      this.meta.set(code, { ...existing, lastActivityAt: Date.now() });
    }
  }

  startCleanup(intervalMs: number): void {
    this.cleanupTimer = setInterval(() => this.cleanupStale(), intervalMs);
    // Allow process to exit even if cleanup timer is pending
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  cleanupStale(now = Date.now()): void {
    for (const [code, m] of this.meta) {
      const room = this.rooms.get(code);
      if (!room) {
        this.meta.delete(code);
        continue;
      }

      // Remove rooms older than 2h
      if (now - m.createdAt > ROOM_TTL_MS) {
        this.evictRoom(code, room);
        continue;
      }

      // Remove rooms where all players have been disconnected for > 10min
      if (room.players.length > 0 && room.players.every((p) => !p.isConnected)) {
        const allStale = room.players.every((p) => {
          const at = this.disconnectedAt.get(p.id);
          return at !== undefined && now - at > DISCONNECTED_TTL_MS;
        });
        if (allStale) this.evictRoom(code, room);
      }
    }
  }

  private evictRoom(code: string, room: RoomState): void {
    this.rooms.delete(code);
    this.meta.delete(code);
    for (const [t, session] of this.sessions) {
      if (session.roomCode === code) this.sessions.delete(t);
    }
    for (const p of room.players) {
      this.disconnectedAt.delete(p.id);
    }
  }

  private setConnected(
    room: RoomState,
    playerId: string,
    connected: boolean,
  ): RoomState {
    return {
      ...room,
      players: room.players.map((p) =>
        p.id === playerId ? { ...p, isConnected: connected } : p,
      ),
    };
  }
}
