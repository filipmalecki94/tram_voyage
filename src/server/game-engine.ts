import type {
  Card,
  Player,
  RoomState,
  Suit,
  Rank,
  PyramidSubState,
  TramSubState,
  DrinkGate,
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
    drinkGate: null,
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
    collecting: { round: 1, currentPlayerIdx: 0, pendingConfirm: null, currentCard: null, lastGuess: null, lastGuessCorrect: null },
    pyramid: null,
    tram: null,
    winnerId: null,
    currentTurnPlayerId: state.players[0]?.id ?? null,
    drinkGate: null,
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
 * Przesuwa turę zbierania po potwierdzeniu picia (lub bezpośrednio gdy nikt nie pił).
 * Wywoływane przez collectingGuess (gdy nikt nie pije) oraz confirmDrink (resumeAction = 'collecting-next').
 */
export function advanceCollecting(state: GameState): GameState {
  if (!state.collecting) return state;
  const col = state.collecting;
  const nextPlayerIdx = (col.currentPlayerIdx + 1) % state.players.length;
  const allPlayed = nextPlayerIdx === 0;
  const isLastRound = col.round === 4;

  if (allPlayed && isLastRound) {
    return enterPyramid(state);
  } else if (allPlayed) {
    return {
      ...state,
      collecting: {
        round: (col.round + 1) as 1 | 2 | 3 | 4,
        currentPlayerIdx: 0,
        pendingConfirm: null,
        currentCard: null,
        lastGuess: null,
        lastGuessCorrect: null,
      },
      currentTurnPlayerId: state.players[0].id,
    };
  } else {
    return {
      ...state,
      collecting: {
        ...col,
        currentPlayerIdx: nextPlayerIdx,
        pendingConfirm: null,
        currentCard: null,
        lastGuess: null,
        lastGuessCorrect: null,
      },
      currentTurnPlayerId: state.players[nextPlayerIdx].id,
    };
  }
}

/**
 * Gracz potwierdza poprawne zgadnięcie ("Zgadłem!").
 * Czyści pendingConfirm i przesuwa turę do następnego gracza.
 */
export function collectingConfirm(state: GameState, playerId: string): GameState {
  if (state.gamePhase !== 'collecting' || !state.collecting) {
    throw new Error('Nie w fazie zbierania');
  }
  if (state.collecting.pendingConfirm !== playerId) {
    throw new Error('Nie czekamy na twoje potwierdzenie');
  }
  const stateAfterConfirm = {
    ...state,
    collecting: { ...state.collecting, pendingConfirm: null },
  };
  // Przesuwamy turę tylko jeśli drinkGate już wyczyszczony (wszyscy wypili)
  if (stateAfterConfirm.drinkGate) return stateAfterConfirm;
  return advanceCollecting(stateAfterConfirm);
}

/**
 * Gracz składa zgadywanie w Etapie 1 (Zbieranie).
 * Zdejmuje kartę z talii, ocenia trafienie, aktualizuje stan.
 * Gdy gracz(e) muszą pić — ustawia drinkGate zamiast natychmiast zmieniać sips.
 * Postęp gry jest wstrzymany do czasu potwierdzenia picia przez wszystkich (confirmDrink).
 */
const SUIT_GUESS_LABELS: Record<Suit, string> = {
  spades: '♠ Pik',
  clubs: '♣ Trefl',
  diamonds: '♦ Karo',
  hearts: '♥ Kier',
};

function guessLabel(guess: CollectingGuess): string {
  if (guess.kind === 'color') return guess.value === 'black' ? '♠♣ Czarna' : '♥♦ Czerwona';
  if (guess.kind === 'hiLo') return guess.value === 'higher' ? '▲ Wyżej' : '▼ Niżej';
  if (guess.kind === 'inOut') return guess.value === 'inside' ? 'Pomiędzy' : 'Poza';
  return SUIT_GUESS_LABELS[guess.value];
}

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

  // Karta zawsze trafia do ręki gracza
  const updatedPlayers: Player[] = state.players.map((p) =>
    p.id === playerId ? { ...p, hand: [...p.hand, card] } : p,
  );

  let newState: GameState = {
    ...state,
    deck: remainingDeck,
    drawnCards: [...state.drawnCards, card],
    players: updatedPlayers,
    collecting: state.collecting ? { ...state.collecting, currentCard: card, lastGuess: guessLabel(guess), lastGuessCorrect: correct } : null,
  };

  if (rainbowTriggered) {
    // Wszyscy inni muszą pić 1 — ustawiamy drinkGate, wstrzymujemy postęp
    const sipsAwarded = state.players.length - 1;
    const otherPlayers = state.players.filter((p) => p.id !== playerId);
    const gate: DrinkGate = {
      entries: otherPlayers.map((p) => ({
        playerId: p.id,
        sips: 1,
        reason: 'collecting-rainbow',
        confirmed: false,
      })),
      resumeAction: 'collecting-next',
    };
    newState = {
      ...newState,
      drinkGate: gate,
      collecting: newState.collecting
        ? { ...newState.collecting, pendingConfirm: playerId }
        : null,
    };
    return { state: newState, card, correct, sipsAwarded, rainbowTriggered: true };
  } else if (!correct) {
    // Gracz musi pić 1 — ustawiamy drinkGate, wstrzymujemy postęp
    const gate: DrinkGate = {
      entries: [{ playerId, sips: 1, reason: 'collecting-miss', confirmed: false }],
      resumeAction: 'collecting-next',
    };
    newState = { ...newState, drinkGate: gate };
    return { state: newState, card, correct, sipsAwarded: 1, rainbowTriggered: false };
  } else {
    // Trafienie — czekamy na potwierdzenie gracza ("Zgadłem!") przed przesunięciem tury
    newState = {
      ...newState,
      drinkGate: null,
      collecting: newState.collecting
        ? { ...newState.collecting, pendingConfirm: playerId }
        : null,
    };
    return { state: newState, card, correct, sipsAwarded: 0, rainbowTriggered: false };
  }
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
    activeDeals: {},
  };

  return {
    ...state,
    deck: remainingDeck,
    gamePhase: 'pyramid',
    collecting: null,
    pyramid,
    currentTurnPlayerId: state.hostId,
    drinkGate: null,
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
  if (state.drinkGate) {
    throw new Error('Czekamy na potwierdzenie picia');
  }
  if (Object.keys(state.pyramid.activeDeals).length > 0) {
    throw new Error('Gracze nie rozdali jeszcze wszystkich kolejek');
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

  // Utwórz deale dla wszystkich graczy posiadających pasującą rangę
  // Usuń po 1 karcie z każdego gracza i przyznaj pulę level kolejek
  const newActiveDeals: Record<string, { remainingSips: number; totalSips: number }> = {};
  const updatedPlayersForDeals = state.players.map((p) => {
    const matchIdx = p.hand.findIndex((c) => c.rank === card.rank);
    if (matchIdx === -1) return p;
    // Gracz ma pasującą kartę — usuń ją i utwórz deal
    newActiveDeals[p.id] = { remainingSips: level, totalSips: level };
    const newHand = [...p.hand.slice(0, matchIdx), ...p.hand.slice(matchIdx + 1)];
    return { ...p, hand: newHand };
  });

  const newPyramid: PyramidSubState = {
    ...py,
    revealedLevels: newRevealedLevels,
    revealedInLevel: nextRevealedInLevel,
    currentCard: card,
    activeDeals: newActiveDeals,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayersForDeals,
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
  sips: number,
): PyramidAssignResult {
  if (state.gamePhase !== 'pyramid' || !state.pyramid) {
    throw new Error('Nie w fazie piramidy');
  }
  if (!state.pyramid.currentCard) {
    throw new Error('Brak aktualnie odkrytej karty');
  }

  const py = state.pyramid;
  const toPlayer = state.players.find((p) => p.id === toPlayerId);
  if (!toPlayer) {
    throw new Error('Gracz docelowy nie znaleziony');
  }

  // Sprawdź deal przypisującego gracza
  const deal = py.activeDeals[fromPlayerId];
  if (!deal) {
    throw new Error('Nie masz aktywnego rozdania dla tej karty');
  }
  if (sips < 1 || sips > deal.remainingSips) {
    throw new Error(`Możesz przypisać 1–${deal.remainingSips} kolejek`);
  }

  // Zaktualizuj deal — usuń gdy wyczerpany
  const newRemaining = deal.remainingSips - sips;
  const newActiveDeals = { ...py.activeDeals };
  if (newRemaining > 0) {
    newActiveDeals[fromPlayerId] = { ...deal, remainingSips: newRemaining };
  } else {
    delete newActiveDeals[fromPlayerId];
  }

  // Aktualizuj drinkGate
  let newGate: DrinkGate;
  if (!state.drinkGate) {
    newGate = {
      entries: [{ playerId: toPlayerId, sips, reason: 'pyramid-assign', confirmed: false }],
      resumeAction: 'pyramid-next',
    };
  } else {
    const existingEntryIdx = state.drinkGate.entries.findIndex((e) => e.playerId === toPlayerId);
    if (existingEntryIdx !== -1) {
      const updatedEntries = state.drinkGate.entries.map((e, i) =>
        i === existingEntryIdx
          ? { ...e, sips: e.sips + sips, confirmed: false }
          : e,
      );
      newGate = { ...state.drinkGate, entries: updatedEntries };
    } else {
      newGate = {
        ...state.drinkGate,
        entries: [
          ...state.drinkGate.entries,
          { playerId: toPlayerId, sips, reason: 'pyramid-assign', confirmed: false },
        ],
      };
    }
  }

  const newState: GameState = {
    ...state,
    pyramid: { ...py, activeDeals: newActiveDeals },
    drinkGate: newGate,
  };

  return { state: newState, sipsAwarded: sips };
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
    referenceCard: null,
    lastCard: null,
    streak: 0,
    tramPlayerId,
    streakCards: [],
    tramAwaitingHostNext: false,
  };
  return {
    ...state,
    gamePhase: 'tram',
    pyramid: null,
    tram,
    currentTurnPlayerId: tramPlayerId,
    winnerId: null,
    drinkGate: null,
  };
}

/**
 * Restart streaka po błędnym zgadnięciu w Etapie 3.
 * Zachowuje istniejący deck (wspólna pula dla całego etapu),
 * resetuje tylko progres streaka i kartę referencyjną.
 */
export function restartTramStreak(state: GameState): GameState {
  if (!state.tram) {
    throw new Error('Nie w fazie tramwaju');
  }
  return {
    ...state,
    tram: {
      ...state.tram,
      referenceCard: null,
      lastCard: null,
      streak: 0,
      streakCards: [],
      tramAwaitingHostNext: false,
    },
    currentTurnPlayerId: state.tram.tramPlayerId,
    drinkGate: null,
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
  // Gdy pula wyczerpana — tasujemy świeżą talię 52 i kontynuujemy streak
  const sourceDeck =
    state.tram.deck.length === 0 ? shuffle(createDeck(), rng) : state.tram.deck;

  const [card, ...remainingDeck] = sourceDeck;
  const isReference = state.tram.lastCard === null;

  if (isReference) {
    // Pierwsza karta — referencyjna, bez zgadywania
    const newTram: TramSubState = {
      ...state.tram,
      deck: remainingDeck,
      referenceCard: card,
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
    if (newStreak >= 4) {
      // Sukces!
      const newState: GameState = {
        ...state,
        gamePhase: 'ended',
        status: 'ended',
        tram: { ...state.tram, deck: remainingDeck, lastCard: card, streak: newStreak, streakCards: newStreakCards },
        winnerId: playerId,
        drinkGate: null,
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
    return { state: { ...state, tram: newTram, drinkGate: null }, card, correct: true, isReference: false };
  } else {
    // Błąd — gracz musi pić, zatrzymujemy grę do potwierdzenia. Reset talii nastąpi po confirmDrink.
    const newTram: TramSubState = {
      ...state.tram,
      deck: remainingDeck,
      lastCard: card,
    };
    const gate: DrinkGate = {
      entries: [{ playerId, sips: 1, reason: 'tram-lost', confirmed: false }],
      resumeAction: 'tram-restart',
      context: {
        streakCards: state.tram.streakCards,
        tramPlayerId: playerId,
      },
    };
    const newState: GameState = { ...state, tram: newTram, drinkGate: gate };
    return { state: newState, card, correct: false, isReference: false };
  }
}

// ----------------------------------------------------------------
// Etap 3 — host zatwierdza kolejną rundę tramwaju
// ----------------------------------------------------------------

export function tramNext(state: GameState, playerId: string): GameState {
  if (state.gamePhase !== 'tram' || !state.tram) {
    throw new Error('Nie w fazie tramwaju');
  }
  if (state.hostId !== playerId) {
    throw new Error('Tylko host może zatwierdzić kolejną rundę');
  }
  if (!state.tram.tramAwaitingHostNext) {
    throw new Error('Nie czekamy na potwierdzenie hosta');
  }
  return restartTramStreak(state);
}

// ----------------------------------------------------------------
// DrinkGate — potwierdzenie picia
// ----------------------------------------------------------------

/**
 * Gracz potwierdza wypicie swojej kary.
 * Gdy wszyscy wskazani gracze potwierdzą — sipsy zostają zapisane i gra rusza dalej.
 * Idempotentne: kolejne wywołanie dla już-potwierdzonego gracza to no-op.
 */
export function confirmDrink(state: GameState, playerId: string, rng: RNG): GameState {
  if (!state.drinkGate) return state;

  const entryIdx = state.drinkGate.entries.findIndex((e) => e.playerId === playerId);
  if (entryIdx === -1) return state; // nie w gate
  if (state.drinkGate.entries[entryIdx].confirmed) return state; // już potwierdzone

  const updatedEntries = state.drinkGate.entries.map((e, i) =>
    i === entryIdx ? { ...e, confirmed: true } : e,
  );

  const allConfirmed = updatedEntries.every((e) => e.confirmed);

  if (!allConfirmed) {
    return { ...state, drinkGate: { ...state.drinkGate, entries: updatedEntries } };
  }

  // Wszyscy potwierdzili — zapisz sipsy i wykonaj resumeAction
  const updatedPlayers = state.players.map((p) => {
    const entry = updatedEntries.find((e) => e.playerId === p.id);
    if (!entry) return p;
    return { ...p, sips: p.sips + entry.sips };
  });

  const resume = state.drinkGate.resumeAction;
  const ctx = state.drinkGate.context;
  const stateAfterSips: GameState = { ...state, players: updatedPlayers, drinkGate: null };

  switch (resume) {
    case 'collecting-next':
      // Przesuwamy turę tylko jeśli gracz już potwierdził "Zgadłem!" (pendingConfirm wyczyszczone)
      if (stateAfterSips.collecting?.pendingConfirm) return stateAfterSips;
      return advanceCollecting(stateAfterSips);
    case 'pyramid-next':
      // Host sam kliknie "Odsłoń następną kartę" po tym jak wszyscy potwierdzą
      return stateAfterSips;
    case 'tram-restart':
      // Host musi zatwierdzić kolejną rundę — zapobiega zbyt szybkiemu klikaniu
      return {
        ...stateAfterSips,
        tram: stateAfterSips.tram
          ? { ...stateAfterSips.tram, tramAwaitingHostNext: true }
          : stateAfterSips.tram,
      };
  }
}
