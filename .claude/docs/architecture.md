# Architektura — Tramwajarz

## Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Telefon gracza  │      │ Telefon gracza  │      │ Ekran stołu     │
│ /room/[code]    │      │ /room/[code]    │      │ /table/[code]   │
│ (kontroler)     │      │ (kontroler)     │      │ (widok wspólny) │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                         │
         └────────────────────────┴─────────────────────────┘
                                  │ WebSocket (Socket.IO)
                                  ▼
                     ┌────────────────────────┐
                     │   Next.js + Socket.IO  │
                     │      (server.ts)       │
                     │                        │
                     │  SocketHandlers        │
                     │    ├─ zod validation   │
                     │    └─ RoomManager      │
                     │         ├─ rooms Map   │
                     │         └─ GameEngine  │
                     └────────────────────────┘
                                  │
                              In-memory
                            Map<code, Room>
```

## Decyzje projektowe

### 1. Custom Next.js server zamiast API Routes + serverless

**Decyzja:** `server.ts` uruchamia `http.createServer()` + `Socket.IO Server`.
**Dlaczego:** WebSocket wymaga długotrwałego połączenia — serverless (Vercel) tego nie obsługuje bez zewnętrznych providerów. VPS mikr.us pozwala na klasyczny serwer Node.
**Trade-off:** trudniejszy deploy na Vercel w przyszłości, ale brak zewnętrznych zależności.

### 2. Pełny snapshot `room:state` zamiast delta/patch

**Decyzja:** po każdej mutacji serwer emituje cały `RoomState`.
**Dlaczego:** prostota implementacji, odporność na desync. Przy 12 graczach i 52 kartach payload jest mały (~2-3 KB).
**Trade-off:** nieefektywne przy dużej liczbie pokoi i wysokiej częstotliwości zmian. Akceptowalne dla MVP.

### 3. In-memory state (Map) zamiast Redis/bazy danych

**Decyzja:** pokoje trzymane w `Map<code, Room>` w pamięci serwera.
**Dlaczego:** gry są efemeryczne (trwają ~30 min), brak potrzeby persystencji. Mikr.us ma jeden serwer.
**Trade-off:** restart serwera = utrata wszystkich pokoi. Akceptowalne dla zabawy.

### 4. Logika gry jako czyste funkcje

**Decyzja:** `game-engine.ts` eksportuje czyste funkcje bez side-effectów.
**Dlaczego:** testowalne jednostkowo bez uruchamiania serwera. Łatwe do przeniesienia jeśli zmieniony zostanie transport.
**Jak:** `GameEngine` nie wie o Socket.IO. `socket-handlers.ts` łączy obie warstwy.

## Przepływ żądania (przykład: draw card)

```
Telefon: klik "Ciągnij kartę"
  → socket.emit('game:drawCard')
  → server: socket-handlers.ts onDrawCard()
      → zod.parse(payload)         // walidacja
      → roomManager.getRoom(code)  // pobierz pokój
      → gameEngine.drawCard(state, playerId)  // mutuj stan
      → roomManager.updateRoom(code, newState)
      → io.to(code).emit('game:card_drawn', { card, cardsLeft })
      → io.to(code).emit('room:state', newRoomState)
  → Wszystkie klienty w pokoju:
      → useRoom hook → React re-render
      → Animacja karty (game:card_drawn)
      → Aktualizacja UI (room:state)
```

## Reconnect flow

```
Klient: rozłączenie (odświeżenie / chwilowy brak sieci)
  → socket.on('connect') odpala się ponownie
  → socket.emit('room:rejoin', { code, token })  // token z localStorage
  → server: mapuje token → playerId, dodaje socket do pokoju
  → server: emituje room:state do nowego socket
  → Klient: UI przywrócone
```
