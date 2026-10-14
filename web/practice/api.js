// Practice API calls (F1c-T04 routes). Thin on purpose: one helper, one line per route.
const TIMEOUT_MS = 12000;

// The request never got an HTTP answer: offline, reset, or the 12 s deadline passed.
export class NetworkError extends Error {
  constructor(cause) { super('network error', { cause }); this.name = 'NetworkError'; }
}

// The server answered with a non-2xx status.
export class ApiError extends Error {
  constructor(status, message) { super(message || `HTTP ${status}`); this.name = 'ApiError'; this.status = status; }
}

async function call(url, body) {
  const init = { signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (body !== undefined) {
    init.method = 'POST';
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new NetworkError(err);
  }
  let data = null;
  try { data = await res.json(); } catch (err) { if (res.ok) throw new NetworkError(err); }
  if (!res.ok) throw new ApiError(res.status, data?.error);
  return data;
}

const enc = encodeURIComponent;
const attempt = id => `/api/practice/attempts/${enc(id)}`;

export const fetchTracks = () => call('/api/practice/tracks');
export const fetchTrack = id => call(`/api/practice/tracks/${enc(id)}`);
export const startAttempt = body => call('/api/practice/attempts', body);
export const postStop = (id, body) => call(`${attempt(id)}/stops`, body);
export const postAssist = id => call(`${attempt(id)}/assist`, {});
export const postComplete = (id, body) => call(`${attempt(id)}/complete`, body);
export const postSelfRating = (id, body) => call(`${attempt(id)}/self-ratings`, body);
