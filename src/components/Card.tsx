import type { Card as CardType } from '@/shared/types';

const SUIT_SYMBOL: Record<CardType['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SIZE_CLASSES = {
  sm: 'w-16 h-24 text-xs',
  md: 'w-24 h-36 text-sm',
  lg: 'w-40 h-56 text-base',
};

const SUIT_CENTER_SIZE = {
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-7xl',
};

interface Props {
  card: CardType;
  size?: 'sm' | 'md' | 'lg';
}

export function Card({ card, size = 'md' }: Props) {
  const symbol = SUIT_SYMBOL[card.suit];
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? 'text-red-600' : 'text-neutral-900';
  const label = `${card.rank}${symbol}`;

  return (
    <div
      className={`relative bg-white border-2 border-neutral-300 rounded-xl shadow-md flex items-center justify-center select-none ${SIZE_CLASSES[size]} ${colorClass}`}
      aria-label={label}
    >
      {/* Lewy górny róg */}
      <span className="absolute top-1 left-1.5 leading-none font-bold">
        {card.rank}
        <br />
        {symbol}
      </span>

      {/* Środek */}
      <span className={`${SUIT_CENTER_SIZE[size]} leading-none`}>{symbol}</span>

      {/* Prawy dolny róg (obrócony) */}
      <span className="absolute bottom-1 right-1.5 leading-none font-bold rotate-180">
        {card.rank}
        <br />
        {symbol}
      </span>
    </div>
  );
}
