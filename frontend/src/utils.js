export function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key];
  }

  const firstArray = Object.values(value).find(Array.isArray);
  return firstArray || [];
}

export function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

export function money(value) {
  const number = Number(value ?? 0);
  if (Number.isNaN(number)) return 'N$0.00';
  return `N$${number.toFixed(2)}`;
}

export function labelize(value) {
  return String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusClass(status) {
  return String(status || '').toLowerCase().replaceAll('_', '-');
}

export function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
  return false;
}
