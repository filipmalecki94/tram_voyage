'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';

interface Props {
  hand: CardType[];
}

export function ActivePlayerFan({ hand }: Props) {
  const [viewportWidth, setViewportWidth] = useState(375);

  useEffect(() => {
    setViewportWidth(window.innerWidth);
    const h = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const cards = hand.length > 0 ? hand : null;
  const cardCount = cards ? cards.length : 1;

  function peekStyle(i: number, total: number): React.CSSProperties {
    const offset = i * 18 - ((total - 1) * 18) / 2;
    return {
      transform: `translateX(${offset}px)`,
      zIndex: i,
      pointerEvents: 'none',
    };
  }

  return (
    <div
      className="relative h-8 overflow-hidden -mt-2"
      aria-label="Ręka aktywnego gracza"
    >
      <div className="absolute inset-x-0 top-0 flex justify-center items-start">
        {cards && cards.map((c, i) => (
          <div key={`peek-${c.suit}-${c.rank}-${i}`} className="absolute" style={peekStyle(i, cardCount)}>
            <div style={{ transform: 'rotate(180deg)' }}>
              <Card card={c} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
