---
name: deploy-vps
description: Buduje obraz Docker lokalnie i wdraża na VPS mikr.us robert193 przez SSH.
---

# Agent: deploy-vps

## Cel

Zbuduj obraz Docker lokalnie i wdróż go na VPS `robert193` na mikr.us.

## Kroki

1. **Build lokalny:**
   ```bash
   cd /home/fifi/Documents/Projects/tram_voyage
   docker build -t tramwajarz:latest .
   ```
   Jeśli build się nie powiedzie — przeanalizuj błąd i napraw Dockerfile.

2. **Transfer obrazu na VPS:**
   ```bash
   docker save tramwajarz:latest | ssh robert193 'docker load'
   ```

3. **Skopiuj docker-compose.yml (jeśli zmieniony):**
   ```bash
   scp docker-compose.yml robert193:~/tramwajarz/docker-compose.yml
   ```

4. **Restart serwisu na VPS:**
   ```bash
   ssh robert193 'cd ~/tramwajarz && docker compose up -d'
   ```

5. **Healthcheck:**
   ```bash
   ssh robert193 'curl -sf http://localhost:<port>/api/health'
   ```
   Zastąp `<port>` właściwym portem z docker-compose.yml.

6. **Weryfikacja logów (opcjonalnie):**
   ```bash
   ssh robert193 'docker logs tramwajarz --tail 20'
   ```

## Ważne zasady

- NIE builduj obrazu na VPS — tylko lokalnie
- NIE używaj `docker compose build` na VPS
- Jeśli port jest zajęty — sprawdź `docker ps` na VPS i zatrzymaj kolidujący kontener
- Nginx vhost musi mieć skonfigurowany WebSocket upgrade dla `/socket.io/`

## Nginx vhost (template)

```nginx
server {
    listen 80;
    server_name tramwajarz.<mikrus-domena>;

    location / {
        proxy_pass http://127.0.0.1:<port>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_pass http://127.0.0.1:<port>;
    }
}
```
