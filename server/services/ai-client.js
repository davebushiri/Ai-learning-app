// The only place that builds the model client and the gateway. It (and ai/models.js)
// reads the environment when first imported, so server/index.js loads .env before
// importing anything that imports this.
//
// MOCK mode (no ANTHROPIC_API_KEY, or MOCK=1) serves fixtures and keyword grading.
import Anthropic from '@anthropic-ai/sdk';
import { createGateway } from '../ai/gateway.js';
import { getDb } from '../db.js';

export const MOCK = process.env.MOCK === '1' || !process.env.ANTHROPIC_API_KEY;

// No client in MOCK: the gateway never calls it when live is false.
const client = MOCK ? null : new Anthropic();

// getDb() is read per call, so importing this module never needs the DB open.
export const gateway = createGateway({ client, logCall: (row) => getDb().logLlmCall(row) });
