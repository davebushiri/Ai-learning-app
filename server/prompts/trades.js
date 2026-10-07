// Adding a trade = adding an entry here (plus, ideally, a cached fixture for demo safety).
// `brief` is what the scenario prompt asks Claude to build a job around.

export const TRADES = {
  electrical: {
    label: 'Electrical: replace a receptacle',
    brief: 'A first-year electrical apprentice replaces a countertop receptacle near a kitchen sink in an occupied home.',
    hazardHints: 'lockout / verifying de-energized (live-dead-live), GFCI requirements near water, terminations, box fill, grounding',
    fixture: 'electrical.json'
  },
  hvac: {
    label: 'HVAC: braze a suction line',
    brief: 'An HVAC apprentice brazes a replacement section of copper suction line on a residential split system outdoors.',
    hazardHints: 'hot work and fire prevention, nitrogen purge while brazing, heat protection of valves, refrigerant recovery, pressure and vacuum testing',
    fixture: 'brazing.json'
  },
  automotive: {
    label: 'Automotive: front brake job',
    brief: 'An automotive apprentice replaces front brake pads and rotors on a sedan in a small shop with no lift available.',
    hazardHints: 'vehicle support (jack stands), caliper and hose handling, brake dust, torque specs, pumping the pedal and road testing',
    fixture: 'brakes.json'
  }
};

export function listTrades() {
  return Object.entries(TRADES).map(([id, t]) => ({ id, label: t.label }));
}
