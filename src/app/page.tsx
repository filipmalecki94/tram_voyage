'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useRoom } from '@/lib/use-room';
import { getSocket } from '@/lib/socket-client';

export default function Page() {
  const router = useRouter();
  const { emit } = useRoom();

  const [nick, setNick] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);

  const nickTrimmed = nick.trim();
  const nickValid = nickTrimmed.length >= 2 && nickTrimmed.length <= 16;
  const codeTrimmed = joinCode.trim().toUpperCase();

  async function handleCreate() {
    if (!nickValid) return;
    setCreateError(null);
    setLoading('create');
    try {
      const res = await emit('room:create', { nick: nickTrimmed });
      if (!res.ok) {
        setCreateError(res.error);
        return;
      }
      const { code, token } = res.data;
      const socket = getSocket();
      const playerId = socket.id ?? '';
      localStorage.setItem(`tram:token:${code}`, token);
      localStorage.setItem(`tram:playerId:${code}`, playerId);
      router.push(`/room/${code}`);
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (!nickValid || codeTrimmed.length < 4) return;
    setJoinError(null);
    setLoading('join');
    try {
      const res = await emit('room:join', { code: codeTrimmed, nick: nickTrimmed });
      if (!res.ok) {
        setJoinError(res.error);
        return;
      }
      const { token } = res.data;
      const socket = getSocket();
      const playerId = socket.id ?? '';
      localStorage.setItem(`tram:token:${codeTrimmed}`, token);
      localStorage.setItem(`tram:playerId:${codeTrimmed}`, playerId);
      router.push(`/room/${codeTrimmed}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 max-w-sm mx-auto">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Tramwajarz</h1>
        <p className="text-muted-foreground mt-2">Pijacka gra karciana na imprezę</p>
      </div>

      {/* Wspólny nick */}
      <div className="w-full flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="nick">
          Twój nick
        </label>
        <input
          id="nick"
          type="text"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="np. Ala"
          maxLength={16}
          className="h-12 rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Stwórz stół */}
      <div className="w-full flex flex-col gap-2">
        <Button
          className="h-12 text-base w-full"
          disabled={!nickValid || loading !== null}
          onClick={handleCreate}
        >
          {loading === 'create' ? 'Tworzę...' : 'Stwórz stół'}
        </Button>
        {createError && (
          <p className="text-sm text-red-600">{createError}</p>
        )}
      </div>

      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase">lub</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Dołącz kodem */}
      <div className="w-full flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="code">
          Kod pokoju
        </label>
        <input
          id="code"
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="np. ABC123"
          maxLength={8}
          className="h-12 rounded-lg border border-input bg-background px-3 text-base font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          variant="secondary"
          className="h-12 text-base w-full"
          disabled={!nickValid || codeTrimmed.length < 4 || loading !== null}
          onClick={handleJoin}
        >
          {loading === 'join' ? 'Dołączam...' : 'Dołącz kodem'}
        </Button>
        {joinError && (
          <p className="text-sm text-red-600">
            {joinError === 'no_room' ? 'Pokój nie istnieje.' : joinError}
          </p>
        )}
      </div>
    </main>
  );
}
