// SAP-1 simulator, following Malvino & Brown, Digital Computer Electronics, ch. 10.
// The state shown is "during" a T state: the control word is active and the bus is driven.
// step() applies the positive clock edge (registers load) and moves to the next T state.

// Control word bit order, MSB first: CON = Cp Ep L̄m C̄E  L̄i Ēi L̄a Ea  Su Eu L̄b L̄o
export const CON_ORDER = ['Cp', 'Ep', 'Lm', 'CE', 'Li', 'Ei', 'La', 'Ea', 'Su', 'Eu', 'Lb', 'Lo'];
const ACTIVE_LOW = new Set(['Lm', 'CE', 'Li', 'Ei', 'La', 'Lb', 'Lo']);

// How each signal name is drawn: base letters, subscript, and whether it has a bar (active low).
export const SIG = {
  Cp: { base: 'C', sub: 'P' },
  Ep: { base: 'E', sub: 'P' },
  Lm: { base: 'L', sub: 'M', bar: true },
  CE: { base: 'CE', bar: true },
  Li: { base: 'L', sub: 'I', bar: true },
  Ei: { base: 'E', sub: 'I', bar: true },
  La: { base: 'L', sub: 'A', bar: true },
  Ea: { base: 'E', sub: 'A' },
  Su: { base: 'S', sub: 'U' },
  Eu: { base: 'E', sub: 'U' },
  Lb: { base: 'L', sub: 'B', bar: true },
  Lo: { base: 'L', sub: 'O', bar: true },
  CLK: { base: 'CLK' },
  CLK_: { base: 'CLK', bar: true },
  CLR: { base: 'CLR' },
  CLR_: { base: 'CLR', bar: true },
  HLT_: { base: 'HLT', bar: true },
  WE: { base: 'WE', bar: true },
};

export const OPS = { 0x0: 'LDA', 0x1: 'ADD', 0x2: 'SUB', 0xe: 'OUT', 0xf: 'HLT' };

// Example 10-1: LDA 9H, ADD AH, ADD BH, SUB CH, OUT, HLT  →  1 + 2 + 3 − 4 = 2
export const PROGRAM = [
  0x09, 0x1a, 0x1b, 0x2c, 0xe0, 0xf0, 0xff, 0xff,
  0xff, 0x01, 0x02, 0x03, 0x04, 0xff, 0xff, 0xff,
];
export const LISTING = [
  'LDA 9H', 'ADD AH', 'ADD BH', 'SUB CH', 'OUT', 'HLT', '—', '—',
  '—', 'data 1', 'data 2', 'data 3', 'data 4', '—', '—', '—',
];

// Microprogram (Table 10-5). Fetch is the same for every instruction.
const FETCH = [['Ep', 'Lm'], ['Cp'], ['CE', 'Li']];
const EXEC = {
  LDA: [['Lm', 'Ei'], ['CE', 'La'], []],
  ADD: [['Lm', 'Ei'], ['CE', 'Lb'], ['La', 'Eu']],
  SUB: [['Lm', 'Ei'], ['CE', 'Lb'], ['La', 'Su', 'Eu']],
  OUT: [['Ea', 'Lo'], [], []],
};

const FETCH_TEXT = [
  'Address state: the program counter puts its address on the bus and the MAR loads it.',
  'Increment state: the program counter counts up by one.',
  'Memory state: the addressed RAM word goes into the instruction register.',
];
const EXEC_TEXT = {
  LDA: ['The address field of the instruction goes to the MAR.', 'The addressed RAM word is loaded into the accumulator.', 'No operation.'],
  ADD: ['The address field of the instruction goes to the MAR.', 'The addressed RAM word is loaded into B.', 'The adder-subtracter output, A + B, is loaded into the accumulator.'],
  SUB: ['The address field of the instruction goes to the MAR.', 'The addressed RAM word is loaded into B.', 'The adder-subtracter output, A − B, is loaded into the accumulator.'],
  OUT: ['The accumulator is copied into the output register.', 'No operation.', 'No operation.'],
};

export const bin = (v, n = 8) => {
  const s = (v >>> 0).toString(2).padStart(n, '0').slice(-n);
  return n > 4 ? s.replace(/(.{4})(?=.)/g, '$1 ') : s;
};
export const hex = (v, n = 2) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');

export function initialState() {
  return { pc: 0, mar: 0, ir: 0, a: 0, b: 0, out: 0, ram: [...PROGRAM], t: 1, halted: false };
}

export const opName = (ir) => OPS[ir >> 4] ?? 'NOP';

export function signals(s) {
  if (s.halted) return new Set();
  if (s.t <= 3) return new Set(FETCH[s.t - 1]);
  return new Set(EXEC[opName(s.ir)]?.[s.t - 4] ?? []);
}

export function conWord(sig) {
  let v = 0;
  for (const k of CON_ORDER) {
    const on = sig.has(k);
    v = (v << 1) | ((ACTIVE_LOW.has(k) ? !on : on) ? 1 : 0);
  }
  return v;
}

// Everything that follows combinationally from the registers during this T state.
export function derive(s) {
  const sig = signals(s);
  const su = sig.has('Su');
  const bIn = su ? ~s.b & 0xff : s.b; // XOR gates: B or its 1's complement
  const alu = (s.a + bIn + (su ? 1 : 0)) & 0xff;
  let bus = null;
  let busBits = 8;
  if (sig.has('Ep')) { bus = s.pc; busBits = 4; }
  else if (sig.has('CE')) bus = s.ram[s.mar];
  else if (sig.has('Ei')) { bus = s.ir & 0xf; busBits = 4; }
  else if (sig.has('Ea')) bus = s.a;
  else if (sig.has('Eu')) bus = alu;
  return { sig, con: conWord(sig), su, bIn, alu, bus, busBits, op: opName(s.ir) };
}

export function describe(s) {
  if (s.halted) return 'HLT is in the instruction register, so the clock has stopped. Reset to run again.';
  if (s.t <= 3) return FETCH_TEXT[s.t - 1];
  return EXEC_TEXT[opName(s.ir)]?.[s.t - 4] ?? 'No operation.';
}

export function step(s) {
  if (s.halted) return s;
  const { sig, bus } = derive(s);
  const n = { ...s };
  if (sig.has('Lm')) n.mar = bus & 0xf;
  if (sig.has('Li')) n.ir = bus;
  if (sig.has('La')) n.a = bus;
  if (sig.has('Lb')) n.b = bus;
  if (sig.has('Lo')) n.out = bus;
  if (sig.has('Cp')) n.pc = (s.pc + 1) & 0xf;
  // HLT: once the op code 1111 reaches the instruction register, HLT̄ goes low and stops the clock.
  if (s.t === 3 && n.ir >> 4 === 0xf) return { ...n, t: 4, halted: true };
  n.t = s.t === 6 ? 1 : s.t + 1;
  return n;
}
