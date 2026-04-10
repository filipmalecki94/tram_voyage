import type { Card, Player, RoomState, Suit, Rank } from '@/shared/types';

export type GameState = RoomState;
export type RNG = () => number;

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];

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

export function createGame(players: Player[], rng: RNG): GameState {
  if (players.length < 2) {
    throw new Error('Potrzeba co najmniej 2 graczy');
  }
  const deck = shuffle(createDeck(), rng);
  return {
    code: '',
    players,
    hostId: players[0].id,
    status: 'playing',
    deck,
    currentTurnPlayerId: players[0].id,
    drawnCards: [],
  };
}

export function drawCard(
  state: GameState,
  playerId: string,
): { state: GameState; card: Card } {
  if (state.status !== 'playing') {
    throw new Error('Gra nie jest w toku');
  }
  if (state.currentTurnPlayerId !== playerId) {
    throw new Error('Nie twoja tura');
  }
  if (state.deck.length === 0) {
    throw new Error('Talia jest pusta');
  }
  const [card, ...remainingDeck] = state.deck;
  const newState: GameState = {
    ...state,
    deck: remainingDeck,
    drawnCards: [...state.drawnCards, card],
  };
  return { state: newState, card };
}

export function nextTurn(state: GameState): GameState {
  const currentIndex = state.players.findIndex(
    (p) => p.id === state.currentTurnPlayerId,
  );
  const nextIndex = (currentIndex + 1) % state.players.length;
  const nextPlayerId = state.players[nextIndex].id;
  const isOver = state.deck.length === 0;
  return {
    ...state,
    currentTurnPlayerId: isOver ? null : nextPlayerId,
    status: isOver ? 'ended' : state.status,
  };
}

export function isGameOver(state: GameState): boolean {
  return state.deck.length === 0 || state.status === 'ended';
}
