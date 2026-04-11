'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/Card';
import { QrPoster } from '@/components/QrPoster';
import { useRoom } from '@/lib/use-room';

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

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/room/${code}`);
    emit('table:subscribe', { code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error === 'no_room' || (state === null && error)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
        <p className="text-xl text-neutral-400">Pokój nie istnieje lub wygasł.</p>
      </main>
    );
  }

  // Aktualny gracz zależny od fazy
  const currentPlayerId = state?.collecting
    ? state.players[state.collecting.currentPlayerIdx]?.id
    : state?.currentPlayerId;

  // Nagłówek fazy
  const phaseLabel = (() => {
    if (!state || state.status === 'waiting') return 'Oczekiwanie na graczy';
    if (state.status === 'ended') return 'Koniec gry!';
    if (state.gamePhase === 'collecting' && state.collecting)
      return `Etap 1 — Runda ${state.collecting.round}/4`;
    if (state.gamePhase === 'pyramid') return 'Etap 2 — Piramida';
    if (state.gamePhase === 'tram' && state.tram)
      return `Etap 3 — Tramwaj (streak ${state.tram.streak}/5)`;
    return '';
  })();

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
          <p className="text-neutral-400 mt-1">{state === null ? 'Łączenie…' : phaseLabel}</p>
        </div>

        {/* Lista graczy */}
        {state && state.players.length > 0 && (
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
              Gracze
            </p>
            <div className="flex flex-wrap gap-3">
              {state.players.map((player) => {
                const isActive = state.status === 'playing' && player.id === currentPlayerId;
                const colorClass = AVATAR_COLORS[hashNick(player.nick) % AVATAR_COLORS.length];
                const initial = player.nick.charAt(0).toUpperCase();
                const isTramPlayer =
                  state.gamePhase === 'tram' && state.tram?.tramPlayerId === player.id;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-300 ${
                      isActive
                        ? 'bg-white text-neutral-900 scale-105 shadow-lg shadow-white/10'
                        : 'bg-neutral-800 text-white'
                    } ${!player.isConnected ? 'opacity-40' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isActive ? 'bg-neutral-900' : colorClass}`}
                    >
                      {initial}
                    </div>
                    <span className="font-medium text-sm">{player.nick}</span>
                    {isTramPlayer && <span className="text-xs ml-1">🚋</span>}
                    {(state.status === 'ended' || state.gamePhase !== null) && (
                      <span className="text-xs ml-1 opacity-70">🍺 {player.sips}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Etap 1 — aktywna tura */}
        {state?.gamePhase === 'collecting' && state.collecting && (() => {
          const currentPlayer = state.players[state.collecting.currentPlayerIdx];
          return (
            <p className="text-2xl font-semibold">
              Runda {state.collecting.round}/4 — tura:{' '}
              <span className="text-white">{currentPlayer?.nick ?? '...'}</span>
            </p>
          );
        })()}

        {/* Etap 2 — Piramida */}
        {state?.gamePhase === 'pyramid' && state.pyramid && (
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-4">
              Piramida
            </p>
            <div className="flex flex-col gap-3">
              {state.pyramid.layout.map((levelCards, lvlIdx) => {
                const level = lvlIdx + 1;
                return (
                  <div key={lvlIdx} className="flex flex-col gap-1">
                    <p className="text-xs text-neutral-500">
                      Poziom {level} ({level} {level === 1 ? 'kolejka' : level < 5 ? 'kolejki' : 'kolejek'})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {levelCards.map((card, cardIdx) => {
                        const isRevealed = card !== null;
                        const isCurrent =
                          isRevealed &&
                          state.pyramid!.currentCard !== null &&
                          card.rank === state.pyramid!.currentCard.rank &&
                          card.suit === state.pyramid!.currentCard.suit;
                        return (
                          <div
                            key={cardIdx}
                            className={`rounded-lg border-2 ${
                              isCurrent
                                ? 'border-yellow-400 shadow-lg shadow-yellow-400/30'
                                : 'border-neutral-700'
                            }`}
                          >
                            {isRevealed ? (
                              <Card card={card} size="sm" />
                            ) : (
                              <div className="w-10 h-14 bg-neutral-700 rounded-md flex items-center justify-center text-neutral-500 text-xs">
                                ?
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Łyki za bieżącą kartę */}
            {state.pyramid.currentCard && Object.keys(state.pyramid.pendingSipsByPlayer).length > 0 && (
              <div className="mt-4 flex flex-col gap-1">
                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
                  Łyki za tę kartę
                </p>
                {Object.entries(state.pyramid.pendingSipsByPlayer).map(([pid, sips]) => {
                  const player = state.players.find((p) => p.id === pid);
                  return (
                    <div key={pid} className="flex justify-between text-sm bg-neutral-800 px-3 py-1 rounded">
                      <span>{player?.nick ?? pid}</span>
                      <span className="font-bold">🍺 {sips}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Etap 3 — Tramwaj */}
        {state?.gamePhase === 'tram' && state.tram && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              {state.tram.lastCard && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-widest">Karta</p>
                  <Card card={state.tram.lastCard} size="lg" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Streak</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                        i <= state.tram!.streak
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-neutral-600 text-neutral-600'
                      }`}
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-neutral-400 mt-1">
                  Tramwajarz:{' '}
                  <strong className="text-white">
                    {state.players.find((p) => p.id === state.tram!.tramPlayerId)?.nick ?? '?'}
                  </strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Koniec gry */}
        {state?.status === 'ended' && (
          <div className="flex flex-col items-center gap-3 mt-4">
            <h2 className="text-4xl font-bold">Koniec gry!</h2>
            {state.winnerId && (
              <p className="text-xl text-neutral-300">
                Tramwajarz:{' '}
                <strong className="text-white">
                  {state.players.find((p) => p.id === state.winnerId)?.nick ?? '?'}
                </strong>{' '}
                dojedzie!
              </p>
            )}
            <p className="text-neutral-400">Sprawdźcie kto pije ile łyków.</p>
          </div>
        )}

        {/* Waiting */}
        {state?.status === 'waiting' && state.players.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-3xl font-bold text-neutral-700">Czekamy na graczy…</p>
          </div>
        )}

        {/* Łączenie */}
        {state === null && !error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-600 text-xl">Łączenie z pokojem…</p>
          </div>
        )}
      </section>
    </main>
  );
}
