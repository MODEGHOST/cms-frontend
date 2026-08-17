/** Short-lived in-memory cache so repeated dashboard/modal requests skip the network. */

const store = new Map();
const inflight = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 80;

function pruneExpired(now = Date.now()) {
  for (const [key, hit] of store) {
    if (now > hit.expires) store.delete(key);
  }
}

function evictOldestIfNeeded() {
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest == null) break;
    store.delete(oldest);
  }
}

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
  const now = Date.now();
  if (store.size > MAX_ENTRIES) pruneExpired(now);
  store.set(key, { value, expires: now + ttlMs });
  evictOldestIfNeeded();
  return value;
}

export function cacheGetOrSet(key, loader, ttlMs = DEFAULT_TTL_MS) {
  const cached = cacheGet(key);
  if (cached != null) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = Promise.resolve()
    .then(loader)
    .then((value) => cacheSet(key, value, ttlMs))
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}
