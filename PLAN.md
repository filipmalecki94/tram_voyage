# Plan: Tramwajarz — karciana gra imprezowa w przeglądarce

> **Lokalizacja projektu:** `/home/fifi/Documents/Projects/tram_voyage`
> **Plik docelowy:** `tram_voyage/PLAN.md` (utworzony po akceptacji tego planu)

## Context

Cel: webowa, wieloosobowa pijacka gra karciana "Tramwajarz". Gracze dołączają z telefonów do wspólnego stołu (pokoju) kodem/QR, kolejno ciągną karty z talii, a widok stołu można wyświetlić na laptopie/TV jako wspólny ekran imprezowy.

**Wymagania produktowe (ustalone):**
- Serwer centralny, autorytatywny stan gry (Next.js + Socket.IO)
- Dołączanie: kod pokoju + QR, bez rejestracji, tylko nick
- UI: telefony = kontrolery + osobny widok `/table/[code]` na duży ekran
- Deploy: VPS mikr.us `robert193` (Docker + Nginx)
- Scope MVP: podstawowy flow (pokój, talia, kolejka tur, ciągnięcie kart). Pełna logika zgadywania — iteracja 2.

## Stack (jedno zdanie przypomnienia)

Next.js 15 (App Router, TS) + Tailwind + shadcn/ui + Socket.IO (custom `server.ts`) + in-memory state + zod + Docker + Nginx reverse proxy na mikr.usie.

---

## Struktura etapów

| Etap | Nazwa | Cel | Deliverable |
|---|---|---|---|
| **0** | Konfiguracja Claude Code | Przygotować projekt pod efektywną pracę z Claude | `.claude/` skonfigurowane, CLAUDE.md, agenci, skills |
| **1** | Szkielet projektu | Pusty działający Next.js + TS + Tailwind | `npm run dev` wyświetla landing |
| **2** | Logika gry (czysta, bez sieci) | `GameEngine` + testy jednostkowe | `npm test` zielony |
| **3** | Warstwa realtime | Socket.IO + RoomManager + eventy | 2 karty przeglądarki widzą ten sam state |
| **4** | UI telefonu i landing | `/`, `/room/[code]` działające jako kontroler | Można utworzyć pokój i dołączyć |
| **5** | Widok stołu + QR | `/table/[code]` + generacja QR | Scenariusz imprezowy działa lokalnie |
| **6** | Docker + deploy na mikr.us | Obraz, compose, Nginx vhost | Publiczny URL, telefony z zewnątrz grają |
| **7** | Polish + reconnect | localStorage token, animacje, edge-cases | Stabilna sesja MVP |
| **8** *(iteracja 2, poza MVP)* | Pełne zasady Tramwajarza | State machine z 4 fazami zgadywania | Pełna gra pijacka |

---

## Etap 0 — Konfiguracja Claude Code

**Cel:** zanim napiszemy linię kodu, projekt ma być „samoopisujący się" dla Claude — z jasnym CLAUDE.md, dedykowanymi agentami do powtarzalnych zadań i skills, które skracają workflow.

### 0.1 Inicjalizacja repo

- `mkdir -p /home/fifi/Documents/Projects/tram_voyage`
- `cd tram_voyage && git init`
- `.gitignore` (Node, Next.js, `.env*`, `.claude/settings.local.json`)
- README.md (jedno zdanie: co to jest + link do PLAN.md)

### 0.2 `CLAUDE.md` projektu

Plik `tram_voyage/CLAUDE.md` z sekcjami:
- **Kontekst biznesowy:** co to za gra, do czego służy, grupa docelowa
- **Stack i konwencje:** Next.js 15 App Router, TS strict, Tailwind, shadcn/ui, import paths `@/*`
- **Zasady pracy:**
  - Logika gry zawsze testowalna bez sieci (pure functions w `src/server/game-engine.ts`)
  - Wszystkie eventy Socket.IO walidowane przez `zod`
  - Stan autorytatywny po stronie serwera — klient nigdy nie zakłada swojego stanu
  - Brak any, brak `// eslint-disable` bez uzasadnienia w komentarzu
- **Deployment:** VPS mikr.us, build lokalnie → push obrazu, nie buildujemy na VPS (zgodnie z memorką `feedback_n8n_deployment`)
- **Gdzie co jest:** mapa katalogów, wskazanie kluczowych plików

### 0.3 `.claude/` — konfiguracja narzędzi

```
tram_voyage/.claude/
├─ CLAUDE.md                 # (alias do głównego, albo rozszerzenie)
├─ agents/
│  ├─ game-logic-tester.md   # agent: uruchom vitest, przeanalizuj output
│  ├─ socket-debugger.md     # agent: loguj eventy, zdiagnozuj desync
│  └─ deploy-vps.md          # agent: build image → push → restart na mikr.us
├─ skills/
│  ├─ add-card-component/SKILL.md   # skill: dodaj nową wizualizację karty
│  ├─ new-socket-event/SKILL.md     # skill: dodaj event end-to-end (typ + handler + client)
│  └─ game-phase/SKILL.md           # skill: dodaj nową fazę do GameEngine (pod iterację 2)
├─ settings.json                     # allowedTools, hooks jeśli potrzeba
└─ docs/
   ├─ architecture.md               # diagram + decyzje
   ├─ game-rules.md                 # pełne zasady Tramwajarza (referencja)
   └─ socket-protocol.md            # spec eventów i payloadów
```

**Agenci (skrócone definicje):**
- `game-logic-tester` — odpala `npm test -- --run src/server/game-engine.test.ts`, raportuje które testy padły i proponuje minimalny fix w logice
- `socket-debugger` — analizuje logi Socket.IO, porównuje stan klienta z serwerem, wskazuje miejsce desyncu
- `deploy-vps` — kroki: `docker build`, `docker save | ssh robert193 docker load`, `docker compose up -d`, healthcheck

**Skills (komendy `/new-socket-event` itd.):**
- `new-socket-event <name>` — dodaje: typ w `shared/types.ts`, handler w `socket-handlers.ts`, emiter po stronie klienta, test
- `add-card-component` — generuje komponent `<Card rank suit />` z wariantami
- `game-phase` — szkielet nowej fazy state machine w `GameEngine`

### 0.4 `docs/game-rules.md`

Spisane zasady Tramwajarza (pełne, żeby iteracja 2 nie wymagała research'u):
- 4 fazy zgadywania: kolor → wyżej/niżej → w środku/poza → mastík (kolor karty)
- Kary: „łyki" rosnące z każdą fazą (1, 2, 3, 4)
- Zakończenie rundy: 4 poprawne = tura przechodzi
- Wariant drugiej rundy: piramida z odrzuconych kart

### 0.5 `PLAN.md` i `PROGRESS.md`

- `tram_voyage/PLAN.md` — **ten plik**, skopiowany do projektu
- `tram_voyage/PROGRESS.md` — tabela etapów ze statusami (`[ ]` / `[WIP]` / `[x]`), aktualizowana ręcznie po każdym etapie (zgodnie z memorką `project_plan_workflow`)

### 0.6 Weryfikacja etapu 0

- `ls tram_voyage/.claude/agents/*.md` → 3 pliki
- `ls tram_voyage/.claude/skills/*/SKILL.md` → 3 pliki
- Claude Code otwarty w `tram_voyage/` rozpoznaje agentów i skills (widoczne w `/agents`, `/skills`)
- `cat CLAUDE.md` — kompletny, bez placeholderów

---

## Etap 1 — Szkielet projektu Next.js

**Cel:** pusty projekt uruchamia się lokalnie.

- `npm create next-app@latest .` → TS, App Router, Tailwind, ESLint, bez `src/` default (użyjemy własnej struktury)
- Dodanie `shadcn/ui`: `npx shadcn@latest init`
- Struktura katalogów (patrz sekcja „Struktura projektu" poniżej)
- `src/shared/types.ts` ze szkieletem typów (`Card`, `Suit`, `Rank`, `Player`, `RoomState`)
- `src/app/page.tsx` — statyczna strona „Tramwajarz — MVP"
- Skrypt `npm run dev` działa, `npm run build` przechodzi

**Weryfikacja:** `http://localhost:3000` pokazuje landing.

---

## Etap 2 — Logika gry (pure, testowalna)

**Cel:** cała mechanika bez ani jednego importu sieciowego. Test-first.

**Pliki:**
- `src/server/game-engine.ts`
  - `createDeck()` — 52 karty
  - `shuffle(deck, rng)` — Fisher-Yates z injektowanym RNG (dla determinizmu w testach)
  - `createGame(players)` → `GameState`
  - `drawCard(state, playerId)` → `{ state, card }` lub `error`
  - `nextTurn(state)` → `GameState`
  - `isGameOver(state)` → `boolean`
- `src/server/code-generator.ts` — 6-znakowy kod z alfabetu bez pomyłek (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
- `tests/game-engine.test.ts` (vitest):
  - talia ma 52 unikalne karty
  - tasowanie jest deterministyczne przy tym samym seedzie
  - `drawCard` rzuca error jeśli nie tura gracza
  - `drawCard` zmniejsza talię o 1
  - `nextTurn` cyklicznie przechodzi po graczach
  - `isGameOver` gdy talia pusta

**Weryfikacja:** `npm test` → wszystkie zielone. Zero zależności od Socket.IO.

---

## Etap 3 — Warstwa realtime (Socket.IO)

**Cel:** stan pokoju synchronizowany między klientami.

**Pliki:**
- `src/server/room-manager.ts` — `Map<code, Room>`, `createRoom`, `joinRoom`, `leaveRoom`, cleanup po 30 min bezczynności
- `src/server/socket-handlers.ts` — handlery eventów z walidacją zod:
  - `room:create`, `room:join`, `room:leave`, `game:start`, `game:drawCard`, `table:subscribe`
- `server.ts` — custom server: Next + `http.createServer` + `Server` z `socket.io`
- `src/lib/socket-client.ts` — singleton `io()` z typami
- `src/lib/use-room.ts` — hook `useRoom(code)` zwracający live `RoomState`

**Eventy (Server → Client):**
- `room:state` (pełny snapshot — najprostsza strategia synchronizacji)
- `room:player_joined`, `room:player_left`
- `game:card_drawn`, `game:ended`
- `error`

**Weryfikacja:** 2 zakładki przeglądarki, jedna tworzy pokój, druga dołącza po kodzie → obie widzą zaktualizowaną listę graczy w realtime. Test ręczny + opcjonalnie integracyjny test Socket.IO w vitest.

---

## Etap 4 — UI: landing + kontroler telefonu

**Cel:** gracz może utworzyć/dołączyć do pokoju z telefonu i zobaczyć swój ekran.

**Pliki:**
- `src/app/page.tsx` — landing z 2 CTA: „Stwórz stół" / „Dołącz kodem"
- `src/app/room/[code]/page.tsx` — widok kontrolera:
  - Formularz nicku (tylko gdy jeszcze nie dołączony)
  - Lista graczy (live)
  - Komunikat „Tura: <nick>" albo wielki przycisk „Ciągnij kartę"
  - Wyświetlenie własnej ostatnio wyciągniętej karty
- Komponent `src/components/Card.tsx` — prosty rendering karty (mast + ranga)
- Mobile-first Tailwind, testowane w DevTools responsive

**Weryfikacja:** od landing do ciągnięcia karty wszystko działa lokalnie na 3 zakładkach.

---

## Etap 5 — Widok stołu + QR

**Cel:** osobny ekran imprezowy z QR do dołączenia.

**Pliki:**
- `src/app/table/[code]/page.tsx` — duży widok:
  - Header: kod pokoju (ogromny) + QR
  - Lista graczy z awatarkami (inicjał nicka w kolorowym kółku)
  - Karuzela / stos odkrytych kart z animacją dochodzącej karty
  - Podświetlenie gracza, którego tura
- `src/app/api/qr/[code]/route.ts` — zwraca SVG z QR (`qrcode` npm)
- Komponent `<QrPoster code={code} url={fullUrl} />`

**Weryfikacja:** laptop pokazuje `/table/ABC123`, telefon skanuje QR → ląduje w `/room/ABC123` → dołącza → widać update na obu ekranach.

---

## Etap 6 — Docker + deploy na mikr.us

**Cel:** publiczny URL, gra dostępna dla znajomych.

**Pliki:**
- `Dockerfile` — multi-stage:
  1. `deps` (npm ci)
  2. `builder` (`next build` + TS compile `server.ts` → `dist/server.js`)
  3. `runner` (node slim, tylko produkcyjne deps + `.next/standalone` + `dist/`)
- `docker-compose.yml` — serwis `tramwajarz`, port wewn. 3000, healthcheck
- Nginx vhost (instrukcja, plik na VPS):
  ```nginx
  server {
    server_name tramwajarz.<mikrus-domena>;
    location / { proxy_pass http://127.0.0.1:<port>; ... }
    location /socket.io/ {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_pass http://127.0.0.1:<port>;
    }
  }
  ```
- `src/app/api/health/route.ts` — `{ ok: true }`

**Proces deploy** (wykonywany przez agenta `deploy-vps` z Etapu 0):
1. `docker build -t tramwajarz:latest .`
2. `docker save tramwajarz:latest | ssh robert193 'docker load'`
3. `scp docker-compose.yml robert193:~/tramwajarz/`
4. `ssh robert193 'cd ~/tramwajarz && docker compose up -d'`
5. `curl https://tramwajarz.<domena>/api/health`

**Weryfikacja:** telefon w sieci komórkowej (nie WiFi!) skanuje QR i gra.

---

## Etap 7 — Polish + reconnect

**Cel:** sesja przeżywa odświeżenie strony i drobne problemy sieciowe.

- `localStorage` token → `playerId` mapping po stronie serwera (15 min TTL)
- Klient po connect wysyła `room:rejoin { code, token }` → serwer odtwarza przynależność
- Animacje ciągnięcia karty (framer-motion lub CSS)
- Toast przy błędach
- Max 12 graczy, hard limit w walidacji
- Cleanup pokoi po 30 min bezczynności (już w RoomManager)
- Test: outage 10s w DevTools → automatyczny reconnect bez utraty tury

---

## Etap 8 — Iteracja 2: pełne zasady Tramwajarza (poza MVP)

Rozszerzenie `GameEngine` do state machine z fazami:
- `phase: 'color' | 'highLow' | 'insideOutside' | 'suit'`
- Akcja `guess(playerId, guess)` → aktualizacja fazy / koniec rundy / kara
- Licznik „łyków" dla graczy
- Zmiany UI: przyciski zgadywania zamiast samego „Ciągnij"
- Skill `/game-phase` (z Etapu 0) pomaga w generowaniu kolejnych faz

---

## Struktura projektu (docelowa, po Etapie 5)

```
tram_voyage/
├─ PLAN.md                   ← ten plik
├─ PROGRESS.md
├─ CLAUDE.md
├─ README.md
├─ .claude/
│  ├─ agents/
│  ├─ skills/
│  ├─ docs/
│  └─ settings.json
├─ server.ts
├─ Dockerfile
├─ docker-compose.yml
├─ next.config.ts
├─ package.json
├─ src/
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ room/[code]/page.tsx
│  │  ├─ table/[code]/page.tsx
│  │  └─ api/
│  │     ├─ qr/[code]/route.ts
│  │     └─ health/route.ts
│  ├─ components/
│  │  ├─ Card.tsx
│  │  ├─ PlayerList.tsx
│  │  ├─ JoinForm.tsx
│  │  └─ QrPoster.tsx
│  ├─ lib/
│  │  ├─ socket-client.ts
│  │  └─ use-room.ts
│  ├─ server/
│  │  ├─ room-manager.ts
│  │  ├─ game-engine.ts
│  │  ├─ socket-handlers.ts
│  │  └─ code-generator.ts
│  └─ shared/
│     └─ types.ts
└─ tests/
   ├─ game-engine.test.ts
   └─ room-manager.test.ts
```

---

## Weryfikacja end-to-end (cały projekt po Etapie 7)

**Lokalnie:**
- `npm test` — wszystkie testy zielone
- `npm run dev` → scenariusz: host na laptopie otwiera `/table/ABC`, 2 telefony skanują QR i dołączają, start gry, 5 tur bez błędów, odświeżenie telefonu → wraca do gry
- `npm run build && npm start` — produkcyjny build działa

**Na VPS:**
- `curl https://tramwajarz.<domena>/api/health` → 200 OK
- Telefon w sieci komórkowej skanuje QR i bierze udział
- `docker logs tramwajarz -f` — brak błędów przy sesji z 4+ graczami
- Latencja draw → update na innych urządzeniach < 300 ms

---

## Otwarte kwestie (do decyzji w trakcie implementacji)

- **Subdomena vs ścieżka** na mikr.usie — zależy od dostępnej konfiguracji DNS
- **Estetyka kart:** SVG set (`svg-cards`) vs custom Tailwind — decyzja w Etapie 4
- **Framer-motion** vs CSS — decyzja w Etapie 7 po profilowaniu na telefonie
- **Persistencja (Redis)** — nie w MVP, do rozważenia gdy będzie > 50 równoległych pokoi
