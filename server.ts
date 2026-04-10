import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './src/server/socket-handlers';
import { RoomManager } from './src/server/room-manager';
import type { AppServer } from './src/shared/socket-events';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handler(req, res);
  });

  const io: AppServer = new Server(httpServer, {
    cors: { origin: '*' },
  });

  const rooms = new RoomManager();
  rooms.startCleanup(5 * 60_000); // cleanup co 5 min

  registerSocketHandlers(io, rooms);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
