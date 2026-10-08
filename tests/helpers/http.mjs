// Small HTTP helpers shared by the server tests.
import net from 'node:net';
import { readFileSync } from 'node:fs';

export const loadFixture = name =>
  JSON.parse(readFileSync(new URL(`../../fixtures/scenarios/${name}`, import.meta.url), 'utf8'));

// Sends bytes exactly as given (fetch would normalize the URL) and returns the status, or null if the socket died.
export function rawRequest(baseUrl, text) {
  const { hostname, port } = new URL(baseUrl);
  return new Promise(resolve => {
    const sock = net.connect(Number(port), hostname, () => sock.write(text));
    let data = '';
    sock.on('data', d => (data += d));
    sock.on('error', () => resolve(null));
    sock.on('close', () => resolve(Number(data.match(/^HTTP\/1\.1 (\d+)/)?.[1]) || null));
    sock.setTimeout(3000, () => sock.destroy());
  });
}

export async function postGrade(baseUrl, body) {
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/api/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { status: res.status, json: await res.json(), ms: Date.now() - t0 };
}

export async function getJson(url) {
  const t0 = Date.now();
  const res = await fetch(url);
  return { status: res.status, json: await res.json(), ms: Date.now() - t0 };
}
