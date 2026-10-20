import { db, NETWORK } from './database.js';

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

export function seedDemo() {
  const count = db.prepare('SELECT COUNT(*) c FROM transactions WHERE network=?').get(NETWORK) as { c: number };
  if (count.c > 0) return;
  const rng = seededRand(42);
  const now = Math.floor(Date.now() / 1000);
  const N = 400;
  const addr = (i: number) => `0x${i.toString(16).padStart(40, '0')}`;
  const addrs = Array.from({ length: N }, (_, i) => addr(i + 1));
  const insertTx = db.prepare(`INSERT OR IGNORE INTO transactions(network,tx_hash,block_number,timestamp,from_address,to_address,value_raw,asset) VALUES(?,?,?,?,?,?,?,?)`);
  const insertTr = db.prepare(`INSERT OR IGNORE INTO transfers(network,tx_hash,log_index,from_address,to_address,value_raw,asset,timestamp) VALUES(?,?,?,?,?,?,?,?)`);
  let txi = 0;
  const mkTx = (from: string, to: string, value: string, ts: number) => {
    const hash = `0x${(txi++).toString(16).padStart(64, '0')}`;
    insertTx.run(NETWORK, hash, 1000 + txi, ts, from, to, value, 'ETH');
    insertTr.run(NETWORK, hash, 0, from, to, value, 'ETH', ts);
  };
  // chains
  for (let i = 0; i < 200; i++) {
    const a = Math.floor(rng() * N);
    let b = Math.floor(rng() * N);
    if (b === a) b = (b + 1) % N;
    const val = BigInt(Math.floor(rng() * 10 + 1)) * 1000000000000000000n;
    const ts = now - Math.floor(rng() * 30) * 86400 + Math.floor(rng() * 1000);
    mkTx(addrs[a], addrs[b], val.toString(), ts);
  }
  // seeded cycle
  mkTx(addrs[10], addrs[20], '1000000000000000000', now - 1000);
  mkTx(addrs[20], addrs[30], '1000000000000000000', now - 900);
  mkTx(addrs[30], addrs[10], '1000000000000000000', now - 800);
  // fan-out
  for (let i = 0; i < 12; i++) mkTx(addrs[50], addrs[60 + i], '500000000000000000', now - 500 + i);
  // fan-in
  for (let i = 0; i < 12; i++) mkTx(addrs[70 + i], addrs[90], '200000000000000000', now - 2000 + i * 10);
  // multi-hop path 1 -> 2 -> 3
  mkTx(addrs[1], addrs[2], '100000000000000000', now - 100);
  mkTx(addrs[2], addrs[3], '100000000000000000', now - 90);
  // rapid successive
  for (let i = 0; i < 6; i++) mkTx(addrs[100], addrs[101], '10000000000000000', now - 100 + i * 5);
  console.log('Seeded large demo data');
}