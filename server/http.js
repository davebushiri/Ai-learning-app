// HTTP helpers shared by server/index.js and the route modules.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY_BYTES = 1_000_000;

const STATIC_DIRS = { '/shared/': 'shared', '/': 'web' };
export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

// Thrown for bad client input; the handler turns it into that status code.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': MIME['.json'] });
  res.end(JSON.stringify(data));
}

export async function readBody(req) {
  const chunks = [];
  let bytes = 0;
  // Keep draining past the limit so the client gets the 413 instead of a reset.
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  if (bytes > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'body is not valid JSON');
  }
}

export async function serveStatic(res, pathname) {
  const prefix = Object.keys(STATIC_DIRS).find(p => pathname.startsWith(p));
  const base = path.join(ROOT, STATIC_DIRS[prefix]);
  const rel = pathname.slice(prefix.length) || 'index.html';
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}
