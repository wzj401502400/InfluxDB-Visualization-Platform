// client/src/utils/flux.js
export function sanitizeFlux(s) {
  return (s || '').replaceAll('＞','>').replaceAll('＜','<').replaceAll('｜','|').replaceAll('‖','|');
}

// Build a structured QuerySpec from UI selections (sent to backend for compilation and execution)
export function buildQuerySpecFromUI({
  measurement,
  field,                 // or fields: string[]
  tags = [],             // Array of tag filters, each element is {key, op, value}
  range = '-24h',        // Flux duration literal
  groupBy = [],          // optional
  aggregate = { every: '1m', fn: 'mean' } // optional
}) {
  const fields = Array.isArray(field) ? field : field ? [field] : [];
  return {
    time: { start: range },
    measurement,
    fields,
    tags,
    groupBy,
    aggregate
  };
}
