# Socket.IO Protocol — Tramwajarz

## Konwencje

- Format eventów: `namespace:action`
- Każdy payload od klienta jest walidowany przez zod przed przetworzeniem
- Serwer zawsze emituje `room:state` (pełny snapshot) po każdej mutacji stanu
- Błędy: serwer emituje `error` wyłącznie do socket, który spowodował błąd

---

## Client → Server

### `room:create`

Tworzy nowy pokój. Host automatycznie dołącza jako pierwszy gracz.

**Payload:**
```typescript
{ hostNick: string }  // 1–20 znaków
```

**Odpowiedź (callback lub `room:state`):**
```typescript
{ code: string, playerId: string, token: string }
```

---

### `room:join`

Dołącza do istniejącego pokoju po kodzie.

**Payload:**
```typescript
{ code: string, nick: string }  // code: 6 znaków uppercase
```

**Odpowiedź:**
```typescript
{ playerId: string, token: string }  // + broadcast room:state
```

---

### `room:rejoin`

Przywraca sesję po rozłączeniu (np. odświeżenie strony).

**Payload:**
```typescript
{ code: string, token: string }
```

---

### `room:leave`

Gracza opuszcza pokój.

**Payload:** brak

---

### `table:subscribe`

Widok stołu (`/table/[code]`) subskrybuje pokój tylko do odczytu (bez gracza).

**Payload:**
```typescript
{ code: string }
```

---

### `room:reorderPlayers`

Zmienia kolejność graczy w lobby. Tylko host, tylko gdy `status === 'waiting'`. Kolejność tablicy `players[]` ma znaczenie — `players[0]` zaczyna grę.

**Payload:**
```typescript
{ playerIds: string[] }  // pełna tablica ID w nowej kolejności
```

**Walidacja:** host-only, status=waiting, identyczny zbiór ID (żaden gracz nie może być pominięty ani dodany), min 2, max 12.

---

### `game:start`

Uruchamia grę. Tylko host może wysłać.

**Payload:** brak

---

### `game:drawCard`

Gracz ciągnie kartę. Tylko gracz, którego tura, może wysłać.

**Payload:** brak

---

### `game:guess` *(iteracja 2)*

Gracz składa odpowiedź w bieżącej fazie.

**Payload:**
```typescript
{
  phase: 'color' | 'highLow' | 'insideOutside' | 'suit',
  answer: string  // 'red'|'black' | 'higher'|'lower' | 'inside'|'outside' | 'hearts'|'diamonds'|'clubs'|'spades'
}
```

---

## Server → Client

### `room:state`

Pełny snapshot stanu pokoju. Emitowany po każdej zmianie (broadcast do całego pokoju).

```typescript
interface RoomState {
  code: string;
  status: 'waiting' | 'playing' | 'ended';
  players: Player[];
  currentPlayerId: string | null;
  drawnCards: Card[];       // odkryte karty (ostatnie N, max 10 dla UI)
  cardsLeft: number;
  hostPlayerId: string;
}

interface Player {
  id: string;
  nick: string;
  sips: number;             // liczba łyków (iteracja 2)
  isConnected: boolean;
}

interface Card {
  rank: Rank;   // 'A'|'2'|...|'10'|'J'|'Q'|'K'
  suit: Suit;   // 'hearts'|'diamonds'|'clubs'|'spades'
}
```

---

### `game:card_drawn`

Emitowany po ciągnięciu karty (oprócz `room:state`). Używany do animacji.

```typescript
{ playerId: string; card: Card; cardsLeft: number }
```

---

### `game:ended`

Gra się skończyła (talia wyczerpana).

```typescript
{ finalSips: Array<{ playerId: string; nick: string; sips: number }> }
```

---

### `error`

Emitowany tylko do socket, który wysłał niepoprawny event.

```typescript
{ code: string; message: string }
// kody: ROOM_NOT_FOUND | NOT_YOUR_TURN | INVALID_PAYLOAD | ROOM_FULL | GAME_NOT_STARTED
```
