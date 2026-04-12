'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';

type FanState =
  | { mode: 'collapsed' }
  | { mode: 'spread' }
  | { mode: 'zoomed'; cardIndex: number };

interface HandFanProps {
  hand: CardType[];
}

export function HandFan({ hand }: HandFanProps) {
  const [fanState, setFanState] = useState<FanState>({ mode: 'collapsed' });
  const [viewportWidth, setViewportWidth] = useState(375);

  useEffect(() => {
    setViewportWidth(window.innerWidth);
    const handler = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const open = useCallback(() => setFanState({ mode: 'spread' }), []);
  const close = useCallback(() => setFanState({ mode: 'collapsed' }), []);
  const zoom = useCallback((i: number) => setFanState({ mode: 'zoomed', cardIndex: i }), []);
  const unzoom = useCallback(() => setFanState({ mode: 'spread' }), []);

  if (hand.length === 0) return null;

  const cardCount = hand.length;
  const isCollapsed = fanState.mode === 'collapsed';
  const isSpread = fanState.mode === 'spread';
  const isZoomed = fanState.mode === 'zoomed';

  // Dynamiczne obliczenia dla wachlarza
  const availableWidth = viewportWidth - 80;
  const cardSpacing = Math.min(48, cardCount <= 1 ? 0 : availableWidth / (cardCount - 1));
  const maxRotation = Math.min(cardCount * 4, 30);

  function getCardStyle(i: number): React.CSSProperties {
    if (isCollapsed) {
      // Karty nałożone, przesunięte poza dolną krawędź, widoczny tylko róg
      const collapsedOffset = i * 20 - ((cardCount - 1) * 20) / 2;
      return {
        transform: `translateX(${collapsedOffset}px) translateY(40px)`,
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: i,
        pointerEvents: 'none',
      };
    }
    // Spread i Zoomed — karty rozłożone w wachlarz
    const offset = (i - (cardCount - 1) / 2) * cardSpacing;
    const rotate = (i - (cardCount - 1) / 2) * (cardCount > 1 ? maxRotation / ((cardCount - 1) / 2) / 2 : 0);
    return {
      transform: `translateX(${offset}px) rotate(${rotate}deg) translateY(0px)`,
      transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      zIndex: i,
      pointerEvents: 'auto',
      cursor: 'pointer',
    };
  }

  return (
    <>
      {/* Backdrop w trybie spread — kliknięcie zamyka wachlarz */}
      {isSpread && (
        <div
          className="fixed inset-0 z-20"
          onClick={close}
        />
      )}

      {/* Kontener kart — zawsze obecny w DOM dla płynnych transitions */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 flex items-end justify-center z-30"
        style={{ height: isCollapsed ? '56px' : 'auto', paddingBottom: isCollapsed ? 0 : '16px' }}
      >
        {hand.map((card, i) => (
          <div
            key={`${card.rank}-${card.suit}`}
            className="absolute"
            style={getCardStyle(i)}
            onClick={isSpread ? (e) => { e.stopPropagation(); zoom(i); } : undefined}
          >
            <Card card={card} size="sm" />
          </div>
        ))}
      </div>

      {/* Hit area w trybie collapsed — kliknięcie otwiera wachlarz */}
      {isCollapsed && (
        <div
          className="fixed bottom-0 left-0 right-0 h-14 z-10 cursor-pointer"
          onClick={open}
        />
      )}

      {/* Overlay w trybie zoomed */}
      {isZoomed && (
        <div
          className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center"
          onClick={unzoom}
        >
          <div className="card-in">
            <Card card={hand[fanState.cardIndex]} size="xl" />
          </div>
        </div>
      )}
    </>
  );
}
