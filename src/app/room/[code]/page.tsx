'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/Card';
import { useRoom, useRoomRejoin } from '@/lib/use-room';
import { getSocket } from '@/lib/socket-client';
import type { Card as CardType, Suit } from '@/shared/types';

const RANK_ORDER = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'] as const;

function sortHand(hand: CardType[]): CardType[] {
  return [...hand].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank as never) - RANK_ORDER.indexOf(b.rank as never),
  );
}

function isRainbowAvailable(hand: CardType[]): boolean {
  if (hand.length !== 3) return false;
  return new Set(hand.map((c) => c.suit)).size === 3;
}

function missingSuit(hand: CardType[]): Suit | null {
  if (!isRainbowAvailable(hand)) return null;
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const present = new Set(hand.map((c) => c.suit));
  return suits.find((s) => !present.has(s)) ?? null;
}

const SUIT_LABELS: Record<Suit, string> = {
  spades: '♠ Pik',
  clubs: '♣ Trefl',
  diamonds: '♦ Karo',
  hearts: '♥ Kier',
};

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const router = useRouter();

  const { state, error, emit, connectionStatus } = useRoom();
  const { saveToken, rejoin } = useRoomRejoin(code);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [joinNick, setJoinNick] = useState('');
  const [joining, setJoining] = useState(false);
  const [reconnecting, setReconnecting] = useState(true);

  // Dla Etapu 1 — wybrana odpowiedź przed zatwierdzeniem
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const prevConnectionStatus = useRef<string | null>(null);
  const wasDisconnected = useRef(false);

  // Na mount: spróbuj rejoin przez token z localStorage
  useEffect(() => {
    const storedPlayerId = localStorage.getItem(`tram:playerId:${code}`);
    if (storedPlayerId) setMyPlayerId(storedPlayerId);

    rejoin().then((ok) => {
      if (ok) {
        const pid = localStorage.getItem(`tram:playerId:${code}`);
        if (pid) setMyPlayerId(pid);
      }
      setReconnecting(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-rejoin po reconnect socket.io
  useEffect(() => {
    const socket = getSocket();
    const handleConnect = () => {
      if (!wasDisconnected.current) return;
      wasDisconnected.current = false;
      rejoin().then((ok) => {
        if (ok) {
          const pid = localStorage.getItem(`tram:playerId:${code}`);
          if (pid) setMyPlayerId(pid);
        }
      });
    };
    const handleDisconnect = () => {
      wasDisconnected.current = true;
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [code, rejoin]);

  // Toast dla statusu połączenia
  useEffect(() => {
    const prev = prevConnectionStatus.current;
    prevConnectionStatus.current = connectionStatus;

    if (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') {
      toast.loading('Wznawianie połączenia…', { id: 'reconn' });
    } else if (connectionStatus === 'connected' && prev !== null && prev !== 'connected') {
      toast.success('Połączono', { id: 'reconn' });
    }
  }, [connectionStatus]);

  // Toast dla błędów z serwera
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Reset selectedAnswer przy zmianie tury
  useEffect(() => {
    setSelectedAnswer(null);
  }, [state?.collecting?.currentPlayerIdx, state?.collecting?.round]);

  const handleJoin = useCallback(async () => {
    const nick = joinNick.trim();
    if (nick.length < 2 || nick.length > 16) return;
    setJoining(true);
    try {
      const res = await emit('room:join', { code, nick });
      if (!res.ok) {
        const msg =
          res.error === 'no_room'
            ? 'Pokój nie istnieje lub wygasł.'
            : res.error === 'room_full'
              ? 'Pokój jest pełny (maks. 12 graczy).'
              : 'Nie udało się dołączyć do pokoju.';
        toast.error(msg);
        return;
      }
      const { token, playerId } = res.data;
      saveToken(token);
      localStorage.setItem(`tram:playerId:${code}`, playerId);
      setMyPlayerId(playerId);
    } finally {
      setJoining(false);
    }
  }, [joinNick, code, emit, saveToken]);

  const handleStart = useCallback(async () => {
    await emit('game:start', {});
  }, [emit]);

  const handleLeave = useCallback(async () => {
    await emit('room:leave', {});
    localStorage.removeItem(`tram:token:${code}`);
    localStorage.removeItem(`tram:playerId:${code}`);
    router.push('/');
  }, [emit, code, router]);

  const handleCollectingGuess = useCallback(async () => {
    if (!selectedAnswer) return;
    const res = await emit('game:collectingGuess', { answer: selectedAnswer });
    if (!res.ok) toast.error(res.error);
    setSelectedAnswer(null);
  }, [selectedAnswer, emit]);

  const handlePyramidNext = useCallback(async () => {
    const res = await emit('game:pyramidNext', {});
    if (!res.ok) toast.error(res.error);
  }, [emit]);

  const handlePyramidAssign = useCallback(async (toPlayerId: string) => {
    const res = await emit('game:pyramidAssign', { toPlayerId });
    if (!res.ok) toast.error(res.error);
  }, [emit]);

  const handleTramGuess = useCallback(async (answer: 'higher' | 'lower' | 'reference') => {
    const res = await emit('game:tramGuess', { answer });
    if (!res.ok) toast.error(res.error);
  }, [emit]);

  const handleConfirmDrink = useCallback(async () => {
    const res = await emit('game:confirmDrink', {});
    if (!res.ok) toast.error(res.error);
  }, [emit]);

  // --- Rendering ---

  if (reconnecting) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Łączenie...</p>
      </main>
    );
  }

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
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
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
  const myHand = sortHand(state.handsByPlayerId[myPlayerId ?? ''] ?? []);
  const myIdx = state.players.findIndex((p) => p.id === myPlayerId);

  // Wachlarz kart (widoczny we wszystkich fazach gry)
  const HandFan = myHand.length > 0 ? (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-end justify-center z-10">
      {myHand.map((card, i) => {
        const offset = (i - (myHand.length - 1) / 2) * 28;
        const rotate = (i - (myHand.length - 1) / 2) * 5;
        return (
          <div
            key={`${card.rank}-${card.suit}`}
            className="absolute transition-all duration-300"
            style={{ transform: `translateX(${offset}px) rotate(${rotate}deg) translateY(12px)` }}
          >
            <Card card={card} size="sm" />
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <main className="min-h-screen flex flex-col p-4 gap-4 max-w-md mx-auto pb-32">
      {/* Header */}
      <div className="pt-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Kod pokoju</p>
        <h1 className="text-4xl font-bold font-mono tracking-widest">{state.code}</h1>
        {state.gamePhase === 'collecting' && state.collecting && (
          <p className="text-sm text-muted-foreground">
            Etap 1 — Runda {state.collecting.round}/4
          </p>
        )}
        {state.gamePhase === 'pyramid' && (
          <p className="text-sm text-muted-foreground">Etap 2 — Piramida</p>
        )}
        {state.gamePhase === 'tram' && state.tram && (
          <p className="text-sm text-muted-foreground">
            Etap 3 — Tramwaj (streak {state.tram.streak}/5)
          </p>
        )}
      </div>

      {/* Lista graczy */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gracze</p>
        {state.players.map((player) => {
          const isCurrentTurn =
            state.status === 'playing' &&
            (state.collecting
              ? state.players[state.collecting.currentPlayerIdx]?.id === player.id
              : state.currentPlayerId === player.id);
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
              {(state.status === 'ended' || state.gamePhase !== null) && (
                <span className="text-xs ml-1">🍺 {player.sips}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* DrinkGate — przystanek na picie */}
      {state.drinkGate && (() => {
        const gate = state.drinkGate!;
        const myEntry = gate.entries.find((e) => e.playerId === myPlayerId);
        const isTramRestart = gate.resumeAction === 'tram-restart';
        const confirmedCount = gate.entries.filter((e) => e.confirmed).length;

        return (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500 bg-amber-500/10 p-4">
            {isTramRestart && gate.context?.streakCards && gate.context.streakCards.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-amber-400">Karty z tego podejścia:</p>
                <div className="flex gap-1 flex-wrap">
                  {gate.context.streakCards.map((c, i) => (
                    <Card key={i} card={c} size="sm" />
                  ))}
                </div>
              </div>
            )}
            {myEntry && !myEntry.confirmed ? (
              <Button
                className="h-16 text-xl w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleConfirmDrink}
              >
                {isTramRestart ? 'Jadę dalej' : `Wypiłem 🍺 ${myEntry.sips}`}
              </Button>
            ) : myEntry?.confirmed ? (
              <p className="text-center text-emerald-400 font-medium py-2">
                ✓ Potwierdzone — czekamy na innych ({confirmedCount}/{gate.entries.length})
              </p>
            ) : (
              <p className="text-center text-amber-400 text-sm py-2">
                {gate.entries.filter((e) => !e.confirmed).map((e) => state.players.find((p) => p.id === e.playerId)?.nick ?? e.playerId).join(', ')} {gate.entries.length === 1 ? 'pije' : 'piją'}…
              </p>
            )}
          </div>
        );
      })()}

      {/* Oczekiwanie na start */}
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

      {/* Etap 1 — Zbieranie */}
      {state.gamePhase === 'collecting' && state.collecting && (() => {
        const col = state.collecting;
        const isMyTurn = state.players[col.currentPlayerIdx]?.id === myPlayerId;
        const currentPlayer = state.players[col.currentPlayerIdx];
        const rainbowAvail = isMyTurn && isRainbowAvailable(myHand);
        const missing = rainbowAvail ? missingSuit(myHand) : null;

        return (
          <div className="flex flex-col gap-4 mt-2">
            {!isMyTurn ? (
              <p className="text-center text-xl py-4">
                Tura: <strong>{currentPlayer?.nick ?? '...'}</strong>
              </p>
            ) : (
              <>
                <p className="text-center text-sm text-muted-foreground font-medium">Twoja tura! Wybierz odpowiedź:</p>

                {/* Runda 1: kolor */}
                {col.round === 1 && (
                  <div className="grid grid-cols-2 gap-3">
                    {(['black', 'red'] as const).map((v) => {
                      const isBlack = v === 'black';
                      const selected = selectedAnswer === v;
                      return (
                        <button
                          key={v}
                          disabled={!!state.drinkGate}
                          className={`h-16 text-lg rounded-md border-2 font-medium transition-colors ${
                            isBlack
                              ? `border-neutral-900 text-neutral-900 hover:bg-neutral-900/10 hover:text-neutral-900 dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100/10 dark:hover:text-neutral-100 ${selected ? 'bg-neutral-900/10 ring-2 ring-neutral-900 dark:bg-neutral-100/10 dark:ring-neutral-100' : 'bg-transparent'}`
                              : `border-red-600 text-red-600 hover:bg-red-600/10 hover:text-red-600 ${selected ? 'bg-red-600/10 ring-2 ring-red-600' : 'bg-transparent'}`
                          }`}
                          onClick={() => setSelectedAnswer(v)}
                        >
                          {isBlack ? 'Czarna' : 'Czerwona'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Runda 2: wyżej/niżej */}
                {col.round === 2 && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={selectedAnswer === 'higher' ? 'default' : 'outline'}
                      className="h-16 text-lg"
                      onClick={() => setSelectedAnswer('higher')}
                    >
                      ▲ Wyżej
                    </Button>
                    <Button
                      variant={selectedAnswer === 'lower' ? 'default' : 'outline'}
                      className="h-16 text-lg"
                      onClick={() => setSelectedAnswer('lower')}
                    >
                      ▼ Niżej
                    </Button>
                  </div>
                )}

                {/* Runda 3: pomiędzy/poza */}
                {col.round === 3 && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={selectedAnswer === 'inside' ? 'default' : 'outline'}
                      className="h-16 text-lg"
                      onClick={() => setSelectedAnswer('inside')}
                    >
                      Pomiędzy
                    </Button>
                    <Button
                      variant={selectedAnswer === 'outside' ? 'default' : 'outline'}
                      className="h-16 text-lg"
                      onClick={() => setSelectedAnswer('outside')}
                    >
                      Poza
                    </Button>
                  </div>
                )}

                {/* Runda 4: symbol */}
                {col.round === 4 && (
                  <div className="grid grid-cols-2 gap-3">
                    {(['spades', 'clubs', 'diamonds', 'hearts'] as Suit[]).map((suit) => {
                      const isRainbow = suit === missing;
                      const isRed = suit === 'diamonds' || suit === 'hearts';
                      const selected = selectedAnswer === suit;
                      if (isRainbow) {
                        return (
                          <button
                            key={suit}
                            disabled={!!state.drinkGate}
                            className={`h-16 text-lg rounded-md border-2 border-transparent bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-blue-400 to-purple-500 text-white font-medium transition-opacity ${selected ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                            onClick={() => setSelectedAnswer(suit)}
                          >
                            {SUIT_LABELS[suit]}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={suit}
                          disabled={!!state.drinkGate}
                          className={`h-16 text-lg rounded-md border-2 font-medium transition-colors ${
                            isRed
                              ? `border-red-600 text-red-600 hover:bg-red-600/10 hover:text-red-600 ${selected ? 'bg-red-600/10 ring-2 ring-red-600' : 'bg-transparent'}`
                              : `border-neutral-900 text-neutral-900 hover:bg-neutral-900/10 hover:text-neutral-900 dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100/10 dark:hover:text-neutral-100 ${selected ? 'bg-neutral-900/10 ring-2 ring-neutral-900 dark:bg-neutral-100/10 dark:ring-neutral-100' : 'bg-transparent'}`
                          }`}
                          onClick={() => setSelectedAnswer(suit)}
                        >
                          {SUIT_LABELS[suit]}
                        </button>
                      );
                    })}
                  </div>
                )}

                <Button
                  className="h-14 text-xl w-full mt-2"
                  disabled={!selectedAnswer}
                  onClick={handleCollectingGuess}
                >
                  Ciągnij kartę
                </Button>
              </>
            )}
          </div>
        );
      })()}

      {/* Etap 2 — Piramida */}
      {state.gamePhase === 'pyramid' && state.pyramid && (() => {
        const py = state.pyramid;
        const currentCard = py.currentCard;
        // Karty w ręce pasujące do aktualnej karty piramidy
        const matchingCards = currentCard
          ? myHand.filter((c) => c.rank === currentCard.rank)
          : [];
        const canAssign = matchingCards.length > 0;
        const otherPlayers = state.players.filter((p) => p.id !== myPlayerId);

        return (
          <div className="flex flex-col gap-4 mt-2">
            {currentCard ? (
              <>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Odkryta karta</p>
                  <Card card={currentCard} size="lg" />
                </div>

                {canAssign && !state.drinkGate && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-center">
                      Masz kartę o tej randze! Każ komuś pić:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {otherPlayers.map((p) => (
                        <Button
                          key={p.id}
                          variant="outline"
                          className="h-12"
                          onClick={() => handlePyramidAssign(p.id)}
                        >
                          {p.nick}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {!canAssign && (
                  <p className="text-center text-muted-foreground py-2">
                    Nie masz pasującej karty.
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Czekaj na odsłonięcie karty piramidy…
              </p>
            )}

            {amHost && (
              <Button
                className="h-14 text-lg w-full mt-2"
                disabled={!!state.drinkGate}
                onClick={handlePyramidNext}
              >
                Odsłoń następną kartę
              </Button>
            )}

            {/* Liczniki łyków z bieżącej karty — z drinkGate */}
            {currentCard && state.drinkGate && state.drinkGate.entries.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  Łyki za tę kartę
                </p>
                {state.drinkGate.entries.map((entry) => {
                  const player = state.players.find((p) => p.id === entry.playerId);
                  return (
                    <div key={entry.playerId} className="flex justify-between px-2 py-1 bg-muted rounded">
                      <span>{player?.nick ?? entry.playerId}</span>
                      <span className="font-bold">🍺 {entry.sips} {entry.confirmed ? '✓' : '…'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Etap 3 — Tramwaj */}
      {(state.gamePhase === 'tram' || (state.status === 'ended' && state.tram)) && state.tram && (() => {
        const tram = state.tram;
        const isTramPlayer = tram.tramPlayerId === myPlayerId;
        const tramPlayer = state.players.find((p) => p.id === tram.tramPlayerId);
        const isFirstCard = tram.lastCard === null;
        const isEnded = state.status === 'ended';

        return (
          <div className="flex flex-col gap-4 mt-2">
            {/* Karta referencyjna */}
            {tram.lastCard && !isEnded && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  Ostatnia karta
                </p>
                <Card card={tram.lastCard} size="lg" />
              </div>
            )}

            {/* Streak jako karty */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Streak</p>
              <div className="flex items-end justify-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => {
                  const revealed = tram.streakCards[i];
                  return revealed
                    ? <Card key={i} card={revealed} size="sm" />
                    : <Card key={i} faceDown size="sm" />;
                })}
              </div>
            </div>

            {isEnded ? (
              <div className="flex flex-col items-center gap-3 mt-2">
                <h2 className="text-2xl font-bold">Koniec gry!</h2>
                {state.winnerId && (
                  <p className="text-lg text-center">
                    Tramwajarz:{' '}
                    <strong>{state.players.find((p) => p.id === state.winnerId)?.nick ?? '?'}</strong>{' '}
                    dojedzie!
                  </p>
                )}
                <p className="text-muted-foreground text-center text-sm">
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
            ) : isTramPlayer && !state.drinkGate ? (
              <>
                {isFirstCard ? (
                  <Button
                    className="h-16 text-xl w-full"
                    onClick={() => handleTramGuess('reference')}
                  >
                    Ciągnij kartę referencyjną
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="h-16 text-xl"
                      onClick={() => handleTramGuess('higher')}
                    >
                      ▲ Wyżej
                    </Button>
                    <Button
                      className="h-16 text-xl"
                      onClick={() => handleTramGuess('lower')}
                    >
                      ▼ Niżej
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                <strong>{tramPlayer?.nick ?? '...'}</strong> jedzie tramwajem.
              </p>
            )}
          </div>
        );
      })()}

      {/* Wachlarz kart */}
      {state.status === 'playing' && myHand.length > 0 && HandFan}

      {/* Dummy — nie usuwaj, żeby myIdx nie był "unused" */}
      {myIdx === -1 && null}
    </main>
  );
}
