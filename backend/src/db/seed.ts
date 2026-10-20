import { db, NETWORK } from './database.js';

export function seedDemo() {
  const count = db.prepare('SELECT COUNT(*) c FROM transactions WHERE network=?').get(NETWORK) as { c: number };
  if (count.c > 0) return;
  const now = Math.floor(Date.now() / 1000);
  const addr = (i: number) => `0x${i.toString(16).padStart(40, '0')}`;
  const addrs = Array.from({ length: 40 }, (_, i) => addr(i + 1));
  const insertTx = db.prepare(`INSERT OR IGNORE INTO transactions(network,tx_hash,block_number,timestamp,from_address,to_address,value_raw,asset) VALUES(?,?,?,?,?,?,?,?)`);
  const insertTr = db.prepare(`INSERT OR IGNORE INTO transfers(network,tx_hash,log_index,from_address,to_address,value_raw,asset,timestamp) VALUES(?,?,?,?,?,?,?,?)`);
  let txi = 0;
  const mkTx = (from: string, to: string, value: string, ts: number) => {
    const hash = `0x${(txi++).toString(16).padStart(64, '0')}`;
    insertTx.run(NETWORK, hash, 1000 + txi, ts, from, to, value, 'ETH');
    insertTr.run(NETWORK, hash, 0, from, to, value, 'ETH', ts);
  };
  // chains
  for (let i = 0; i < 20; i++) {
    mkTx(addrs[i], addrs[i + 1], String(BigInt(i + 1) * 1000000000000000000n), now - (20 - i) * 3600);
  }
  // cycle
  mkTx(addrs[5], addrs[2], '500000000000000000', now - 1000);
  mkTx(addrs[2], addrs[5], '400000000000000000', now - 900);
  // fan-out from addr 25
  for (let i = 0; i < 8; i++) mkTx(addrs[24], addrs[30 + i], String(100000000000000000n * BigInt(i + 1)), now - 500 + i);
  // fan-in to addr 38
  for (let i = 0; i < 8; i++) mkTx(addrs[i], addrs[37], String(200000000000000000n), now - 2000 + i * 10);
  // rapid successive
  for (let i = 0; i < 5; i++) mkTx(addrs[10], addrs[11], '10000000000000000', now - 100 + i * 5);
  // repeated counterparties
  for (let i = 0; i < 6; i++) mkTx(addrs[15], addrs[16], '300000000000000000', now - 8000 + i * 1000);
  console.log('Seeded demo data');
}