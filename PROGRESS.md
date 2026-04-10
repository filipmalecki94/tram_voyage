# Tramwajarz — Progress

| Etap | Nazwa | Status |
|---|---|---|
| **0** | Konfiguracja Claude Code | [x] |
| **1** | Szkielet projektu Next.js | [x] |
| **2** | Logika gry (czysta, bez sieci) | [x] |
| **3** | Warstwa realtime (Socket.IO) | [x] |
| **4** | UI: landing + kontroler telefonu | [x] |
| **5** | Widok stołu + QR | [x] |
| **6** | Docker + deploy na mikr.us | [ ] |
| **7** | Polish + reconnect | [ ] |
| **8** | Pełne zasady Tramwajarza (iteracja 2) | [ ] |

## Notatki

<!-- Aktualizuj po każdym etapie: co zostało zrobione, co odblokowane, decyzje podjęte w trakcie -->

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
