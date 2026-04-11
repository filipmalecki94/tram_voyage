export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type GamePhase = 'collecting' | 'pyramid' | 'tram' | 'ended';

export interface CollectingSubState {
  round: 1 | 2 | 3 | 4;
  currentPlayerIdx: number;
}

export interface PyramidSubState {
  /** layout[i] = karty na poziomie i+1 (0-indexed: level 1..4) */
  layout: Card[][];
  revealedLevels: number;
  revealedInLevel: number;
  currentCard: Card | null;
  pendingSipsByPlayer: Record<string, number>;
}

export interface PublicPyramidSubState {
  /** layout[i][j] = karta jeśli odkryta, null jeśli zasłonięta */
  layout: (Card | null)[][];
  revealedLevels: number;
  revealedInLevel: number;
  currentCard: Card | null;
  pendingSipsByPlayer: Record<string, number>;
}

export interface TramSubState {
  deck: Card[];
  lastCard: Card | null;
  streak: number;
  tramPlayerId: string;
  streakCards: Card[];
}

export interface PublicTramSubState {
  tramDeckLeft: number;
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
    publicPyramid = {
      layout: publicLayout,
      revealedLevels: py.revealedLevels,
      revealedInLevel: py.revealedInLevel,
      currentCard: py.currentCard,
      pendingSipsByPlayer: py.pendingSipsByPlayer,
    };
  }

  let publicTram: PublicTramSubState | null = null;
  if (s.tram) {
    publicTram = {
      tramDeckLeft: s.tram.deck.length,
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
  };
}
