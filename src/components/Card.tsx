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
  xl: 'w-56 h-80 text-2xl',
  fill: 'w-full h-full',
};

const SUIT_CENTER_SIZE = {
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-7xl',
  xl: 'text-9xl',
  fill: '',
};

interface Props {
  card?: CardType;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fill';
}

export function Card({ card, faceDown = false, size = 'md' }: Props) {
  const isFill = size === 'fill';
  const cornerStyle = isFill ? { fontSize: 'clamp(0.5rem, 10cqw, 2.5rem)' } : undefined;
  const centerStyle = isFill ? { fontSize: 'clamp(1rem, 50cqw, 12rem)' } : undefined;

  if (faceDown) {
    return (
      <div
        className={`@container relative bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-blue-950 rounded-xl shadow-md flex items-center justify-center select-none ${SIZE_CLASSES[size]}`}
        aria-label="Karta zakryta"
      >
        <span
          className={`${SUIT_CENTER_SIZE[size]} leading-none text-blue-400 opacity-60`}
          style={centerStyle}
        >
          ♦
        </span>
      </div>
    );
  }

  const c = card!;
  const symbol = SUIT_SYMBOL[c.suit];
  const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
  const colorClass = isRed ? 'text-red-600' : 'text-neutral-900';
  const label = `${c.rank}${symbol}`;

  return (
    <div
      className={`@container relative bg-white border-2 border-neutral-300 rounded-xl shadow-md flex items-center justify-center select-none ${SIZE_CLASSES[size]} ${colorClass}`}
      aria-label={label}
    >
      {/* Lewy górny róg */}
      <span className="absolute top-1 left-1.5 leading-none font-bold" style={cornerStyle}>
        {c.rank}
        <br />
        {symbol}
      </span>

      {/* Środek */}
      <span className={`${SUIT_CENTER_SIZE[size]} leading-none`} style={centerStyle}>{symbol}</span>

      {/* Prawy dolny róg (obrócony) */}
      <span className="absolute bottom-1 right-1.5 leading-none font-bold rotate-180" style={cornerStyle}>
        {c.rank}
        <br />
        {symbol}
      </span>
    </div>
  );
}
