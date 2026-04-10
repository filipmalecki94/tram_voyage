'use client';
import { useState, useEffect, useCallback } from 'react';
import type { PublicRoomState } from '@/shared/types';
import type { ClientToServerEvents, Result } from '@/shared/socket-events';
import { getSocket } from '@/lib/socket-client';

type Payload<E extends keyof ClientToServerEvents> =
  ClientToServerEvents[E] extends (p: infer P, cb: (r: unknown) => void) => void
    ? P
    : Record<string, never>;

type Response<E extends keyof ClientToServerEvents> =
  ClientToServerEvents[E] extends (p: never, cb: (r: infer R) => void) => void
    ? R
    : never;

export function useRoom() {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();
    const onState = (rs: PublicRoomState) => setState(rs);
    const onError = (e: { message: string }) => setError(e.message);
    s.on('room:state', onState);
    s.on('error', onError);
    return () => {
      s.off('room:state', onState);
      s.off('error', onError);
    };
  }, []);

  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      event: E,
      payload: Payload<E>,
    ): Promise<Response<E>> =>
      new Promise<Response<E>>((resolve) => {
        (
          getSocket().emit as (
            e: string,
            p: unknown,
            cb: (r: Response<E>) => void,
          ) => void
        )(event, payload, resolve);
      }),
    [],
  );

  return { state, error, emit };
}

export function useRoomRejoin(code: string) {
  const storageKey = `tram:token:${code}`;

  const saveToken = useCallback(
    (token: string) => localStorage.setItem(storageKey, token),
    [storageKey],
  );

  const rejoin = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem(storageKey);
    if (!token) return false;
    const s = getSocket();
    const res = await new Promise<Result<{ code: string; playerId: string }>>(
      (resolve) => {
        (
          s.emit as (
            e: string,
            p: unknown,
            cb: (r: Result<{ code: string; playerId: string }>) => void,
          ) => void
        )('room:rejoin', { token }, resolve);
      },
    );
    if (res.ok) {
      const playerIdKey = storageKey.replace('tram:token:', 'tram:playerId:');
      localStorage.setItem(playerIdKey, res.data.playerId);
    }
    return res.ok;
  }, [storageKey]);

  return { saveToken, rejoin };
}
