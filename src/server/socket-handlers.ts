import { createGame, drawCard, nextTurn } from '@/server/game-engine';
import { toPublicRoomState } from '@/shared/types';
import {
  roomCreateSchema,
  roomJoinSchema,
  roomRejoinSchema,
  tableSubscribeSchema,
  validate,
} from '@/server/schemas';
import type { AppServer, AppSocket } from '@/shared/socket-events';
import type { RoomManager } from '@/server/room-manager';

export function registerSocketHandlers(
  io: AppServer,
  rooms: RoomManager,
): void {
  io.on('connection', (socket: AppSocket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('room:create', (payload, cb) => {
      const data = validate(roomCreateSchema, payload, cb);
      if (!data) return;
      try {
        const { state, playerId, token } = rooms.createRoom(data.nick);
        socket.join(state.code);
        socket.data.playerId = playerId;
        socket.data.roomCode = state.code;
        cb({ ok: true, data: { code: state.code, playerId, token } });
        io.to(state.code).emit('room:state', toPublicRoomState(state));
      } catch (e) {
        cb({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('room:join', (payload, cb) => {
      const data = validate(roomJoinSchema, payload, cb);
      if (!data) return;
      try {
        const { state, playerId, token } = rooms.joinRoom(data.code, data.nick);
        socket.join(data.code);
        socket.data.playerId = playerId;
        socket.data.roomCode = data.code;
        cb({ ok: true, data: { playerId, token } });
        io.to(data.code).emit('room:state', toPublicRoomState(state));
      } catch (e) {
        cb({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('room:rejoin', (payload, cb) => {
      const data = validate(roomRejoinSchema, payload, cb);
      if (!data) return;
      const result = rooms.rejoin(data.token);
      if (!result) return cb({ ok: false, error: 'invalid_token' });
      const { state, playerId } = result;
      socket.join(state.code);
      socket.data.playerId = playerId;
      socket.data.roomCode = state.code;
      cb({ ok: true, data: { code: state.code, playerId } });
      io.to(state.code).emit('room:state', toPublicRoomState(state));
    });

    socket.on('room:leave', (_payload, cb) => {
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const newState = rooms.leaveRoom(playerId, roomCode);
      socket.leave(roomCode);
      socket.data.playerId = undefined;
      socket.data.roomCode = undefined;
      cb({ ok: true, data: null });
      if (newState) io.to(roomCode).emit('room:state', toPublicRoomState(newState));
    });

    socket.on('table:subscribe', (payload, cb) => {
      const data = validate(tableSubscribeSchema, payload, cb);
      if (!data) return;
      const room = rooms.getRoom(data.code);
      if (!room) return cb({ ok: false, error: 'no_room' });
      socket.join(data.code);
      cb({ ok: true, data: null });
      socket.emit('room:state', toPublicRoomState(room));
    });

    socket.on('game:start', (_payload, cb) => {
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const room = rooms.getRoom(roomCode);
      if (!room) return cb({ ok: false, error: 'no_room' });
      if (room.hostId !== playerId) return cb({ ok: false, error: 'not_host' });
      if (room.status !== 'waiting') return cb({ ok: false, error: 'already_started' });
      if (room.players.length < 2) return cb({ ok: false, error: 'not_enough_players' });

      const gameState = createGame(room.players, Math.random);
      const newState = { ...gameState, code: roomCode };
      rooms.updateRoom(roomCode, newState);
      io.to(roomCode).emit('room:state', toPublicRoomState(newState));
      cb({ ok: true, data: null });
    });

    socket.on('game:drawCard', (_payload, cb) => {
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const room = rooms.getRoom(roomCode);
      if (!room) return cb({ ok: false, error: 'no_room' });
      try {
        const { state: s1, card } = drawCard(room, playerId);
        const s2 = nextTurn(s1);
        rooms.updateRoom(roomCode, s2);
        io.to(roomCode).emit('game:card_drawn', { card, byPlayerId: playerId });
        io.to(roomCode).emit('room:state', toPublicRoomState(s2));
        if (s2.status === 'ended') {
          io.to(roomCode).emit('game:ended', { reason: 'deck_empty' });
        }
        cb({ ok: true, data: null });
      } catch (e) {
        cb({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('disconnect', () => {
      const { playerId, roomCode } = socket.data;
      if (playerId && roomCode) {
        const newState = rooms.markDisconnected(playerId, roomCode);
        if (newState) {
          io.to(roomCode).emit('room:state', toPublicRoomState(newState));
        }
      }
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });
}
