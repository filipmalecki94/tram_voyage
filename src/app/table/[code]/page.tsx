'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/Card';
import { QrPoster } from '@/components/QrPoster';
import { useRoom } from '@/lib/use-room';
import { getSocket } from '@/lib/socket-client';
import type { Card as CardType } from '@/shared/types';

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-pink-500',
];

function hashNick(nick: string): number {
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function TablePage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { state, error, emit } = useRoom();
  const [joinUrl, setJoinUrl] = useState<string>('');
  // Klucz ostatnio dochodzącej karty — trigger animacji
  const [latestCardKey, setLatestCardKey] = useState<string | null>(null);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/room/${code}`);
    emit('table:subscribe', { code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const handler = (data: { card: CardType; byPlayerId: string }) => {
      setLatestCardKey(`${data.card.rank}-${data.card.suit}-${Date.now()}`);
    };
    socket.on('game:card_drawn', handler);
    return () => {
      socket.off('game:card_drawn', handler);
    };
  }, []);

  if (error === 'no_room' || (state === null && error)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
        <p className="text-xl text-neutral-400">Pokój nie istnieje lub wygasł.</p>
      </main>
    );
  }

  const lastCards = state ? [...state.drawnCards].slice(-5).reverse() : [];
  const currentPlayer = state?.players.find((p) => p.id === state.currentPlayerId);

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col lg:flex-row gap-0">
      {/* Lewa kolumna — QR + kod */}
      <aside className="lg:w-80 flex flex-col items-center justify-center p-8 gap-6 border-b lg:border-b-0 lg:border-r border-neutral-800 shrink-0">
        {joinUrl ? (
          <QrPoster code={code} joinUrl={joinUrl} />
        ) : (
          <div className="w-64 h-64 bg-neutral-800 rounded-2xl animate-pulse" />
        )}
        <a
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors underline"
        >
          Nowy pokój
        </a>
      </aside>

      {/* Prawa kolumna — gra */}
      <section className="flex-1 flex flex-col p-8 gap-8 overflow-hidden">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Tramwajarz</h1>
          <p className="text-neutral-400 mt-1">
            {state === null
              ? 'Łączenie…'
              : state.status === 'waiting'
                ? 'Oczekiwanie na graczy'
                : state.status === 'playing'
                  ? `Kart w talii: ${state.cardsLeft}`
                  : 'Koniec gry!'}
          </p>
        </div>

        {/* Lista graczy */}
        {state && state.players.length > 0 && (
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
              Gracze
            </p>
            <div className="flex flex-wrap gap-3">
              {state.players.map((player) => {
                const isActive =
                  state.status === 'playing' && player.id === state.currentPlayerId;
                const colorClass =
                  AVATAR_COLORS[hashNick(player.nick) % AVATAR_COLORS.length];
                const initial = player.nick.charAt(0).toUpperCase();
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-300 ${
                      isActive
                        ? 'bg-white text-neutral-900 scale-105 shadow-lg shadow-white/10'
                        : 'bg-neutral-800 text-white'
                    } ${!player.isConnected ? 'opacity-40' : ''}`}
                  >
                    {/* Awatarka */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isActive ? 'bg-neutral-900' : colorClass}`}
                    >
                      {initial}
                    </div>
                    <span className="font-medium text-sm">{player.nick}</span>
                    {state.status === 'ended' && (
                      <span className="text-xs ml-1 opacity-70">🍺 {player.sips}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Aktywna tura */}
        {state?.status === 'playing' && currentPlayer && (
          <p className="text-2xl font-semibold">
            Tura:{' '}
            <span className="text-white">{currentPlayer.nick}</span>
          </p>
        )}

        {/* Odkryte karty */}
        {state?.status !== 'waiting' && lastCards.length > 0 && (
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
              Odkryte karty
            </p>
            <div className="flex gap-3 flex-wrap">
              {lastCards.map((card, idx) => {
                const key = `${card.rank}-${card.suit}-${idx}`;
                const isNewest = idx === 0 && key === latestCardKey;
                return (
                  <div
                    key={key}
                    className={`transition-all duration-500 ${
                      isNewest
                        ? 'opacity-100 translate-y-0 scale-105'
                        : 'opacity-80 translate-y-0'
                    }`}
                    style={
                      isNewest
                        ? { animation: 'card-in 0.4s ease-out' }
                        : undefined
                    }
                  >
                    <Card card={card} size={idx === 0 ? 'lg' : 'md'} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Waiting — brak graczy lub brak started */}
        {state?.status === 'waiting' && state.players.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-3xl font-bold text-neutral-700">Czekamy na graczy…</p>
          </div>
        )}

        {/* Koniec gry */}
        {state?.status === 'ended' && (
          <div className="flex flex-col items-center gap-3 mt-4">
            <h2 className="text-4xl font-bold">Koniec gry!</h2>
            <p className="text-neutral-400">Sprawdźcie kto pije ile łyków.</p>
          </div>
        )}

        {/* Łączenie */}
        {state === null && !error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-600 text-xl">Łączenie z pokojem…</p>
          </div>
        )}
      </section>

      {/* Globalna animacja */}
      <style>{`
        @keyframes card-in {
          from { opacity: 0; transform: translateY(-20px) scale(1.1); }
          to   { opacity: 1; transform: translateY(0) scale(1.05); }
        }
      `}</style>
    </main>
  );
}
