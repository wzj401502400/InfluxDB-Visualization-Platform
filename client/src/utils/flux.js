// client/src/utils/flux.js
export function sanitizeFlux(s) {
  return (s || '').replaceAll('＞','>').replaceAll('＜','<').replaceAll('｜','|').replaceAll('‖','|');
}

// 从 UI 选择生成结构化的 QuerySpec（交给后端去编译和执行）
export function buildQuerySpecFromUI({
  measurement,
  field,                 // 或 fields: string[]
  tags = [],             // 新的tags数组结构，每个元素为 {key, op, value}
  range = '-24h',        // Flux duration 字面量
  groupBy = [],          // 可选
  aggregate = { every: '1m', fn: 'mean' } // 可选
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
