// server/services/influx.js

// 校验 token/URL 是否可用，并可顺便返回用户/组织信息
export async function validateInflux({ url, token }) {
  const headers = { Authorization: `Token ${token}` };
  const me = await fetch(new URL('/api/v2/me', url).href, { headers });
  if (!me.ok) throw new Error('Invalid URL or Token');

  // 再试 buckets 确认权限
  const b = await fetch(new URL('/api/v2/buckets', url).href, { headers });
  if (!b.ok) throw new Error('Token cannot list buckets');

  return { ok: true };
}

// 列 buckets，返回统一形状
export async function listBuckets(sess) {
  const { influxUrl: url, token } = sess;
  const headers = { Authorization: `Token ${token}` };
  const r = await fetch(new URL('/api/v2/buckets', url).href, { headers });
  if (!r.ok) throw new Error('Failed to fetch buckets');
  const j = await r.json();

  // 兼容不同返回结构，整理成 {id,name}
  const arr = j.buckets?.buckets ?? j.buckets ?? j?.buckets ?? j;
  return (arr || []).map(b => ({ id: b.id, name: b.name }));
}

// ========== 1) 执行 Flux ==========
export async function runFlux(sess, flux, { org, prefer='json' } = {}) {
  const { influxUrl: url, token } = sess;
  const orgName = org || sess.org; // 你登录时若保存了 org，可直接用
  const baseHeaders = { Authorization: `Token ${token}` };

  // 尝试 JSON（2.6+ 支持）；失败则回退 CSV
  if (prefer === 'json') {
    try {
      const u = new URL('/api/v2/query', url);
      if (orgName) u.searchParams.set('org', orgName);
      const r = await fetch(u.href, {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: flux,
          type: 'flux',
          dialect: { header: true, annotations: ['group','datatype','default'], format: 'json' }
        })
      });
      if (r.ok) {
        // Influx 的 JSON 会按表流式返回，这里统一摊平成行对象（只取 _time/_value 等常用列）
        const j = await r.json(); // 结构依版本不同，这里兜底转为 rows
        if (Array.isArray(j)) return j; // 有些代理层会直接把表格转成行数组
        // 兜底：如果不是数组，直接返回原始 JSON，交给上层处理
        return j;
      }
    } catch (_) { /* fallthrough */ }
  }

  // CSV 回退方案（稳定）
  const u = new URL('/api/v2/query', url);
  if (orgName) u.searchParams.set('org', orgName);
  const r = await fetch(u.href, {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/vnd.flux', Accept: 'text/csv' },
    body: flux
  });
  if (!r.ok) throw new Error(`Flux query failed: ${r.status}`);
  const text = await r.text();
  return csvToRows(text);
}

// ========== 2) schema 元数据（标签筛选会用到） ==========
// 注意：这些都通过 runFlux 调用 schema.* 得到 _value 列
export async function listMeasurements(sess, { bucket, start='-30d' }) {
  const flux = `
import "influxdata/influxdb/schema"
schema.measurements(bucket: "${esc(bucket)}", start: ${start})
`;
  const rows = await runFlux(sess, flux, { prefer: 'csv' });
  return [...new Set(rows.map(r => r._value).filter(Boolean))];
}

export async function listFieldKeys(sess, { bucket, measurement, start='-30d' }) {
  const pred = measurement ? `(r) => r._measurement == "${esc(measurement)}"` : '';
  const flux = `
import "influxdata/influxdb/schema"
schema.fieldKeys(bucket: "${esc(bucket)}"${pred ? `, predicate: ${pred}` : ''}, start: ${start})
`;
  const rows = await runFlux(sess, flux, { prefer: 'csv' });
  return [...new Set(rows.map(r => r._value).filter(Boolean))];
}

export async function listTagKeys(sess, { bucket, measurement, start='-30d' }) {
  const pred = measurement ? `(r) => r._measurement == "${esc(measurement)}"` : '';
  const flux = `
import "influxdata/influxdb/schema"
schema.tagKeys(bucket: "${esc(bucket)}"${pred ? `, predicate: ${pred}` : ''}, start: ${start})
`;
  const rows = await runFlux(sess, flux, { prefer: 'csv' });
  return [...new Set(rows.map(r => r._value).filter(Boolean))];
}

export async function listTagValues(sess, { bucket, tag, measurement, field, start='-30d' }) {
  const pieces = [];
  if (measurement) pieces.push(`r._measurement == "${esc(measurement)}"`);
  if (field)       pieces.push(`r._field == "${esc(field)}"`);
  const pred = pieces.length ? `(r) => ${pieces.join(' and ')}` : '';
  const flux = `
import "influxdata/influxdb/schema"
schema.tagValues(bucket: "${esc(bucket)}", tag: "${esc(tag)}"${pred ? `, predicate: ${pred}` : ''}, start: ${start})
`;
  const rows = await runFlux(sess, flux, { prefer: 'csv' });
  return [...new Set(rows.map(r => r._value).filter(Boolean))];
}

// ========== 3) 更精准的 Flux 生成器 ==========
export function buildFlux(spec) {
  const {
    bucket,
    time,                  // { start: "-24h", stop?: "...ISO..." }
    measurement,           // "m"
    fields = [],           // ["mem", ...]
    tags = [],             // [{key, op:'=='|'!='|'in', value: string|string[]}, ...]
    groupBy = [],          // ["host","env"]
    aggregate,             // { every:"1m", fn:"mean", createEmpty:false }
    limit                  // number
  } = spec;

  const lines = [];
  lines.push(`from(bucket: "${esc(bucket)}")`);
  lines.push(`|> range(start: ${time.start}${time.stop ? `, stop: ${time.stop}` : ''})`);

  if (measurement) {
    lines.push(`|> filter(fn: (r) => r._measurement == "${esc(measurement)}")`);
  }
  if (fields.length) {
    const cond = fields.map(f => `r._field == "${esc(f)}"`).join(' or ');
    lines.push(`|> filter(fn: (r) => ${cond})`);
  }
  if (tags.length) {
    const expr = tags.map(t => {
      const k = `r["${esc(t.key)}"]`;
      if (t.op === 'in') {
        const arr = Array.isArray(t.value) ? t.value : [t.value];
        const orCond = arr.map(v => `${k} == "${esc(v)}"`).join(' or ');
        return `(${orCond})`;
      }
      if (t.op === '==' || t.op === '!=') {
        return `${k} ${t.op} "${esc(String(t.value))}"`;
      }
      throw new Error(`Unsupported tag op: ${t.op}`); // 如需正则，可再扩展 =~ /.../
    }).join(' and ');
    lines.push(`|> filter(fn: (r) => ${expr})`);
  }

  if (groupBy.length) lines.push(`|> group(columns: [${groupBy.map(c => `"${esc(c)}"`).join(', ')}])`);

  if (aggregate && aggregate.fn) {
    const every = aggregate.every ? aggregate.every : '1m';
    lines.push(`|> aggregateWindow(every: ${every}, fn: ${aggregate.fn}, createEmpty: ${aggregate.createEmpty ?? false})`);
  }

  if (Number.isInteger(limit)) lines.push(`|> limit(n: ${limit})`);
  lines.push(`|> yield(name: "query")`);

  return lines.join('\n');
}