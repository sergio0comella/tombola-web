// src/app/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import type { GameState, Player, Prize } from "@/lib/tombola";
import { applyDrawNumber, createGame, PRIZE_ORDER, undoLast, nextUnassignedPrize } from "@/lib/tombola";
import { getSocket } from "@/lib/socket";
import QRCode from "qrcode";

type SetupPlayer = { name: string; cards: number };

const PRIZE_LABEL: Record<Prize, string> = {
  AMBO: "Ambo",
  TERNO: "Terno",
  QUATERNA: "Quaterna",
  CINQUINA: "Cinquina",
  TOMBOLA: "Tombola",
};

function classNames(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warn";
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        tone === "neutral" && "bg-white text-gray-800 border-black/10",
        tone === "success" && "bg-emerald-50 text-emerald-800 border-emerald-200",
        tone === "warn" && "bg-amber-50 text-amber-900 border-amber-200"
      )}
    >
      {children}
    </span>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-black/10">
          <div className="flex items-center justify-between p-4 border-b border-black/10">
            <div className="font-semibold">{title}</div>
            <button onClick={onClose} className="rounded-lg px-2 py-1 hover:bg-gray-100">
              ✕
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Board({ state, onPick }: { state: GameState; onPick: (n: number) => void }) {
  const nums = useMemo(() => Array.from({ length: 90 }, (_, i) => i + 1), []);
  const last = state.drawSequence[state.drawSequence.length - 1];
  const hot = new Set(state.drawSequence.slice(-8));

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-gray-500">Ultimo estratto</div>
          <div className="text-4xl font-extrabold tracking-tight">{last ?? "—"}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>
              Estratti: <span className="ml-1">{state.drawSequence.length}</span>
            </Pill>
            <Pill tone={nextUnassignedPrize(state.awards) ? "warn" : "success"}>
              Prossimo premio:{" "}
              <span className="ml-1 font-bold">
                {nextUnassignedPrize(state.awards) ? PRIZE_LABEL[nextUnassignedPrize(state.awards)!] : "Fine"}
              </span>
            </Pill>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Ultimi numeri:{" "}
          <span className="font-semibold text-gray-900">
            {state.drawSequence.slice(-12).join(", ") || "—"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-10 gap-2">
        {nums.map((n) => {
          const marked = state.marked[n];
          const isHot = hot.has(n);
          return (
            <button
              key={n}
              onClick={() => onPick(n)}
             className={classNames(
                "h-10 w-10 rounded-full border text-sm font-extrabold transition active:scale-[0.95] flex items-center justify-center",
                marked
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white hover:bg-gray-50 border-black/10",
                isHot && !marked && "ring-2 ring-black/10"
              )}

              aria-pressed={marked}
              title={marked ? "Già segnato" : "Segna numero"}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardView({ card, marked }: { card: Player["cards"][number]; marked: boolean[] }) {
  return (
    <div className="rounded-2xl border border-black/10 p-3 bg-white shadow-soft">
      <div className="grid grid-rows-3 gap-1">
        {card.grid.map((row, r) => (
          <div key={r} className="grid grid-cols-9 gap-1">
            {row.map((cell, c) => {
              const isMarked = cell !== null && marked[cell];

              return (
                <div
                  key={c}
                  style={isMarked ? { backgroundColor: "var(--primary)", borderColor: "var(--primary)" } : undefined}
                  className={classNames(
                    "relative h-9 flex items-center justify-center rounded-xl border text-xs font-extrabold transition",
                    cell === null
                      ? "bg-gray-50 border-dashed text-gray-300"
                      : "bg-white text-gray-900 border-black/10",
                    isMarked && "text-white ring-brand"
                  )}
                >
                  {cell ?? ""}
                  {isMarked && (
                    <span className="absolute top-0.5 right-1 text-[10px] opacity-90 leading-none select-none">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardPanel({ state }: { state: GameState }) {
  const next = nextUnassignedPrize(state.awards);
  const progress = PRIZE_ORDER.findIndex((p) => p === next);
  const doneCount = progress === -1 ? PRIZE_ORDER.length : progress;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Premi</div>
        <Pill tone={doneCount === PRIZE_ORDER.length ? "success" : "warn"}>
          {doneCount}/{PRIZE_ORDER.length} assegnati
        </Pill>
      </div>

      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-gray-900" style={{ width: `${(doneCount / PRIZE_ORDER.length) * 100}%` }} />
      </div>

      <div className="mt-4 space-y-3">
        {PRIZE_ORDER.map((p) => {
          const a = state.awards[p];
          const isNext = next === p;
          const winnersUnique = a ? Array.from(new Set(a.winners.map((w) => w.playerName))) : [];

          return (
            <div
              key={p}
              className={classNames(
                "rounded-2xl border p-3",
                a && "border-gray-900",
                !a && isNext && "border-amber-300 bg-amber-50",
                !a && !isNext && "border-black/10 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{PRIZE_LABEL[p]}</div>
                <div className="text-xs text-gray-600">
                  {a ? `trigger: #${a.drawIndex + 1} (n° ${a.numberDrawn})` : isNext ? "in attesa…" : "—"}
                </div>
              </div>

              {a ? (
                <div className="mt-2">
                  <div className="text-sm text-gray-700">
                    Vincitori: <span className="font-semibold text-gray-900">{winnersUnique.join(", ")}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.winners.map((w, i) => (
                      <Pill key={`${w.playerId}_${w.cardId}_${i}`} tone="success">
                        {w.playerName} · {w.cardId.slice(-6)}
                      </Pill>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-600">
                  {isNext
                    ? "Appena un giocatore lo completa, verranno mostrati tutti i vincitori."
                    : "Non assegnato."}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<"SETUP" | "GAME">("SETUP");
  const [setupPlayers, setSetupPlayers] = useState<SetupPlayer[]>([{ name: "Giocatore 1", cards: 1 }]);

  const [game, setGame] = useState<GameState | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  const [openAddNumber, setOpenAddNumber] = useState(false);
  const [manualNumber, setManualNumber] = useState<string>("");

  // QR
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrLink, setQrLink] = useState<string>("");
  const [qrPlayerName, setQrPlayerName] = useState<string>("");
  const [phoneBaseUrl, setPhoneBaseUrl] = useState<string>(""); // es. http://192.168.x.x:3000

  const lastAward = useMemo(() => {
    if (!game) return null;
    for (let i = PRIZE_ORDER.length - 1; i >= 0; i--) {
      const p = PRIZE_ORDER[i];
      if (game.awards[p]) return game.awards[p]!;
    }
    return null;
  }, [game]);

  function addPlayer() {
    setSetupPlayers((ps) => ps.concat({ name: `Giocatore ${ps.length + 1}`, cards: 1 }));
  }
  function removePlayer(idx: number) {
    setSetupPlayers((ps) => ps.filter((_, i) => i !== idx));
  }

  async function start() {
    const cleaned = setupPlayers.map((p) => ({
      name: p.name.trim() || "Giocatore",
      cards: Math.max(1, Math.min(12, p.cards || 1)),
    }));

    const gs = createGame(cleaned);
    setGame(gs);
    setPhase("GAME");

    // base URL default
    if (typeof window !== "undefined") {
      setPhoneBaseUrl(window.location.origin);
    }

    // start socket server (dev)
    await fetch("/api/socket");

    const socket = getSocket();
    socket.emit("host:create", gs, ({ gameId }: { gameId: string }) => {
      setGameId(gameId);
    });
  }

  function reset() {
    setGame(null);
    setGameId(null);
    setPhase("SETUP");
    setQrOpen(false);
    setQrDataUrl("");
    setQrLink("");
    setQrPlayerName("");
  }

  function pushUpdate(updated: GameState) {
    if (!gameId) return;
    const socket = getSocket();
    socket.emit("host:update", { gameId, gameState: updated });
  }

  function pick(n: number) {
    if (!game) return;
    const updated = applyDrawNumber(game, n);
    setGame(updated);
    pushUpdate(updated);
  }

  function undo() {
    if (!game) return;
    const updated = undoLast(game);
    setGame(updated);
    pushUpdate(updated);
  }

  function pickManual() {
    const n = Number(manualNumber);
    if (!game) return;
    if (!Number.isFinite(n) || n < 1 || n > 90) return;

    const updated = applyDrawNumber(game, n);
    setGame(updated);
    pushUpdate(updated);

    setManualNumber("");
    setOpenAddNumber(false);
  }

  function drawRandom() {
    if (!game) return;

    // lista numeri non ancora estratti (1..90)
    const remaining: number[] = [];
    for (let n = 1; n <= 90; n++) {
      if (!game.marked[n]) remaining.push(n);
    }

    if (remaining.length === 0) return;

    const n = remaining[Math.floor(Math.random() * remaining.length)];
    const updated = applyDrawNumber(game, n);
    setGame(updated);
    pushUpdate(updated);
  }


  async function openQrForPlayer(p: Player) {
    if (!gameId) return;
    const base = (phoneBaseUrl || "").trim();
    if (!base) return;

    const link = `${base}/player/${gameId}/${p.id}`;
    const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 280, errorCorrectionLevel: "M" });

    setQrPlayerName(p.name);
    setQrLink(link);
    setQrDataUrl(dataUrl);
    setQrOpen(true);
  }

  if (phase === "SETUP") {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto max-w-5xl">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight">Tombola Web</h1>
            <p className="text-gray-600">
              Imposta giocatori e cartelle. Poi usa il tabellone per segnare i numeri estratti fisicamente.
            </p>
          </header>

          <div className="mt-6 grid grid-cols-12 gap-6">
            <section className="col-span-12 rounded-3xl border border-black/10 bg-white p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Setup partita</h2>
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-black/10"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--primary)" }}
                >
                  Cartelle auto-generate · 3×9
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {setupPlayers.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 md:col-span-7">
                      <label className="text-xs font-semibold text-gray-600">Nome</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        value={p.name}
                        onChange={(e) =>
                          setSetupPlayers((ps) =>
                            ps.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                          )
                        }
                        placeholder="Nome giocatore"
                      />
                    </div>

                    <div className="col-span-8 md:col-span-3">
                      <label className="text-xs font-semibold text-gray-600">Cartelle</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                        type="number"
                        min={1}
                        max={12}
                        value={p.cards}
                        onChange={(e) =>
                          setSetupPlayers((ps) =>
                            ps.map((x, i) => (i === idx ? { ...x, cards: Number(e.target.value) } : x))
                          )
                        }
                      />
                      <div className="text-[11px] text-gray-500 mt-1">Max 12 per giocatore</div>
                    </div>

                    <div className="col-span-4 md:col-span-2 flex md:justify-end">
                      <button
                        className="mt-5 md:mt-6 w-full md:w-auto rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                        disabled={setupPlayers.length <= 1}
                        onClick={() => removePlayer(idx)}
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={addPlayer}
                  className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-gray-50 transition"
                >
                  + Aggiungi giocatore
                </button>

                <button
                  onClick={start}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-soft transition active:scale-[0.98]"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  Avvia partita
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (!game) return null;

  const last = game.drawSequence[game.drawSequence.length - 1];
  const canUndo = game.drawSequence.length > 0;

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-gray-500">Partita in corso</div>
            <div className="text-2xl font-extrabold tracking-tight">
              Ultimo numero: <span className="text-gray-900">{last ?? "—"}</span>
            </div>

            {gameId && (
              <div className="mt-2">
                <Pill>
                  Game ID: <span className="ml-1 font-mono">{gameId}</span>
                </Pill>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">

            <button
              onClick={drawRandom}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-soft transition active:scale-[0.98]"
              style={{ backgroundColor: "var(--primary)" }}
              disabled={game.drawSequence.length >= 90}
              title={game.drawSequence.length >= 90 ? "Numeri finiti" : "Estrai un numero non ancora uscito"}
            >
              🎲 Estrai numero
            </button>

            <button
              onClick={() => setOpenAddNumber(true)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-soft transition active:scale-[0.98]"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Inserisci numero
            </button>

            <button
              onClick={undo}
              disabled={!canUndo}
              className="rounded-xl border border-black/10 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              title={!canUndo ? "Nessun numero da annullare" : "Annulla ultimo numero"}
            >
              Annulla ultimo
            </button>

            <button onClick={reset} className="rounded-xl border border-black/10 px-4 py-2 text-sm hover:bg-gray-50">
              Nuova partita
            </button>
          </div>
        </header>

        {lastAward && (
          <div className="mb-6 rounded-2xl border border-black/10 p-4 shadow-soft text-white" style={{ backgroundColor: "var(--primary)" }}>
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div className="text-lg font-bold">🎉 {PRIZE_LABEL[lastAward.prize]} assegnato!</div>
              <div className="text-sm text-white/80">
                Trigger: estrazione #{lastAward.drawIndex + 1} · Numero {lastAward.numberDrawn}
              </div>
            </div>
            <div className="mt-2 text-sm">
              Vincitori:{" "}
              <span className="font-semibold">
                {Array.from(new Set(lastAward.winners.map((w) => w.playerName))).join(", ")}
              </span>{" "}
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-7">
            <Board state={game} onPick={pick} />
          </section>

          <section className="col-span-12 lg:col-span-5">
            <AwardPanel state={game} />
          </section>

          <section className="col-span-12 rounded-2xl border border-black/10 bg-white p-4 shadow-soft">
            <h2 className="font-semibold">Giocatori</h2>
            <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
              {game.players.map((pl) => (
                <details key={pl.id} className="group rounded-2xl border border-black/10 bg-gray-50 p-4">
                  <summary className="cursor-pointer list-none flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="font-bold">{pl.name}</div>
                      <Pill>Cartelle: {pl.cards.length}</Pill>
                    </div>
                    <span className="text-sm text-gray-600 group-open:rotate-180 transition">▾</span>
                  </summary>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pl.cards.map((card) => (
                      <CardView key={card.id} card={card} marked={game.marked} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>

      {gameId && (
        <details className="mt-8 rounded-2xl border border-black/10 bg-white p-4 shadow-soft group">
          <summary className="cursor-pointer list-none flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Condivisione cartelle (link & QR)</div>
            </div>
            <span className="text-sm text-gray-600 transition group-open:rotate-180">▾</span>
          </summary>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Link giocatori</div>
              <Pill tone="warn">Aprili dai telefoni (stessa rete Wi-Fi)</Pill>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-600">
                  Base URL per telefoni (non usare localhost)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2"
                  value={phoneBaseUrl}
                  onChange={(e) => setPhoneBaseUrl(e.target.value)}
                  placeholder="es. http://192.168.1.50:3000"
                />
                <div className="mt-1 text-[11px] text-gray-500">
                  Usa l’IP del PC (stessa rete Wi-Fi).
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {game.players.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div className="font-semibold">{p.name}</div>

                  <div className="flex items-center gap-3">
                    <a
                      className="underline break-all"
                      href={`/player/${gameId}/${p.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      /player/{gameId}/{p.id}
                    </a>

                    <button
                      onClick={() => openQrForPlayer(p)}
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Mostra QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}


        {/* Modal inserimento numero */}
        <Modal open={openAddNumber} title="Inserisci numero estratto" onClose={() => setOpenAddNumber(false)}>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-black/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="1 - 90"
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pickManual();
              }}
              inputMode="numeric"
            />
            <button
              onClick={pickManual}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-soft transition active:scale-[0.98]"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Aggiungi
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Tip: puoi premere <span className="font-semibold">Invio</span>. Se il numero è già segnato verrà ignorato.
          </div>
        </Modal>

        {/* Modal QR */}
        <Modal open={qrOpen} title={`QR — ${qrPlayerName}`} onClose={() => setQrOpen(false)}>
          <div className="flex flex-col items-center gap-3">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`QR ${qrPlayerName}`}
                className="rounded-xl border border-black/10 bg-white p-2"
              />
            )}
            <div className="text-xs text-gray-600 break-all text-center">{qrLink}</div>
            <button
              className="rounded-xl border border-black/10 px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => navigator.clipboard?.writeText(qrLink)}
            >
              Copia link
            </button>
          </div>
        </Modal>
      </div>
    </main>
  );
}
