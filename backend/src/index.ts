import express from 'express';
import cors from 'cors';
import { db, NETWORK } from './db/database.js';
import { seedDemo } from './db/seed.js';
import { buildGraph, addressStats, addressHistory } from './services/graphService.js';
import { runCpp } from './services/cppRunner.js';

seedDemo();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, network: NETWORK }));

app.get('/api/dashboard', (_req, res) => {
  const txCount = (db.prepare('SELECT COUNT(*) c FROM transactions WHERE network=?').get(NETWORK) as any).c;
  const addrCount = (db.prepare('SELECT COUNT(DISTINCT address) c FROM (SELECT from_address address FROM transfers WHERE network=? UNION SELECT to_address FROM transfers WHERE network=?)').get(NETWORK, NETWORK) as any).c;
  const inTotal = (db.prepare('SELECT value_raw FROM transfers WHERE network=? AND to_address IS NOT NULL').all(NETWORK) as any[]).reduce((a: bigint, r: any) => a + BigInt(r.value_raw), 0n).toString();
  const outTotal = (db.prepare('SELECT value_raw FROM transfers WHERE network=?').all(NETWORK) as any[]).reduce((a: bigint, r: any) => a + BigInt(r.value_raw), 0n).toString();
  const recent = db.prepare('SELECT * FROM transfers WHERE network=? ORDER BY timestamp DESC LIMIT 10').all(NETWORK);
  const top = db.prepare('SELECT from_address addr, COUNT(*) c FROM transfers WHERE network=? GROUP BY from_address ORDER BY c DESC LIMIT 5').all(NETWORK);
  res.json({ network: NETWORK, provider: 'demo-synthetic', txCount, uniqueAddresses: addrCount, totalValueRaw: outTotal, incomingTotal: inTotal, outgoingTotal: outTotal, recent, topAddresses: top, lastSync: null });
});

app.get('/api/addresses/:address', (req, res) => {
  res.json(addressStats(NETWORK, req.params.address));
});

app.get('/api/addresses/:address/history', (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  res.json(addressHistory(NETWORK, req.params.address, page, pageSize));
});

app.post('/api/graph/neighborhood', async (req, res) => {
  try {
    const { center, hops = 2, limit = 200, direction = 'both' } = req.body ?? {};
    const g = buildGraph(NETWORK, { center, limit });
    const result = await runCpp('neighbors', { ...g, node: center, direction, hops, limit });
    res.json({ graph: g, analysis: result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/graph/path', async (req, res) => {
  try {
    const { source, destination, algorithm = 'bfs', maxHops = 6, costMetric = 'cost' } = req.body ?? {};
    const g = buildGraph(NETWORK, { limit: 1000 });
    const cmd = algorithm === 'dijkstra' ? 'dijkstra' : 'bfs';
    const result = await runCpp(cmd, { ...g, source, destination, maxHops, costMetric });
    res.json({ graph: g, result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/graph/analyze', async (req, res) => {
  try {
    const { type = 'cycles' } = req.body ?? {};
    const g = buildGraph(NETWORK, { limit: 1000 });
    let result;
    if (type === 'cycles') result = await runCpp('cycles', { ...g, maxCycles: 50, maxLen: 8 });
    else if (type === 'scc') result = await runCpp('scc', g);
    else if (type === 'degrees') result = await runCpp('degrees', g);
    else if (type === 'topk') result = await runCpp('topk', { ...g, k: 10 });
    else if (type === 'components') result = await runCpp('components', g);
    else return res.status(400).json({ error: 'unknown type' });
    res.json({ graph: g, result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/patterns/scan', async (req, res) => {
  try {
    const g = buildGraph(NETWORK, { limit: 2000 });
    const cycles = await runCpp('cycles', { ...g, maxCycles: 20, maxLen: 6 });
    const degrees = await runCpp('degrees', g);
    // build alerts
    const alerts: any[] = [];
    const highDeg = (degrees.nodes ?? []).filter((n: any) => n.total >= 6);
    for (const n of highDeg) {
      alerts.push({ rule: 'high-degree', severity: 'medium', addresses: [n.node], txHashes: [], evidence: { inDegree: n.inDegree, outDegree: n.outDegree, uniqueIn: n.uniqueIn, uniqueOut: n.uniqueOut }, threshold: 'total degree >= 6' });
    }
    for (const c of cycles.cycles ?? []) {
      alerts.push({ rule: 'directed-cycle', severity: 'high', addresses: c, txHashes: [], evidence: { cycle: c }, threshold: 'cycle length <= 6' });
    }
    // fan-out
    const outCounts: Record<string, number> = {};
    for (const e of g.edges) outCounts[e.from] = (outCounts[e.from] ?? 0) + 1;
    for (const [a, c] of Object.entries(outCounts)) if (c >= 5) alerts.push({ rule: 'fan-out', severity: 'medium', addresses: [a], txHashes: [], evidence: { outgoingEdges: c }, threshold: 'outgoing edges >= 5' });
    // store alerts
    const ins = db.prepare('INSERT INTO alerts(network,rule,severity,addresses,tx_hashes,evidence,status,created_at) VALUES(?,?,?,?,?,?,?,?)');
    const now = Math.floor(Date.now() / 1000);
    for (const a of alerts) ins.run(NETWORK, a.rule, a.severity, JSON.stringify(a.addresses), JSON.stringify(a.txHashes), JSON.stringify(a.evidence), 'open', now);
    res.json({ alerts, count: alerts.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/alerts', (_req, res) => {
  const rows = db.prepare('SELECT * FROM alerts WHERE network=? ORDER BY created_at DESC LIMIT 100').all(NETWORK);
  res.json(rows.map((r: any) => ({ ...r, addresses: JSON.parse(r.addresses), tx_hashes: JSON.parse(r.tx_hashes), evidence: JSON.parse(r.evidence) })));
});

// Investigations
app.get('/api/investigations', (_req, res) => {
  res.json(db.prepare('SELECT * FROM investigations ORDER BY created_at DESC').all());
});
app.post('/api/investigations', (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const now = Math.floor(Date.now() / 1000);
  const info = db.prepare('INSERT INTO investigations(name,description,network,created_at,updated_at) VALUES(?,?,?,?,?)').run(name, description ?? '', NETWORK, now, now);
  res.json({ id: info.lastInsertRowid, name, description, network: NETWORK, created_at: now, updated_at: now });
});
app.get('/api/investigations/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM investigations WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'not found' });
  const addresses = db.prepare('SELECT address FROM investigation_addresses WHERE investigation_id=?').all(req.params.id).map((r: any) => r.address);
  const txs = db.prepare('SELECT tx_hash FROM investigation_transactions WHERE investigation_id=?').all(req.params.id).map((r: any) => r.tx_hash);
  const notes = db.prepare('SELECT * FROM notes WHERE investigation_id=? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...inv, addresses, transactions: txs, notes });
});
app.post('/api/investigations/:id/addresses', (req, res) => {
  const { address } = req.body ?? {};
  db.prepare('INSERT OR IGNORE INTO investigation_addresses(investigation_id,address) VALUES(?,?)').run(req.params.id, address);
  res.json({ ok: true });
});
app.post('/api/investigations/:id/transactions', (req, res) => {
  const { txHash } = req.body ?? {};
  db.prepare('INSERT OR IGNORE INTO investigation_transactions(investigation_id,tx_hash) VALUES(?,?)').run(req.params.id, txHash);
  res.json({ ok: true });
});
app.post('/api/investigations/:id/notes', (req, res) => {
  const { body } = req.body ?? {};
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO notes(investigation_id,body,created_at) VALUES(?,?,?)').run(req.params.id, body, now);
  res.json({ ok: true });
});

app.post('/api/reports/generate', (req, res) => {
  const { investigationId } = req.body ?? {};
  const inv: any = db.prepare('SELECT * FROM investigations WHERE id=?').get(investigationId);
  if (!inv) return res.status(404).json({ error: 'investigation not found' });
  const addresses = db.prepare('SELECT address FROM investigation_addresses WHERE investigation_id=?').all(investigationId).map((r: any) => r.address);
  const txs = db.prepare('SELECT tx_hash FROM investigation_transactions WHERE investigation_id=?').all(investigationId).map((r: any) => r.tx_hash);
  const notes = db.prepare('SELECT body,created_at FROM notes WHERE investigation_id=?').all(investigationId);
  const report = {
    title: `Investigation Report: ${inv.name}`,
    generatedAt: new Date().toISOString(),
    network: inv.network,
    provider: 'demo-synthetic',
    investigation: inv,
    addresses,
    transactions: txs,
    notes,
    limitations: 'Demo synthetic data. Address-level graph does not establish fund provenance. Graph patterns are not proof of illicit activity.',
  };
  res.json(report);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Backend listening on ${port}`));