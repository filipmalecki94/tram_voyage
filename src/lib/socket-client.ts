import { io } from 'socket.io-client';
import type { AppClientSocket } from '@/shared/socket-events';

let socket: AppClientSocket | null = null;

export function getSocket(): AppClientSocket {
  if (typeof window === 'undefined') {
    throw new Error('getSocket() działa tylko w przeglądarce');
  }
  if (!socket) {
    socket = io() as AppClientSocket;
  }
  return socket;
}
