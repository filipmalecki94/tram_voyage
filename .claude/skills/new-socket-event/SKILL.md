---
name: new-socket-event
description: Dodaje nowy event Socket.IO end-to-end — typ, handler serwera, emiter klienta i test.
usage: /new-socket-event <nazwa-eventu>
example: /new-socket-event game:kick
---

# Skill: new-socket-event

Dodaje kompletny nowy event Socket.IO do projektu Tramwajarz.

## Argumenty

- `$ARGUMENTS` — nazwa eventu w formacie `namespace:action`, np. `game:kick`

## Co zrobić

Dla eventu `$ARGUMENTS`:

### 1. `src/shared/types.ts`

Dodaj:
- typ payloadu żądania: `<PascalCase>Payload`
- typ payloadu odpowiedzi (jeśli event emituje odpowiedź)
- dodaj do union typów `ClientToServerEvents` i/lub `ServerToClientEvents`

### 2. `src/server/socket-handlers.ts`

Dodaj handler:
```typescript
socket.on('$ARGUMENTS', (payload: unknown) => {
  const data = <PayloadSchema>.parse(payload); // zod
  // logika
  io.to(roomCode).emit('room:state', newState);
});
```

### 3. `src/lib/socket-client.ts` lub odpowiedni hook

Dodaj helper do emitowania eventu z klienta.

### 4. `tests/socket-handlers.test.ts` (stwórz jeśli nie istnieje)

Dodaj test weryfikujący:
- event z poprawnym payloadem → właściwy broadcast
- event z błędnym payloadem → `error` emitowany do klienta

## Zasady

- Payload zawsze walidowany przez zod przed dotknięciem logiki
- Autoryzacja: sprawdź czy `socket.data.playerId` ma prawo wykonać akcję
- Broadcast pełny `room:state` po każdej mutacji stanu gry
