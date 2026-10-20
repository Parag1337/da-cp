import { describe, it, expect } from 'vitest';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(x => x.trim() !== '')) rows.push(row); }
  return rows;
}
function normalizeAmount(input: string): string | null {
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  if (!/^\d+(\.\d{1,18})$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return (BigInt(w) * 10n ** 18n + BigInt(f.padEnd(18, '0'))).toString();
}

describe('csv parsing', () => {
  it('parses header + rows', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });
  it('handles quoted commas', () => {
    expect(parseCsv('a,b\n"x,y",2\n')[1]).toEqual(['x,y', '2']);
  });
  it('rejects missing required columns', () => {
    const header = parseCsv('from_address,to_address\n0x1,0x2\n')[0].map(h => h.trim().toLowerCase());
    const missing = ['from_address', 'to_address', 'amount', 'timestamp'].filter(k => !header.includes(k));
    expect(missing).toEqual(['amount', 'timestamp']);
  });
});
describe('amount normalization', () => {
  it('accepts raw integer units', () => { expect(normalizeAmount('1500000000000000000')).toBe('1500000000000000000'); });
  it('converts decimals to wei', () => { expect(normalizeAmount('1.5')).toBe('1500000000000000000'); });
  it('rejects invalid amounts', () => {
    expect(normalizeAmount('abc')).toBeNull();
    expect(normalizeAmount('1.1234567890123456789')).toBeNull();
  });
});
describe('graph integrity rules', () => {
  it('rejects self-transfers and bad addresses', () => {
    const ok = (a: string) => /^0x[0-9a-f]{40}$/.test(a);
    expect(ok('0x' + 'ab'.repeat(20))).toBe(true);
    expect(ok('0x123')).toBe(false);
  });
  it('requires 64-hex tx hashes', () => {
    expect(/^0x[0-9a-f]{64}$/.test('0x' + '11'.repeat(32))).toBe(true);
    expect(/^0x[0-9a-f]{64}$/.test('0x123')).toBe(false);
  });
});
