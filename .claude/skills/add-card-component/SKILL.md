---
name: add-card-component
description: Generuje lub aktualizuje komponent <Card /> z wizualizacją karty do gry.
usage: /add-card-component [wariant]
example: /add-card-component large
---

# Skill: add-card-component

Tworzy lub rozszerza komponent `src/components/Card.tsx` o nowy wariant wizualny.

## Argumenty

- `$ARGUMENTS` — opcjonalny wariant: `small` | `large` | `back` (rewers karty) | `animated`

## Plik docelowy

`src/components/Card.tsx`

## Interfejs komponentu

```typescript
interface CardProps {
  rank: Rank;           // z src/shared/types.ts
  suit: Suit;           // z src/shared/types.ts
  faceDown?: boolean;   // rewers karty
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

## Zasady

- Używaj Tailwind CSS (bez inline styles)
- Kolory: ♥ ♦ = czerwony (`text-red-600`), ♠ ♣ = czarny (`text-gray-900`)
- Tło karty: białe z zaokrąglonymi rogami i cieniem (`rounded-xl shadow-md bg-white`)
- Rewers: ciemno-niebieskie paski lub gradient
- Komponent czysto prezentacyjny — zero logiki gry, zero Socket.IO
- Responsywny: size `sm` dla listy, `lg` dla głównego wyświetlenia

## Symbole

```typescript
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RANK_LABELS = { A: 'A', 2: '2', ..., 10: '10', J: 'J', Q: 'Q', K: 'K' };
```
