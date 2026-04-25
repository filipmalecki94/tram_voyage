export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type GamePhase = 'collecting' | 'pyramid' | 'tram' | 'ended';

export type DrinkReason = 'collecting-miss' | 'collecting-rainbow' | 'pyramid-assign' | 'tram-lost';
export type DrinkResume = 'collecting-next' | 'pyramid-next' | 'tram-restart';

export interface DrinkGateEntry {
  playerId: string;
  sips: number;
  reason: DrinkReason;
  confirmed: boolean;
}

export interface DrinkGate {
  entries: DrinkGateEntry[];
  resumeAction: DrinkResume;
  context?: {
    streakCards?: Card[];
    tramPlayerId?: string;
  };
}

export interface CollectingSubState {
  round: 1 | 2 | 3 | 4;
  currentPlayerIdx: number;
  /** playerId który zgadł poprawnie i czeka na potwierdzenie "Zgadłem!" */
  pendingConfirm: string | null;
  /** Karta dobrana w bieżącej turze; null gdy tura się jeszcze nie zaczęła lub już zakończyła */
  currentCard: Card | null;
  /** Czytelna etykieta odpowiedzi którą wybrał aktualny gracz, np. "♠♣ Czarna", "▲ Wyżej" */
  lastGuess: string | null;
  /** Czy ostatnia odpowiedź była poprawna; null gdy karta jeszcze nie dobrana */
  lastGuessCorrect: boolean | null;
}

export interface PyramidPlayerDeal {
  /** Ile kolejek gracz ma jeszcze do rozdania */
  remainingSips: number;
  /** Łączna pula gracza na tę kartę (= level) */
  totalSips: number;
}

export interface PyramidSubState {
  /** layout[i] = karty na poziomie i+1 (0-indexed: level 1..4) */
  layout: Card[][];
  revealedLevels: number;
  revealedInLevel: number;
  currentCard: Card | null;
  /** Aktywne rozdania per gracz: playerId → pozostała pula. Puste = wszyscy rozdali. */
  activeDeals: Record<string, PyramidPlayerDeal>;
}

export interface PublicPyramidSubState {
  /** layout[i][j] = karta jeśli odkryta, null jeśli zasłonięta */
  layout: (Card | null)[][];
  revealedLevels: number;
  revealedInLevel: number;
  currentCard: Card | null;
  /** Poziom aktualnej karty (1–4), null gdy brak karty */
  currentCardLevel: number | null;
  /** Aktywne rozdania per gracz (playerId → pula). Puste = wszyscy rozdali. */
  activeDeals: Record<string, PyramidPlayerDeal>;
}

export interface TramSubState {
  deck: Card[];
  referenceCard: Card | null;
  lastCard: Card | null;
  streak: number;
  tramPlayerId: string;
  streakCards: Card[];
}

export interface PublicTramSubState {
  tramDeckLeft: number;
  referenceCard: Card | null;
  lastCard: Card | null;
  streak: number;
  tramPlayerId: string;
  streakCards: Card[];
}

export interface Player {
  id: string;
  nick: string;
  joinedAt: number;
  sips: number;
  isConnected: boolean;
  hand: Card[];
}

export interface RoomState {
  code: string;
  players: Player[];
  hostId: string | null;
  status: 'waiting' | 'playing' | 'ended';
  deck: Card[];
  currentTurnPlayerId: string | null;
  drawnCards: Card[];
  gamePhase: GamePhase | null;
  collecting: CollectingSubState | null;
  pyramid: PyramidSubState | null;
  tram: TramSubState | null;
  winnerId: string | null;
  drinkGate: DrinkGate | null;
}

export type PublicPlayer = Omit<Player, 'joinedAt'>;

export interface PublicRoomState {
  code: string;
  status: 'waiting' | 'playing' | 'ended';
  players: PublicPlayer[];
  currentPlayerId: string | null;
  hostPlayerId: string | null;
  drawnCards: Card[];
  cardsLeft: number;
  gamePhase: GamePhase | null;
  collecting: CollectingSubState | null;
  pyramid: PublicPyramidSubState | null;
  tram: PublicTramSubState | null;
  winnerId: string | null;
  handsByPlayerId: Record<string, Card[]>;
  drinkGate: DrinkGate | null;
}

export function toPublicRoomState(s: RoomState): PublicRoomState {
  const handsByPlayerId: Record<string, Card[]> = {};
  for (const p of s.players) {
    handsByPlayerId[p.id] = p.hand;
  }

  let publicPyramid: PublicPyramidSubState | null = null;
  if (s.pyramid) {
    const py = s.pyramid;
    const publicLayout: (Card | null)[][] = py.layout.map((levelCards, lvlIdx) => {
      return levelCards.map((card, cardIdx) => {
        // Poziom jest odkryty jeśli: lvlIdx < revealedLevels (w pełni odkryty)
        // lub lvlIdx === revealedLevels i cardIdx < revealedInLevel
        const isRevealed =
          lvlIdx < py.revealedLevels ||
          (lvlIdx === py.revealedLevels && cardIdx < py.revealedInLevel);
        return isRevealed ? card : null;
      });
    });
    // Wyznacz poziom aktualnej karty (1-indexed)
    let currentCardLevel: number | null = null;
    if (py.currentCard) {
      for (let lvl = 0; lvl < py.layout.length; lvl++) {
        if (py.layout[lvl].some((c) => c === py.currentCard)) {
          currentCardLevel = lvl + 1;
          break;
        }
      }
    }
    publicPyramid = {
      layout: publicLayout,
      revealedLevels: py.revealedLevels,
      revealedInLevel: py.revealedInLevel,
      currentCard: py.currentCard,
      currentCardLevel,
      activeDeals: py.activeDeals,
    };
  }

  let publicTram: PublicTramSubState | null = null;
  if (s.tram) {
    publicTram = {
      tramDeckLeft: s.tram.deck.length,
      referenceCard: s.tram.referenceCard,
      lastCard: s.tram.lastCard,
      streak: s.tram.streak,
      tramPlayerId: s.tram.tramPlayerId,
      streakCards: s.tram.streakCards,
    };
  }

  return {
    code: s.code,
    status: s.status,
    players: s.players.map(({ id, nick, sips, isConnected, hand }) => ({
      id,
      nick,
      sips,
      isConnected,
      hand,
    })),
    currentPlayerId: s.currentTurnPlayerId,
    hostPlayerId: s.hostId,
    drawnCards: s.drawnCards,
    cardsLeft: s.deck.length,
    gamePhase: s.gamePhase,
    collecting: s.collecting,
    pyramid: publicPyramid,
    tram: publicTram,
    winnerId: s.winnerId,
    handsByPlayerId,
    drinkGate: s.drinkGate,
  };
}
