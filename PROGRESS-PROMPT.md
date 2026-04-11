# Prompt dla Claude Code — Etap 8

Realizujesz **Etap 8** z planu zawartego w `PLAN.md`.

## Treść planu

```markdown
## Etap 8 — Pełne zasady Tramwajarza (iteracja 2)

**Cel:** rozszerzyć `GameEngine` do state machine z 4 fazami zgadywania.

- `phase: 'color' | 'highLow' | 'insideOutside' | 'suit'`
- Akcja `guess(playerId, guess)` → aktualizacja fazy / koniec rundy / kara
- Licznik „łyków" dla graczy
- Zmiany UI: przyciski zgadywania zamiast samego „Ciągnij"
- Skill `/game-phase` (z Etapu 0) pomaga w generowaniu kolejnych faz
```

## Kontekst aktualnego stanu

Po Etapie 7 działa stabilne MVP:
- Automatyczny reconnect: `socket.on('connect')` → `room:rejoin` po każdym disconnect
- Toasty (`sonner`): błędy join, statusy połączenia
- Animacja `.card-in` w globals.css (widok stołu + kontroler)
- 42/42 testy zielone; 0 błędów TS

Zasady gry w szczegółach: `.claude/docs/game-rules.md`

## Twoje zadanie

1. Przeczytaj `.claude/docs/game-rules.md` — pełne zasady 4 faz zgadywania.
2. Rozszerz `src/server/game-engine.ts`:
   - Dodaj do `GameState` pole `phase: GuessPhase` i `roundCards: Card[]` (karty odkryte w bieżącej rundzie gracza)
   - Dodaj funkcję `guess(state, playerId, guess)` → `{ state, correct, sipsAwarded }` lub error
   - Logika: po poprawnej odpowiedzi w fazie 4 (`'suit'`) → tura przechodzi (`nextTurn`), nowa runda
   - Łyki: faza 1 = 1 łyk, faza 2 = 2, faza 3 = 3, faza 4 = 4 (przy błędnej odpowiedzi)
   - `drawCard` teraz ciągnie kartę i czeka na `guess` (nie przechodzi tury automatycznie)
3. Dodaj event Socket.IO `game:guess { guess: string }` po stronie klienta i handler serwera.
4. Zaktualizuj UI kontrolera (`room/[code]/page.tsx`):
   - Zamiast przycisku „Ciągnij kartę" → przyciski fazy (np. kolor: Czerwony/Czarny, wyżej/niżej itd.)
   - Wyświetl aktualną fazę i liczbę łyków gracza
5. Zaktualizuj widok stołu (`table/[code]/page.tsx`) — pokaż aktualną fazę i kto ile łyków naliczył.
6. Napisz testy jednostkowe dla `guess()` w `tests/game-engine.test.ts`.
7. Upewnij się że testy przechodzą: `npm run test:run` i `npx tsc --noEmit`.
8. Po ukończeniu edytuj `PROGRESS.md`:
   - Oznacz Etap 8 jako `[x]`
   - Dodaj notatki pod `### Etap 8`

## Uwagi
- Przed pisaniem kodu przeczytaj aktualny `src/server/game-engine.ts` i `src/shared/types.ts`
- Logika `guess()` powinna być czystą funkcją (bez side-effectów), testowalną bez sieci
- Użyj skilla `/game-phase` jeśli potrzebujesz wygenerować szkielet kolejnej fazy
- Trzymaj się zakresu etapu — nie przepisuj UI od zera, rozszerzaj istniejące komponenty
