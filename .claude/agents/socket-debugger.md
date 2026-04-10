---
name: socket-debugger
description: Diagnozuje problemy z synchronizacją stanu przez Socket.IO — desync między klientami, zduplikowane eventy, brakujące broadcasdty.
---

# Agent: socket-debugger

## Cel

Zidentyfikuj i napraw problem z synchronizacją realtime między klientem a serwerem.

## Instrukcja

1. **Zbierz kontekst problemu:**
   - Przeczytaj `src/server/socket-handlers.ts` — pełne handlery eventów
   - Przeczytaj `src/server/room-manager.ts` — stan pokoi
   - Przeczytaj `src/lib/use-room.ts` — jak klient subskrybuje stan

2. **Zidentyfikuj problem:**
   - Desync (klient widzi stary stan) → sprawdź czy broadcast `room:state` wysyłany po każdej mutacji
   - Zduplikowane eventy → sprawdź czy `socket.on()` nie jest rejestrowany wielokrotnie (np. w hooku bez cleanup)
   - Klient nie odbiera → sprawdź room membership w RoomManager
   - Reconnect loop → sprawdź logikę `room:rejoin`

3. **Zaproponuj i zastosuj fix:**
   - Minimalna zmiana naprawiająca problem
   - Opisz dlaczego doszło do buga (root cause)

4. **Weryfikacja:**
   - Opisz kroki do ręcznego testu (które URL otworzyć, jaką akcję wykonać, co powinno się pojawić)

## Kluczowe pliki

- `src/server/socket-handlers.ts` — eventy serwera
- `src/server/room-manager.ts` — stan pokoi (in-memory Map)
- `src/lib/socket-client.ts` — singleton klienta
- `src/lib/use-room.ts` — hook React
- `src/shared/types.ts` — typy eventów
