'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/Card';
import { QrPoster } from '@/components/QrPoster';
import { useRoom } from '@/lib/use-room';
import type { Card as CardType, DrinkGate, PublicPlayer } from '@/shared/types';

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

function RightCardPanel({
  card,
  label,
  drinkGate,
  players,
}: {
  card: CardType | null;
  label: string;
  drinkGate: DrinkGate | null;
  players: PublicPlayer[];
}) {
  return (
    <div className="w-1/2 flex flex-col border-l border-neutral-800 bg-neutral-900/20 min-h-0 p-4">
      {drinkGate ? (
        /* Panel picia — zastępuje kartę */
        <div className="flex-1 flex flex-col items-center justify-start gap-6 pt-4">
          <p className="text-lg font-semibold text-amber-400 uppercase tracking-widest">
            Przystanek — picie
          </p>
          <div className="flex flex-col gap-3 w-full max-w-sm px-3">
            {drinkGate.entries.map((entry) => {
              const player = players.find((p) => p.id === entry.playerId);
              return (
                <div
                  key={entry.playerId}
                  className="grid items-center bg-neutral-800 rounded-xl px-4 py-3"
                  style={{ gridTemplateColumns: '1fr 1.5rem 2rem 1.5rem' }}
                >
                  <span className={`text-lg font-medium truncate ${entry.confirmed ? 'line-through text-neutral-500' : 'text-white'}`}>
                    {player?.nick ?? entry.playerId}
                  </span>
                  <span className="text-xl text-center">🍺</span>
                  <span className="text-xl font-bold text-amber-300 text-left tabular-nums px-2">
                    {entry.sips}
                  </span>
                  <span className={`text-lg text-center ${entry.confirmed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {entry.confirmed ? '✓' : '⏳'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Panel karty */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center min-h-0">
            {card ? (
              <div className="h-full aspect-[5/7] max-w-full">
                <Card card={card} size="fill" />
              </div>
            ) : (
              <p className="text-neutral-700 text-lg">Oczekiwanie na odsłonięcie…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
    <main className="h-screen bg-neutral-950 text-white flex flex-col lg:flex-row gap-0 overflow-hidden">
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
      <section className="flex-1 flex flex-col p-8 gap-8 overflow-hidden min-h-0">
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
                    className={`flex flex-col gap-1 rounded-xl px-3 py-2 transition-all duration-300 ${
                      isActive
                        ? 'bg-white text-neutral-900 scale-105 shadow-lg shadow-white/10'
                        : 'bg-neutral-800 text-white'
                    } ${!player.isConnected ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-2">
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
                    {/* Zebrane karty w Etapie 1 */}
                    {state.gamePhase === 'collecting' && state.handsByPlayerId[player.id]?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {state.handsByPlayerId[player.id].map((c, i) => (
                          <Card key={i} card={c} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DrinkGate banner — tylko w Etapie 1 (zbieranie); Etap 2/3 obsługuje to w RightCardPanel */}
        {state?.drinkGate && state.gamePhase === 'collecting' && (
          <div className="rounded-xl border border-amber-500 bg-amber-500/10 px-4 py-3 flex flex-col gap-2">
            <p className="text-sm font-semibold text-amber-400 uppercase tracking-widest">
              Przystanek — picie
            </p>
            <div className="flex flex-col gap-1">
              {state.drinkGate.entries.map((entry) => {
                const player = state.players.find((p) => p.id === entry.playerId);
                return (
                  <div key={entry.playerId} className="flex items-center justify-between text-sm">
                    <span className={entry.confirmed ? 'line-through text-neutral-500' : 'text-white'}>
                      {player?.nick ?? entry.playerId} — pije 🍺 {entry.sips}
                    </span>
                    <span className={entry.confirmed ? 'text-emerald-400' : 'text-amber-400'}>
                      {entry.confirmed ? '✓ Wypiłem' : '⏳ czeka'}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-neutral-400">
              {state.drinkGate.entries.filter((e) => e.confirmed).length}/{state.drinkGate.entries.length} potwierdziło
            </p>
          </div>
        )}

        {/* Etap 1 — aktywna tura */}
        {state?.gamePhase === 'collecting' && state.collecting && !state.drinkGate && (() => {
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
          <div className="flex flex-row flex-1 min-h-0 -mx-8 -mb-8 overflow-hidden">
            {/* Lewa część — piramida */}
            <div className="flex flex-col min-h-0 w-1/2 p-4">
              <div className="flex flex-col flex-1 min-h-0 justify-around gap-2">
                {state.pyramid.layout.map((levelCards, lvlIdx) => {
                  const level = lvlIdx + 1;
                  return (
                    <div key={lvlIdx} className="flex justify-center items-center gap-2 flex-1 min-h-0" aria-label={`Poziom ${level} — ${level} kolejki`}>
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
                            className={`h-full aspect-[5/7] rounded-lg border-2 shrink-0 ${
                              isCurrent
                                ? 'border-yellow-400 shadow-lg shadow-yellow-400/30'
                                : 'border-neutral-700'
                            }`}
                          >
                            {isRevealed ? (
                              <Card card={card} size="fill" />
                            ) : (
                              <div className="w-full h-full bg-neutral-700 rounded-md flex items-center justify-center text-neutral-500 text-xs">
                                ?
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prawa część — aktualna karta lub panel picia */}
            <RightCardPanel
              card={state.pyramid.currentCard}
              label="Aktualna karta"
              drinkGate={state.drinkGate}
              players={state.players}
            />
          </div>
        )}

        {/* Etap 3 — Tramwaj */}
        {(state?.gamePhase === 'tram' || (state?.status === 'ended' && state.tram)) && state?.tram && (
          <div className="flex flex-row flex-1 min-h-0 -mx-8 -mb-8 overflow-hidden">
            {/* Lewa część — streak + nick tramwajarza + tram-restart overlay + ended banner */}
            <div className="flex flex-col gap-4 px-8 pb-8 overflow-y-auto w-1/2">
              {/* tram-restart overlay — kto przegrał i jakie karty miał */}
              {state.drinkGate?.resumeAction === 'tram-restart' && state.drinkGate.context && (
                <div className="rounded-xl border border-red-500 bg-red-500/10 px-4 py-4 flex flex-col gap-3">
                  <p className="text-xl font-bold text-red-400">
                    {state.players.find((p) => p.id === state.drinkGate!.context!.tramPlayerId)?.nick ?? '?'} przegrał — zaczyna od nowa
                  </p>
                  {state.drinkGate.context.streakCards && state.drinkGate.context.streakCards.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-neutral-400 uppercase tracking-widest">Karty z tego podejścia:</p>
                      <div className="flex gap-2 flex-wrap">
                        {state.drinkGate.context.streakCards.map((c, i) => (
                          <Card key={i} card={c} size="md" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 w-full flex-1 justify-center">
                <div className="grid grid-cols-5 gap-2 w-full">
                  {[0, 1, 2, 3, 4].map((i) => {
                    const revealed = state.tram!.streakCards[i];
                    return (
                      <div key={i} className="aspect-[5/7] w-full">
                        {revealed
                          ? <Card card={revealed} size="fill" />
                          : <Card faceDown size="fill" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {state.status === 'ended' && (
                <div className="flex flex-col items-center gap-3 mt-2">
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
            </div>

            {/* Prawa część — karta referencyjna lub panel picia */}
            <RightCardPanel
              card={state.tram.lastCard}
              label="Karta referencyjna"
              drinkGate={state.drinkGate?.resumeAction !== 'tram-restart' ? state.drinkGate : null}
              players={state.players}
            />
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
