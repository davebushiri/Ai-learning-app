// The only place that chooses the AI module. It reads the environment when first
// imported, so server/index.js loads .env before importing anything that imports this.
//
// MOCK mode (no ANTHROPIC_API_KEY, or MOCK=1) serves fixtures and keyword grading.
export const MOCK = process.env.MOCK === '1' || !process.env.ANTHROPIC_API_KEY;

// Only load the SDK when we actually need it.
export const ai = MOCK ? null : await import('../llm.js');
