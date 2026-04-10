---
name: game-phase
description: Dodaje nową fazę do state machine GameEngine (iteracja 2 — pełne zasady Tramwajarza).
usage: /game-phase <nazwa-fazy>
example: /game-phase highLow
---

# Skill: game-phase

Rozszerza `GameEngine` o nową fazę zgadywania. Używać przy implementacji Etapu 8 (pełne zasady Tramwajarza).

## Argumenty

- `$ARGUMENTS` — nazwa fazy: `color` | `highLow` | `insideOutside` | `suit`

## Kontekst (przeczytaj przed implementacją)

- `src/server/game-engine.ts` — obecna logika
- `src/shared/types.ts` — typy `GameState`, `Phase`
- `.claude/docs/game-rules.md` — pełne zasady z opisem każdej fazy

## Co zrobić

### 1. `src/shared/types.ts`

Dodaj fazę do union `Phase` i odpowiedni typ odpowiedzi gracza (np. `ColorGuess = 'red' | 'black'`).

### 2. `src/server/game-engine.ts`

Dodaj funkcję `guess<PhaseName>(state: GameState, playerId: string, answer: <GuessType>): GameState`:
- Waliduj że to tura gracza i odpowiednia faza
- Sprawdź poprawność odpowiedzi (logika z `game-rules.md`)
- Jeśli błąd → dodaj łyki do gracza, przejdź do następnej tury
- Jeśli poprawna → przejdź do następnej fazy lub następnej tury (jeśli ostatnia faza)
- Zwróć nowy niezmieniony `GameState` (immutable update)

### 3. `tests/game-engine.test.ts`

Dodaj testy:
- poprawna odpowiedź → przejście do następnej fazy
- błędna odpowiedź → kara (łyki) + reset do następnej tury
- edge case specyficzny dla tej fazy (np. `insideOutside`: karty o tej samej randze)

### 4. `src/server/socket-handlers.ts`

Dodaj/zaktualizuj handler `game:guess` żeby obsługiwał nową fazę.

## Zasady

- Każda faza to czysta funkcja, testowalna bez sieci
- `GameState` jest immutable — zawsze zwracaj nowy obiekt
- Łyki dla gracza przechowywane w `player.sips` (liczba int)
