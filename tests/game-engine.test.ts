import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffle,
  createGame,
  drawCard,
  nextTurn,
  isGameOver,
} from '@/server/game-engine';
import type { Player } from '@/shared/types';

// Prosty LCG — deterministyczny RNG do testów
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

const makePlayers = (count: number): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nick: `Gracz${i + 1}`,
    joinedAt: 1000 + i,
    sips: 0,
    isConnected: true,
  }));

describe('createDeck', () => {
  it('zwraca 52 karty', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('wszystkie karty są unikalne', () => {
    const deck = createDeck();
    const keys = deck.map((c) => `${c.suit}-${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });
});

describe('shuffle', () => {
  it('deterministyczne przy tym samym seedzie', () => {
    const deck = createDeck();
    const a = shuffle(deck, seededRng(42));
    const b = shuffle(deck, seededRng(42));
    expect(a.map((c) => `${c.suit}-${c.rank}`)).toEqual(
      b.map((c) => `${c.suit}-${c.rank}`),
    );
  });

  it('różne wyniki przy różnych seedach', () => {
    const deck = createDeck();
    const a = shuffle(deck, seededRng(1));
    const b = shuffle(deck, seededRng(2));
    expect(a.map((c) => `${c.suit}-${c.rank}`)).not.toEqual(
      b.map((c) => `${c.suit}-${c.rank}`),
    );
  });

  it('nie mutuje oryginalnej tablicy', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffle(deck, seededRng(99));
    expect(deck.map((c) => `${c.suit}-${c.rank}`)).toEqual(
      original.map((c) => `${c.suit}-${c.rank}`),
    );
  });
});

describe('createGame', () => {
  it('rzuca przy mniej niż 2 graczach', () => {
    expect(() => createGame(makePlayers(1), seededRng(1))).toThrow();
  });

  it('zwraca stan z status playing i pełną talią', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    expect(state.status).toBe('playing');
    expect(state.deck).toHaveLength(52);
  });

  it('ustawia turę pierwszego gracza', () => {
    const players = makePlayers(3);
    const state = createGame(players, seededRng(1));
    expect(state.currentTurnPlayerId).toBe(players[0].id);
  });

  it('hostId to pierwszy gracz', () => {
    const players = makePlayers(2);
    const state = createGame(players, seededRng(1));
    expect(state.hostId).toBe(players[0].id);
  });

  it('inicjalizuje pustą tablicę drawnCards', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    expect(state.drawnCards).toEqual([]);
  });
});

describe('drawCard', () => {
  it('rzuca gdy nie tura tego gracza', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    expect(() => drawCard(state, 'p2')).toThrow('Nie twoja tura');
  });

  it('rzuca gdy gra nie jest w toku', () => {
    const state = { ...createGame(makePlayers(2), seededRng(1)), status: 'ended' as const };
    expect(() => drawCard(state, 'p1')).toThrow('Gra nie jest w toku');
  });

  it('zmniejsza talię o 1', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    const { state: after } = drawCard(state, 'p1');
    expect(after.deck).toHaveLength(51);
  });

  it('dopisuje kartę do drawnCards', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    const { state: after, card } = drawCard(state, 'p1');
    expect(after.drawnCards).toHaveLength(1);
    expect(after.drawnCards[0]).toEqual(card);
  });

  it('zwraca tę samą kartę co top talii', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    const topCard = state.deck[0];
    const { card } = drawCard(state, 'p1');
    expect(card).toEqual(topCard);
  });
});

describe('nextTurn', () => {
  it('cyklicznie przechodzi po graczach (3 graczy)', () => {
    const state = createGame(makePlayers(3), seededRng(1));
    // tura: p1 → p2 → p3 → p1
    const s1 = nextTurn(state);
    expect(s1.currentTurnPlayerId).toBe('p2');
    const s2 = nextTurn(s1);
    expect(s2.currentTurnPlayerId).toBe('p3');
    const s3 = nextTurn(s2);
    expect(s3.currentTurnPlayerId).toBe('p1');
  });

  it('kończy grę gdy talia pusta', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    const emptyState = { ...state, deck: [] };
    const after = nextTurn(emptyState);
    expect(after.status).toBe('ended');
    expect(after.currentTurnPlayerId).toBeNull();
  });
});

describe('isGameOver', () => {
  it('false gdy talia niepusta i status playing', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    expect(isGameOver(state)).toBe(false);
  });

  it('true gdy talia pusta', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    expect(isGameOver({ ...state, deck: [] })).toBe(true);
  });

  it('true gdy status ended', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    expect(isGameOver({ ...state, status: 'ended' })).toBe(true);
  });
});
