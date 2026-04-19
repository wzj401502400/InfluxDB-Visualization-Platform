export async function login(url, token) {
  const r = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, token })
  });
  return r.json();
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
}

export async function fetchBuckets() {
  const r = await fetch('/api/buckets', { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || JSON.stringify(j));
  const list = (j.buckets?.buckets ?? j.buckets ?? j) || [];
  return Array.isArray(list) ? list : [];
}

export async function fetchMeasurements(bucketId) {
  if (!bucketId) throw new Error('bucketId missing');
  const r = await fetch(
    `/api/measurements?bucketId=${encodeURIComponent(bucketId)}`,
    { cache: 'no-store' }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || JSON.stringify(j));
  return Array.isArray(j) ? j : [];
}

export async function fetchFields(bucketId, measurement) {
  if (!bucketId || !measurement) throw new Error('bucketId/measurement missing');
  const url = `/api/fields?bucketId=${encodeURIComponent(
    bucketId
  )}&measurement=${encodeURIComponent(measurement)}`;
  const r = await fetch(url, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || JSON.stringify(j));
  return Array.isArray(j) ? j : [];
}

// Fetch Tag Keys
export async function fetchTagKeys(bucketId, measurement, start = '-30d') {
  if (!bucketId) throw new Error('bucketId missing');
  const p = new URLSearchParams({ bucketId, start });
  if (measurement) p.set('measurement', measurement);

  const r = await fetch(`/api/tag-keys?${p.toString()}`, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || JSON.stringify(j));
  return Array.isArray(j) ? j : [];
}

// Fetch all values for a given Tag Key (optionally filtered by measurement / field)
export async function fetchTagValues(bucketId, tag, { measurement, field, start = '-30d', filters = [] } = {}) {
  if (!bucketId || !tag) throw new Error('bucketId/tag missing');
  const p = new URLSearchParams({ bucketId, tag, start });
  if (measurement) p.set('measurement', measurement);
  if (field) p.set('field', field);
  if (filters && filters.length > 0) {
    p.set('filters', JSON.stringify(filters));
  }

  const r = await fetch(`/api/tag-values?${p.toString()}`, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || JSON.stringify(j));
  return Array.isArray(j) ? j : [];
}

// Structured query: send spec to backend to generate and execute Flux (/api/query/spec)
export async function runQuerySpec({ bucketId, spec, dry = false }) {
  if (!bucketId || !spec) throw new Error('bucketId/spec missing');
  const r = await fetch('/api/query/spec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId, spec, dry })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || JSON.stringify(j));
  return j; // => { flux, rows }
}
