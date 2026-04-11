# Tramwajarz — Progress

| Etap | Nazwa | Status |
|---|---|---|
| **0** | Konfiguracja Claude Code | [x] |
| **1** | Szkielet projektu Next.js | [x] |
| **2** | Logika gry (czysta, bez sieci) | [x] |
| **3** | Warstwa realtime (Socket.IO) | [x] |
| **4** | UI: landing + kontroler telefonu | [x] |
| **5** | Widok stołu + QR | [x] |
| **6** | Docker + deploy na mikr.us | [x] |
| **7** | Polish + reconnect | [x] |
| **8** | Pełne zasady Tramwajarza (iteracja 2) | [x] |

## Notatki

### Etap 8 (2026-04-11)
- **Architektura faz:** `RoomState` rozszerzony o `gamePhase: GamePhase | null`, `collecting`, `pyramid`, `tram`, `winnerId`. Sub-stany jako osobne pola (nie tagged union) — prostsze zmiany w wielu miejscach.
- **Ręka graczy w stanie publicznym:** `PublicRoomState.handsByPlayerId: Record<string, Card[]>` — cały snapshot, klient filtruje po swoim `playerId`. Ukrywa nieodkryte karty piramidy (null) i `tram.deck` (tylko `tramDeckLeft`).
- **Usunięcie `game:drawCard`:** zastąpiony przez `game:collectingGuess` i `game:tramGuess`, które atomowo zdejmują kartę i rozstrzygają wynik.
- **Automatyczne przejścia faz:** `collectingGuess` → `enterPyramid` po R4 ostatniego gracza; `pyramidNext` → `enterTram` po 10 odsłonięciach.
- **Tęcza:** wykrywana po stronie klienta (`isRainbowAvailable`, `missingSuit`) dla UI + weryfikowana po stronie serwera w engine.
- **Testy:** 50 testów game-engine (nowe) + 22 pozostałe = 72/72 zielone. `npx tsc --noEmit` = 0 błędów. `npm run build` = zielony.
- **UI:** wachlarz kart (`fixed bottom` z translateX/rotate per karta), przyciski zależne od fazy/rundy, wizualizacja piramidy (Card|null layout), streak counter 0/5 w Etapie 3.

### Etap 7 (2026-04-11)
- **Auto-reconnect:** `socket.io-client` skonfigurowany jawnie (`reconnectionDelay: 500ms`, `reconnectionDelayMax: 3000ms`). `RoomPage` rejestruje listener `socket.on('connect')` z flagą `wasDisconnected` — wywołuje `room:rejoin` tylko przy właściwym reconnect (nie przy pierwszym mount).
- **Toasty (`sonner`):** `npx shadcn@latest add sonner` → `src/components/ui/sonner.tsx`. `<Toaster richColors position="top-center" />` dodany do `layout.tsx`. Błędy join (`no_room`, `room_full`, fallback) wyświetlane przez `toast.error()`. Status połączenia (`disconnected`/`reconnecting` → `toast.loading`, `connected` po disconnect → `toast.success`) z identyfikatorem `id: 'reconn'` żeby sonner podmieniał zamiast dorzucać kolejne.
- **Animacja karty:** `@keyframes card-in` + klasa `.card-in` przeniesione do `globals.css` z `prefers-reduced-motion`. Widok stołu reużywa klasy (`className="card-in"` zamiast inline `style + <style>`). Kontroler: `<div key={myLastCardKey} className="card-in">` — `myLastCardKey` inkrementowany przy każdej własnej karcie, co wymusza remount i ponowne odpalenie animacji.
- **Nowe testy (42/42 zielone):** rejoin po `markDisconnected` flipuje `isConnected`, rejoin po `cleanupStale` zwraca null, rejoin po `leaveRoom` zwraca null (token usunięty).
- **Decyzje:** brak oddzielnego TTL tokenów (tokeny żyją z pokojem); limit 12 graczy był już zaimplementowany — nie wymagał zmian.

<!-- Aktualizuj po każdym etapie: co zostało zrobione, co odblokowane, decyzje podjęte w trakcie -->

### Etap 6 (2026-04-11)
- `Dockerfile` multi-stage: `deps` (npm ci) → `builder` (next build + esbuild server.ts → dist/server.js) → `runner` (node:20-alpine, tylko prod deps)
  - **Decyzja:** zamiast `npx tsc` użyto `esbuild --bundle --packages=external` — szybciej i produkuje jeden plik JS bez potrzeby kopiowania node_modules do dist
  - `tsx` przeniesiony do devDependencies (runtime `node dist/server.js`, bez tsx)
- `docker-compose.yml` — serwis `tramwajarz` ciągnie obraz z GHCR (`ghcr.io/$GHCR_OWNER/tram_voyage:latest`), konfigurowany przez `.env` na VPS (BIND_IP, TRAM_PORT, GHCR_OWNER); healthcheck przez `wget /api/health`
- `src/app/api/health/route.ts` — `GET → { ok: true }` z `force-dynamic`
- `.github/workflows/deploy.yml` — CI/CD pipeline:
  1. `test` — npm ci + vitest + tsc --noEmit
  2. `build-and-push` — docker buildx push do GHCR (tag `latest` + `sha-*`), GHA cache layers
  3. `deploy` — SSH do VPS: docker login GHCR → `docker compose pull` → `docker compose up -d` → curl healthcheck
  - **Decyzja:** GHCR zamiast `docker save | ssh` z PLAN.md — CI/CD przez GitHub Actions jest powtarzalny i nie wymaga ręcznych kroków; obraz ~300 MB nie blokuje pipeline dzięki layer cache
- Fixupy po pierwszym deploy:
  - VPS musiał się zalogować do GHCR przed `docker compose pull` (token z `$GITHUB_TOKEN` przez `envs:`)
  - `playerId` zmieniany na UUID generowany przez serwer (`crypto.randomUUID()`) zamiast `socket.id` — socket.id zmienia się po reconnect, UUID-based token przeżywa odświeżenie

### Etap 5 (2026-04-10)
- `npm install qrcode` + `@types/qrcode` — generator SVG QR po stronie serwera
- `src/app/api/qr/[code]/route.ts` — GET route zwracający `image/svg+xml`; klient podaje `?url=` z pełnym adresem (bo server nie zna LAN IP — `window.location.origin` przesyłany z frontendu)
- `src/components/QrPoster.tsx` — prezentacyjny: `<img>` zamiast `next/image` (unika konfiguracji loaderów dla dynamicznego SVG route)
- `src/app/table/[code]/page.tsx` — fullscreen dark-theme widok stołu:
  - lewa kolumna: `<QrPoster>` z dynamicznym `joinUrl` ustawionym po mount (SSR-safe: `useState('')` + `useEffect`)
  - prawa kolumna: lista graczy z awatarkami (inicjał + kolor z `hashNick(nick) % 8`), aktywna tura podświetlona (bg-white + scale-105), stos 5 ostatnich kart (`drawnCards.slice(-5).reverse()`), animacja `card-in` dla najnowszej karty przez `game:card_drawn` event
  - `table:subscribe` wysyłane przez `emit` z `useRoom` na mount; serwer dorzuca socket do room i pushuje `room:state`
- 39/39 testów zielone; 0 błędów TS

### Etap 4 (2026-04-10)
- `src/components/Card.tsx` — presentacyjny komponent karty (mast + ranga, unicode suitów, 3 rozmiary: sm/md/lg); zero logiki
- `src/app/page.tsx` — landing client component: wspólny input nick, CTA „Stwórz stół" + „Dołącz kodem" z inline walidacją i obsługą błędów
- `src/app/room/[code]/page.tsx` — widok kontrolera: rejoin przez localStorage token (`tram:token:<code>`), formularz dołączenia, lista graczy z oznaczeniami (ty/host/aktywna tura), widok waiting (start dla hosta, ≥2 graczy), widok playing (przycisk „Ciągnij kartę" tylko dla aktywnego gracza, komunikat tury, sekcja „Twoja ostatnia karta"), widok ended z łykami
- `src/lib/use-room.ts` — drobna poprawka typów `Payload<E>` / `Response<E>`: zmiana `cb: unknown` → `cb: (r: unknown) => void` i `p: unknown` → `p: never` żeby warunkowe conditional types działały z `strictFunctionTypes`
- playerId śledzony przez `localStorage.setItem('tram:playerId:<code>', socket.id)` po room:create/join
- 39/39 testów zielone; 0 błędów TS

### Etap 3 (2026-04-10)
- `socket.io` ^4.8.1 + `socket.io-client` ^4.8.1 + `tsx` ^4.19.3 dodane do package.json
- `server.ts` — custom Next.js 16 + Socket.IO server; dev: `tsx watch server.ts`
- `src/shared/types.ts` — `Player` rozszerzony o `sips`/`isConnected`; `RoomState.status` dodane `'waiting'`; `drawnCards: Card[]` zamiast `lastDrawnCard`; nowe typy `PublicPlayer`, `PublicRoomState` + `toPublicRoomState()`
- `src/shared/socket-events.ts` — `ClientToServerEvents`, `ServerToClientEvents`, `SocketData`, aliasy `AppServer`/`AppSocket`/`AppClientSocket`
- `src/server/schemas.ts` — zod schematy dla C→S + helper `validate()`
- `src/server/room-manager.ts` — in-memory `Map<code, RoomState>`, 12 graczy limit, token-based rejoin, `cleanupStale()` z metadata TTL (nie `setInterval` w konstruktorze)
- `src/server/socket-handlers.ts` — `registerSocketHandlers()`: room:create/join/rejoin/leave, table:subscribe, game:start/drawCard, disconnect
- `src/lib/socket-client.ts` — lazy singleton `getSocket()`
- `src/lib/use-room.ts` — `useRoom()` → `{ state, error, emit }` + `useRoomRejoin()` helper
- 39/39 testów zielonych (20 game-engine + 14 room-manager + 5 code-generator); 0 błędów TS

### Etap 2 (2026-04-10)
- `vitest` ^3.0.0 + `zod` ^3.24.0 dodane do package.json; skrypty `test` i `test:run`
- `vitest.config.ts` z aliasem `@/*` → `src/*`
- `src/server/game-engine.ts` — pure functions: `createDeck`, `shuffle`, `createGame`, `drawCard`, `nextTurn`, `isGameOver`; `GameState = RoomState` (bez duplikowania typów)
- `src/server/code-generator.ts` — alfabet bez 0/O/1/I, injectowalny RNG
- 24/24 testów zielone; 0 błędów TS; zero importów Socket.IO/Next w logice gry

### Etap 1 (2026-04-10)
- Next.js **16.2.3** (CNA pobrał najnowszy — PLAN.md mówił o v15, ale v16 ma to samo API App Router)
- Tailwind **v4** — globals.css używa `@import "tailwindcss"` zamiast dyrektyw v3
- shadcn init v4.2.0 — wykrył Tailwind v4, poprawnie skonfigurował; zainstalował też `button.tsx` jako przykładowy komponent (zostawiony)
- `npm run build` → zielony; `npx tsc --noEmit` → 0 błędów
- Struktury `src/{components,lib,server,shared}` i `tests/` gotowe
