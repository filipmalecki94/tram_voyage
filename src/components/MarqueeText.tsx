'use client';
import { useLayoutEffect, useRef, useState } from 'react';

const GAP_PX = 32; // w-8
const SCROLL_SPEED_PX_S = 30;

interface ScrollState {
  duration: number;
  shift: number;
}

export function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scroll, setScroll] = useState<ScrollState | null>(null);

  useLayoutEffect(() => {
    const check = () => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container || !textEl) return;
      const textWidth = textEl.getBoundingClientRect().width;
      const containerWidth = container.getBoundingClientRect().width;
      if (textWidth > containerWidth) {
        const cycleWidth = textWidth + GAP_PX;
        setScroll({ duration: cycleWidth / SCROLL_SPEED_PX_S, shift: cycleWidth });
      } else {
        setScroll(null);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span ref={containerRef} className={`overflow-hidden${className ? ` ${className}` : ''}`}>
      {scroll ? (
        <span
          className="inline-flex whitespace-nowrap nick-marquee"
          style={{
            animationDuration: `${scroll.duration}s`,
            '--nick-shift': `-${scroll.shift}px`,
          } as React.CSSProperties}
        >
          <span ref={textRef}>{text}</span>
          <span className="inline-block w-8" aria-hidden />
          <span aria-hidden>{text}</span>
          <span className="inline-block w-8" aria-hidden />
        </span>
      ) : (
        <span ref={textRef} className="whitespace-nowrap">{text}</span>
      )}
    </span>
  );
}
