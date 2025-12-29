// server/routes/rest.js
import express from 'express';
import fs from 'fs';
import { setSession, clearSession } from '../services/session.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// GET /api/buckets
router.get('/buckets', requireAuth, async (req, res) => {
  const { influxUrl, token } = req.auth;
  const r = await fetch(new URL('/api/v2/buckets', influxUrl).href, {
    headers: { Authorization: `Token ${token}` }
  });
  const j = await r.json();
  res.status(r.status).json(j);
});

const normalizeBaseUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    // 只保留协议 + host[:port]
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (e) {
    return null;
  }
};

const buildUrlFallbacks = (rawUrl) => {
  const normalized = normalizeBaseUrl(rawUrl);
  if (!normalized) return [];

  const parsed = new URL(normalized);
  const host = parsed.hostname;
  const candidates = new Set([normalized]);

  const pushVariant = (nextHost) => {
    const clone = new URL(normalized);
    clone.hostname = nextHost;
    candidates.add(clone.toString());
  };

  if (host === 'localhost' || host === '127.0.0.1') {
    pushVariant('influxdb');
    pushVariant('host.docker.internal');
  } else if (host === 'influxdb') {
    pushVariant('localhost');
    pushVariant('host.docker.internal');
  } else if (host === 'host.docker.internal') {
    pushVariant('localhost');
    pushVariant('influxdb');
  }

  return Array.from(candidates);
};

const testInfluxConnection = async (baseUrl, token) => {
  const headers = { Authorization: `Token ${token}` };
  const meUrl = new URL('/api/v2/me', baseUrl);
  const bucketsUrl = new URL('/api/v2/buckets', baseUrl);

  const meResp = await fetch(meUrl, { headers });
  if (meResp.status === 401) throw new Error('Invalid token (unauthorized)');
  if (meResp.status === 404) throw new Error('Invalid InfluxDB URL');
  if (!meResp.ok) throw new Error(`Login failed: HTTP ${meResp.status}`);

  const bucketsResp = await fetch(bucketsUrl, { headers });
  if (bucketsResp.status === 403) throw new Error('Token is valid but lacks permission to list buckets');
  if (!bucketsResp.ok) throw new Error(`Bucket check failed: HTTP ${bucketsResp.status}`);

  const me = await meResp.json();
  return { user: me, resolvedUrl: baseUrl };
};

// POST /auth/login
router.post('/login', async (req, res) => {
  const { url, token } = req.body || {};
  if (!url || !token) {
    return res.status(400).json({ ok: false, error: 'URL and Token are required' });
  }

  const candidates = buildUrlFallbacks(url);
  if (candidates.length === 0) {
    return res.status(400).json({ ok: false, error: 'Invalid URL format' });
  }

  const errors = [];

  for (const candidate of candidates) {
    try {
      const { user, resolvedUrl } = await testInfluxConnection(candidate, token);
      setSession(res, { influxUrl: resolvedUrl, token });
      return res.json({ ok: true, user: { id: user.id, name: user.name } });
    } catch (err) {
      errors.push(`${candidate}: ${err.message}`);
    }
  }

  const detail = errors.length ? `Tried ${errors.join('; ')}` : 'Login failed';
  res.status(401).json({ ok: false, error: detail });
});


// POST /auth/logout
router.post('/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true, message: 'Logout successful' });
});

// POST /api/query
router.post('/query', requireAuth, async (req, res) => {
  const { influxUrl, token } = req.auth;
  const { org, query } = req.body || {};
  if (!org || !query) return res.status(400).json({ ok:false, error:'org and query required' });

  const r = await fetch(new URL('/api/v2/query', influxUrl).href, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/vnd.flux',
      'Accept': 'application/json'
    },
    body: query
  });

  res.status(r.status);
  r.body.pipe(res);
});

/*------------measurement和field------------ */
// --- helpers: 转义 + 解析 Flux 响应（CSV 为主，JSON 兜底） ---
function escapeFluxString(s = "") {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// 更健壮的 CSV/JSON 解析：兼容 text/csv、application/csv、带 charset；
// 支持简单的带引号 CSV；容错：空响应/204、找不到列名时尝试常见备选。
async function parseFluxResponseToValuesArray(r) {
  const status = r.status;
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  const isCsv = ct.includes('text/csv') || ct.includes('application/csv');

  // 204 或空 body 直接返回空数组
  if (status === 204) return [];

  // -------- CSV 分支 --------
  if (isCsv) {
    const csv = await r.text();
    if (!r.ok) {
      const err = new Error(csv || `HTTP ${status}`);
      err.status = status;
      throw err;
    }
    // 过滤空行和注释
    const rows = csv.split(/\r?\n/).filter(Boolean).filter(l => !l.startsWith('#'));
    if (rows.length === 0) return [];

    // 轻量 CSV 行解析（支持双引号包裹与逗号）
    const splitCsvLine = (line) => {
      const out = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          // 处理转义双引号 ""
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQ = !inQ; }
        } else if (ch === ',' && !inQ) {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    };

    const header = splitCsvLine(rows[0]);
    // 优先顺序：_value -> value -> name
    let colIdx = header.indexOf('_value');
    if (colIdx === -1) colIdx = header.indexOf('value');
    if (colIdx === -1) colIdx = header.indexOf('name');
    if (colIdx === -1) return []; // 没有可用列

    const out = new Set();
    for (let i = 1; i < rows.length; i++) {
      const cols = splitCsvLine(rows[i]);
      const v = cols[colIdx];
      if (v != null && v !== '') out.add(v);
    }
    return Array.from(out).sort();
  }

  // -------- JSON 分支（兜底）--------
  if (ct.includes('application/json')) {
    const j = await r.json();
    if (!r.ok) {
      const err = new Error(j?.message || JSON.stringify(j) || `HTTP ${status}`);
      err.status = status;
      throw err;
    }
    const collect = (arr) => {
      const out = new Set();
      for (const row of (arr || [])) {
        const v = row?._value ?? row?.value ?? row?.name;
        if (v != null && v !== '') out.add(String(v));
      }
      return Array.from(out).sort();
    };

    if (Array.isArray(j)) return collect(j);
    if (Array.isArray(j?.tables)) {
      const out = new Set();
      for (const t of j.tables) {
        for (const rec of (t.records || [])) {
          const v = rec?._value ?? rec?.value ?? rec?.name;
          if (v != null && v !== '') out.add(String(v));
        }
      }
      return Array.from(out).sort();
    }
    if (Array.isArray(j?.data)) return collect(j.data);
    if (Array.isArray(j?.rows)) return collect(j.rows);
    return [];
  }

  // 其它类型：读文本并报错（便于调试）
  const txt = await r.text();
  const err = new Error(txt || `Unexpected content-type: ${ct || 'unknown'}`);
  err.status = status || 500;
  throw err;
}

/**
 * 执行 Flux 并把结果规整成字符串数组（取 _value）
 * 默认 CSV，若传 accept='json' 则请求 JSON（保留灵活性）
 */
async function runFluxReturnValuesArray({ influxUrl, token, org, flux, accept = 'csv' }) {
  const url = new URL('/api/v2/query', influxUrl);
  url.searchParams.set('org', org);
  const r = await fetch(url.href, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/vnd.flux',
      'Accept': accept === 'json' ? 'application/json' : 'text/csv',
    },
    body: flux
  });
  return parseFluxResponseToValuesArray(r);
}

// --- helpers: bucket/org 解析（id 优先，name 次之；处理重名冲突） ---
async function fetchAllBuckets({ influxUrl, token }) {
  const r = await fetch(new URL('/api/v2/buckets', influxUrl).href, {
    headers: { Authorization: `Token ${token}`, Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`cannot list buckets: HTTP ${r.status}`);
  const j = await r.json();
  return (j.buckets?.buckets ?? j.buckets ?? j) || [];
}

/**
 * 解析 bucket → { bucketId, bucketName, orgID }
 * - 若传 bucketId：直接按 id 命中（全局唯一）
 * - 若只传 bucket（name）：
 *    · 若也传 org：仅在该 org 下按 name 匹配；
 *    · 否则跨 org 查 name；0 命中 → 404；>1 命中 → 409（重名冲突）
 */
async function resolveBucket({ influxUrl, token, bucketId, bucketName, org }) {
  const list = await fetchAllBuckets({ influxUrl, token });

  if (bucketId) {
    const hit = list.find(b => b.id === bucketId);
    if (!hit) {
      const e = new Error(`bucketId "${bucketId}" not found`);
      e.status = 404; throw e;
    }
    return { bucketId: hit.id, bucketName: hit.name, orgID: hit.orgID };
  }

  if (!bucketName) {
    const e = new Error('bucket or bucketId required');
    e.status = 400; throw e;
  }

  const candidates = list.filter(b =>
    b.name === bucketName && (!org || b.orgID === org || b.org === org)
  );

  if (candidates.length === 0) {
    const e = new Error(`bucket "${bucketName}" not found${org ? ` in org "${org}"` : ''}`);
    e.status = 404; throw e;
  }
  if (candidates.length > 1) {
    const e = new Error(`bucket "${bucketName}" is ambiguous across orgs; use bucketId or specify org`);
    e.status = 409; throw e;
  }

  const hit = candidates[0];
  return { bucketId: hit.id, bucketName: hit.name, orgID: hit.orgID };
}

// --- end helpers ---

/**
 * GET /api/measurements?[bucketId=ID]|[bucket=NAME][&org=ORG][&format=json|csv]
 * 返回：["weather","cpu","mem", ...]
 */
router.get('/measurements', requireAuth, async (req, res) => {
  try {
    const { influxUrl, token } = req.auth;
    const { bucketId, bucket: bucketName, org, format } = req.query || {};

    // 解析 bucket 与 org（不要求前端传 org）
    const { bucketName: bn, orgID } = await resolveBucket({ influxUrl, token, bucketId, bucketName, org });

    const flux = `
import "influxdata/influxdb/schema"
schema.measurements(bucket: "${escapeFluxString(bn)}")
`.trim();

    const list = await runFluxReturnValuesArray({
      influxUrl, token, org: orgID, flux, accept: format === 'json' ? 'json' : 'csv'
    });
    res.json(list);
  } catch (e) {
    console.error('measurements error:', e);
    res.status(e.status || 500).json({ ok:false, error: e.message || 'measurements failed' });
  }
});

/**
 * GET /api/fields?[bucketId=ID]|[bucket=NAME][&org=ORG]&measurement=MEAS[&format=json|csv]
 * 返回：["temperature","usage_user", ...]
 */
router.get('/fields', requireAuth, async (req, res) => {
  try {
    const { influxUrl, token } = req.auth;
    const { bucketId, bucket: bucketName, measurement, org, format, diagnose, start } = req.query || {};
    const meas = String(measurement || '').trim();
    if (!meas) return res.status(400).json({ ok:false, error:'measurement required' });

    // 解析 bucket/org
    const { bucketName: bn, orgID } = await resolveBucket({ influxUrl, token, bucketId, bucketName, org });

    const accept = format === 'json' ? 'json' : 'csv';

    // 1) 首选：schema.measurementFieldKeys
    const flux1 = `
import "influxdata/influxdb/schema"
schema.measurementFieldKeys(
  bucket: "${escapeFluxString(bn)}",
  measurement: "${escapeFluxString(meas)}"
)
|> keep(columns: ["_value"])
`.trim();

    let fields = await runFluxReturnValuesArray({ influxUrl, token, org: orgID, flux: flux1, accept });

    // 2) 兼容：schema.fieldKeys |> filter
    if (!fields.length) {
      const flux2 = `
import "influxdata/influxdb/schema"
schema.fieldKeys(bucket: "${escapeFluxString(bn)}")
  |> filter(fn: (r) => r._measurement == "${escapeFluxString(meas)}")
  |> keep(columns: ["_value"])
`.trim();
      fields = await runFluxReturnValuesArray({ influxUrl, token, org: orgID, flux: flux2, accept });
    }

    // 3) 兜底：数据路径（可选 start，默认 -30d，必要时可传 -100y）
    if (!fields.length) {
      const win = String(start || '-30d'); // 建议改成默认 -100y 更保险
      const flux3 = `
from(bucket: "${escapeFluxString(bn)}")
  |> range(start: ${win})
  |> filter(fn: (r) => r._measurement == "${escapeFluxString(meas)}")
  |> keep(columns: ["_field"])
  |> group()
  |> distinct(column: "_field")
  |> keep(columns: ["_value"])
`.trim();
      fields = await runFluxReturnValuesArray({ influxUrl, token, org: orgID, flux: flux3, accept });

      // 如果默认窗口太短导致空，可让前端传 start=-100y 再试
      if (!fields.length && win !== '-100y') {
        const flux3b = flux3.replace(`range(start: ${win})`, 'range(start: -100y)');
        fields = await runFluxReturnValuesArray({ influxUrl, token, org: orgID, flux: flux3b, accept });
      }
    }

    return res.json(fields);
  } catch (e) {
    console.error('fields error:', e);
    res.status(e.status || 500).json({ ok:false, error: e.message || 'fields failed' });
  }
});

// GET /api/tag-keys?bucket=devbucket&measurement=m[&start=-30d]
router.get('/tag-keys', requireAuth, async (req, res) => {
  try {
    const { influxUrl, token } = req.auth;
    const { bucketId, bucket: bucketName, org, measurement, start, format } = req.query || {};
    const { bucketName: bn, orgID } = await resolveBucket({ influxUrl, token, bucketId, bucketName, org });

    const pred = measurement ? `(r) => r._measurement == "${escapeFluxString(measurement)}"` : '';
    const flux = `
import "influxdata/influxdb/schema"
schema.tagKeys(bucket: "${escapeFluxString(bn)}"${pred ? `, predicate: ${pred}` : ''}, start: ${start || '-30d'})
`.trim();

    const list = await runFluxReturnValuesArray({
      influxUrl, token, org: orgID, flux,
      accept: format === 'json' ? 'json' : 'csv'
    });
    res.json(list);
  } catch (e) {
    console.error('tag-keys error:', e);
    res.status(e.status || 500).json({ ok:false, error: e.message || 'tag-keys failed' });
  }
});

// GET /api/tag-values?bucket=devbucket&tag=host&measurement=m&field=mem[&start=-30d][&filters=...]
router.get('/tag-values', requireAuth, async (req, res) => {
  try {
    const { influxUrl, token } = req.auth;
    const { bucketId, bucket: bucketName, org, tag, measurement, field, start, format, filters } = req.query || {};
    if (!tag) return res.status(400).json({ ok:false, error:'tag is required' });

    const { bucketName: bn, orgID } = await resolveBucket({ influxUrl, token, bucketId, bucketName, org });

    const pieces = [];
    if (measurement) pieces.push(`r._measurement == "${escapeFluxString(measurement)}"`);
    if (field)       pieces.push(`r._field == "${escapeFluxString(field)}"`);

    // 处理级联过滤条件
    if (filters) {
      try {
        const cascadeFilters = JSON.parse(filters);
        if (Array.isArray(cascadeFilters)) {
          cascadeFilters.forEach(filter => {
            if (filter.key && filter.values && filter.values.length > 0) {
              if (filter.values.length === 1) {
                // 单个值：直接比较
                pieces.push(`r["${escapeFluxString(filter.key)}"] == "${escapeFluxString(filter.values[0])}"`);
              } else {
                // 多个值：使用contains
                const valueList = filter.values.map(v => `"${escapeFluxString(v)}"`).join(', ');
                pieces.push(`contains(value: r["${escapeFluxString(filter.key)}"], set: [${valueList}])`);
              }
            }
          });
        }
      } catch (e) {
        console.error('Error parsing filters:', e);
      }
    }

    const pred = pieces.length ? `(r) => ${pieces.join(' and ')}` : '';

    const flux = `
import "influxdata/influxdb/schema"
schema.tagValues(bucket: "${escapeFluxString(bn)}", tag: "${escapeFluxString(tag)}"${pred ? `, predicate: ${pred}` : ''}, start: ${start || '-30d'})
`.trim();

    const list = await runFluxReturnValuesArray({
      influxUrl, token, org: orgID, flux,
      accept: format === 'json' ? 'json' : 'csv'
    });
    res.json(list);
  } catch (e) {
    console.error('tag-values error:', e);
    res.status(e.status || 500).json({ ok:false, error: e.message || 'tag-values failed' });
  }
});

function buildFluxFromSpec(spec) {
  const {
    bucket,
    time,                   // { start: "-24h", stop?: "..." }
    measurement,
    fields = [],
    tags = [],              // [{key, op:'=='|'!='|'in', value: string|string[]}]
    groupBy = [],
    aggregate               // { every:"1m", fn:"mean", createEmpty:false }
  } = spec;

  const esc = escapeFluxString;
  const lines = [];
  lines.push(`from(bucket: "${esc(bucket)}")`);
  lines.push(`|> range(start: ${time.start}${time?.stop ? `, stop: ${time.stop}` : ''})`);
  if (measurement) lines.push(`|> filter(fn: (r) => r._measurement == "${esc(measurement)}")`);
  if (fields.length) {
    const cond = fields.map(f => `r._field == "${esc(f)}"`).join(' or ');
    lines.push(`|> filter(fn: (r) => ${cond})`);
  }
  if (tags.length) {
    const expr = tags.map(t => {
      const k = `r["${esc(t.key)}"]`;
      if (t.op === 'in') {
        const arr = (Array.isArray(t.value) ? t.value : [t.value]).map(v => `"${esc(v)}"`).join(', ');
        return `(${k} == ${arr.split(', ').join(` or ${k} == `)})`;
      }
      if (t.op === '==' || t.op === '!=') return `${k} ${t.op} "${esc(String(t.value))}"`;
      throw new Error(`Unsupported tag op: ${t.op}`);
    }).join(' and ');
    lines.push(`|> filter(fn: (r) => ${expr})`);
  }
  if (groupBy.length) lines.push(`|> group(columns: [${groupBy.map(c => `"${esc(c)}"`).join(', ')}])`);
  if (aggregate?.fn) {
    const every = aggregate.every || '1m';
    lines.push(`|> aggregateWindow(every: ${every}, fn: ${aggregate.fn}, createEmpty: ${aggregate.createEmpty ?? false})`);
  }
  lines.push(`|> yield(name: "query")`);
  return lines.join('\n');
}

const detectDocker = () => {
  try {
    return fs.existsSync('/.dockerenv');
  } catch (_err) {
    return false;
  }
};

const runningInDocker = detectDocker() || Boolean(process.env.CONTAINER || process.env.DOCKER);

const grafanaPublicBaseUrl = normalizeBaseUrl(
  process.env.GRAFANA_PUBLIC_URL || process.env.GRAFANA_BASE_URL || 'http://localhost:3001'
);

const grafanaApiBaseUrl =
  normalizeBaseUrl(process.env.GRAFANA_INTERNAL_URL) ||
  normalizeBaseUrl(process.env.GRAFANA_BASE_URL) ||
  normalizeBaseUrl(runningInDocker ? 'http://grafana:3000' : 'http://localhost:3001');

const grafanaOrgId = process.env.GRAFANA_ORG_ID || '1';

const grafanaUser = process.env.GRAFANA_USER || process.env.GRAFANA_BASIC_USER || 'admin';
const grafanaPassword = process.env.GRAFANA_PASSWORD || process.env.GRAFANA_BASIC_PASSWORD || 'admin';
const grafanaAuthHeader = 'Basic ' + Buffer.from(`${grafanaUser}:${grafanaPassword}`).toString('base64');

const grafanaDatasourceUidFromEnv = process.env.GRAFANA_DATASOURCE_UID;
const grafanaDatasourceNameFromEnv = process.env.GRAFANA_DATASOURCE_NAME;

let cachedGrafanaDatasourcePromise = null;

const ensureGrafanaDatasource = async () => {
  if (grafanaDatasourceUidFromEnv) {
    return { uid: grafanaDatasourceUidFromEnv, name: grafanaDatasourceNameFromEnv || 'Configured datasource' };
  }

  if (cachedGrafanaDatasourcePromise) {
    return cachedGrafanaDatasourcePromise;
  }

  cachedGrafanaDatasourcePromise = (async () => {
    const base = grafanaApiBaseUrl || 'http://localhost:3001';
    const url = new URL('/api/datasources', base);
    const res = await fetch(url, {
      headers: {
        Authorization: grafanaAuthHeader,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to list Grafana datasources: ${res.status} ${res.statusText} - ${body}`);
    }

    const datasources = await res.json();
    if (!Array.isArray(datasources)) {
      throw new Error('Unexpected Grafana datasource response format');
    }

    const matchByName = grafanaDatasourceNameFromEnv
      ? datasources.find(ds => ds.name === grafanaDatasourceNameFromEnv || ds.uid === grafanaDatasourceNameFromEnv)
      : null;

    const matchByType = datasources.find(ds => ds.type === 'influxdb');

    const datasource = matchByName || matchByType;
    if (!datasource) {
      throw new Error('Grafana InfluxDB datasource not found. Please create one and set GRAFANA_DATASOURCE_UID if necessary.');
    }

    return { uid: datasource.uid, name: datasource.name };
  })();

  return cachedGrafanaDatasourcePromise;
};

// POST /api/query/spec  （结构化查询）
router.post('/query/spec', requireAuth, async (req, res) => {
  try {
    const { influxUrl, token } = req.auth;
    const { bucketId, bucket: bucketName, org, spec, dry } = req.body || {};
    if (!spec?.time?.start) return res.status(400).json({ ok:false, error:'spec.time.start required' });

    // 解析真实 bucket 与 org
    const { bucketName: bn, orgID } = await resolveBucket({ influxUrl, token, bucketId, bucketName, org });

    const flux = buildFluxFromSpec({ ...spec, bucket: bn });

    if (dry) return res.json({ flux });

    const rows = await runFluxReturnValuesArray({
      influxUrl, token, org: orgID, flux,
      accept: 'json'  // 想用 CSV 也可以改成 'csv'
    });
    res.json({ flux, rows });
  } catch (e) {
    console.error('query/spec error:', e);
    res.status(e.status || 500).json({ ok:false, error: e.message || 'spec query failed' });
  }
});

// POST /api/create-filtered-dashboard
router.post('/create-filtered-dashboard', async (req, res) => {
  try {
    const {
      measurement,
      field,
      tags,
      visualizationType = 'timeseries',
      timeRange = '-24h',
      aggregateWindow = '30m',
      // Cross-measurement query parameters
      isCrossMeasurement,
      customFlux,
      fields,
      measurements,
      // Custom dashboard title
      customTitle
    } = req.body;

    console.log('=== Dynamic Dashboard Request ===');
    console.log('isCrossMeasurement:', isCrossMeasurement);
    console.log('customFlux:', customFlux);
    console.log('fields:', fields);
    console.log('measurements:', measurements);
    console.log('timeRange:', timeRange);
    console.log('aggregateWindow:', aggregateWindow);
    console.log('visualizationType:', visualizationType);
    console.log('customTitle:', customTitle);
    console.log('================================');

    // Cross-measurement validation
    if (isCrossMeasurement) {
      if (!customFlux || !fields || fields.length === 0) {
        return res.status(400).json({ error: 'customFlux and fields are required for cross-measurement queries' });
      }
    } else {
      // Single measurement validation
      if (!measurement || !field) {
        return res.status(400).json({ error: 'measurement and field are required for single measurement queries' });
      }
    }

    // 构建Flux查询
    let fluxQuery;

    if (isCrossMeasurement) {
      // 对于跨measurement查询，直接使用提供的customFlux
      fluxQuery = customFlux;
      console.log('Using custom Flux for cross-measurement query:', customFlux);
    } else {
      // 单measurement查询，使用原有逻辑
      fluxQuery = `from(bucket: "devbucket")
  |> range(start: ${timeRange})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> filter(fn: (r) => r._field == "${field}")`;

      // 添加tag过滤 - 使用AND逻辑组合多个条件
      if (tags && tags.length > 0) {
        const conditions = tags.map(tag => {
          if (tag.values && tag.values.length > 0) {
            if (tag.values.length === 1) {
              // 单个值：直接比较，标签值必须加引号
              return `r["${tag.key}"] == "${tag.values[0]}"`;
            } else {
              // 多个值：使用contains，标签值必须加引号
              const valuesList = tag.values.map(v => `"${v}"`).join(', ');
              return `contains(value: r["${tag.key}"], set: [${valuesList}])`;
            }
          }
          return null;
        }).filter(Boolean);

        if (conditions.length > 0) {
          fluxQuery += `\n  |> filter(fn: (r) => ${conditions.join(' and ')})`;
        }
      }

      // 添加聚合
      if (visualizationType === 'timeseries') {
        fluxQuery += `\n  |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)\n  |> yield(name: "mean")`;
      } else if (visualizationType === 'stat' || visualizationType === 'gauge') {
        fluxQuery += `\n  |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)\n  |> last()`;
      } else if (visualizationType === 'table') {
        fluxQuery += `\n  |> aggregateWindow(every: ${aggregateWindow}, fn: mean, createEmpty: false)\n  |> limit(n: 100)`;
      }
    }

    // 生成唯一的仪表板ID和标题
    const timestamp = Date.now();
    const dashboardUid = `filtered-${visualizationType}-${timestamp}`;

    let dashboardTitle, panelTitle;

    // Use custom title if provided, otherwise generate default
    if (customTitle && customTitle.trim()) {
      dashboardTitle = customTitle.trim();
      panelTitle = customTitle.trim();
      console.log('Using custom title:', dashboardTitle);
    } else {
      // Default title generation
      if (isCrossMeasurement) {
        const measurementList = measurements ? measurements.join(', ') : 'Multiple';
        const fieldList = fields ? fields.join(', ') : 'Multiple';
        dashboardTitle = `Cross-Measurement Dashboard - ${measurementList}`;
        panelTitle = `${visualizationType} Panel (${fieldList})`;
      } else {
        dashboardTitle = `${measurement}.${field} Dashboard`;
        panelTitle = `${visualizationType} Panel (${measurement}.${field})`;
      }
      console.log('Using default title:', dashboardTitle);
    }

    // 构建面板配置
    const grafanaDatasource = await ensureGrafanaDatasource();

    let panelConfig = {
      id: 1,
      title: panelTitle,
      type: visualizationType,
      targets: [{
        query: fluxQuery,
        refId: 'A',
        datasource: { type: 'influxdb', uid: grafanaDatasource.uid }
      }],
      datasource: { type: 'influxdb', uid: grafanaDatasource.uid },
      fieldConfig: {
        defaults: {
          color: { mode: visualizationType === 'timeseries' ? 'palette-classic' : 'thresholds' }
        }
      },
      gridPos: { h: 12, w: 24, x: 0, y: 0 }
    };

    // 添加特定类型的配置
    if (visualizationType === 'stat') {
      panelConfig.options = { textMode: 'auto', colorMode: 'value' };
    } else if (visualizationType === 'gauge') {
      panelConfig.fieldConfig.defaults.min = 0;
      panelConfig.fieldConfig.defaults.max = 100;
    }

    // 创建Grafana仪表板
    const grafanaApiUrl = new URL('/api/dashboards/db', grafanaApiBaseUrl || 'http://localhost:3001');
    const grafanaResponse = await fetch(grafanaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': grafanaAuthHeader
      },
      body: JSON.stringify({
        dashboard: {
          id: null,
          uid: dashboardUid,
          title: dashboardTitle,
          tags: isCrossMeasurement ? ['cross-measurement', visualizationType] : ['filtered', visualizationType],
          datasource: { type: 'influxdb', uid: grafanaDatasource.uid },
          timezone: 'browser',
          panels: [panelConfig],
          time: { from: `now${timeRange}`, to: 'now' },
          templating: { list: [] },
          refresh: '5s',
          schemaVersion: 37,
          version: 0
        },
        overwrite: true
      })
    });

    if (!grafanaResponse.ok) {
      const errorBody = await grafanaResponse.text();
      console.error('Grafana API Error:', grafanaResponse.status, grafanaResponse.statusText, errorBody);
      throw new Error(`Failed to create Grafana dashboard: ${grafanaResponse.status} ${grafanaResponse.statusText} - ${errorBody}`);
    }

    const result = await grafanaResponse.json();

    // URL for iframe embedding (solo panel)
    const baseForEmbed = grafanaPublicBaseUrl || 'http://localhost:3001';

    const embedUrl = new URL(`/d-solo/${result.uid}/${result.slug}`, baseForEmbed);
    embedUrl.searchParams.set('orgId', grafanaOrgId);
    embedUrl.searchParams.set('panelId', '1');
    embedUrl.searchParams.set('from', `now${timeRange}`);
    embedUrl.searchParams.set('to', 'now');
    embedUrl.searchParams.set('theme', 'light');
    embedUrl.searchParams.set('kiosk', 'true');
    embedUrl.searchParams.set('refresh', '5s');
    embedUrl.searchParams.set('_t', Date.now().toString());

    // URL for full Grafana dashboard editing interface
    const fullUrl = new URL(`/d/${result.uid}/${result.slug}`, baseForEmbed);
    fullUrl.searchParams.set('orgId', grafanaOrgId);
    fullUrl.searchParams.set('from', `now${timeRange}`);
    fullUrl.searchParams.set('to', 'now');
    fullUrl.searchParams.set('editPanel', '1');
    fullUrl.searchParams.set('_t', Date.now().toString());

    console.log('Dashboard created successfully:', result);
    console.log('Generated embed URL:', embedUrl.toString());
    console.log('Generated full URL:', fullUrl.toString());

    res.json({
      success: true,
      dashboardUid,
      grafanaUrl: embedUrl.toString(),
      grafanaFullUrl: fullUrl.toString()
    });

  } catch (error) {
    console.error('Create filtered dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
