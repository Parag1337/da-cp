import { db, NETWORK } from '../db/database.js';

export interface GraphData { nodes: string[]; edges: any[]; }

export function buildGraph(network: string, opts: { center?: string; hops?: number; limit?: number } = {}): GraphData {
  // bounded neighborhood via SQL recent transfers
  const limit = Math.min(opts.limit ?? 500, 2000);
  let rows: any[];
  if (opts.center) {
    rows = db.prepare(`
      SELECT tx_hash, from_address, to_address, value_raw, asset, timestamp FROM transfers
      WHERE network=? AND (from_address=? OR to_address=?)
      ORDER BY timestamp DESC LIMIT ?
    `).all(network, opts.center, opts.center, limit) as any[];
  } else {
    rows = db.prepare(`
      SELECT tx_hash, from_address, to_address, value_raw, asset, timestamp FROM transfers
      WHERE network=? ORDER BY timestamp DESC LIMIT ?
    `).all(network, limit) as any[];
  }
  const nodeSet = new Set<string>();
  const edges: any[] = [];
  for (const r of rows) {
    nodeSet.add(r.from_address); nodeSet.add(r.to_address);
    let amtCpp = 0;
    try { amtCpp = Number(BigInt(r.value_raw) / 1000000000000n); } catch { amtCpp = 0; }
    edges.push({ id: r.tx_hash, from: r.from_address, to: r.to_address, amount: amtCpp, amountRaw: r.value_raw, timestamp: r.timestamp, asset: r.asset, cost: 1 });
  }
  // keep amount as number for cpp (may lose precision for huge; store raw too). cpp uses amount long long; Number ok for demo.
  return { nodes: [...nodeSet], edges };
}

export function addressStats(network: string, address: string) {
  const incoming = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(CAST(value_raw AS INTEGER)),0) s FROM transfers WHERE network=? AND to_address=?').get(network, address) as any;
  // SUM of text may be 0 in sqlite; use JS aggregation for raw
  const inRows = db.prepare('SELECT value_raw FROM transfers WHERE network=? AND to_address=?').all(network, address) as any[];
  const outRows = db.prepare('SELECT value_raw FROM transfers WHERE network=? AND from_address=?').all(network, address) as any[];
  const inTotal = inRows.reduce((a, r) => a + BigInt(r.value_raw), 0n).toString();
  const outTotal = outRows.reduce((a, r) => a + BigInt(r.value_raw), 0n).toString();
  const counterpartiesIn = new Set(inRows.map(() => 0)); // placeholder
  const uniqueIn = (db.prepare('SELECT COUNT(DISTINCT from_address) c FROM transfers WHERE network=? AND to_address=?').get(network, address) as any).c;
  const uniqueOut = (db.prepare('SELECT COUNT(DISTINCT to_address) c FROM transfers WHERE network=? AND from_address=?').get(network, address) as any).c;
  const first = (db.prepare('SELECT MIN(timestamp) t FROM transfers WHERE network=? AND (from_address=? OR to_address=?)').get(network, address, address) as any).t;
  const last = (db.prepare('SELECT MAX(timestamp) t FROM transfers WHERE network=? AND (from_address=? OR to_address=?)').get(network, address, address) as any).t;
  const inCount = (db.prepare('SELECT COUNT(*) c FROM transfers WHERE network=? AND to_address=?').get(network, address) as any).c;
  const outCount = (db.prepare('SELECT COUNT(*) c FROM transfers WHERE network=? AND from_address=?').get(network, address) as any).c;
  return { address, network, incomingCount: inCount, outgoingCount: outCount, uniqueIncomingCounterparties: uniqueIn, uniqueOutgoingCounterparties: uniqueOut, incomingTotal: inTotal, outgoingTotal: outTotal, firstSeen: first, lastSeen: last };
}

export function addressHistory(network: string, address: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const rows = db.prepare('SELECT * FROM transfers WHERE network=? AND (from_address=? OR to_address=?) ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(network, address, address, pageSize, offset) as any[];
  const total = (db.prepare('SELECT COUNT(*) c FROM transfers WHERE network=? AND (from_address=? OR to_address=?)').get(network, address, address) as any).c;
  return { rows, total, page, pageSize };
}