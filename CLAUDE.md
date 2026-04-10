# Tramwajarz — CLAUDE.md

## Kontekst biznesowy

Webowa, wieloosobowa pijacka gra karciana „Tramwajarz". Przeznaczona na imprezy — każdy gracz używa swojego telefonu jako kontrolera, a wspólny ekran (laptop/TV) wyświetla stół. Bez rejestracji, bez kont — tylko nick i kod pokoju.

**Docelowi użytkownicy:** ~2–12 osób na imprezie, telefony z przeglądarką.

## Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript strict |
| Style | Tailwind CSS + shadcn/ui |
| Realtime | Socket.IO (custom `server.ts`) |
| Walidacja | zod (wszystkie eventy Socket.IO) |
| Testy | vitest |
| Deploy | Docker + Nginx na VPS mikr.us `robert193` |

## Konwencje

- Import paths: `@/*` → `src/*`
- Brak `any` — używaj `unknown` + type guard lub zod parse
- Brak `// eslint-disable` bez komentarza wyjaśniającego dlaczego
- Komponenty: PascalCase, pliki tsx
- Eventy Socket.IO: `namespace:action` (np. `room:create`, `game:drawCard`)

## Zasady architektury

1. **Logika gry jest serwerocentryczna** — `GameEngine` w `src/server/game-engine.ts` to czyste funkcje bez side-effectów. Klient wysyła intencje, serwer waliduje i broadcastuje nowy stan.
2. **Testy logiki bez sieci** — `game-engine.ts` nie importuje Socket.IO. Testowalny z vitest bez uruchamiania serwera.
3. **Pełny snapshot, nie diff** — serwer broadcastuje pełny `RoomState` po każdej zmianie. Prosto, odpornie na desync.
4. **Zod na wejściu** — każdy event od klienta przechodzi przez `zod.parse()` zanim dotknie logiki.

## Deployment

- **Build lokalnie**, push obrazu przez `docker save | ssh`. Nie buildujemy na VPS.
- Agent `deploy-vps` obsługuje pełny proces (patrz `.claude/agents/deploy-vps.md`).
- Nginx wymaga konfiguracji WebSocket upgrade dla `/socket.io/`.

## Mapa projektu

```
server.ts                   # Custom Next.js + Socket.IO server
src/
  app/
    page.tsx                # Landing: stwórz stół / dołącz kodem
    room/[code]/page.tsx    # Kontroler telefonu
    table/[code]/page.tsx   # Widok dużego ekranu
    api/
      qr/[code]/route.ts    # Generacja QR jako SVG
      health/route.ts       # Healthcheck dla Dockera
  components/
    Card.tsx                # Wizualizacja karty
    PlayerList.tsx          # Lista graczy z awatarkami
    JoinForm.tsx            # Formularz nicku
    QrPoster.tsx            # QR + kod pokoju
  lib/
    socket-client.ts        # Singleton io() z typami
    use-room.ts             # Hook useRoom(code) → live RoomState
  server/
    room-manager.ts         # Tworzenie/niszczenie pokoi, cleanup
    game-engine.ts          # Logika gry (czyste funkcje)
    socket-handlers.ts      # Handlery eventów Socket.IO
    code-generator.ts       # Generacja 6-znakowych kodów pokoi
  shared/
    types.ts                # Wspólne typy klient + serwer
tests/
  game-engine.test.ts
  room-manager.test.ts
```

## Eventy Socket.IO

Pełna specyfikacja: `.claude/docs/socket-protocol.md`

## Zasady Tramwajarza

Pełne zasady (do iteracji 2): `.claude/docs/game-rules.md`
