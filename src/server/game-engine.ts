import type {
  Card,
  Player,
  RoomState,
  Suit,
  Rank,
  PyramidSubState,
  TramSubState,
} from '@/shared/types';

export type GameState = RoomState;
export type RNG = () => number;

export type CollectingGuess =
  | { kind: 'color'; value: 'black' | 'red' }
  | { kind: 'hiLo'; value: 'higher' | 'lower' }
  | { kind: 'inOut'; value: 'inside' | 'outside' }
  | { kind: 'suit'; value: Suit };

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
const RANK_ORDER: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle<T>(items: readonly T[], rng: RNG): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Zwraca −1, 0 lub 1 (a < b, a === b, a > b) według hierarchii rang */
export function compareRank(a: Rank, b: Rank): -1 | 0 | 1 {
  const ia = RANK_ORDER.indexOf(a);
  const ib = RANK_ORDER.indexOf(b);
  if (ia < ib) return -1;
  if (ia > ib) return 1;
  return 0;
}

/** Tworzy bazowy stan gry (czyści stan z createGame, potem używamy startCollecting) */
export function createGame(players: Player[], rng: RNG): GameState {
  if (players.length < 2) {
    throw new Error('Potrzeba co najmniej 2 graczy');
  }
  const deck = shuffle(createDeck(), rng);
  return {
    code: '',
    players: players.map((p) => ({ ...p, hand: [] })),
    hostId: players[0].id,
    status: 'playing',
    deck,
    currentTurnPlayerId: players[0].id,
    drawnCards: [],
    gamePhase: null,
    collecting: null,
    pyramid: null,
    tram: null,
    winnerId: null,
  };
}

/** Inicjalizuje Etap 1 — Zbieranie. Może być wołane zaraz po createGame. */
export function startCollecting(state: GameState, rng: RNG): GameState {
  const deck = shuffle(createDeck(), rng);
  return {
    ...state,
    deck,
    drawnCards: [],
    players: state.players.map((p) => ({ ...p, hand: [], sips: 0 })),
    status: 'playing',
    gamePhase: 'collecting',
    collecting: { round: 1, currentPlayerIdx: 0 },
    pyramid: null,
    tram: null,
    winnerId: null,
    currentTurnPlayerId: state.players[0]?.id ?? null,
  };
}

// ----------------------------------------------------------------
// Helpers dla Etapu 1
// ----------------------------------------------------------------

/** true jeśli ręka z dokładnie 3 kartami ma 3 różne symbole */
export function isRainbowAvailable(hand: Card[]): boolean {
  if (hand.length !== 3) return false;
  const suits = new Set(hand.map((c) => c.suit));
  return suits.size === 3;
}

/** Brakujący 4. symbol dla ręki z 3 kartami 3 różnych symboli; inaczej null */
export function missingSuit(hand: Card[]): Suit | null {
  if (!isRainbowAvailable(hand)) return null;
  const present = new Set(hand.map((c) => c.suit));
  return SUITS.find((s) => !present.has(s)) ?? null;
}

function isBlack(card: Card): boolean {
  return card.suit === 'spades' || card.suit === 'clubs';
}

function resolveCollectingGuess(
  guess: CollectingGuess,
  drawnCard: Card,
  hand: Card[],
): boolean {
  const round = hand.length + 1; // hand jeszcze nie ma tej karty
  switch (round) {
    case 1: {
      // Runda 1: kolor czarny/czerwony
      if (guess.kind !== 'color') return false;
      const drawnBlack = isBlack(drawnCard);
      return guess.value === 'black' ? drawnBlack : !drawnBlack;
    }
    case 2: {
      // Runda 2: wyżej/niżej od karty z R1 (hand[0]); remis = błąd
      if (guess.kind !== 'hiLo') return false;
      const cmp = compareRank(drawnCard.rank, hand[0].rank);
      if (cmp === 0) return false; // remis = błąd
      return guess.value === 'higher' ? cmp > 0 : cmp < 0;
    }
    case 3: {
      // Runda 3: pomiędzy/poza zakresem hand[0] i hand[1] (ściśle)
      if (guess.kind !== 'inOut') return false;
      const r0 = RANK_ORDER.indexOf(hand[0].rank);
      const r1 = RANK_ORDER.indexOf(hand[1].rank);
      const lo = Math.min(r0, r1);
      const hi = Math.max(r0, r1);
      const rd = RANK_ORDER.indexOf(drawnCard.rank);
      if (lo === hi) {
        // obie karty tej samej rangi — pomiędzy niemożliwe, zawsze "poza"
        return guess.value === 'outside';
      }
      const inside = rd > lo && rd < hi;
      return guess.value === 'inside' ? inside : !inside;
    }
    case 4: {
      // Runda 4: symbol karty
      if (guess.kind !== 'suit') return false;
      return guess.value === drawnCard.suit;
    }
    default:
      return false;
  }
}

export interface CollectingGuessResult {
  state: GameState;
  card: Card;
  correct: boolean;
  sipsAwarded: number;
  rainbowTriggered: boolean;
}

/**
 * Gracz składa zgadywanie w Etapie 1 (Zbieranie).
 * Zdejmuje kartę z talii, ocenia trafienie, aktualizuje stan.
 * Po rundzie 4 ostatniego gracza automatycznie przechodzi do enterPyramid.
 */
export function collectingGuess(
  state: GameState,
  playerId: string,
  guess: CollectingGuess,
  rng: RNG,
): CollectingGuessResult {
  if (state.gamePhase !== 'collecting' || !state.collecting) {
    throw new Error('Nie w fazie zbierania');
  }
  const col = state.collecting;
  const currentPlayer = state.players[col.currentPlayerIdx];
  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error('Nie twoja tura');
  }
  if (state.deck.length === 0) {
    throw new Error('Talia jest pusta');
  }

  const [card, ...remainingDeck] = state.deck;
  const hand = currentPlayer.hand;

  // Tęcza w Rundzie 4: check przed zgadywaniem
  const rainbowAvail = col.round === 4 && isRainbowAvailable(hand);
  const missing = rainbowAvail ? missingSuit(hand) : null;
  const choseRainbow =
    rainbowAvail && guess.kind === 'suit' && missing !== null && guess.value === missing;

  const correct = resolveCollectingGuess(guess, card, hand);
  const rainbowTriggered = choseRainbow && correct;

  // Oblicz łyki
  let sipsAwarded = 0;
  let updatedPlayers: Player[];

  if (rainbowTriggered) {
    // Wszyscy inni piją 1
    updatedPlayers = state.players.map((p) => {
      if (p.id === playerId) return { ...p, hand: [...p.hand, card] };
      return { ...p, sips: p.sips + 1 };
    });
    sipsAwarded = state.players.length - 1;
  } else if (!correct) {
    // Gracz pije 1
    updatedPlayers = state.players.map((p) =>
      p.id === playerId
        ? { ...p, hand: [...p.hand, card], sips: p.sips + 1 }
        : p,
    );
    sipsAwarded = 1;
  } else {
    // Trafienie bez tęczy — nikt nie pije
    updatedPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, hand: [...p.hand, card] } : p,
    );
  }

  // Przesuń turę
  const nextPlayerIdx = (col.currentPlayerIdx + 1) % state.players.length;
  const allPlayed = nextPlayerIdx === 0;
  const isLastRound = col.round === 4;

  let newState: GameState = {
    ...state,
    deck: remainingDeck,
    drawnCards: [...state.drawnCards, card],
    players: updatedPlayers,
  };

  if (allPlayed && isLastRound) {
    // Etap 1 zakończony → przejdź do piramidy
    newState = enterPyramid(newState);
  } else if (allPlayed) {
    // Kolejna runda
    newState = {
      ...newState,
      collecting: {
        round: (col.round + 1) as 1 | 2 | 3 | 4,
        currentPlayerIdx: 0,
      },
      currentTurnPlayerId: newState.players[0].id,
    };
  } else {
    newState = {
      ...newState,
      collecting: {
        ...col,
        currentPlayerIdx: nextPlayerIdx,
      },
      currentTurnPlayerId: newState.players[nextPlayerIdx].id,
    };
  }

  return { state: newState, card, correct, sipsAwarded, rainbowTriggered };
}

// ----------------------------------------------------------------
// Etap 2 — Piramida
// ----------------------------------------------------------------

const PYRAMID_LEVELS = [1, 2, 3, 4]; // liczba kart na każdym poziomie (od góry)
const PYRAMID_TOTAL = PYRAMID_LEVELS.reduce((a, b) => a + b, 0); // 10

export function enterPyramid(state: GameState): GameState {
  const pyramidCards = state.deck.slice(0, PYRAMID_TOTAL);
  const remainingDeck = state.deck.slice(PYRAMID_TOTAL);

  // Buduj layout: layout[0] = level 1 (1 karta), layout[1] = level 2 (2 karty), ...
  const layout: Card[][] = [];
  let idx = 0;
  for (const levelSize of PYRAMID_LEVELS) {
    layout.push(pyramidCards.slice(idx, idx + levelSize));
    idx += levelSize;
  }

  const pyramid: PyramidSubState = {
    layout,
    revealedLevels: 0,
    revealedInLevel: 0,
    currentCard: null,
    pendingSipsByPlayer: {},
  };

  return {
    ...state,
    deck: remainingDeck,
    gamePhase: 'pyramid',
    collecting: null,
    pyramid,
    currentTurnPlayerId: state.hostId,
  };
}

export interface PyramidNextResult {
  state: GameState;
  card: Card;
  level: number;
}

/**
 * Odsłania następną kartę piramidy.
 * Po wyczerpaniu 10 kart przechodzi do Etapu 3 (Tramwaj).
 */
export function pyramidNext(state: GameState, rng: RNG): PyramidNextResult {
  if (state.gamePhase !== 'pyramid' || !state.pyramid) {
    throw new Error('Nie w fazie piramidy');
  }
  const py = state.pyramid;

  // Aktualny poziom i indeks karty do odsłonięcia
  let lvlIdx = py.revealedLevels;
  if (lvlIdx >= PYRAMID_LEVELS.length) {
    throw new Error('Wszystkie karty piramidy już odkryte');
  }
  const levelSize = PYRAMID_LEVELS[lvlIdx];
  const cardIdx = py.revealedInLevel;
  const card = py.layout[lvlIdx][cardIdx];
  const level = lvlIdx + 1; // 1-indexed dla UI

  const newRevealedInLevel = cardIdx + 1;
  const levelDone = newRevealedInLevel >= levelSize;
  const newRevealedLevels = levelDone ? py.revealedLevels + 1 : py.revealedLevels;
  const nextRevealedInLevel = levelDone ? 0 : newRevealedInLevel;

  const allDone = levelDone && newRevealedLevels >= PYRAMID_LEVELS.length;

  const newPyramid: PyramidSubState = {
    ...py,
    revealedLevels: newRevealedLevels,
    revealedInLevel: nextRevealedInLevel,
    currentCard: card,
    pendingSipsByPlayer: {},
  };

  let newState: GameState = {
    ...state,
    pyramid: newPyramid,
  };

  if (allDone) {
    // Przejdź do Etapu 3
    const tramPlayerId = pickTramPlayer(newState, rng);
    newState = enterTram(newState, tramPlayerId, rng);
  }

  return { state: newState, card, level };
}

export interface PyramidAssignResult {
  state: GameState;
  sipsAwarded: number;
}

/**
 * Gracz z pasującą kartą w ręce każe pić innemu graczowi.
 * Usuwa jedną kartę pasującej rangi z ręki `fromPlayerId`.
 */
export function pyramidAssignSips(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
): PyramidAssignResult {
  if (state.gamePhase !== 'pyramid' || !state.pyramid) {
    throw new Error('Nie w fazie piramidy');
  }
  if (!state.pyramid.currentCard) {
    throw new Error('Brak aktualnie odkrytej karty');
  }
  if (fromPlayerId === toPlayerId) {
    throw new Error('Nie możesz kazać pić samemu sobie');
  }
  const fromPlayer = state.players.find((p) => p.id === fromPlayerId);
  const toPlayer = state.players.find((p) => p.id === toPlayerId);
  if (!fromPlayer || !toPlayer) {
    throw new Error('Gracz nie znaleziony');
  }

  const targetRank = state.pyramid.currentCard.rank;
  const matchIdx = fromPlayer.hand.findIndex((c) => c.rank === targetRank);
  if (matchIdx === -1) {
    throw new Error('Brak karty pasującej do aktualnej karty piramidy');
  }

  // Poziom = revealedLevels (0-indexed) → +1 do sipsów
  // Aktualnie odsłaniamy na poziomie revealedLevels (przed inkrem.) ale currentCard jest ustawiona
  // Musimy znać poziom currentCard. Szukamy w layout.
  let level = 1;
  for (let lvl = 0; lvl < state.pyramid.layout.length; lvl++) {
    if (state.pyramid.layout[lvl].some((c) => c === state.pyramid!.currentCard)) {
      level = lvl + 1;
      break;
    }
  }

  const newHand = [
    ...fromPlayer.hand.slice(0, matchIdx),
    ...fromPlayer.hand.slice(matchIdx + 1),
  ];

  const newPendingSips = {
    ...state.pyramid.pendingSipsByPlayer,
    [toPlayerId]: (state.pyramid.pendingSipsByPlayer[toPlayerId] ?? 0) + level,
  };

  const updatedPlayers = state.players.map((p) => {
    if (p.id === fromPlayerId) return { ...p, hand: newHand };
    if (p.id === toPlayerId) return { ...p, sips: p.sips + level };
    return p;
  });

  const newState: GameState = {
    ...state,
    players: updatedPlayers,
    pyramid: {
      ...state.pyramid,
      pendingSipsByPlayer: newPendingSips,
    },
  };

  return { state: newState, sipsAwarded: level };
}

// ----------------------------------------------------------------
// Wyłonienie Tramwajarza
// ----------------------------------------------------------------

export function pickTramPlayer(state: GameState, rng: RNG): string {
  const players = [...state.players];
  if (players.length === 0) throw new Error('Brak graczy');

  // (1) Największa ręka
  const maxHandSize = Math.max(...players.map((p) => p.hand.length));
  let candidates = players.filter((p) => p.hand.length === maxHandSize);

  if (candidates.length === 1) return candidates[0].id;

  // (2) Porównaj ręce sort desc; przegrywa (jedzie) ten z najniższą "najwyższą kartą"
  // Sortujemy każdą rękę malejąco
  const sortedHands = candidates.map((p) => ({
    id: p.id,
    sorted: [...p.hand].sort((a, b) => compareRank(b.rank, a.rank)),
  }));

  // Porównuj pozycję po pozycji; szukamy kto ma NAJNIŻSZĄ wartość na danej pozycji
  const handLen = sortedHands[0].sorted.length;
  for (let pos = 0; pos < handLen; pos++) {
    const vals = sortedHands.map((h) => ({
      id: h.id,
      rankIdx: RANK_ORDER.indexOf(h.sorted[pos]?.rank ?? 2),
    }));
    const minRankIdx = Math.min(...vals.map((v) => v.rankIdx));
    const losers = vals.filter((v) => v.rankIdx === minRankIdx);
    if (losers.length === 1) return losers[0].id;
    // Zawężamy kandydatów do przegrywających (remis na tej pozycji)
    const loserIds = new Set(losers.map((v) => v.id));
    sortedHands.splice(
      0,
      sortedHands.length,
      ...sortedHands.filter((h) => loserIds.has(h.id)),
    );
  }

  // (3) Losowanie
  const finalCandidates = sortedHands;
  return finalCandidates[Math.floor(rng() * finalCandidates.length)].id;
}

// ----------------------------------------------------------------
// Etap 3 — Tramwaj
// ----------------------------------------------------------------

export function enterTram(state: GameState, tramPlayerId: string, rng: RNG): GameState {
  const newDeck = shuffle(createDeck(), rng);
  const tram: TramSubState = {
    deck: newDeck,
    lastCard: null,
    streak: 0,
    tramPlayerId,
    streakCards: [],
  };
  return {
    ...state,
    gamePhase: 'tram',
    pyramid: null,
    tram,
    currentTurnPlayerId: tramPlayerId,
    winnerId: null,
  };
}

export interface TramGuessResult {
  state: GameState;
  card: Card;
  correct: boolean;
  isReference: boolean;
}

/**
 * Tramwajarz ciągnie kartę.
 * - Gdy `lastCard === null`: ciągnie kartę referencyjną (answer ignorowany, zawsze "correct").
 * - Inaczej: answer 'higher'|'lower', remis = błąd → sips++, nowa talia.
 * - 5-streak sukces → gamePhase='ended'.
 */
export function tramGuess(
  state: GameState,
  playerId: string,
  answer: 'higher' | 'lower' | 'reference',
  rng: RNG,
): TramGuessResult {
  if (state.gamePhase !== 'tram' || !state.tram) {
    throw new Error('Nie w fazie tramwaju');
  }
  if (state.tram.tramPlayerId !== playerId) {
    throw new Error('Nie jesteś tramwajarzem');
  }
  if (state.tram.deck.length === 0) {
    throw new Error('Talia tramwaju jest pusta');
  }

  const [card, ...remainingDeck] = state.tram.deck;
  const isReference = state.tram.lastCard === null;

  if (isReference) {
    // Pierwsza karta — referencyjna, bez zgadywania
    const newTram: TramSubState = {
      ...state.tram,
      deck: remainingDeck,
      lastCard: card,
      streak: 0,
    };
    return {
      state: { ...state, tram: newTram },
      card,
      correct: true,
      isReference: true,
    };
  }

  // Zgadywanie wyżej/niżej
  const cmp = compareRank(card.rank, state.tram.lastCard!.rank);
  const correct =
    cmp !== 0 && // remis = błąd
    (answer === 'higher' ? cmp > 0 : cmp < 0);

  if (correct) {
    const newStreak = state.tram.streak + 1;
    const newStreakCards = [...state.tram.streakCards, card];
    if (newStreak >= 5) {
      // Sukces!
      const newState: GameState = {
        ...state,
        gamePhase: 'ended',
        status: 'ended',
        tram: { ...state.tram, deck: remainingDeck, lastCard: card, streak: newStreak, streakCards: newStreakCards },
        winnerId: playerId,
      };
      return { state: newState, card, correct: true, isReference: false };
    }
    const newTram: TramSubState = {
      ...state.tram,
      deck: remainingDeck,
      lastCard: card,
      streak: newStreak,
      streakCards: newStreakCards,
    };
    return { state: { ...state, tram: newTram }, card, correct: true, isReference: false };
  } else {
    // Błąd — gracz pije, reset (nowa talia)
    const updatedPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, sips: p.sips + 1 } : p,
    );
    const stateAfterSip = { ...state, players: updatedPlayers };
    const resetState = enterTram(stateAfterSip, playerId, rng);
    return { state: resetState, card, correct: false, isReference: false };
  }
}
