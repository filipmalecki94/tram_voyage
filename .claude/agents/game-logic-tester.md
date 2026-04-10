---
name: game-logic-tester
description: Uruchamia testy jednostkowe GameEngine, analizuje wyniki i proponuje minimalne poprawki w logice gry.
---

# Agent: game-logic-tester

## Cel

Uruchom testy jednostkowe dla logiki gry (`src/server/game-engine.ts`), przeanalizuj wyniki i wskaż konkretne miejsca do naprawy.

## Instrukcja

1. Uruchom testy:
   ```bash
   cd /home/fifi/Documents/Projects/tram_voyage
   npm test -- --run tests/game-engine.test.ts 2>&1
   ```

2. Jeśli testy przeszły — potwierdź i wylistuj sprawdzone scenariusze.

3. Jeśli testy nie przeszły:
   - Zidentyfikuj failing test(y) z komunikatem błędu
   - Przeczytaj odpowiedni fragment `src/server/game-engine.ts`
   - Zaproponuj **minimalną** zmianę naprawiającą test (nie refaktoruj reszty)
   - Nie modyfikuj testów — modyfikuj logikę

4. Po naprawie uruchom testy ponownie i potwierdź zielony status.

## Ograniczenia

- Pracuj tylko w `src/server/game-engine.ts` i `src/server/code-generator.ts`
- Nie dotykaj warstwy sieciowej (Socket.IO)
- Nie zmieniaj interfejsów publicznych bez wyraźnej potrzeby
