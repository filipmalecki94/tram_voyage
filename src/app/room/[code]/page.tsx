'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/Card';
import { useRoom, useRoomRejoin } from '@/lib/use-room';
import { getSocket } from '@/lib/socket-client';
import type { Card as CardType } from '@/shared/types';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const router = useRouter();

  const { state, error, emit } = useRoom();
  const { saveToken, rejoin } = useRoomRejoin(code);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [joinNick, setJoinNick] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [myLastCard, setMyLastCard] = useState<CardType | null>(null);
  const [reconnecting, setReconnecting] = useState(true);

  // Na mount: spróbuj rejoin przez token z localStorage
  useEffect(() => {
    const storedPlayerId = localStorage.getItem(`tram:playerId:${code}`);
    if (storedPlayerId) setMyPlayerId(storedPlayerId);

    rejoin().then((ok) => {
      if (ok) {
        // playerId mógł być zapisany przed wejściem na stronę lub z socket.id
        const pid = localStorage.getItem(`tram:playerId:${code}`);
        if (pid) setMyPlayerId(pid);
      }
      setReconnecting(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nasłuchuj game:card_drawn żeby śledzić własną ostatnio wyciągniętą kartę
  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { card: CardType; byPlayerId: string }) => {
      if (data.byPlayerId === myPlayerId) {
        setMyLastCard(data.card);
      }
    };
    socket.on('game:card_drawn', handler);
    return () => {
      socket.off('game:card_drawn', handler);
    };
  }, [myPlayerId]);

  const handleJoin = useCallback(async () => {
    const nick = joinNick.trim();
    if (nick.length < 2 || nick.length > 16) return;
    setJoinError(null);
    setJoining(true);
    try {
      const res = await emit('room:join', { code, nick });
      if (!res.ok) {
        setJoinError(res.error);
        return;
      }
      const { token } = res.data;
      saveToken(token);
      const socket = getSocket();
      const playerId = socket.id ?? '';
      localStorage.setItem(`tram:playerId:${code}`, playerId);
      setMyPlayerId(playerId);
    } finally {
      setJoining(false);
    }
  }, [joinNick, code, emit, saveToken]);

  const handleStart = useCallback(async () => {
    await emit('game:start', {});
  }, [emit]);

  const handleDraw = useCallback(async () => {
    await emit('game:drawCard', {});
  }, [emit]);

  const handleLeave = useCallback(async () => {
    await emit('room:leave', {});
    localStorage.removeItem(`tram:token:${code}`);
    localStorage.removeItem(`tram:playerId:${code}`);
    router.push('/');
  }, [emit, code, router]);

  // --- Rendering ---

  if (reconnecting) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Łączenie...</p>
      </main>
    );
  }

  // Nie dołączyliśmy jeszcze — pokaż formularz dołączenia
  if (!myPlayerId) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-sm mx-auto">
        <h1 className="text-3xl font-bold text-center">Pokój {code}</h1>
        <div className="w-full flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="join-nick">
            Twój nick
          </label>
          <input
            id="join-nick"
            type="text"
            value={joinNick}
            onChange={(e) => setJoinNick(e.target.value)}
            placeholder="np. Ala"
            maxLength={16}
            className="h-12 rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            className="h-12 text-base w-full"
            disabled={joinNick.trim().length < 2 || joining}
            onClick={handleJoin}
          >
            {joining ? 'Dołączam...' : `Dołącz do pokoju ${code}`}
          </Button>
          {joinError && (
            <p className="text-sm text-red-600">
              {joinError === 'no_room'
                ? 'Pokój nie istnieje lub wygasł.'
                : joinError === 'full'
                  ? 'Pokój jest pełny (maks. 12 graczy).'
                  : joinError}
            </p>
          )}
          <a href="/" className="text-sm text-center text-muted-foreground underline mt-2">
            Wróć do strony głównej
          </a>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Łączenie z pokojem...</p>
      </main>
    );
  }

  const amHost = state.hostPlayerId === myPlayerId;
  const isMyTurn = state.currentPlayerId === myPlayerId;
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);

  return (
    <main className="min-h-screen flex flex-col p-4 gap-4 max-w-md mx-auto">
      {/* Błąd z hosta */}
      {error && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-sm text-center py-2 px-4 z-50">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="pt-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Kod pokoju</p>
        <h1 className="text-4xl font-bold font-mono tracking-widest">{state.code}</h1>
        {state.status === 'playing' && (
          <p className="text-sm text-muted-foreground">Kart w talii: {state.cardsLeft}</p>
        )}
      </div>

      {/* Lista graczy */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gracze</p>
        {state.players.map((player) => {
          const isCurrentTurn = state.currentPlayerId === player.id && state.status === 'playing';
          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${isCurrentTurn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${player.isConnected ? 'bg-green-500' : 'bg-neutral-400'}`}
              />
              <span className="flex-1 font-medium">{player.nick}</span>
              {player.id === myPlayerId && (
                <span className="text-xs opacity-70">(ty)</span>
              )}
              {player.id === state.hostPlayerId && (
                <span className="text-xs opacity-70">(host)</span>
              )}
              {state.status === 'ended' && (
                <span className="text-xs ml-1">🍺 {player.sips}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Akcje zależne od stanu */}
      {state.status === 'waiting' && (
        <div className="flex flex-col gap-3 mt-2">
          {amHost ? (
            <>
              <Button
                className="h-14 text-lg w-full"
                disabled={state.players.length < 2}
                onClick={handleStart}
              >
                Rozpocznij grę
              </Button>
              {state.players.length < 2 && (
                <p className="text-sm text-center text-muted-foreground">
                  Potrzeba co najmniej 2 graczy.
                </p>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Czekamy na hosta…
            </p>
          )}
        </div>
      )}

      {state.status === 'playing' && (
        <div className="flex flex-col gap-4 mt-2">
          {isMyTurn ? (
            <Button
              className="h-24 text-2xl w-full"
              onClick={handleDraw}
            >
              Ciągnij kartę
            </Button>
          ) : (
            <p className="text-center text-xl py-4">
              Tura:{' '}
              <strong>{currentPlayer?.nick ?? '...'}</strong>
            </p>
          )}

          {/* Własna ostatnia karta */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Twoja ostatnia karta
            </p>
            {myLastCard ? (
              <Card card={myLastCard} size="lg" />
            ) : (
              <p className="text-3xl text-muted-foreground">—</p>
            )}
          </div>
        </div>
      )}

      {state.status === 'ended' && (
        <div className="flex flex-col items-center gap-4 mt-2">
          <h2 className="text-2xl font-bold">Koniec gry!</h2>
          <p className="text-muted-foreground text-center">
            Sprawdźcie kto pije ile łyków powyżej.
          </p>
          <Button
            variant="secondary"
            className="h-12 w-full"
            onClick={handleLeave}
          >
            Opuść pokój
          </Button>
        </div>
      )}
    </main>
  );
}
