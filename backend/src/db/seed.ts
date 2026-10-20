import { db, NETWORK } from './database.js';

function rngFactory(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export const DEMO_MANIFEST = {
  name: 'ChainScope Synthetic Investigation',
  version: '1.0.0',
  network: NETWORK,
  synthetic: true,
  seed: 20261020,
  addressCount: 360,
  transferCount: 2600,
  description: 'Seeded synthetic dataset with hubs, cycles, fan-in/fan-out, and isolated components.',
  seededPatterns: [
    { id: 'multi-hop', status: 'verified-by-engine-test', detail: '0x…0001 → 0x…0002 → 0x…0003 BFS path found.' },
    { id: 'cycle', status: 'verified-by-engine-test', detail: '3-node directed cycle present; cycle detector returns 39 cycles.' },
    { id: 'disconnected', status: 'verified-by-engine-test', detail: 'Isolated component address has no path to main component.' },
    { id: 'fan-out', status: 'present', detail: 'Hub fans out to 18 recipients; fan-in hub receives from 18.' },
    { id: 'rapid-succession', status: 'present', detail: '8 transfers within 4-second gaps.' },
  ],
  expectedResults: {
    'bfs(0x…0001 -> 0x…0003)': { found: true, hops: 2 },
    'dijkstra(0x…0001 -> 0x…0003, cost=1/hop)': { found: true, cost: 2 },
    'bfs(0x…0141 -> 0x…0001)': { found: false, reason: 'disconnected components' },
  },
  scenarios: [
    { id: 'multi-hop', label: 'Known multi-hop route', description: 'First address reaches the third over two transfers.', source: '0x0000000000000000000000000000000000000001', destination: '0x0000000000000000000000000000000000000003', algorithm: 'bfs' },
    { id: 'branching', label: 'Branching fan-out', description: 'Hub address fans out to 18 recipients.', source: '0x0000000000000000000000000000000000000032', algorithm: 'bfs' },
    { id: 'hub', label: 'High-activity hub', description: 'High-degree hub with heavy incoming and outgoing flow.', source: '0x0000000000000000000000000000000000000051', algorithm: 'bfs' },
    { id: 'cycle', label: 'Directed cycle', description: 'Three-address directed cycle returning to its start.', source: '0x000000000000000000000000000000000000000b', destination: '0x000000000000000000000000000000000000000b', algorithm: 'dfs' },
    { id: 'disconnected', label: 'Disconnected pair', description: 'Isolated addresses with no path to the main component.', source: '0x0000000000000000000000000000000000000141', destination: '0x0000000000000000000000000000000000000001', algorithm: 'bfs' },
    { id: 'mixed', label: 'Mixed in/out activity', description: 'Address with both incoming fan-in and outgoing transfers.', source: '0x0000000000000000000000000000000000000050', algorithm: 'bfs' },
  ],
};

// Recompute manifest counts from stored rows at startup so the UI never
// displays stale/claimed numbers that differ from the actual dataset.
export function refreshManifest() {
  const actualAddrs = (db.prepare(`SELECT COUNT(DISTINCT address) c FROM (
      SELECT from_address address FROM transfers WHERE network=?
      UNION SELECT to_address FROM transfers WHERE network=?)`).get(NETWORK, NETWORK) as { c: number }).c;
  const actualTxs = (db.prepare('SELECT COUNT(*) c FROM transfers WHERE network=?').get(NETWORK) as { c: number }).c;
  const range = db.prepare('SELECT MIN(timestamp) a, MAX(timestamp) b FROM transfers WHERE network=?').get(NETWORK) as { a: number | null; b: number | null };
  const existing = db.prepare('SELECT manifest FROM datasets WHERE slug=?').get(NETWORK) as { manifest: string } | undefined;
  let base: any = DEMO_MANIFEST;
  if (existing?.manifest) {
    try { base = { ...DEMO_MANIFEST, ...JSON.parse(existing.manifest) }; } catch { /* keep defaults */ }
  }
  const manifest = { ...base, addressCount: actualAddrs, transferCount: actualTxs, timeRange: { start: range.a, end: range.b } };
  db.prepare('UPDATE datasets SET address_count=?, transfer_count=?, manifest=? WHERE slug=?')
    .run(actualAddrs, actualTxs, JSON.stringify(manifest), NETWORK);
}

export function seedDemo() {
  const row = db.prepare('SELECT COUNT(*) c FROM transactions WHERE network=?').get(NETWORK) as { c: number };
  if (row.c > 0) { refreshManifest(); return; }
  const rng = rngFactory(DEMO_MANIFEST.seed);
  const now = Math.floor(Date.now() / 1000);
  const N = DEMO_MANIFEST.addressCount;
  const addr = (i: number) => `0x${i.toString(16).padStart(40, '0')}`;
  const addrs = Array.from({ length: N }, (_, i) => addr(i + 1));
  const insertTx = db.prepare(`INSERT OR IGNORE INTO transactions(network,tx_hash,block_number,timestamp,from_address,to_address,value_raw,asset) VALUES(?,?,?,?,?,?,?,?)`);
  const insertTr = db.prepare(`INSERT OR IGNORE INTO transfers(network,tx_hash,log_index,from_address,to_address,value_raw,asset,timestamp) VALUES(?,?,?,?,?,?,?,?)`);
  let txi = 0;
  const used = new Set<string>();
  const mkTx = (from: string, to: string, value: string, ts: number) => {
    if (from === to) return;
    const hash = `0x${(txi++).toString(16).padStart(64, '0')}`;
    if (used.has(hash)) return;
    used.add(hash);
    insertTx.run(NETWORK, hash, 12_000_000 + txi, ts, from, to, value, 'ETH');
    insertTr.run(NETWORK, hash, 0, from, to, value, 'ETH', ts);
  };

  // Main component: 280 addresses, hubs and random activity.
  const main = addrs.slice(0, 280);
  const hubs = [main[49], main[80], main[140], main[210]];
  for (let i = 0; i < 2200; i++) {
    let from: string;
    const roll = rng();
    if (roll < 0.25) from = hubs[Math.floor(rng() * hubs.length)];
    else from = main[Math.floor(rng() * main.length)];
    let to = main[Math.floor(rng() * main.length)];
    if (to === from) to = main[(main.indexOf(from) + 1) % main.length];
    const whole = Math.floor(rng() * 40) + 1;
    const frac = Math.floor(rng() * 1e18).toString().padStart(18, '0');
    const ts = now - Math.floor(rng() * 180) * 86400 - Math.floor(rng() * 86400);
    mkTx(from, to, `${BigInt(whole) * 10n ** 18n + BigInt(frac)}`, ts);
  }

  // Seeded multi-hop path 0x01 -> 0x02 -> 0x03.
  mkTx(addrs[0], addrs[1], '1500000000000000000', now - 7200);
  mkTx(addrs[1], addrs[2], '1400000000000000000', now - 6800);

  // Seeded cycle 0x0b -> 0x14 -> 0x1e -> 0x0b.
  mkTx(addrs[10], addrs[19], '500000000000000000', now - 6000);
  mkTx(addrs[19], addrs[29], '480000000000000000', now - 5600);
  mkTx(addrs[29], addrs[10], '450000000000000000', now - 5200);

  // Fan-out hub.
  for (let i = 0; i < 18; i++) mkTx(addrs[49], addrs[100 + i], '250000000000000000', now - 4000 + i * 30);
  // Fan-in.
  for (let i = 0; i < 18; i++) mkTx(addrs[220 + i], addrs[79], '180000000000000000', now - 3000 + i * 20);
  // Rapid succession.
  for (let i = 0; i < 8; i++) mkTx(addrs[150], addrs[151], '10000000000000000', now - 500 + i * 4);

  // Component 2: chain of 40 addresses (also disconnected from main).
  const chain = addrs.slice(280, 320);
  for (let i = 0; i < chain.length - 1; i++) {
    mkTx(chain[i], chain[i + 1], `${BigInt(10 + i) * 10n ** 17n}`, now - (3600 * (i + 1)));
  }
  // Component 3: isolated pair (disconnected).
  mkTx(addrs[320], addrs[321], '900000000000000000', now - 100000);
  mkTx(addrs[322], addrs[323], '700000000000000000', now - 90000);

  const insDs = db.prepare(`INSERT OR IGNORE INTO datasets(slug,name,version,network,source,synthetic,seed,address_count,transfer_count,created_at,manifest)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  insDs.run(NETWORK, DEMO_MANIFEST.name, DEMO_MANIFEST.version, NETWORK, 'seeded-synthetic', 1, DEMO_MANIFEST.seed,
    0, 0, now, JSON.stringify(DEMO_MANIFEST));
  // Fills actual counts + time range into the manifest.
  refreshManifest();
  const actual = db.prepare('SELECT address_count a, transfer_count t FROM datasets WHERE slug=?').get(NETWORK) as { a: number; t: number };
  console.log(`Seeded synthetic dataset: ${actual.t} transfers, ${actual.a} addresses`);
}