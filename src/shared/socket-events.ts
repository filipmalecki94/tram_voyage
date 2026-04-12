import type { PublicRoomState, Card } from '@/shared/types';
import type { Server, Socket } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ClientToServerEvents {
  'room:create': (
    payload: { nick: string },
    cb: (res: Result<{ code: string; playerId: string; token: string }>) => void,
  ) => void;
  'room:join': (
    payload: { code: string; nick: string },
    cb: (res: Result<{ playerId: string; token: string }>) => void,
  ) => void;
  'room:rejoin': (
    payload: { token: string },
    cb: (res: Result<{ code: string; playerId: string }>) => void,
  ) => void;
  'room:leave': (
    payload: Record<string, never>,
    cb: (res: Result<null>) => void,
  ) => void;
  'table:subscribe': (
    payload: { code: string },
    cb: (res: Result<null>) => void,
  ) => void;
  'game:start': (
    payload: Record<string, never>,
    cb: (res: Result<null>) => void,
  ) => void;
  'game:collectingGuess': (
    payload: { answer: string },
    cb: (res: Result<null>) => void,
  ) => void;
  'game:collectingConfirm': (
    payload: Record<string, never>,
    cb: (res: Result<null>) => void,
  ) => void;
  'game:pyramidAssign': (
    payload: { toPlayerId: string; sips: number },
    cb: (res: Result<null>) => void,
  ) => void;
  'game:pyramidNext': (
    payload: Record<string, never>,
    cb: (res: Result<null>) => void,
  ) => void;
  'game:tramGuess': (
    payload: { answer: 'higher' | 'lower' | 'reference' },
    cb: (res: Result<null>) => void,
  ) => void;
  'game:confirmDrink': (
    payload: Record<string, never>,
    cb: (res: Result<null>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: PublicRoomState) => void;
  'game:card_drawn': (data: { card: Card; byPlayerId: string }) => void;
  'game:ended': (data: { reason: string; winnerId?: string }) => void;
  'game:rainbow': (data: { byPlayerId: string }) => void;
  'error': (data: { message: string }) => void;
}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
