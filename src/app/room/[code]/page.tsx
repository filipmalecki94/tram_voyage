'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/Card';
import { useRoom, useRoomRejoin } from '@/lib/use-room';
import { getSocket } from '@/lib/socket-client';
import { cn } from '@/lib/utils';
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
      } else {
        // Token nieważny (np. serwer zrestartował) — wyczyść stale dane i pokaż formularz join
        setMyPlayerId(null);
        localStorage.removeItem(`tram:playerId:${code}`);
        localStorage.removeItem(`tram:token:${code}`);
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

  const handleCollectingConfirm = useCallback(async () => {
    const res = await emit('game:collectingConfirm', {});
    if (!res.ok) toast.error(res.error);
  }, [emit]);

  const handlePyramidNext = useCallback(async () => {
    const res = await emit('game:pyramidNext', {});
    if (!res.ok) toast.error(res.error);
  }, [emit]);

  const handlePyramidAssign = useCallback(async (toPlayerId: string, sips: number) => {
    const res = await emit('game:pyramidAssign', { toPlayerId, sips });
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
    <main className="w-full min-h-screen flex flex-col p-4 gap-4 max-w-md mx-auto pb-32">
      {/* Header */}
      <div className="pt-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Kod pokoju</p>
        <h1 className="text-4xl font-bold font-mono tracking-widest">{state.code}</h1>
        {state.gamePhase === 'collecting' && (
          <p className="text-sm text-muted-foreground">
            Etap 1{state.collecting ? ` — Runda ${state.collecting.round}/4` : ''}
          </p>
        )}
        {state.gamePhase === 'pyramid' && (
          <p className="text-sm text-muted-foreground">Etap 2 — Piramida</p>
        )}
        {state.gamePhase === 'tram' && (
          <p className="text-sm text-muted-foreground">
            Etap 3 — Tramwaj{state.tram ? ` (streak ${state.tram.streak}/5)` : ''}
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
          const isMe = player.id === myPlayerId;
          const isHost = player.id === state.hostPlayerId;
          const gateEntry = state.drinkGate?.entries.find((e) => e.playerId === player.id);
          const pendingSips = gateEntry && !gateEntry.confirmed ? gateEntry.sips : 0;
          const inGame = state.status === 'ended' || state.gamePhase !== null;
          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${isCurrentTurn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${player.isConnected ? 'bg-green-500' : 'bg-neutral-400'}`}
              />
              <span
                className={cn(
                  'flex-1 font-medium truncate',
                  isHost && !isCurrentTurn && 'text-yellow-500',
                  isHost && isCurrentTurn && 'text-yellow-300',
                  isMe && 'underline',
                )}
              >
                {player.nick}
              </span>
              {/* Prawa strona — stała szerokość: badge (invisible gdy 0) + licznik */}
              {inGame && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded font-semibold tabular-nums',
                      pendingSips > 0 ? 'bg-amber-500 text-white' : 'invisible',
                    )}
                  >
                    +{pendingSips}
                  </span>
                  <span className="text-xs tabular-nums w-9 text-right">🍺 {player.sips}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DrinkGate — przystanek na picie (tylko tram-restart; collecting i pyramid obsługują slot inline) */}

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
      {state.gamePhase === 'collecting' && (() => {
        const col = state.collecting;
        if (!col) return <div className="flex flex-col gap-4 mt-2"><p className="text-center text-muted-foreground py-4">Ładowanie…</p></div>;
        const isMyTurn = state.players[col.currentPlayerIdx]?.id === myPlayerId;
        const currentPlayer = state.players[col.currentPlayerIdx];
        const rainbowAvail = isMyTurn && isRainbowAvailable(myHand);
        const missing = rainbowAvail ? missingSuit(myHand) : null;
        const blockGuess = !!state.drinkGate || col.pendingConfirm !== null;

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
                          disabled={blockGuess}
                          className={`h-16 text-lg rounded-md border-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
                      disabled={blockGuess}
                      onClick={() => setSelectedAnswer('higher')}
                    >
                      ▲ Wyżej
                    </Button>
                    <Button
                      variant={selectedAnswer === 'lower' ? 'default' : 'outline'}
                      className="h-16 text-lg"
                      disabled={blockGuess}
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
                      disabled={blockGuess}
                      onClick={() => setSelectedAnswer('inside')}
                    >
                      Pomiędzy
                    </Button>
                    <Button
                      variant={selectedAnswer === 'outside' ? 'default' : 'outline'}
                      className="h-16 text-lg"
                      disabled={blockGuess}
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
                            disabled={blockGuess}
                            className={`h-16 text-lg rounded-md border-2 border-transparent bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 via-blue-400 to-purple-500 text-white font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${selected ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                            onClick={() => setSelectedAnswer(suit)}
                          >
                            {SUIT_LABELS[suit]}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={suit}
                          disabled={blockGuess}
                          className={`h-16 text-lg rounded-md border-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
              </>
            )}

            {/* CTA slot — widoczny niezależnie od isMyTurn */}
            {(() => {
              const myEntry = state.drinkGate?.entries.find((e) => e.playerId === myPlayerId);
              const pendingMyDrink = myEntry && !myEntry.confirmed;
              const iWaitForConfirm = col.pendingConfirm === myPlayerId;

              // Priorytet 1: muszę potwierdzić picie
              if (pendingMyDrink) {
                return (
                  <Button
                    className="h-14 text-xl w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleConfirmDrink}
                  >
                    Wypiłem 🍺 {myEntry!.sips}
                  </Button>
                );
              }

              // Priorytet 2: potwierdziłem picie, czekam na innych
              if (myEntry?.confirmed) {
                return (
                  <p className="h-14 flex items-center justify-center text-center text-emerald-500 font-medium mt-2">
                    ✓ Wypiłem — czekamy na innych
                  </p>
                );
              }

              // Priorytet 3: muszę kliknąć "Zgadłem!" + drinkGate wciąż aktywny (tęcza)
              if (iWaitForConfirm && state.drinkGate) {
                return (
                  <button
                    className="h-14 text-xl w-full mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold transition-colors"
                    onClick={handleCollectingConfirm}
                  >
                    ✓ Zgadłem! (czekamy aż wszyscy wypiją)
                  </button>
                );
              }

              // Priorytet 4: kliknąłem "Zgadłem!" wcześniej, czekam aż inni wypiją
              if (!iWaitForConfirm && col.pendingConfirm === null && state.drinkGate && isMyTurn) {
                return (
                  <p className="h-14 flex items-center justify-center text-center text-emerald-500 font-medium mt-2">
                    ✓ Zgadłem — czekamy aż wszyscy wypiją
                  </p>
                );
              }

              // Priorytet 5: muszę kliknąć "Zgadłem!" (bez drinkGate — zwykłe trafienie)
              if (iWaitForConfirm) {
                return (
                  <button
                    className="h-14 text-xl w-full mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold transition-colors"
                    onClick={handleCollectingConfirm}
                  >
                    ✓ Zgadłem!
                  </button>
                );
              }

              if (!isMyTurn) return null;
              return (
                <Button
                  className="h-14 text-xl w-full mt-2"
                  disabled={!selectedAnswer || blockGuess}
                  onClick={handleCollectingGuess}
                >
                  Ciągnij kartę
                </Button>
              );
            })()}
          </div>
        );
      })()}

      {/* Etap 2 — Piramida */}
      {state.gamePhase === 'pyramid' && state.pyramid && (() => {
        const py = state.pyramid;
        const currentCard = py.currentCard;
        // Gracz może rozdawać jeśli ma aktywny deal (kartę odłożono przy odsłonięciu)
        const myDeal = py.activeDeals[myPlayerId ?? ''];
        const canAssign = !!myDeal;
        // Wszyscy gracze (self-assign dozwolony)
        const allPlayers = state.players;

        return (
          <div className="flex flex-col gap-4 mt-2">
            {currentCard ? (
              <>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Odkryta karta</p>
                  <Card card={currentCard} size="lg" />
                </div>

                {/* Slot CTA: grid rozdawania kolejek (gdy canAssign) lub brak akcji */}
                {(() => {
                  const myEntry = state.drinkGate?.entries.find((e) => e.playerId === myPlayerId);
                  const pendingMyDrink = myEntry && !myEntry.confirmed;

                  if (canAssign && myDeal) {
                    const pool = myDeal.remainingSips;
                    const totalPool = myDeal.totalSips;
                    const alreadyGiven = totalPool - pool;
                    return (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-center">
                          {alreadyGiven > 0
                            ? `Zostało ${pool} z ${totalPool} kolejek — każ pić:`
                            : `Masz kartę! ${totalPool > 1 ? `Rozdaj ${totalPool} kolejki:` : 'Każ komuś pić:'}`}
                        </p>
                        <div className="flex gap-1 justify-center">
                          {Array.from({ length: totalPool }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                'h-2 w-6 rounded-full transition-colors duration-200',
                                i < alreadyGiven ? 'bg-primary/40' : 'bg-primary',
                              )}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {allPlayers.map((p) => (
                            <Button
                              key={p.id}
                              variant="outline"
                              className="h-12"
                              onClick={() => handlePyramidAssign(p.id, 1)}
                            >
                              {p.nick}{p.id === myPlayerId ? ' (ty)' : ''}
                            </Button>
                          ))}
                        </div>
                        {pendingMyDrink && (
                          <Button
                            className="h-14 text-xl w-full mt-1 bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={handleConfirmDrink}
                          >
                            Wypiłem 🍺 {myEntry!.sips}
                          </Button>
                        )}
                        {myEntry?.confirmed && (
                          <p className="h-14 flex items-center justify-center text-center text-emerald-500 font-medium">
                            ✓ Wypiłem — czekamy na innych
                          </p>
                        )}
                      </div>
                    );
                  }

                  if (pendingMyDrink) {
                    return (
                      <Button
                        className="h-14 text-xl w-full bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={handleConfirmDrink}
                      >
                        Wypiłem 🍺 {myEntry!.sips}
                      </Button>
                    );
                  }

                  if (myEntry?.confirmed) {
                    return (
                      <p className="h-14 flex items-center justify-center text-center text-emerald-500 font-medium">
                        ✓ Wypiłem — czekamy na innych
                      </p>
                    );
                  }

                  return (
                    <p className="h-14 flex items-center justify-center text-center text-muted-foreground">
                      Nie masz pasującej karty.
                    </p>
                  );
                })()}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Czekaj na odsłonięcie karty piramidy…
              </p>
            )}

            {amHost && (
              <Button
                className="h-14 text-lg w-full mt-2"
                disabled={!!state.drinkGate || Object.keys(py.activeDeals).length > 0}
                onClick={handlePyramidNext}
              >
                Odsłoń następną kartę
              </Button>
            )}

          </div>
        );
      })()}

      {/* Etap 3 — Tramwaj */}
      {(state.gamePhase === 'tram' || (state.status === 'ended' && state.tram)) && state.tram && (() => {
        const tram = state.tram;
        const isTramPlayer = tram.tramPlayerId === myPlayerId;
        const tramPlayer = state.players.find((p) => p.id === tram.tramPlayerId);
        const isFirstCard = tram.referenceCard === null;
        const isEnded = state.status === 'ended';
        // Pełna sekwencja: slot 0 = referenceCard, sloty 1-4 = streakCards
        const allCards: (typeof tram.referenceCard)[] = [
          tram.referenceCard,
          ...tram.streakCards,
        ];

        return (
          <div className="flex flex-col gap-4 mt-2">
            {/* Streak jako karty — slot 0 = referencyjna */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Tramwaj</p>
              <div className="flex items-end justify-center gap-1">
                {(() => {
                  const failedCard = state.drinkGate?.resumeAction === 'tram-restart' ? tram.lastCard : null;
                  const failedSlot = failedCard ? allCards.length : -1;
                  return [0, 1, 2, 3, 4].map((i) => {
                    const card = allCards[i];
                    const isFailed = i === failedSlot;
                    if (card) return <Card key={i} card={card} size="sm" />;
                    if (isFailed && failedCard) return (
                      <div key={i} className="ring-2 ring-red-500 rounded-lg">
                        <Card card={failedCard} size="sm" />
                      </div>
                    );
                    return <Card key={i} faceDown size="sm" />;
                  });
                })()}
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
            ) : isTramPlayer ? (
              <>
                {state.drinkGate ? (
                  <Button
                    className="h-16 text-xl w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleConfirmDrink}
                  >
                    Jadę dalej
                  </Button>
                ) : isFirstCard ? (
                  <Button
                    className="h-16 text-xl w-full"
                    onClick={() => handleTramGuess('reference')}
                  >
                    Ciągnij kartę
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
