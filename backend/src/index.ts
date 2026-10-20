import express from 'express';
import cors from 'cors';
import { db, NETWORK } from './db/database.js';
import { seedDemo, DEMO_MANIFEST } from './db/seed.js';
import { buildGraph, addressStats, addressHistory } from './services/graphService.js';
import { runCpp } from './services/cppRunner.js';
import { getProviderConfig } from './services/provider.js';

seedDemo();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

function net(req: express.Request): string {
  const n = (req.query.network as string) || (req.body?.network as string) || NETWORK;
  return n;
}
function datasetMeta(slug: string) {
  return db.prepare('SELECT * FROM datasets WHERE slug=?').get(slug) as any;
}
function serializeDataset(d: any) {
  if (!d) return null;
  return { ...d, synthetic: !!d.synthetic, manifest: d.manifest ? JSON.parse(d.manifest) : null };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, network: NETWORK }));
app.get('/api/provider/status', (_req, res) => res.json(getProviderConfig()));

app.get('/api/datasets', (_req, res) => {
  const rows = db.prepare('SELECT * FROM datasets ORDER BY created_at DESC').all();
  res.json(rows.map(serializeDataset));
});

// CSV helper
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
  if (/^\d+$/.test(s)) return s; // raw integer units
  if (!/^\d+(\.\d{1,18})$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return (BigInt(w) * 10n ** 18n + BigInt(f.padEnd(18, '0'))).toString();
}

function validateAndIngest(slug: string, records: any[], source: string) {
  const errors: string[] = [];
  const valid: any[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  records.forEach((r, idx) => {
    const row = idx + 2;
    const from = String(r.from_address ?? r.from ?? '').trim().toLowerCase();
    const to = String(r.to_address ?? r.to ?? '').trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(from)) { errors.push(`Row ${row}: invalid from_address`); return; }
    if (!/^0x[0-9a-f]{40}$/.test(to)) { errors.push(`Row ${row}: invalid to_address`); return; }
    if (from === to) { errors.push(`Row ${row}: self-transfer is not supported`); return; }
    const amount = normalizeAmount(String(r.amount ?? r.value_raw ?? ''));
    if (!amount) { errors.push(`Row ${row}: invalid amount`); return; }
    const ts = Number(r.timestamp);
    if (!Number.isFinite(ts) || ts <= 0) { errors.push(`Row ${row}: invalid timestamp (unix seconds expected)`); return; }
    const txHash = String(r.transaction_hash ?? r.tx_hash ?? `0x${slug.slice(0, 6)}${idx}${from.slice(2, 10)}${to.slice(2, 10)}`).toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) { errors.push(`Row ${row}: invalid transaction_hash`); return; }
    if (seen.has(txHash)) { duplicates++; return; }
    seen.add(txHash);
    valid.push({ from, to, amount, ts: Math.floor(ts), txHash, asset: String(r.asset ?? 'units').slice(0, 20), block: Number(r.block_number ?? 0) });
  });
  const insTx = db.prepare('INSERT OR IGNORE INTO transactions(network,tx_hash,block_number,timestamp,from_address,to_address,value_raw,asset) VALUES(?,?,?,?,?,?,?,?)');
  const insTr = db.prepare('INSERT OR IGNORE INTO transfers(network,tx_hash,log_index,from_address,to_address,value_raw,asset,timestamp) VALUES(?,?,?,?,?,?,?,?)');
  let inserted = 0;
  const tx = db.transaction(() => {
    for (const v of valid) {
      const a = insTx.run(slug, v.txHash, v.block, v.ts, v.from, v.to, v.amount, v.asset);
      insTr.run(slug, v.txHash, 0, v.from, v.to, v.amount, v.asset, v.ts);
      if (a.changes > 0) inserted++;
    }
  });
  tx();
  const addressCount = (db.prepare('SELECT COUNT(DISTINCT address) c FROM (SELECT from_address address FROM transfers WHERE network=? UNION SELECT to_address FROM transfers WHERE network=?)').get(slug, slug) as any).c;
  const transferCount = (db.prepare('SELECT COUNT(*) c FROM transfers WHERE network=?').get(slug) as any).c;
  db.prepare('UPDATE datasets SET address_count=?, transfer_count=? WHERE slug=?').run(addressCount, transferCount, slug);
  return { totalRows: records.length, validRows: valid.length, inserted, duplicates, invalidRows: records.length - valid.length, errors: errors.slice(0, 25), addressCount, transferCount, source };
}

app.post('/api/datasets/import', (req, res) => {
  try {
    const { name, csv, records, format } = req.body ?? {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Dataset name is required' });
    let rows: any[] = [];
    if (format === 'csv' || typeof csv === 'string') {
      if (typeof csv !== 'string' || csv.length > 8_000_000) return res.status(400).json({ error: 'CSV too large or missing' });
      const parsed = parseCsv(csv);
      if (parsed.length < 2) return res.status(400).json({ error: 'CSV must include a header and at least one data row' });
      const header = parsed[0].map(h => h.trim().toLowerCase());
      const required = ['from_address', 'to_address', 'amount', 'timestamp'];
      const missing = required.filter(k => !header.includes(k));
      if (missing.length) return res.status(400).json({ error: `Missing required columns: ${missing.join(', ')}`, header });
      rows = parsed.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
    } else if (Array.isArray(records)) {
      rows = records;
    } else {
      return res.status(400).json({ error: 'Provide a CSV string or a JSON records array' });
    }
    if (rows.length > 20000) return res.status(400).json({ error: 'Too many rows (limit 20,000)' });
    const baseSlug = 'import-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36);
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO datasets(slug,name,version,network,source,synthetic,seed,created_at,manifest) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(baseSlug, name, '1.0.0', baseSlug, 'user-import', 1, null, now, JSON.stringify({ importedAt: now, format: format ?? 'json' }));
    const summary = validateAndIngest(baseSlug, rows, format === 'csv' ? 'csv-import' : 'json-import');
    res.json({ dataset: serializeDataset(datasetMeta(baseSlug)), summary });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.get('/api/dashboard', (req, res) => {
  const network = net(req);
  const meta = datasetMeta(network);
  const txCount = (db.prepare('SELECT COUNT(*) c FROM transactions WHERE network=?').get(network) as any).c;
  const addrCount = (db.prepare('SELECT COUNT(DISTINCT address) c FROM (SELECT from_address address FROM transfers WHERE network=? UNION SELECT to_address FROM transfers WHERE network=?)').get(network, network) as any).c;
  const all = db.prepare('SELECT value_raw, from_address, to_address, timestamp, asset FROM transfers WHERE network=?').all(network) as any[];
  const total = all.reduce((a, r) => a + BigInt(r.value_raw), 0n).toString();
  const recent = db.prepare('SELECT * FROM transfers WHERE network=? ORDER BY timestamp DESC LIMIT 10').all(network);
  const top = db.prepare('SELECT from_address addr, COUNT(*) c FROM transfers WHERE network=? GROUP BY from_address ORDER BY c DESC LIMIT 8').all(network);
  // daily activity
  const days = new Map<string, { count: number; volume: bigint }>();
  for (const r of all) {
    const d = new Date(r.timestamp * 1000).toISOString().slice(0, 10);
    const cur = days.get(d) ?? { count: 0, volume: 0n };
    cur.count++; cur.volume += BigInt(r.value_raw); days.set(d, cur);
  }
  const activity = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, count: v.count, volume: v.volume.toString() }));
  res.json({
    network, datasetName: meta?.name ?? network, synthetic: meta ? !!meta.synthetic : true, provider: meta?.source ?? 'demo-synthetic',
    txCount, uniqueAddresses: addrCount, totalValueRaw: total, incomingTotal: total, outgoingTotal: total,
    recent, topAddresses: top, activity, lastSync: meta?.created_at ?? null,
    asset: all[0]?.asset ?? 'units',
  });
});

app.get('/api/addresses/:address', (req, res) => {
  res.json(addressStats(net(req), req.params.address));
});

app.get('/api/addresses/:address/history', (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  res.json(addressHistory(net(req), req.params.address, page, pageSize));
});

app.post('/api/graph/neighborhood', async (req, res) => {
  try {
    const { center, hops = 2, limit = 200, direction = 'both' } = req.body ?? {};
    const network = net(req);
    if (center && !/^0x[0-9a-fA-F]{40}$/.test(center)) return res.status(400).json({ error: 'Invalid address format' });
    if (hops < 1 || hops > 3) return res.status(400).json({ error: 'hops must be between 1 and 3' });
    if (limit < 1 || limit > 500) return res.status(400).json({ error: 'limit must be between 1 and 500' });
    const g = buildGraph(network, { center, limit });
    const result = await runCpp('neighbors', { ...g, node: center || g.nodes[0], direction, hops, limit });
    res.json({ graph: g, analysis: result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/graph/path', async (req, res) => {
  try {
    const { source, destination, algorithm = 'bfs', maxHops = 6, costMetric = 'cost' } = req.body ?? {};
    const network = net(req);
    if (!/^0x[0-9a-fA-F]{40}$/.test(source || '') || !/^0x[0-9a-fA-F]{40}$/.test(destination || '')) return res.status(400).json({ error: 'Both source and destination must be valid 0x addresses' });
    const g = buildGraph(network, { limit: 4000 });
    const cmd = algorithm === 'dijkstra' ? 'dijkstra' : 'bfs';
    const result = await runCpp(cmd, { ...g, source, destination, maxHops, costMetric });
    res.json({ graph: g, result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/graph/trace-steps', async (req, res) => {
  try {
    const { source, destination, algorithm = 'bfs', maxHops = 6, costMetric = 'cost', maxSteps = 300 } = req.body ?? {};
    const network = net(req);
    if (!/^0x[0-9a-fA-F]{40}$/.test(source || '')) return res.status(400).json({ error: 'Source must be a valid 0x address' });
    if (destination && !/^0x[0-9a-fA-F]{40}$/.test(destination)) return res.status(400).json({ error: 'Destination must be a valid 0x address' });
    const g = buildGraph(network, { limit: 4000 });
    const cmd = algorithm === 'dijkstra' ? 'dijkstraTrace' : algorithm === 'dfs' ? 'dfsTrace' : 'bfsTrace';
    const result = await runCpp(cmd, { ...g, source, destination: destination ?? '', maxHops, costMetric, maxSteps: Math.min(maxSteps, 600) });
    res.json({ graph: g, result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scenarios', (req, res) => {
  const network = net(req);
  const meta = datasetMeta(network);
  const manifest = meta?.manifest ? JSON.parse(meta.manifest) : null;
  const scenarios = (manifest?.scenarios ?? []).map((s: any) => ({ ...s, network }));
  res.json({ network, scenarios });
});

app.post('/api/graph/analyze', async (req, res) => {
  try {
    const { type = 'cycles' } = req.body ?? {};
    const g = buildGraph(net(req), { limit: 4000 });
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
    const network = net(req);
    const g = buildGraph(network, { limit: 4000 });
    const cycles = await runCpp('cycles', { ...g, maxCycles: 20, maxLen: 6 });
    const degrees = await runCpp('degrees', g);
    const alerts: any[] = [];
    const highDeg = (degrees.nodes ?? []).filter((n: any) => n.total >= 12);
    for (const n of highDeg) {
      alerts.push({ rule: 'high-degree', severity: 'medium', addresses: [n.node], txHashes: [], evidence: { inDegree: n.inDegree, outDegree: n.outDegree, uniqueIn: n.uniqueIn, uniqueOut: n.uniqueOut }, threshold: 'total degree >= 12' });
    }
    for (const c of cycles.cycles ?? []) {
      alerts.push({ rule: 'directed-cycle', severity: 'high', addresses: c, txHashes: [], evidence: { cycleLength: c.length, cycle: c }, threshold: 'cycle length <= 6' });
    }
    const outCounts: Record<string, number> = {};
    const outUnique: Record<string, Set<string>> = {};
    for (const e of g.edges) { outCounts[e.from] = (outCounts[e.from] ?? 0) + 1; (outUnique[e.from] ??= new Set()).add(e.to); }
    for (const [a, c] of Object.entries(outCounts)) if (c >= 15) alerts.push({ rule: 'fan-out', severity: 'medium', addresses: [a], txHashes: [], evidence: { outgoingEdges: c, uniqueRecipients: outUnique[a].size }, threshold: 'outgoing edges >= 15' });
    // dedupe by rule+addresses
    const seen = new Set<string>();
    const unique = alerts.filter(a => { const k = a.rule + ':' + a.addresses.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
    const ins = db.prepare('INSERT INTO alerts(network,rule,severity,addresses,tx_hashes,evidence,status,created_at) VALUES(?,?,?,?,?,?,?,?)');
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM alerts WHERE network=?').run(network);
    for (const a of unique) ins.run(network, a.rule, a.severity, JSON.stringify(a.addresses), JSON.stringify(a.txHashes), JSON.stringify(a.evidence), 'open', now);
    res.json({ alerts: unique, count: unique.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/alerts', (req, res) => {
  const rows = db.prepare('SELECT * FROM alerts WHERE network=? ORDER BY created_at DESC LIMIT 200').all(net(req));
  res.json(rows.map((r: any) => ({ ...r, addresses: JSON.parse(r.addresses), tx_hashes: JSON.parse(r.tx_hashes), evidence: JSON.parse(r.evidence) })));
});

app.post('/api/alerts/:id/status', (req, res) => {
  const { status } = req.body ?? {};
  if (!['open', 'reviewed', 'dismissed'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  db.prepare('UPDATE alerts SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

// Investigations
app.get('/api/investigations', (_req, res) => {
  res.json(db.prepare('SELECT * FROM investigations ORDER BY created_at DESC').all());
});
app.post('/api/investigations', (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const now = Math.floor(Date.now() / 1000);
  const info = db.prepare('INSERT INTO investigations(name,description,network,created_at,updated_at) VALUES(?,?,?,?,?)').run(name, description ?? '', net(req), now, now);
  res.json({ id: info.lastInsertRowid, name, description, network: net(req), status: 'open', created_at: now, updated_at: now });
});
app.patch('/api/investigations/:id', (req, res) => {
  const { name, description, status } = req.body ?? {};
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE investigations SET name=COALESCE(?,name), description=COALESCE(?,description), status=COALESCE(?,status), updated_at=? WHERE id=?').run(name ?? null, description ?? null, status ?? null, now, req.params.id);
  res.json({ ok: true });
});
app.get('/api/investigations/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM investigations WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'not found' });
  const addresses = db.prepare('SELECT address FROM investigation_addresses WHERE investigation_id=?').all(req.params.id).map((r: any) => r.address);
  const txs = db.prepare('SELECT tx_hash FROM investigation_transactions WHERE investigation_id=?').all(req.params.id).map((r: any) => r.tx_hash);
  const notes = db.prepare('SELECT * FROM notes WHERE investigation_id=? ORDER BY created_at DESC').all(req.params.id);
  let alerts: any[] = [];
  try { alerts = db.prepare('SELECT * FROM alerts WHERE network=? AND status != ?').all((inv as any).network, 'dismissed').filter((a: any) => JSON.parse(a.addresses).some((x: string) => addresses.includes(x))); } catch {}
  res.json({ ...inv, addresses, transactions: txs, notes, alerts });
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
  if (!body) return res.status(400).json({ error: 'note body required' });
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO notes(investigation_id,body,created_at) VALUES(?,?,?)').run(req.params.id, body, now);
  res.json({ ok: true });
});
app.delete('/api/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
app.post('/api/alerts/:id/add-to-case', (req, res) => {
  const { investigationId } = req.body ?? {};
  const alert: any = db.prepare('SELECT * FROM alerts WHERE id=?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'alert not found' });
  for (const a of JSON.parse(alert.addresses)) db.prepare('INSERT OR IGNORE INTO investigation_addresses(investigation_id,address) VALUES(?,?)').run(investigationId, a);
  res.json({ ok: true });
});

app.post('/api/reports/generate', (req, res) => {
  const { investigationId } = req.body ?? {};
  const inv: any = db.prepare('SELECT * FROM investigations WHERE id=?').get(investigationId);
  if (!inv) return res.status(404).json({ error: 'investigation not found' });
  const addresses = db.prepare('SELECT address FROM investigation_addresses WHERE investigation_id=?').all(investigationId).map((r: any) => r.address);
  const txs = db.prepare('SELECT tx_hash FROM investigation_transactions WHERE investigation_id=?').all(investigationId).map((r: any) => r.tx_hash);
  const notes = db.prepare('SELECT body,created_at FROM notes WHERE investigation_id=?').all(investigationId);
  const meta = datasetMeta((inv as any).network);
  const report = {
    title: `Investigation Report: ${inv.name}`,
    generatedAt: new Date().toISOString(),
    network: (inv as any).network,
    dataset: meta ? { name: meta.name, source: meta.source, synthetic: !!meta.synthetic } : null,
    provenance: 'Records derived from the stored dataset. Synthetic datasets are not real blockchain evidence.',
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