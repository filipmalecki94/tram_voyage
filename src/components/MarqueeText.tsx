'use client';
import { useLayoutEffect, useRef, useState } from 'react';

export function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useLayoutEffect(() => {
    const check = () => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container || !textEl) return;
      const diff = textEl.scrollWidth - container.clientWidth;
      setOverflowPx(diff > 0 ? diff : 0);
    };
    check();
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span ref={containerRef} className={`overflow-hidden${className ? ` ${className}` : ''}`}>
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap${overflowPx > 0 ? ' nick-marquee' : ''}`}
        style={overflowPx > 0 ? ({ '--marquee-offset': `-${overflowPx}px` } as React.CSSProperties) : undefined}
      >
        {text}
      </span>
    </span>
  );
}
