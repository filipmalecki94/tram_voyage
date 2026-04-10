# Prompt dla Claude Code — Etap 6

Realizujesz **Etap 6** z planu zawartego w `PLAN.md`.

## Treść planu

```markdown
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
```

## Kontekst aktualnego stanu

Po Etapie 5 działają:
- `src/app/page.tsx` — landing z CTA „Stwórz stół" / „Dołącz kodem"
- `src/app/room/[code]/page.tsx` — pełny kontroler telefonu
- `src/app/table/[code]/page.tsx` — widok stołu: QR, lista graczy z awatarkami, stos kart, animacja nowej karty
- `src/app/api/qr/[code]/route.ts` — SVG QR z parametrem `?url=`
- `src/components/QrPoster.tsx` — prezentacyjny poster z QR
- `src/components/Card.tsx` — wizualizacja karty
- `src/lib/use-room.ts` + `src/lib/socket-client.ts`
- `src/shared/types.ts` + `src/shared/socket-events.ts`
- `server.ts` — custom Next.js + Socket.IO server (uruchamiany przez `tsx watch server.ts`)
- 39/39 testów zielone; 0 błędów TS

## Twoje zadanie

1. Stwórz `Dockerfile` (multi-stage), `docker-compose.yml` i `src/app/api/health/route.ts`.
2. Przetestuj lokalne build: `docker build -t tramwajarz:latest .`
3. Skorzystaj z agenta `deploy-vps` do wdrożenia na VPS `robert193`.
4. Po ukończeniu edytuj plik `PROGRESS.md`:
   - Oznacz Etap 6 jako `[x]`
   - Dodaj notatki pod `### Etap 6` — co zostało zrealizowane, decyzje podjęte
5. Nadpisz `PROGRESS-PROMPT.md` nowym promptem dla Etapu 7.

## Uwagi
- `npm run dev` = `tsx watch server.ts` (nie `next dev`)
- `next.config.ts` musi mieć `output: 'standalone'` żeby Docker działał
- `server.ts` jest pisany w TS — w builderze uruchom `npx tsc -p tsconfig.server.json` żeby dostać `dist/server.js`; możliwe że trzeba stworzyć osobny `tsconfig.server.json`
- Nginx musi mieć `proxy_set_header Upgrade` dla `/socket.io/` — bez tego WS nie działa
- Port na VPS mikr.us: sprawdź `ssh robert193 'cat ~/tramwajarz/.env'` lub ustal z użytkownikiem
- Trzymaj się zakresu etapu — nie rób z góry kolejnych kroków
