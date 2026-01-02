// src/lib/tombola.ts
export type Prize = "AMBO" | "TERNO" | "QUATERNA" | "CINQUINA" | "TOMBOLA";

export const PRIZE_ORDER: Prize[] = ["AMBO", "TERNO", "QUATERNA", "CINQUINA", "TOMBOLA"];

export type Cell = number | null;

export type Card = {
  id: string;
  grid: Cell[][]; // 3 x 9
  // lookup: number -> {r,c}
  pos: Record<number, { r: number; c: number }>;
};

export type Player = {
  id: string;
  name: string;
  cards: Card[];
};

export type WinnerRef = {
  playerId: string;
  playerName: string;
  cardId: string;
};

export type Award = {
  prize: Prize;
  drawIndex: number; // indice nell'estrazione (1-based sarebbe più umano, ma qui 0-based)
  numberDrawn: number; // numero che ha scatenato il premio
  winners: WinnerRef[]; // in caso di pareggio, più vincitori
};

export type GameState = {
  players: Player[];
  marked: boolean[]; // index 0..90, usiamo 1..90
  drawSequence: number[];
  awards: Partial<Record<Prize, Award>>;
};

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/**
 * Colonne per decine (tombola italiana):
 * 0: 1-9
 * 1: 10-19
 * ...
 * 7: 70-79
 * 8: 80-90 (incluso 90)
 */
export function decadeColumn(n: number): number {
  if (n === 90) return 8;
  if (n >= 1 && n <= 9) return 0;
  return Math.floor(n / 10); // 10..89 -> 1..8
}

export function columnRange(col: number): { min: number; max: number } {
  if (col === 0) return { min: 1, max: 9 };
  if (col === 8) return { min: 80, max: 90 };
  return { min: col * 10, max: col * 10 + 9 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleUnique(range: number[], k: number): number[] {
  return shuffle(range).slice(0, k);
}

function makeRange(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

/**
 * Genera una cartella 3x9 valida:
 * - 15 numeri totali
 * - 5 numeri per riga
 * - per colonna 1..3 numeri, con numeri nel range della decina
 * - celle vuote dove non c'è numero
 *
 * Nota: non tenta di replicare "book of tickets" professionale, ma produce cartelle valide e giocabili.
 */
export function generateCard(): Card {
  // Step A: decidere quante presenze per colonna (somma 15, ogni colonna 1..3)
  // Approccio: parti da 1 per colonna (9) e distribuisci 6 extra fino a max 3.
  const colCounts = Array(9).fill(1); // base 9
  let extras = 15 - 9; // 6
  while (extras > 0) {
    const c = Math.floor(Math.random() * 9);
    if (colCounts[c] < 3) {
      colCounts[c]++;
      extras--;
    }
  }

  // Step B: per ogni colonna, estrai i numeri nel range
  const numsByCol: number[][] = [];
  for (let c = 0; c < 9; c++) {
    const { min, max } = columnRange(c);
    const pool = makeRange(min, max);
    const picked = sampleUnique(pool, colCounts[c]).sort((a, b) => a - b);
    numsByCol.push(picked);
  }

  // Step C: distribuzione sulle 3 righe con vincolo 5 per riga.
  // Costruiamo una matrice di "slot" per colonna: quante celle occupate per riga in quella colonna.
  const rowCounts = [0, 0, 0];
  const slots: boolean[][] = Array.from({ length: 3 }, () => Array(9).fill(false));

  // Per ogni colonna con k numeri, scegli k righe (distinte) dove piazzarli
  // privilegiando le righe con meno numeri per arrivare a 5 ciascuna.
  for (let c = 0; c < 9; c++) {
    const k = colCounts[c];
    // candidati righe ordinate per rowCounts crescente (tie random)
    const rows = [0, 1, 2].map(r => ({ r, w: rowCounts[r] + Math.random() * 0.01 }));
    rows.sort((a, b) => a.w - b.w);
    // se k=3 => tutte, se k=2 => le prime due, se k=1 => la prima
    const chosen = rows.slice(0, k).map(x => x.r);
    for (const r of chosen) {
      slots[r][c] = true;
      rowCounts[r]++;
    }
  }

  // Step D: se qualche riga non è 5 (può succedere raramente), ripara con swap.
  // Strategia: sposta slot da righe >5 a righe <5 dentro colonne dove è possibile.
  function repair() {
    let guard = 0;
    while ((rowCounts[0] !== 5 || rowCounts[1] !== 5 || rowCounts[2] !== 5) && guard < 5000) {
      guard++;
      const low = rowCounts.indexOf(Math.min(...rowCounts));
      const high = rowCounts.indexOf(Math.max(...rowCounts));
      if (rowCounts[low] === 5 && rowCounts[high] === 5) break;

      // cerca una colonna dove high ha slot=true e low ha slot=false e colonna non violi il minimo (1 per colonna è già ok)
      const cols = shuffle([...Array(9)].map((_, i) => i));
      let moved = false;
      for (const c of cols) {
        if (slots[high][c] && !slots[low][c]) {
          // verifica che spostando non portiamo high sotto 5 o low sopra 5
          if (rowCounts[high] > 5 && rowCounts[low] < 5) {
            slots[high][c] = false;
            slots[low][c] = true;
            rowCounts[high]--;
            rowCounts[low]++;
            moved = true;
            break;
          }
        }
      }
      if (!moved) break;
    }
  }
  repair();

  // Step E: costruisci grid e assegna i numeri alle righe nella colonna
  const grid: Cell[][] = Array.from({ length: 3 }, () => Array(9).fill(null));
  const pos: Record<number, { r: number; c: number }> = {};

  for (let c = 0; c < 9; c++) {
    const colNums = numsByCol[c].slice(); // già sort
    // righe che hanno slot in questa colonna, in ordine top->bottom
    const rowsHere = [0, 1, 2].filter(r => slots[r][c]);
    // assegna numeri in ordine crescente dall'alto verso il basso (stile classico)
    for (let i = 0; i < rowsHere.length; i++) {
      const r = rowsHere[i];
      const n = colNums[i];
      grid[r][c] = n;
      pos[n] = { r, c };
    }
  }

  // Validazione leggera: 15 numeri e 5 per riga
  const countsPerRow = grid.map(row => row.filter(x => x !== null).length);
  const total = countsPerRow.reduce((a, b) => a + b, 0);
  if (!(countsPerRow[0] === 5 && countsPerRow[1] === 5 && countsPerRow[2] === 5 && total === 15)) {
    // fallback: rigenera (semplice e pragmatico)
    return generateCard();
  }

  return { id: uid("card"), grid, pos };
}

export function createGame(playersInput: Array<{ name: string; cards: number }>): GameState {
  const players: Player[] = playersInput.map(p => ({
    id: uid("player"),
    name: p.name.trim() || "Giocatore",
    cards: Array.from({ length: p.cards }, () => generateCard()),
  }));

  return {
    players,
    marked: Array(91).fill(false),
    drawSequence: [],
    awards: {},
  };
}

export function nextUnassignedPrize(awards: GameState["awards"]): Prize | null {
  for (const p of PRIZE_ORDER) {
    if (!awards[p]) return p;
  }
  return null;
}

function cardRowMarkedCount(card: Card, marked: boolean[]): [number, number, number] {
  const rc: [number, number, number] = [0, 0, 0];
  for (const [numStr, { r }] of Object.entries(card.pos)) {
    const n = Number(numStr);
    if (marked[n]) rc[r]++;
  }
  return rc;
}

function cardTotalMarked(card: Card, marked: boolean[]): number {
  let t = 0;
  for (const numStr of Object.keys(card.pos)) {
    const n = Number(numStr);
    if (marked[n]) t++;
  }
  return t;
}

function satisfiesPrize(card: Card, marked: boolean[], prize: Prize): boolean {
  if (prize === "TOMBOLA") return cardTotalMarked(card, marked) === 15;
  const rc = cardRowMarkedCount(card, marked);
  const best = Math.max(...rc);
  if (prize === "AMBO") return best >= 2;
  if (prize === "TERNO") return best >= 3;
  if (prize === "QUATERNA") return best >= 4;
  if (prize === "CINQUINA") return best >= 5;
  return false;
}

export function applyDrawNumber(state: GameState, n: number): GameState {
  if (n < 1 || n > 90) return state;
  if (state.marked[n]) return state;

  const marked = state.marked.slice();
  marked[n] = true;

  const drawSequence = state.drawSequence.concat(n);

  // Calcolo premi: solo il prossimo non assegnato
  const awards = { ...state.awards };
  const nextPrize = nextUnassignedPrize(awards);

  if (nextPrize) {
    const winners: WinnerRef[] = [];

    // Pareggio: prendiamo tutti i giocatori/cartelle che soddisfano lo step
    for (const pl of state.players) {
      for (const card of pl.cards) {
        if (satisfiesPrize(card, marked, nextPrize)) {
          winners.push({ playerId: pl.id, playerName: pl.name, cardId: card.id });
        }
      }
    }

    if (winners.length > 0) {
      awards[nextPrize] = {
        prize: nextPrize,
        drawIndex: drawSequence.length - 1,
        numberDrawn: n,
        winners,
      };
    }
  }

  return { ...state, marked, drawSequence, awards };
}

/**
 * Undo robusto: ricostruisce tutto riprocessando drawSequence senza l'ultimo.
 * Questo evita bug se la cartella è stata marcata male.
 */
export function undoLast(state: GameState): GameState {
  if (state.drawSequence.length === 0) return state;
  const seq = state.drawSequence.slice(0, -1);

  let rebuilt: GameState = {
    players: state.players, // le cartelle restano uguali
    marked: Array(91).fill(false),
    drawSequence: [],
    awards: {},
  };

  for (const n of seq) {
    rebuilt = applyDrawNumber(rebuilt, n);
  }
  return rebuilt;
}
 