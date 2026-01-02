"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { GameState, Prize } from "@/lib/tombola";
import { PRIZE_ORDER } from "@/lib/tombola";

const PRIZE_LABEL: Record<Prize, string> = {
  AMBO: "AMBO",
  TERNO: "TERNO",
  QUATERNA: "QUATERNA",
  CINQUINA: "CINQUINA",
  TOMBOLA: "TOMBOLA",
};

function classNames(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

function CardView({ card, marked }: { card: any; marked: boolean[] }) {
  return (
    <div className="rounded-2xl border border-black/10 p-3 bg-white shadow-soft">
      <div className="grid grid-rows-3 gap-1">
        {card.grid.map((row: any[], r: number) => (
          <div key={r} className="grid grid-cols-9 gap-1">
            {row.map((cell: number | null, c: number) => {
              const isMarked = cell !== null && marked[cell];
              return (
                <div
                  key={c}
                  style={isMarked ? { backgroundColor: "var(--primary)", borderColor: "var(--primary)" } : undefined}
                  className={classNames(
                    "relative h-11 flex items-center justify-center rounded-xl border text-sm font-extrabold transition",
                    cell === null ? "bg-gray-50 border-dashed text-gray-300" : "bg-white text-gray-900 border-black/10",
                    isMarked && "text-white ring-brand"
                  )}
                >
                  {cell ?? ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function findBestPrizeWon(state: GameState, playerId: string): Prize | null {
  // premio “più alto” vinto dal player (in ordine PRIZE_ORDER)
  let best: Prize | null = null;
  for (const p of PRIZE_ORDER) {
    const a = state.awards[p];
    if (!a) continue;
    const won = a.winners.some((w) => w.playerId === playerId);
    if (won) best = p;
  }
  return best;
}

export default function PlayerPage() {
  const params = useParams<{ gameId: string; playerId: string }>();
  const gameId = params?.gameId;
  const playerId = params?.playerId;

    if (!gameId || !playerId) {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-soft">
          <div className="text-lg font-bold">Link non valido</div>
          <div className="text-sm text-gray-600 mt-1">Mancano gameId o playerId.</div>
        </div>
      </main>
    );
  }

  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    let cleanup: (() => void) | undefined;

    (async () => {
      await fetch("/api/socket"); // avvia socket server in dev
      const socket = getSocket();

      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));

      socket.emit("join", { gameId });

      const onUpdate = (gs: GameState) => setState(gs);
      socket.on("game:update", onUpdate);

      cleanup = () => {
        socket.off("game:update", onUpdate);
        socket.off("connect");
        socket.off("disconnect");
      };
    })();

    return () => cleanup?.();
  }, [gameId]);

  const me = useMemo(() => {
    if (!state) return null;
    return state.players.find((p) => p.id === playerId) ?? null;
  }, [state, playerId]);

  const last = state?.drawSequence[state.drawSequence.length - 1];
  const bestPrize = state ? findBestPrizeWon(state, playerId) : null;

  if (!state) {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-soft">
          <div className="text-lg font-bold">Connessione…</div>
          <div className="text-sm text-gray-600 mt-1">In attesa dello stato partita.</div>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-soft">
          <div className="text-lg font-bold">Giocatore non trovato</div>
          <div className="text-sm text-gray-600 mt-1">Link errato o partita resettata.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">Vista giocatore</div>
            <div className="text-2xl font-extrabold">{me.name}</div>
            <div className="mt-1 text-xs text-gray-500">
              Stato: {connected ? "🟢 online" : "🟠 offline"}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-500">Ultimo numero</div>
            <div className="text-4xl font-extrabold">{last ?? "—"}</div>
          </div>
        </header>

        {/* Badge grande SOLO se vincitore di almeno un premio */}
        {bestPrize && (
          <div
            className="mb-5 rounded-3xl p-5 text-white shadow-soft"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <div className="text-sm text-white/80">Hai vinto:</div>
            <div className="text-4xl font-extrabold tracking-tight">🎉 {PRIZE_LABEL[bestPrize]}!</div>
            <div className="mt-2 text-sm text-white/85">
              Complimenti!
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {me.cards.map((card) => (
            <CardView key={card.id} card={card} marked={state.marked} />
          ))}
        </div>
      </div>
    </main>
  );
}
