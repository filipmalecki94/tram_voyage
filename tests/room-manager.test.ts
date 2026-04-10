import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '@/server/room-manager';

describe('RoomManager', () => {
  let rooms: RoomManager;

  beforeEach(() => {
    rooms = new RoomManager();
  });

  describe('createRoom', () => {
    it('zwraca 6-znakowy kod, playerId i token', () => {
      const { state, playerId, token } = rooms.createRoom('Alice');
      expect(state.code).toHaveLength(6);
      expect(playerId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('tworzy pokój z jednym graczem i status waiting', () => {
      const { state } = rooms.createRoom('Alice');
      expect(state.players).toHaveLength(1);
      expect(state.players[0].nick).toBe('Alice');
      expect(state.status).toBe('waiting');
      expect(state.hostId).toBe(state.players[0].id);
    });

    it('dwa createRoom dają różne kody', () => {
      const { state: s1 } = rooms.createRoom('Alice');
      const { state: s2 } = rooms.createRoom('Bob');
      expect(s1.code).not.toBe(s2.code);
    });
  });

  describe('joinRoom', () => {
    it('rzuca no_room dla nieistniejącego kodu', () => {
      expect(() => rooms.joinRoom('XXXXXX', 'Bob')).toThrow('no_room');
    });

    it('dodaje gracza do pokoju', () => {
      const { state } = rooms.createRoom('Alice');
      const { state: updated } = rooms.joinRoom(state.code, 'Bob');
      expect(updated.players).toHaveLength(2);
      expect(updated.players[1].nick).toBe('Bob');
    });

    it('rzuca room_full po osiągnięciu 12 graczy', () => {
      const { state } = rooms.createRoom('Host');
      for (let i = 1; i < 12; i++) {
        rooms.joinRoom(state.code, `Gracz${i}`);
      }
      expect(() => rooms.joinRoom(state.code, 'Extra')).toThrow('room_full');
    });
  });

  describe('rejoin', () => {
    it('zwraca tego samego gracza po ważnym tokenie', () => {
      const { state, playerId, token } = rooms.createRoom('Alice');
      const result = rooms.rejoin(token);
      expect(result).not.toBeNull();
      expect(result?.playerId).toBe(playerId);
      expect(result?.state.code).toBe(state.code);
    });

    it('zwraca null dla nieprawidłowego tokenu', () => {
      expect(
        rooms.rejoin('00000000-0000-0000-0000-000000000000'),
      ).toBeNull();
    });
  });

  describe('markDisconnected', () => {
    it('ustawia isConnected=false, nie usuwa gracza', () => {
      const { state, playerId } = rooms.createRoom('Alice');
      rooms.markDisconnected(playerId, state.code);
      const room = rooms.getRoom(state.code);
      expect(room?.players).toHaveLength(1);
      expect(room?.players[0].isConnected).toBe(false);
    });
  });

  describe('leaveRoom', () => {
    it('usuwa gracza z pokoju', () => {
      const { state, playerId } = rooms.createRoom('Alice');
      rooms.joinRoom(state.code, 'Bob');
      rooms.leaveRoom(playerId, state.code);
      const room = rooms.getRoom(state.code);
      expect(room?.players).toHaveLength(1);
      expect(room?.players[0].nick).toBe('Bob');
    });

    it('usuwa pokój gdy ostatni gracz wychodzi', () => {
      const { state, playerId } = rooms.createRoom('Alice');
      rooms.leaveRoom(playerId, state.code);
      expect(rooms.getRoom(state.code)).toBeUndefined();
    });

    it('przenosi hosta gdy host wychodzi', () => {
      const { state, playerId } = rooms.createRoom('Alice');
      const { playerId: bobId } = rooms.joinRoom(state.code, 'Bob');
      rooms.leaveRoom(playerId, state.code);
      const room = rooms.getRoom(state.code);
      expect(room?.hostId).toBe(bobId);
    });
  });

  describe('cleanupStale', () => {
    it('usuwa pokoje starsze niż 2h', () => {
      const { state } = rooms.createRoom('Alice');
      const TWO_HOURS_PLUS_MS = 2 * 60 * 60_000 + 1;
      rooms.cleanupStale(Date.now() + TWO_HOURS_PLUS_MS);
      expect(rooms.getRoom(state.code)).toBeUndefined();
    });

    it('nie usuwa świeżych pokoi', () => {
      const { state } = rooms.createRoom('Alice');
      rooms.cleanupStale(Date.now() + 60_000); // tylko +1min
      expect(rooms.getRoom(state.code)).toBeDefined();
    });
  });
});
