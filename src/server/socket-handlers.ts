import {
  createGame,
  startCollecting,
  collectingGuess,
  pyramidNext,
  pyramidAssignSips,
  tramGuess,
  confirmDrink,
  type CollectingGuess,
} from '@/server/game-engine';
import { toPublicRoomState } from '@/shared/types';
import {
  roomCreateSchema,
  roomJoinSchema,
  roomRejoinSchema,
  tableSubscribeSchema,
  collectingGuessSchema,
  pyramidAssignSchema,
  pyramidNextSchema,
  tramGuessSchema,
  confirmDrinkSchema,
  validate,
} from '@/server/schemas';
import type { AppServer, AppSocket } from '@/shared/socket-events';
import type { RoomManager } from '@/server/room-manager';

/** Mapuje answer (string) z eventu na typowany CollectingGuess */
function parseCollectingGuess(answer: string): CollectingGuess | null {
  switch (answer) {
    case 'black': return { kind: 'color', value: 'black' };
    case 'red': return { kind: 'color', value: 'red' };
    case 'higher': return { kind: 'hiLo', value: 'higher' };
    case 'lower': return { kind: 'hiLo', value: 'lower' };
    case 'inside': return { kind: 'inOut', value: 'inside' };
    case 'outside': return { kind: 'inOut', value: 'outside' };
    case 'spades': return { kind: 'suit', value: 'spades' };
    case 'clubs': return { kind: 'suit', value: 'clubs' };
    case 'diamonds': return { kind: 'suit', value: 'diamonds' };
    case 'hearts': return { kind: 'suit', value: 'hearts' };
    default: return null;
  }
}

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

      const gameBase = createGame(room.players, Math.random);
      const newState = startCollecting({ ...gameBase, code: roomCode }, Math.random);
      rooms.updateRoom(roomCode, newState);
      io.to(roomCode).emit('room:state', toPublicRoomState(newState));
      cb({ ok: true, data: null });
    });

    socket.on('game:collectingGuess', (payload, cb) => {
      const data = validate(collectingGuessSchema, payload, cb);
      if (!data) return;
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const room = rooms.getRoom(roomCode);
      if (!room) return cb({ ok: false, error: 'no_room' });
      if (room.gamePhase !== 'collecting') return cb({ ok: false, error: 'wrong_phase' });

      const guess = parseCollectingGuess(data.answer);
      if (!guess) return cb({ ok: false, error: 'invalid_answer' });

      try {
        const result = collectingGuess(room, playerId, guess, Math.random);
        rooms.updateRoom(roomCode, result.state);
        io.to(roomCode).emit('game:card_drawn', { card: result.card, byPlayerId: playerId });
        if (result.rainbowTriggered) {
          io.to(roomCode).emit('game:rainbow', { byPlayerId: playerId });
        }
        io.to(roomCode).emit('room:state', toPublicRoomState(result.state));
        if (result.state.gamePhase === 'ended' || result.state.status === 'ended') {
          io.to(roomCode).emit('game:ended', {
            reason: 'game_complete',
            winnerId: result.state.winnerId ?? undefined,
          });
        }
        cb({ ok: true, data: null });
      } catch (e) {
        cb({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('game:pyramidAssign', (payload, cb) => {
      const data = validate(pyramidAssignSchema, payload, cb);
      if (!data) return;
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const room = rooms.getRoom(roomCode);
      if (!room) return cb({ ok: false, error: 'no_room' });
      if (room.gamePhase !== 'pyramid') return cb({ ok: false, error: 'wrong_phase' });

      try {
        const result = pyramidAssignSips(room, playerId, data.toPlayerId);
        rooms.updateRoom(roomCode, result.state);
        io.to(roomCode).emit('room:state', toPublicRoomState(result.state));
        cb({ ok: true, data: null });
      } catch (e) {
        cb({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('game:pyramidNext', (payload, cb) => {
      const data = validate(pyramidNextSchema, payload, cb);
      if (!data && data !== null) return;
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const room = rooms.getRoom(roomCode);
      if (!room) return cb({ ok: false, error: 'no_room' });
      if (room.hostId !== playerId) return cb({ ok: false, error: 'not_host' });
      if (room.gamePhase !== 'pyramid') return cb({ ok: false, error: 'wrong_phase' });

      try {
        const result = pyramidNext(room, Math.random);
        rooms.updateRoom(roomCode, result.state);
        io.to(roomCode).emit('room:state', toPublicRoomState(result.state));
        if (result.state.gamePhase === 'ended' || result.state.status === 'ended') {
          io.to(roomCode).emit('game:ended', {
            reason: 'game_complete',
            winnerId: result.state.winnerId ?? undefined,
          });
        }
        cb({ ok: true, data: null });
      } catch (e) {
        cb({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('game:tramGuess', (payload, cb) => {
      const data = validate(tramGuessSchema, payload, cb);
      if (!data) return;
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const room = rooms.getRoom(roomCode);
      if (!room) return cb({ ok: false, error: 'no_room' });
      if (room.gamePhase !== 'tram') return cb({ ok: false, error: 'wrong_phase' });

      try {
        const result = tramGuess(room, playerId, data.answer, Math.random);
        rooms.updateRoom(roomCode, result.state);
        io.to(roomCode).emit('game:card_drawn', { card: result.card, byPlayerId: playerId });
        io.to(roomCode).emit('room:state', toPublicRoomState(result.state));
        if (result.state.gamePhase === 'ended' || result.state.status === 'ended') {
          io.to(roomCode).emit('game:ended', {
            reason: 'tram_complete',
            winnerId: result.state.winnerId ?? undefined,
          });
        }
        cb({ ok: true, data: null });
      } catch (e) {
        cb({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('game:confirmDrink', (payload, cb) => {
      const data = validate(confirmDrinkSchema, payload, cb);
      if (data === null) return;
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return cb({ ok: false, error: 'not_in_room' });
      const room = rooms.getRoom(roomCode);
      if (!room) return cb({ ok: false, error: 'no_room' });
      if (!room.drinkGate) return cb({ ok: false, error: 'no_drink_gate' });

      try {
        const newState = confirmDrink(room, playerId, Math.random);
        rooms.updateRoom(roomCode, newState);
        io.to(roomCode).emit('room:state', toPublicRoomState(newState));
        if (newState.gamePhase === 'ended' || newState.status === 'ended') {
          io.to(roomCode).emit('game:ended', {
            reason: 'game_complete',
            winnerId: newState.winnerId ?? undefined,
          });
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
