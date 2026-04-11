import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffle,
  createGame,
  compareRank,
  startCollecting,
  collectingGuess,
  isRainbowAvailable,
  missingSuit,
  enterPyramid,
  pyramidNext,
  pyramidAssignSips,
  pickTramPlayer,
  enterTram,
  tramGuess,
  confirmDrink,
  type CollectingGuess,
} from '@/server/game-engine';
import type { Card, Player, RoomState } from '@/shared/types';

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
    hand: [],
  }));

function makeCard(rank: Card['rank'], suit: Card['suit'] = 'spades'): Card {
  return { rank, suit };
}

// ----------------------------------------------------------------
// createDeck
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// shuffle
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// compareRank
// ----------------------------------------------------------------
describe('compareRank', () => {
  it('2 < 3', () => expect(compareRank(2, 3)).toBe(-1));
  it('A > K', () => expect(compareRank('A', 'K')).toBe(1));
  it('J === J', () => expect(compareRank('J', 'J')).toBe(0));
  it('10 < J', () => expect(compareRank(10, 'J')).toBe(-1));
});

// ----------------------------------------------------------------
// createGame
// ----------------------------------------------------------------
describe('createGame', () => {
  it('rzuca przy mniej niż 2 graczach', () => {
    expect(() => createGame(makePlayers(1), seededRng(1))).toThrow();
  });

  it('zwraca stan z status playing i pełną talią', () => {
    const state = createGame(makePlayers(2), seededRng(1));
    expect(state.status).toBe('playing');
    expect(state.deck).toHaveLength(52);
  });
});

// ----------------------------------------------------------------
// startCollecting
// ----------------------------------------------------------------
describe('startCollecting', () => {
  it('ustawia gamePhase collecting, round=1, idx=0', () => {
    const base = createGame(makePlayers(3), seededRng(1));
    const state = startCollecting(base, seededRng(2));
    expect(state.gamePhase).toBe('collecting');
    expect(state.collecting).toEqual({ round: 1, currentPlayerIdx: 0 });
  });

  it('czyści ręce i sips graczy', () => {
    const players = makePlayers(2).map((p) => ({ ...p, hand: [makeCard(5)], sips: 3 }));
    const base = createGame(players, seededRng(1));
    const state = startCollecting(base, seededRng(1));
    expect(state.players.every((p) => p.hand.length === 0)).toBe(true);
    expect(state.players.every((p) => p.sips === 0)).toBe(true);
  });

  it('nowa potasowana talia 52 kart', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const state = startCollecting(base, seededRng(1));
    expect(state.deck).toHaveLength(52);
  });
});

// ----------------------------------------------------------------
// isRainbowAvailable / missingSuit
// ----------------------------------------------------------------
describe('isRainbowAvailable', () => {
  it('false gdy mniej niż 3 karty', () => {
    expect(isRainbowAvailable([makeCard(5, 'hearts'), makeCard(7, 'spades')])).toBe(false);
  });

  it('false gdy 3 karty ale dwa te same symbole', () => {
    expect(
      isRainbowAvailable([
        makeCard(5, 'hearts'),
        makeCard(7, 'hearts'),
        makeCard(9, 'spades'),
      ]),
    ).toBe(false);
  });

  it('true gdy 3 karty 3 różne symbole', () => {
    expect(
      isRainbowAvailable([
        makeCard(5, 'hearts'),
        makeCard(7, 'spades'),
        makeCard(9, 'clubs'),
      ]),
    ).toBe(true);
  });
});

describe('missingSuit', () => {
  it('zwraca brakujący symbol', () => {
    const hand: Card[] = [
      makeCard(5, 'hearts'),
      makeCard(7, 'spades'),
      makeCard(9, 'clubs'),
    ];
    expect(missingSuit(hand)).toBe('diamonds');
  });

  it('zwraca null gdy nie spełnia warunku tęczy', () => {
    expect(missingSuit([makeCard(5, 'hearts'), makeCard(7, 'spades')])).toBeNull();
  });
});

// ----------------------------------------------------------------
// collectingGuess — Runda 1 (kolor)
// ----------------------------------------------------------------
describe('collectingGuess — Runda 1', () => {
  function stateR1WithTopCard(topCard: Card): RoomState {
    const base = createGame(makePlayers(2), seededRng(1));
    const started = startCollecting(base, seededRng(1));
    // Podmieniamy deck żeby top był znany
    return {
      ...started,
      deck: [topCard, ...started.deck.slice(1)],
    };
  }

  it('trafienie czarnej — gracz nie pije, karta w ręce', () => {
    const state = stateR1WithTopCard(makeCard(7, 'spades')); // czarna
    const guess: CollectingGuess = { kind: 'color', value: 'black' };
    const result = collectingGuess(state, 'p1', guess, seededRng(1));
    expect(result.correct).toBe(true);
    expect(result.sipsAwarded).toBe(0);
    const p1 = result.state.players.find((p) => p.id === 'p1')!;
    expect(p1.hand).toHaveLength(1);
    expect(p1.sips).toBe(0);
  });

  it('pudło — gracz pije 1, karta trafia do ręki', () => {
    const state = stateR1WithTopCard(makeCard(7, 'hearts')); // czerwona
    const guess: CollectingGuess = { kind: 'color', value: 'black' };
    const result = collectingGuess(state, 'p1', guess, seededRng(1));
    expect(result.correct).toBe(false);
    expect(result.sipsAwarded).toBe(1);
    const p1 = result.state.players.find((p) => p.id === 'p1')!;
    expect(p1.hand).toHaveLength(1);
    // Sipsy trafiają do gracza dopiero po confirmDrink
    expect(p1.sips).toBe(0);
    expect(result.state.drinkGate).not.toBeNull();
    expect(result.state.drinkGate!.entries[0].playerId).toBe('p1');
    expect(result.state.drinkGate!.entries[0].sips).toBe(1);
    expect(result.state.drinkGate!.resumeAction).toBe('collecting-next');
  });
});

// ----------------------------------------------------------------
// collectingGuess — Runda 2 (wyżej/niżej)
// ----------------------------------------------------------------
describe('collectingGuess — Runda 2', () => {
  function stateR2(hand0: Card, topCard: Card): RoomState {
    const base = createGame(makePlayers(2), seededRng(1));
    const state = startCollecting(base, () => 0);
    // Ustawiamy p1 z jedną kartą w ręce (symulacja po R1) i p2 bez
    const players = state.players.map((p) =>
      p.id === 'p1' ? { ...p, hand: [hand0] } : p,
    );
    return {
      ...state,
      deck: [topCard, ...createDeck().slice(2)],
      players,
      collecting: { round: 2, currentPlayerIdx: 0 },
    };
  }

  it('wyżej — trafienie', () => {
    const s = stateR2(makeCard(5, 'hearts'), makeCard(9, 'spades'));
    const r = collectingGuess(s, 'p1', { kind: 'hiLo', value: 'higher' }, seededRng(1));
    expect(r.correct).toBe(true);
  });

  it('niżej — trafienie', () => {
    const s = stateR2(makeCard(9, 'hearts'), makeCard(3, 'spades'));
    const r = collectingGuess(s, 'p1', { kind: 'hiLo', value: 'lower' }, seededRng(1));
    expect(r.correct).toBe(true);
  });

  it('remis rang = błąd', () => {
    const s = stateR2(makeCard(7, 'hearts'), makeCard(7, 'spades'));
    const r = collectingGuess(s, 'p1', { kind: 'hiLo', value: 'higher' }, seededRng(1));
    expect(r.correct).toBe(false);
    expect(r.sipsAwarded).toBe(1);
  });
});

// ----------------------------------------------------------------
// collectingGuess — Runda 3 (pomiędzy/poza)
// ----------------------------------------------------------------
describe('collectingGuess — Runda 3', () => {
  function stateR3(hand: [Card, Card], topCard: Card): RoomState {
    const base = createGame(makePlayers(2), seededRng(1));
    const state = startCollecting(base, () => 0);
    const players = state.players.map((p) =>
      p.id === 'p1' ? { ...p, hand: [...hand] } : p,
    );
    return {
      ...state,
      deck: [topCard, ...createDeck().slice(3)],
      players,
      collecting: { round: 3, currentPlayerIdx: 0 },
    };
  }

  it('pomiędzy (ścisłe) — trafienie', () => {
    const s = stateR3([makeCard(3), makeCard(9)], makeCard(6));
    const r = collectingGuess(s, 'p1', { kind: 'inOut', value: 'inside' }, seededRng(1));
    expect(r.correct).toBe(true);
  });

  it('poza — trafienie', () => {
    const s = stateR3([makeCard(3), makeCard(9)], makeCard('K'));
    const r = collectingGuess(s, 'p1', { kind: 'inOut', value: 'outside' }, seededRng(1));
    expect(r.correct).toBe(true);
  });

  it('karta na granicy zakresu = poza', () => {
    const s = stateR3([makeCard(3), makeCard(9)], makeCard(9)); // ranga = górna granica
    const rIn = collectingGuess(s, 'p1', { kind: 'inOut', value: 'inside' }, seededRng(1));
    expect(rIn.correct).toBe(false);
    const s2 = stateR3([makeCard(3), makeCard(9)], makeCard(9));
    const rOut = collectingGuess(s2, 'p1', { kind: 'inOut', value: 'outside' }, seededRng(1));
    expect(rOut.correct).toBe(true);
  });

  it('edge case: obie karty tej samej rangi — tylko "poza" poprawne', () => {
    const s = stateR3([makeCard(7), makeCard(7)], makeCard(7));
    const rIn = collectingGuess(s, 'p1', { kind: 'inOut', value: 'inside' }, seededRng(1));
    expect(rIn.correct).toBe(false);
    const s2 = stateR3([makeCard(7), makeCard(7)], makeCard(7));
    const rOut = collectingGuess(s2, 'p1', { kind: 'inOut', value: 'outside' }, seededRng(1));
    expect(rOut.correct).toBe(true);
  });
});

// ----------------------------------------------------------------
// collectingGuess — Runda 4 (symbol + tęcza)
// ----------------------------------------------------------------
describe('collectingGuess — Runda 4 (symbol + tęcza)', () => {
  function stateR4(hand: [Card, Card, Card], topCard: Card): RoomState {
    const base = createGame(makePlayers(2), seededRng(1));
    const state = startCollecting(base, () => 0);
    const players = state.players.map((p) =>
      p.id === 'p1' ? { ...p, hand: [...hand] } : p,
    );
    return {
      ...state,
      deck: [topCard, ...createDeck().slice(4)],
      players,
      collecting: { round: 4, currentPlayerIdx: 0 },
    };
  }

  it('trafienie symbolu — nikt nie pije', () => {
    // Ręka z 2 symbolami (nie kwalifikuje się do tęczy)
    const s = stateR4(
      [makeCard(3, 'hearts'), makeCard(5, 'hearts'), makeCard(7, 'clubs')],
      makeCard('K', 'spades'),
    );
    const r = collectingGuess(s, 'p1', { kind: 'suit', value: 'spades' }, seededRng(1));
    expect(r.correct).toBe(true);
    expect(r.rainbowTriggered).toBe(false);
    expect(r.sipsAwarded).toBe(0);
  });

  it('pudło symbolu — gracz pije 1', () => {
    const s = stateR4(
      [makeCard(3, 'hearts'), makeCard(5, 'spades'), makeCard(7, 'clubs')],
      makeCard('K', 'diamonds'),
    );
    const r = collectingGuess(s, 'p1', { kind: 'suit', value: 'hearts' }, seededRng(1));
    expect(r.correct).toBe(false);
    expect(r.sipsAwarded).toBe(1);
  });

  it('tęcza — wybór brakującego symbolu i trafienie → wszyscy inni piją', () => {
    // hand: hearts, spades, clubs → brakuje diamonds
    const hand: [Card, Card, Card] = [
      makeCard(3, 'hearts'),
      makeCard(5, 'spades'),
      makeCard(7, 'clubs'),
    ];
    const s = stateR4(hand, makeCard('K', 'diamonds'));
    const r = collectingGuess(s, 'p1', { kind: 'suit', value: 'diamonds' }, seededRng(1));
    expect(r.correct).toBe(true);
    expect(r.rainbowTriggered).toBe(true);
    // p1 nie pije, p2 pije 1 — ale sipsy dopiero po confirmDrink
    const p1 = r.state.players.find((p) => p.id === 'p1')!;
    const p2 = r.state.players.find((p) => p.id === 'p2')!;
    expect(p1.sips).toBe(0);
    expect(p2.sips).toBe(0);
    expect(r.state.drinkGate).not.toBeNull();
    const gateEntryP2 = r.state.drinkGate!.entries.find((e) => e.playerId === 'p2');
    expect(gateEntryP2).toBeDefined();
    expect(gateEntryP2!.sips).toBe(1);
    expect(r.state.drinkGate!.resumeAction).toBe('collecting-next');
  });

  it('tęcza — wybór tęczowego symbolu ale pudło → tylko gracz pije', () => {
    // hand: hearts, spades, clubs → brakuje diamonds; ale karta to hearts
    const hand: [Card, Card, Card] = [
      makeCard(3, 'hearts'),
      makeCard(5, 'spades'),
      makeCard(7, 'clubs'),
    ];
    const s = stateR4(hand, makeCard('K', 'hearts'));
    const r = collectingGuess(s, 'p1', { kind: 'suit', value: 'diamonds' }, seededRng(1));
    expect(r.correct).toBe(false);
    expect(r.rainbowTriggered).toBe(false);
    const p1 = r.state.players.find((p) => p.id === 'p1')!;
    const p2 = r.state.players.find((p) => p.id === 'p2')!;
    // Sipsy trafiają po confirmDrink
    expect(p1.sips).toBe(0);
    expect(p2.sips).toBe(0);
    expect(r.state.drinkGate).not.toBeNull();
    expect(r.state.drinkGate!.entries[0].playerId).toBe('p1');
    expect(r.state.drinkGate!.entries[0].sips).toBe(1);
  });
});

// ----------------------------------------------------------------
// Przejście Etap 1 → Etap 2 (pełny flow 2 graczy, 8 guess)
// ----------------------------------------------------------------
describe('przejście collecting → pyramid po R4 ostatniego gracza', () => {
  it('gamePhase=pyramid po 8 poprawnych zgadywaniach (2 gracze)', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    let state = startCollecting(base, seededRng(1));

    // 4 rundy × 2 graczy = 8 guess; używamy koloru żeby przejść prostą ścieżkę
    for (let round = 1; round <= 4; round++) {
      for (let gi = 0; gi < 2; gi++) {
        const col = state.collecting!;
        const player = state.players[col.currentPlayerIdx];
        let guess: CollectingGuess;
        const topCard = state.deck[0];
        switch (round) {
          case 1:
            guess = {
              kind: 'color',
              value:
                topCard.suit === 'spades' || topCard.suit === 'clubs' ? 'black' : 'red',
            };
            break;
          case 2: {
            const hand0 = player.hand[0];
            const cmp =
              ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(String(topCard.rank)) -
              ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(String(hand0.rank));
            guess = { kind: 'hiLo', value: cmp >= 0 ? 'higher' : 'lower' };
            break;
          }
          case 3: {
            const r0i = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(String(player.hand[0].rank));
            const r1i = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(String(player.hand[1].rank));
            const rdi = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(String(topCard.rank));
            const lo = Math.min(r0i, r1i); const hi = Math.max(r0i, r1i);
            guess = { kind: 'inOut', value: (lo !== hi && rdi > lo && rdi < hi) ? 'inside' : 'outside' };
            break;
          }
          default:
            guess = { kind: 'suit', value: topCard.suit };
        }
        const result = collectingGuess(state, player.id, guess, seededRng(round * 10 + gi));
        state = result.state;
        if (state.gamePhase === 'pyramid') break;
      }
      if (state.gamePhase === 'pyramid') break;
    }

    expect(state.gamePhase).toBe('pyramid');
    expect(state.collecting).toBeNull();
    expect(state.pyramid).not.toBeNull();
  });
});

// ----------------------------------------------------------------
// enterPyramid
// ----------------------------------------------------------------
describe('enterPyramid', () => {
  it('layout ma 4 poziomy z 1/2/3/4 kartami', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const state = startCollecting(base, seededRng(1));
    const py = enterPyramid(state);
    expect(py.pyramid!.layout).toHaveLength(4);
    expect(py.pyramid!.layout[0]).toHaveLength(1);
    expect(py.pyramid!.layout[1]).toHaveLength(2);
    expect(py.pyramid!.layout[2]).toHaveLength(3);
    expect(py.pyramid!.layout[3]).toHaveLength(4);
  });

  it('deck zmniejsza się o 10', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const state = startCollecting(base, seededRng(1));
    const deckBefore = state.deck.length;
    const py = enterPyramid(state);
    expect(py.deck.length).toBe(deckBefore - 10);
  });
});

// ----------------------------------------------------------------
// pyramidAssignSips
// ----------------------------------------------------------------
describe('pyramidAssignSips', () => {
  function pyramidStateWithCurrentCard(): RoomState {
    const base = createGame(makePlayers(3), seededRng(1));
    const collecting = startCollecting(base, seededRng(1));
    // Daj p1 kartę o randze 7
    const p1Card: Card = { rank: 7, suit: 'hearts' };
    const players = collecting.players.map((p) =>
      p.id === 'p1' ? { ...p, hand: [p1Card] } : p,
    );
    const pyState = enterPyramid({ ...collecting, players });
    // Ustaw currentCard na kartę o tej samej randze (7) — ręcznie
    const fakeCurrentCard: Card = { rank: 7, suit: 'spades' };
    // Wstaw ją do layout[0][0] i oznacz jako odkrytą
    const layout = [[fakeCurrentCard], ...pyState.pyramid!.layout.slice(1)];
    return {
      ...pyState,
      pyramid: {
        ...pyState.pyramid!,
        layout,
        currentCard: fakeCurrentCard,
        revealedLevels: 0,
        revealedInLevel: 1,
      },
    };
  }

  it('dodaje N łyków graczowi (N = poziom 1)', () => {
    const state = pyramidStateWithCurrentCard();
    const result = pyramidAssignSips(state, 'p1', 'p2', 1);
    expect(result.sipsAwarded).toBe(1);
    // Sipsy trafiają do gracza dopiero po confirmDrink
    const p2 = result.state.players.find((p) => p.id === 'p2')!;
    expect(p2.sips).toBe(0);
    expect(result.state.drinkGate).not.toBeNull();
    expect(result.state.drinkGate!.entries[0].playerId).toBe('p2');
    expect(result.state.drinkGate!.entries[0].sips).toBe(1);
    expect(result.state.drinkGate!.resumeAction).toBe('pyramid-next');
  });

  it('usuwa kartę z ręki gracza przypisującego', () => {
    const state = pyramidStateWithCurrentCard();
    const result = pyramidAssignSips(state, 'p1', 'p2', 1);
    const p1 = result.state.players.find((p) => p.id === 'p1')!;
    expect(p1.hand).toHaveLength(0);
  });

  it('rzuca gdy brak pasującej rangi w ręce', () => {
    const state = pyramidStateWithCurrentCard();
    // p2 nie ma żadnej karty
    expect(() => pyramidAssignSips(state, 'p2', 'p3', 1)).toThrow();
  });

  it('rzuca gdy from === to', () => {
    const state = pyramidStateWithCurrentCard();
    expect(() => pyramidAssignSips(state, 'p1', 'p1', 1)).toThrow();
  });
});

// ----------------------------------------------------------------
// pyramidNext
// ----------------------------------------------------------------
describe('pyramidNext', () => {
  it('odsłania kartę i ustawia currentCard', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const collecting = startCollecting(base, seededRng(1));
    const py = enterPyramid(collecting);
    const result = pyramidNext(py, seededRng(1));
    expect(result.card).toBeDefined();
    expect(result.state.pyramid!.currentCard).toEqual(result.card);
  });

  it('po 10 odsłonięciach przechodzi do gamePhase=tram', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const collecting = startCollecting(base, seededRng(1));
    let state = enterPyramid(collecting);
    for (let i = 0; i < 10; i++) {
      const r = pyramidNext(state, seededRng(i + 1));
      state = r.state;
    }
    expect(state.gamePhase).toBe('tram');
    expect(state.tram).not.toBeNull();
    expect(state.tram!.streak).toBe(0);
    expect(state.tram!.lastCard).toBeNull();
  });
});

// ----------------------------------------------------------------
// pickTramPlayer
// ----------------------------------------------------------------
describe('pickTramPlayer', () => {
  it('wybiera gracza z największą ręką', () => {
    const players: Player[] = [
      { ...makePlayers(3)[0], hand: [makeCard(5)] },
      { ...makePlayers(3)[1], id: 'p2', hand: [makeCard(5), makeCard(7)] },
      { ...makePlayers(3)[2], id: 'p3', hand: [] },
    ];
    const base = createGame(makePlayers(3), seededRng(1));
    const state = { ...base, players };
    expect(pickTramPlayer(state, seededRng(1))).toBe('p2');
  });

  it('tiebreaker: przy remisie liczby kart — przegrywa ten z niższą najwyższą kartą', () => {
    // p1: [Q], p2: [5] → p2 ma niższą najwyższą → jedzie tramwajem
    const players: Player[] = [
      { ...makePlayers(2)[0], hand: [makeCard('Q', 'hearts')] },
      { ...makePlayers(2)[1], id: 'p2', hand: [makeCard(5, 'spades')] },
    ];
    const base = createGame(makePlayers(2), seededRng(1));
    const state = { ...base, players };
    expect(pickTramPlayer(state, seededRng(1))).toBe('p2');
  });

  it('tiebreaker dalszy: jeśli pierwsza karta remis — porównuje drugą', () => {
    // p1: [K, 5], p2: [K, 3] → druga karta: p2 niższa → p2 jedzie
    const players: Player[] = [
      { ...makePlayers(2)[0], hand: [makeCard('K'), makeCard(5)] },
      { ...makePlayers(2)[1], id: 'p2', hand: [makeCard('K'), makeCard(3)] },
    ];
    const base = createGame(makePlayers(2), seededRng(1));
    const state = { ...base, players };
    expect(pickTramPlayer(state, seededRng(1))).toBe('p2');
  });
});

// ----------------------------------------------------------------
// tramGuess
// ----------------------------------------------------------------
describe('tramGuess', () => {
  function tramState(): RoomState {
    const base = createGame(makePlayers(2), seededRng(1));
    return enterTram(base, 'p1', seededRng(1));
  }

  it('pierwsza karta = referencyjna (bez zgadywania)', () => {
    const state = tramState();
    const r = tramGuess(state, 'p1', 'reference', seededRng(1));
    expect(r.isReference).toBe(true);
    expect(r.correct).toBe(true);
    expect(r.state.tram!.lastCard).toEqual(r.card);
    expect(r.state.tram!.streak).toBe(0);
  });

  it('trafienie — streak rośnie', () => {
    let state = tramState();
    // Ciągniemy referencyjną
    const r0 = tramGuess(state, 'p1', 'reference', seededRng(1));
    state = r0.state;
    // Wymuszamy drugą kartę wyższą — ręcznie ustawiamy deck
    const higherCard: Card = { rank: 'A', suit: 'hearts' };
    const lowerRefCard: Card = { rank: 2, suit: 'spades' };
    state = {
      ...state,
      tram: { ...state.tram!, lastCard: lowerRefCard, deck: [higherCard, ...state.tram!.deck.slice(1)] },
    };
    const r1 = tramGuess(state, 'p1', 'higher', seededRng(1));
    expect(r1.correct).toBe(true);
    expect(r1.state.tram!.streak).toBe(1);
  });

  it('pudło — gracz pije, streak resetowany, nowa talia', () => {
    let state = tramState();
    const r0 = tramGuess(state, 'p1', 'reference', seededRng(1));
    state = r0.state;
    // Wymusz pudło: karta wyżej, guess lower
    const higherCard: Card = { rank: 'A', suit: 'hearts' };
    const lowerRefCard: Card = { rank: 2, suit: 'spades' };
    state = {
      ...state,
      tram: { ...state.tram!, lastCard: lowerRefCard, deck: [higherCard, ...state.tram!.deck.slice(1)], streak: 3 },
    };
    const r1 = tramGuess(state, 'p1', 'lower', seededRng(1));
    expect(r1.correct).toBe(false);
    // Tram nie jest od razu resetowany — czekamy na confirmDrink
    expect(r1.state.drinkGate).not.toBeNull();
    expect(r1.state.drinkGate!.resumeAction).toBe('tram-restart');
    expect(r1.state.drinkGate!.context!.tramPlayerId).toBe('p1');
    // Sipsy trafiają do gracza dopiero po confirmDrink
    const p1 = r1.state.players.find((p) => p.id === 'p1')!;
    expect(p1.sips).toBe(0);
  });

  it('5-streak sukces → gamePhase=ended, winnerId ustawiony', () => {
    let state = tramState();
    const r0 = tramGuess(state, 'p1', 'reference', seededRng(1));
    state = r0.state;

    // Symulujemy 5 trafień ręcznie przez podmianę deck + lastCard
    const cards: Card[] = [
      { rank: 3, suit: 'spades' },
      { rank: 5, suit: 'hearts' },
      { rank: 7, suit: 'clubs' },
      { rank: 9, suit: 'diamonds' },
      { rank: 'J', suit: 'spades' },
    ];
    // lastCard = 2, cards rosnąco → wszystkie 'higher' poprawne
    state = {
      ...state,
      tram: { ...state.tram!, lastCard: { rank: 2, suit: 'spades' }, deck: cards, streak: 0 },
    };

    for (let i = 0; i < 5; i++) {
      const r = tramGuess(state, 'p1', 'higher', seededRng(i));
      state = r.state;
      if (state.gamePhase === 'ended') break;
    }

    expect(state.gamePhase).toBe('ended');
    expect(state.winnerId).toBe('p1');
    expect(state.status).toBe('ended');
  });

  it('remis rang w tramwaju = błąd', () => {
    let state = tramState();
    const r0 = tramGuess(state, 'p1', 'reference', seededRng(1));
    state = r0.state;
    const sameRankCard: Card = { rank: state.tram!.lastCard!.rank, suit: 'clubs' };
    state = {
      ...state,
      tram: { ...state.tram!, deck: [sameRankCard, ...state.tram!.deck.slice(1)] },
    };
    const r1 = tramGuess(state, 'p1', 'higher', seededRng(1));
    expect(r1.correct).toBe(false);
  });

  it('rzuca gdy nie jesteś tramwajarzem', () => {
    const state = tramState();
    expect(() => tramGuess(state, 'p2', 'reference', seededRng(1))).toThrow();
  });

  it('streakCards rośnie po każdym trafieniu', () => {
    let state = tramState();
    const r0 = tramGuess(state, 'p1', 'reference', seededRng(1));
    state = r0.state;
    expect(state.tram!.streakCards).toHaveLength(0);

    const cards: Card[] = [
      { rank: 5, suit: 'hearts' },
      { rank: 8, suit: 'clubs' },
      { rank: 'K', suit: 'diamonds' },
    ];
    state = {
      ...state,
      tram: { ...state.tram!, lastCard: { rank: 2, suit: 'spades' }, deck: cards, streak: 0 },
    };

    const r1 = tramGuess(state, 'p1', 'higher', seededRng(1));
    expect(r1.state.tram!.streakCards).toHaveLength(1);
    expect(r1.state.tram!.streakCards[0]).toEqual(cards[0]);

    state = r1.state;
    const r2 = tramGuess(state, 'p1', 'higher', seededRng(1));
    expect(r2.state.tram!.streakCards).toHaveLength(2);

    state = r2.state;
    const r3 = tramGuess(state, 'p1', 'higher', seededRng(1));
    expect(r3.state.tram!.streakCards).toHaveLength(3);
  });

  it('streakCards resetuje się po pudłe', () => {
    let state = tramState();
    const r0 = tramGuess(state, 'p1', 'reference', seededRng(1));
    state = r0.state;

    const cards: Card[] = [
      { rank: 5, suit: 'hearts' },
      { rank: 8, suit: 'clubs' },
      { rank: 3, suit: 'diamonds' }, // niżej — pudło przy 'higher'
    ];
    state = {
      ...state,
      tram: { ...state.tram!, lastCard: { rank: 2, suit: 'spades' }, deck: cards, streak: 0 },
    };

    const r1 = tramGuess(state, 'p1', 'higher', seededRng(1));
    state = r1.state;
    expect(state.tram!.streakCards).toHaveLength(1);

    const r2 = tramGuess(state, 'p1', 'higher', seededRng(1));
    state = r2.state;
    expect(state.tram!.streakCards).toHaveLength(2);

    // pudło — karta niżej przy guess 'higher'
    const r3 = tramGuess(state, 'p1', 'higher', seededRng(1));
    expect(r3.correct).toBe(false);
    // streakCards zachowane w drinkGate.context (nie zresetowane od razu)
    expect(r3.state.drinkGate).not.toBeNull();
    expect(r3.state.drinkGate!.context!.streakCards).toHaveLength(2);
    expect(r3.state.drinkGate!.resumeAction).toBe('tram-restart');
  });

  it('streakCards ma 5 elementów po wygranej', () => {
    let state = tramState();
    const r0 = tramGuess(state, 'p1', 'reference', seededRng(1));
    state = r0.state;

    const cards: Card[] = [
      { rank: 3, suit: 'spades' },
      { rank: 5, suit: 'hearts' },
      { rank: 7, suit: 'clubs' },
      { rank: 9, suit: 'diamonds' },
      { rank: 'J', suit: 'spades' },
    ];
    state = {
      ...state,
      tram: { ...state.tram!, lastCard: { rank: 2, suit: 'spades' }, deck: cards, streak: 0 },
    };

    for (let i = 0; i < 5; i++) {
      const r = tramGuess(state, 'p1', 'higher', seededRng(i));
      state = r.state;
    }

    expect(state.gamePhase).toBe('ended');
    expect(state.tram!.streakCards).toHaveLength(5);
  });
});

// ----------------------------------------------------------------
// confirmDrink
// ----------------------------------------------------------------
describe('confirmDrink', () => {
  it('collecting — gracz pije po potwierdzeniu, tura przesuwa się dalej', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const collecting = startCollecting(base, seededRng(1));
    const col = collecting.collecting!;
    const p1 = collecting.players[col.currentPlayerIdx];

    // Wymuś pudło: zgadnij kolor a karta będzie przeciwna
    const topCard = collecting.deck[0];
    const wrongColor = topCard.suit === 'hearts' || topCard.suit === 'diamonds' ? 'black' : 'red';
    const r = collectingGuess(collecting, p1.id, { kind: 'color', value: wrongColor }, seededRng(1));

    expect(r.state.drinkGate).not.toBeNull();
    expect(r.state.drinkGate!.entries[0].playerId).toBe(p1.id);

    // Po confirmDrink: sipsy zapisane, tura ruszyła
    const after = confirmDrink(r.state, p1.id, seededRng(1));
    expect(after.drinkGate).toBeNull();
    const p1After = after.players.find((p) => p.id === p1.id)!;
    expect(p1After.sips).toBe(1);
    // Tura ruszyła do następnego gracza
    const p2Id = collecting.players[(col.currentPlayerIdx + 1) % 2].id;
    expect(after.players[after.collecting!.currentPlayerIdx].id).toBe(p2Id);
  });

  it('confirmDrink jest idempotentne — drugi call to no-op', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const collecting = startCollecting(base, seededRng(1));
    const p1 = collecting.players[collecting.collecting!.currentPlayerIdx];
    const topCard = collecting.deck[0];
    const wrongColor = topCard.suit === 'hearts' || topCard.suit === 'diamonds' ? 'black' : 'red';
    const r = collectingGuess(collecting, p1.id, { kind: 'color', value: wrongColor }, seededRng(1));

    const after1 = confirmDrink(r.state, p1.id, seededRng(1));
    const after2 = confirmDrink(after1, p1.id, seededRng(1)); // drugi call
    // Stan nie zmienia się po drugim potwierdzeniu
    expect(after2).toEqual(after1);
  });

  it('confirmDrink — nie-gracz z gate to no-op', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const collecting = startCollecting(base, seededRng(1));
    const p1 = collecting.players[collecting.collecting!.currentPlayerIdx];
    const topCard = collecting.deck[0];
    const wrongColor = topCard.suit === 'hearts' || topCard.suit === 'diamonds' ? 'black' : 'red';
    const r = collectingGuess(collecting, p1.id, { kind: 'color', value: wrongColor }, seededRng(1));

    // p2 próbuje potwierdzić picie p1 — nie powinno zmienić stanu
    const p2Id = collecting.players.find((p) => p.id !== p1.id)!.id;
    const after = confirmDrink(r.state, p2Id, seededRng(1));
    expect(after.drinkGate).not.toBeNull(); // gate nadal aktywny
    expect(after.drinkGate!.entries[0].confirmed).toBe(false);
  });

  it('pyramid — confirmDrink zwalnia blokadę pyramidNext', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const collecting = startCollecting(base, seededRng(1));
    const py = enterPyramid(collecting);

    // Odsłoń kartę
    const r0 = pyramidNext(py, seededRng(1));
    const currentCard = r0.state.pyramid!.currentCard!;

    // Daj p1 kartę pasującą do currentCard
    const stateWithCard: RoomState = {
      ...r0.state,
      players: r0.state.players.map((p, i) =>
        i === 0 ? { ...p, hand: [currentCard] } : p,
      ),
    };
    const p1 = stateWithCard.players[0];
    const p2 = stateWithCard.players[1];

    const assignResult = pyramidAssignSips(stateWithCard, p1.id, p2.id, 1);
    expect(assignResult.state.drinkGate).not.toBeNull();

    // pyramidNext zablokowane
    expect(() => pyramidNext(assignResult.state, seededRng(1))).toThrow('Czekamy na potwierdzenie picia');

    // Po confirmDrink pyramidNext działa
    const afterConfirm = confirmDrink(assignResult.state, p2.id, seededRng(1));
    expect(afterConfirm.drinkGate).toBeNull();
    expect(afterConfirm.players.find((p) => p.id === p2.id)!.sips).toBe(1);
    expect(() => pyramidNext(afterConfirm, seededRng(1))).not.toThrow();
  });

  it('tram — confirmDrink resetuje talię (enterTram)', () => {
    const base = createGame(makePlayers(2), seededRng(1));
    const s = enterTram(base, base.players[0].id, seededRng(1));

    const r0 = tramGuess(s, s.players[0].id, 'reference', seededRng(1));
    // Wymuś pudło
    const refCard: Card = { rank: 2, suit: 'spades' };
    const wrongCard: Card = { rank: 'A', suit: 'hearts' }; // wyżej, ale guess lower
    const withWrongDeck: RoomState = {
      ...r0.state,
      tram: { ...r0.state.tram!, lastCard: refCard, deck: [wrongCard, ...r0.state.tram!.deck.slice(1)], streak: 2, streakCards: [{ rank: 3, suit: 'clubs' }, { rank: 5, suit: 'hearts' }] },
    };

    const r1 = tramGuess(withWrongDeck, withWrongDeck.tram!.tramPlayerId, 'lower', seededRng(1));
    expect(r1.correct).toBe(false);
    expect(r1.state.drinkGate).not.toBeNull();
    expect(r1.state.drinkGate!.context!.streakCards).toHaveLength(2);

    const afterConfirm = confirmDrink(r1.state, r1.state.tram!.tramPlayerId, seededRng(1));
    // enterTram wywołane: reset streak, nowa talia
    expect(afterConfirm.drinkGate).toBeNull();
    expect(afterConfirm.tram!.streak).toBe(0);
    expect(afterConfirm.tram!.streakCards).toHaveLength(0);
    expect(afterConfirm.tram!.lastCard).toBeNull();
    expect(afterConfirm.players.find((p) => p.id === r1.state.tram!.tramPlayerId)!.sips).toBe(1);
  });
});
