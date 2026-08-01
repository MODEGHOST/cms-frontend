/** Short-lived in-memory cache so repeated dashboard/modal requests skip the network. */

const store = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function cacheKey(prefix, params = {}) {
  return `${prefix}:${JSON.stringify(params)}`;
}

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function cacheGetOrSet(key, loader, ttlMs = DEFAULT_TTL_MS) {
  const cached = cacheGet(key);
  if (cached != null) return Promise.resolve(cached);
  return Promise.resolve(loader()).then((value) => cacheSet(key, value, ttlMs));
}
