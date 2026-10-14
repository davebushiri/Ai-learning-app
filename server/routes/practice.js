// Practice engine routes (ADR 0008; F1c-T04). Thin: parsing and dispatch only, logic is in
// server/services/practice.js. Matches only the exact paths below and returns false otherwise,
// so later route modules are still reached.

import { sendJson, readBody } from '../http.js';
import { getDb } from '../db.js';
import { listTracks } from '../services/practice-pack.js';
import { createPracticeService, trackSummary } from '../services/practice.js';

const TRACK_PATH = /^\/api\/practice\/tracks\/([^/]+)$/;
const ACTION_PATH = /^\/api\/practice\/attempts\/([^/]+)\/(stops|assist|complete|self-ratings)$/;

// Created on first use: getDb() needs initDb() to have run, which index.js does before listening.
let service = null;
const svc = () => (service ??= createPracticeService({ db: getDb() }));

const ACTIONS = {
  stops: (s, id, body) => s.submitStop(id, body),
  assist: (s, id) => s.assist(id),
  complete: (s, id, body) => s.complete(id, body),
  'self-ratings': (s, id, body) => s.selfRate(id, body)
};

export async function handle(req, res, url) {
  const p = url.pathname;
  if (req.method === 'GET' && p === '/api/practice/tracks') {
    sendJson(res, 200, listTracks());
    return true;
  }
  const track = req.method === 'GET' && p.match(TRACK_PATH);
  if (track) {
    let id;
    try { id = decodeURIComponent(track[1]); } catch { id = null; }
    const body = trackSummary(id);
    sendJson(res, body ? 200 : 404, body ?? { error: 'unknown track' });
    return true;
  }
  if (req.method === 'POST' && p === '/api/practice/attempts') {
    sendJson(res, 200, svc().startAttempt(await readBody(req)));
    return true;
  }
  const action = req.method === 'POST' && p.match(ACTION_PATH);
  if (action) {
    // Non-pra_ ids (att_ included) are 404 from the service, before the body matters.
    const body = await readBody(req);
    sendJson(res, 200, ACTIONS[action[2]](svc(), action[1], body));
    return true;
  }
  return false;
}
