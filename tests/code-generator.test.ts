import { describe, it, expect } from 'vitest';
import { generateRoomCode } from '@/server/code-generator';

const ALPHABET = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''));

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

describe('generateRoomCode', () => {
  it('generuje string o długości 6', () => {
    expect(generateRoomCode(6, seededRng(1))).toHaveLength(6);
  });

  it('wszystkie znaki z dozwolonego alfabetu', () => {
    const code = generateRoomCode(6, seededRng(1));
    for (const char of code) {
      expect(ALPHABET.has(char)).toBe(true);
    }
  });

  it('deterministyczny przy tym samym seedzie', () => {
    const a = generateRoomCode(6, seededRng(42));
    const b = generateRoomCode(6, seededRng(42));
    expect(a).toBe(b);
  });

  it('różne kody przy różnych seedach', () => {
    const a = generateRoomCode(6, seededRng(1));
    const b = generateRoomCode(6, seededRng(2));
    expect(a).not.toBe(b);
  });

  it('nie zawiera mylących znaków (0, O, 1, I)', () => {
    const forbidden = new Set(['0', 'O', '1', 'I']);
    for (let seed = 0; seed < 100; seed++) {
      const code = generateRoomCode(6, seededRng(seed));
      for (const char of code) {
        expect(forbidden.has(char)).toBe(false);
      }
    }
  });
});
