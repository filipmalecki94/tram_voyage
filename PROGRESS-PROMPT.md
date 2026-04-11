# Prompt dla Claude Code — Etap 8

Realizujesz **Etap 8** z planu zawartego w `PLAN.md`.

## Treść planu

Etap 8 implementuje pełną grę w trzech sekwencyjnych etapach — szczegółowa specyfikacja
w `PLAN.md` (sekcja „Etap 8") oraz pełne zasady w `.claude/docs/game-rules.md`.

Skrót:
- **Etap 1 (collecting):** 4 globalne rundy — każdy gracz ciągnie po 1 karcie per runda, zgadując (kolor → wyżej/niżej → pomiędzy/poza → symbol). Możliwa tęcza w Rundzie 4.
- **Etap 2 (pyramid):** 10 zasłoniętych kart w piramidzie (1+2+3+4), odsłaniamy po kolei; gracz z pasującą rangą w ręce rozdaje kolejki do picia (1–4 w zależności od poziomu). Na koniec wyłaniamy tramwajarza.
- **Etap 3 (tram):** wyłoniony tramwajarz ciągnie karty wyżej/niżej, musi trafić 5 z rzędu; błąd = pije + restart etapu (nowa talia).

## Kontekst aktualnego stanu

Po Etapie 7 działa stabilne MVP:
- Automatyczny reconnect, toasty (`sonner`), animacje CSS
- 42/42 testy zielone; 0 błędów TS

Aktualny stan kodu, który musisz rozszerzyć:

- `src/shared/types.ts`: brak `gamePhase` (tylko `status: 'waiting'|'playing'|'ended'`), brak `Player.hand`; pole `Player.sips` istnieje ale **nigdy nie jest inkrementowane**
- `src/server/game-engine.ts`: eksportuje `createDeck`, `shuffle`, `createGame`, `drawCard`, `nextTurn`, `isGameOver` — brak faz gry, brak logiki zbierania kart, piramidy, tram
- `src/server/socket-handlers.ts` linia ~107: handler `game:drawCard` **automatycznie woła `nextTurn` po każdym draw** — tę semantykę trzeba zmienić, bo w nowym modelu tura kończy się po `collectingGuess`, nie po samym ciągnięciu
- `game:guess` jest udokumentowane w `.claude/docs/socket-protocol.md` ale **nigdzie nie zaimplementowane** — zastępujemy je nowymi eventami (`game:collectingGuess`, `game:pyramidAssign`, `game:pyramidNext`, `game:tramGuess`)

## Twoje zadanie

1. Przeczytaj `.claude/docs/game-rules.md` — pełne zasady trzech etapów.
2. Zaktualizuj `src/shared/types.ts`:
   - Dodaj typ `GamePhase: 'collecting' | 'pyramid' | 'tram' | 'ended'`
   - Dodaj `Player.hand: Card[]`
   - Dodaj `RoomState.gamePhase: GamePhase` oraz sub-stany `collecting`, `pyramid`, `tram`
   - Zaktualizuj `PublicRoomState` i `toPublicRoomState()` (ukryj talię, odkryj rękę gracza tylko właścicielowi — albo przekazuj pełny stan i filtruj po stronie kontrolera)
3. Rozszerz `src/server/game-engine.ts` o nowe czyste funkcje (lista w `PLAN.md`):
   `startCollecting`, `collectingGuess`, `isRainbowAvailable`, `missingSuit`,
   `enterPyramid`, `revealPyramidCard`, `pyramidAssignSips`, `pickTramPlayer`,
   `enterTram`, `tramGuess`
4. Zaktualizuj `src/server/schemas.ts` — schematy zod dla nowych eventów
5. Zaktualizuj `src/server/socket-handlers.ts`:
   - Usuń automatyczne `nextTurn` z handlera `game:drawCard` (lub usuń ten handler zupełnie jeśli nie jest już potrzebny)
   - Dodaj handlery: `game:collectingGuess`, `game:pyramidAssign`, `game:pyramidNext`, `game:tramGuess`
6. Zaktualizuj UI kontrolera `src/app/room/[code]/page.tsx`:
   - Wachlarz kart w ręce przy dolnej krawędzi (posortowany, częściowo ukryty)
   - Przyciski zgadywania zależne od etapu i rundy (patrz `PLAN.md` → sekcja UI kontrolera)
   - Tęcza: podświetlenie tęczowe brakującego symbolu w Rundzie 4
7. Zaktualizuj widok stołu `src/app/table/[code]/page.tsx`:
   - Wyświetlaj bieżący etap i rundę
   - Piramida w Etapie 2, streak w Etapie 3
8. Napisz testy jednostkowe w `tests/game-engine.test.ts` (lista w `PLAN.md` → sekcja Testy)
9. Upewnij się że testy przechodzą: `npm run test:run` i `npx tsc --noEmit`
10. Po ukończeniu edytuj `PROGRESS.md`: oznacz Etap 8 jako `[x]` i dodaj notatki

## Uwagi

- **Grafika robocza** — nie tracimy czasu na pixel-perfect; polerujemy w osobnym etapie
- Zachować architekturę: czyste funkcje w `game-engine.ts`, zod na wejściu handlerów, pełny `RoomState` snapshot zamiast diffów
- Zaczynaj od **typów → logiki engine → testy jednostkowe** zanim dotkniesz UI
- Obsługa filtrowania ręki: klient powinien widzieć tylko swoją rękę (nie innych graczy); albo `PublicRoomState` zawiera `handsByPlayerId` i klient filtruje, albo serwer wysyła `hand` tylko właścicielowi
- `Player.sips` jest już w typach — wystarczy go inkrementować; nie przepisuj całego modelu gracza
