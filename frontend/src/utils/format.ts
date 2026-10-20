export function formatAmount(raw: string | number | bigint, asset = 'units') {
  try {
    const b = typeof raw === 'bigint' ? raw : BigInt(String(raw));
    // 18 decimals
    const whole = b / 10n ** 18n;
    const frac = b % 10n ** 18n;
    const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '') || '0';
    const num = Number(whole.toString() + '.' + fracStr);
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(num);
    return `${formatted} ${asset}`;
  } catch {
    return `${raw} ${asset}`;
  }
}

export function shortAddr(a: string) {
  if (!a || a.length < 12) return a;
  return a.slice(0, 8) + '…' + a.slice(-6);
}

export const GLOSSARY: Record<string, string> = {
  'Address': 'A unique identifier for an account or smart contract on a blockchain network.',
  'Transaction': 'A recorded transfer of value or data between addresses.',
  'Node': 'A point in the graph representing an address.',
  'Edge': 'A directed connection representing a transfer from one address to another.',
  'Hop': 'One step along a path, crossing a single transfer.',
  'In-degree': 'Number of incoming transfers to an address.',
  'Out-degree': 'Number of outgoing transfers from an address.',
  'Cycle': 'A path that starts and ends at the same address.',
  'Strongly connected component': 'A group of addresses where each can reach every other.',
  'Shortest path': 'The path with the fewest connections (BFS) or lowest total cost (Dijkstra).',
  'Pattern alert': 'A flagged structural pattern that may warrant review; not proof of wrongdoing.',
};