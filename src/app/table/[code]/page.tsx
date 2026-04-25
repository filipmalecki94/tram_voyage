'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/Card';
import { QrPoster } from '@/components/QrPoster';
import { useRoom } from '@/lib/use-room';
import type { Card as CardType, DrinkGate, PublicPlayer } from '@/shared/types';
import { MarqueeText } from '@/components/MarqueeText';

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

function PlayerCollectingPanel({
  players,
  currentPlayerIdx,
}: {
  players: PublicPlayer[];
  currentPlayerIdx: number;
}) {
  const ITEM_HEIGHT = 60;

  const [displayIdx, setDisplayIdx] = useState(currentPlayerIdx);
  const [queueOffset, setQueueOffset] = useState(0);
  const prevIdxRef = useRef(currentPlayerIdx);

  useEffect(() => {
    if (currentPlayerIdx === prevIdxRef.current) return;
    setQueueOffset(-ITEM_HEIGHT);
    const timer = setTimeout(() => {
      setQueueOffset(0);
      setDisplayIdx(currentPlayerIdx);
      prevIdxRef.current = currentPlayerIdx;
    }, 350);
    return () => clearTimeout(timer);
  }, [currentPlayerIdx]);

  const displayCurrentPlayer = players[displayIdx] ?? null;
  const displayQueue = [
    ...players.slice(displayIdx + 1),
    ...players.slice(0, displayIdx),
  ];

  if (!displayCurrentPlayer) return null;

  return (
    <div className="flex flex-col px-8 pb-8 w-1/2 overflow-hidden min-h-0">
      <div
        className={`flex flex-col gap-2 rounded-xl px-3 bg-white text-neutral-900 py-3 shrink-0 shadow-lg shadow-white/10 ${!displayCurrentPlayer.isConnected ? 'opacity-40' : ''}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 bg-neutral-900">
            {displayCurrentPlayer.nick.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-sm">{displayCurrentPlayer.nick}</span>
          <span className="text-xs ml-auto opacity-70">🍺 {displayCurrentPlayer.sips}</span>
        </div>
        {displayCurrentPlayer.hand.length > 0 && (
          <div className="flex gap-1 overflow-hidden h-40">
            {displayCurrentPlayer.hand.map((c, i) => (
              <Card key={i} card={c} size="md" />
            ))}
          </div>
        )}
      </div>
      {displayQueue.length > 0 && (
        <div className="flex-1 overflow-hidden min-h-0 pt-3">
          <div
            style={{
              transform: `translateY(${queueOffset}px)`,
              transition: queueOffset !== 0 ? 'transform 300ms ease-in-out' : 'none',
            }}
            className="flex flex-col gap-3"
          >
            {displayQueue.map((player) => {
              const colorClass = AVATAR_COLORS[hashNick(player.nick) % AVATAR_COLORS.length];
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 rounded-xl px-3 h-12 bg-neutral-800 text-white shrink-0 ${!player.isConnected ? 'opacity-40' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${colorClass}`}>
                    {player.nick.charAt(0).toUpperCase()}
                  </div>
                  <MarqueeText text={player.nick} className="font-medium text-sm flex-1 min-w-0" />
                  {player.hand.length > 0 && (
                    <div className="flex gap-0.5 overflow-hidden h-7 shrink-0">
                      {player.hand.map((c, i) => (
                        <Card key={i} card={c} size="sm" />
                      ))}
                    </div>
                  )}
                  <span className="text-xs opacity-70 shrink-0">🍺 {player.sips}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RightCardPanel({
  card,
  label,
  drinkGate,
  players,
  placeholder = 'Oczekiwanie na odsłonięcie…',
}: {
  card: CardType | null;
  label: string;
  drinkGate: DrinkGate | null;
  players: PublicPlayer[];
  placeholder?: string;
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
              <p className="text-neutral-700 text-lg">{placeholder}</p>
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
    <main className="h-screen bg-neutral-950 text-white flex flex-col gap-0 overflow-hidden relative">
      {/* Przycisk nawigacyjny */}
      <a
        href="/table"
        className="absolute top-4 right-4 z-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-sm text-neutral-200 transition-colors"
      >
        zmień stół
      </a>

      {/* Główna sekcja — gra */}
      <section className="flex-1 flex flex-col p-8 gap-8 overflow-hidden min-h-0">
        {/* Header */}
        <div className="text-center">
          <p className="text-neutral-400">{state === null ? 'Łączenie…' : phaseLabel}</p>
        </div>

        {/* Lista graczy — tylko poza Etapem 1 (tam jest w lewym panelu split-layoutu) */}
        {state && state.players.length > 0 && state.gamePhase !== 'collecting' && state.gamePhase !== 'tram' && state.status !== 'ended' && (
          <div className="grid grid-cols-3 gap-1 max-h-52 overflow-y-auto">
            {state.players.map((player) => {
              const isActive = state.status === 'playing' && player.id === currentPlayerId;
              const hasActiveDeal = state.gamePhase === 'pyramid' &&
                !!state.pyramid?.activeDeals[player.id];
              const isHighlighted = state.gamePhase === 'pyramid' ? hasActiveDeal : isActive;
              const gateEntry = state.drinkGate?.entries.find((e) => e.playerId === player.id);
              const pendingSips = gateEntry && !gateEntry.confirmed ? gateEntry.sips : 0;
              const remainingToGive = state.pyramid?.activeDeals[player.id]?.remainingSips ?? 0;
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-1.5 rounded-md px-2 h-9 min-w-0 transition-all duration-300 ${
                    isHighlighted ? 'bg-white text-neutral-900' : 'bg-neutral-800 text-white'
                  } ${!player.isConnected ? 'opacity-40' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${player.isConnected ? 'bg-green-500' : 'bg-neutral-400'}`} />
                  <MarqueeText text={player.nick} className="text-sm font-medium flex-1 min-w-0" />
                  {remainingToGive > 0 && (
                    <span className="text-[11px] px-0.5 rounded font-bold tabular-nums leading-tight bg-sky-500 text-white flex-shrink-0">
                      →{remainingToGive}
                    </span>
                  )}
                  {pendingSips > 0 && (
                    <span className="text-[11px] px-0.5 rounded font-bold tabular-nums leading-tight bg-amber-500 text-white flex-shrink-0">
                      +{pendingSips}
                    </span>
                  )}
                  {state.gamePhase !== null && (
                    <span className="text-[11px] tabular-nums flex-shrink-0 opacity-70">🍺{player.sips}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Etap 3 — gracz tramwajowy wyśrodkowany */}
        {(state?.gamePhase === 'tram' || (state?.status === 'ended' && state?.tram)) && state?.tram && (() => {
          const tramPlayer = state.players.find((p) => p.id === state.tram!.tramPlayerId);
          if (!tramPlayer) return null;
          const colorClass = AVATAR_COLORS[hashNick(tramPlayer.nick) % AVATAR_COLORS.length];
          const initial = tramPlayer.nick.charAt(0).toUpperCase();
          const isTramRestart = state.drinkGate?.resumeAction === 'tram-restart';
          const bgClass = state.status === 'ended' ? 'bg-green-700' : isTramRestart ? 'bg-red-700' : 'bg-neutral-800';
          return (
            <div className="flex justify-center">
              <div className={`flex flex-col gap-1 rounded-xl px-4 py-2 transition-colors duration-300 text-white ${bgClass} ${!tramPlayer.isConnected ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${colorClass}`}>
                    {initial}
                  </div>
                  <span className="font-medium text-sm">{tramPlayer.nick}</span>
                  <span className="text-xs ml-1">🚋</span>
                  <span className="text-xs ml-1 opacity-70">🍺 {tramPlayer.sips}</span>
                </div>
              </div>
            </div>
          );
        })()}


        {/* Etap 1 — zbieranie kart */}
        {state?.gamePhase === 'collecting' && state.collecting && (
          <div className="flex flex-row flex-1 min-h-0 -mx-8 -mb-8 overflow-hidden">
            {/* Lewa część — aktywny gracz + kolejka (ticker) */}
            <PlayerCollectingPanel
              players={state.players}
              currentPlayerIdx={state.collecting.currentPlayerIdx}
            />

            {/* Prawa część — aktualna karta lub DrinkGate */}
            <RightCardPanel
              card={state.collecting.currentCard ?? null}
              label="Aktualna karta"
              drinkGate={state.drinkGate}
              players={state.players}
              placeholder="Oczekiwanie na odsłonięcie…"
            />
          </div>
        )}

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
<div className="flex flex-col gap-3 w-full flex-1 justify-center">
                <div className="grid grid-cols-5 gap-2 w-full">
                  {(() => {
                    const allCards = [state.tram!.referenceCard, ...state.tram!.streakCards];
                    const failedCard = (state.drinkGate?.resumeAction === 'tram-restart' || state.tram!.tramAwaitingHostNext) ? state.tram!.lastCard : null;
                    const failedSlot = failedCard ? allCards.length : -1;
                    return [0, 1, 2, 3, 4].map((i) => {
                      const card = allCards[i];
                      const isFailed = i === failedSlot;
                      return (
                        <div key={i} className={`aspect-[5/7] w-full${isFailed ? ' ring-2 ring-red-500 rounded-xl' : ''}`}>
                          {card
                            ? <Card card={card} size="fill" />
                            : isFailed && failedCard
                              ? <Card card={failedCard} size="fill" />
                              : <Card faceDown size="fill" />}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>

            {/* Prawa część — ostatnia wyciągnięta karta */}
            <RightCardPanel
              card={state.tram.lastCard ?? state.tram.referenceCard}
              label="Ostatnia karta"
              drinkGate={state.drinkGate?.resumeAction !== 'tram-restart' ? state.drinkGate : null}
              players={state.players}
            />
          </div>
        )}

        {/* Waiting — QR + opcjonalny komunikat */}
        {state?.status === 'waiting' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            {joinUrl ? (
              <QrPoster code={code} joinUrl={joinUrl} />
            ) : (
              <div className="w-64 h-64 bg-neutral-800 rounded-2xl animate-pulse" />
            )}
            {state.players.length === 0 && (
              <p className="text-2xl font-bold text-neutral-700">Czekamy na graczy…</p>
            )}
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
