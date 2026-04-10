export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string;
  nick: string;
  joinedAt: number;
  sips: number;
  isConnected: boolean;
}

export interface RoomState {
  code: string;
  players: Player[];
  hostId: string | null;
  status: 'waiting' | 'playing' | 'ended';
  deck: Card[];
  currentTurnPlayerId: string | null;
  drawnCards: Card[];
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
}

export function toPublicRoomState(s: RoomState): PublicRoomState {
  return {
    code: s.code,
    status: s.status,
    players: s.players.map(({ id, nick, sips, isConnected }) => ({
      id,
      nick,
      sips,
      isConnected,
    })),
    currentPlayerId: s.currentTurnPlayerId,
    hostPlayerId: s.hostId,
    drawnCards: s.drawnCards,
    cardsLeft: s.deck.length,
  };
}
