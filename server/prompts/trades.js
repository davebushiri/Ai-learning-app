// Adding a trade = adding an entry here (plus, ideally, a cached fixture for demo safety).
// `brief` is what the scenario prompt asks Claude to build a job around.
// `criticalHints` (optional, falls back to hazardHints) are areas where a
// mistake can seriously hurt someone; one is picked at random per scenario.
// `twists` (optional) are short jobsite complications; one is picked per scenario.

export const TRADES = {
  electrical: {
    label: 'Electrical: replace a receptacle',
    brief: 'A first-year electrical apprentice replaces a countertop receptacle near a kitchen sink in an occupied home.',
    hazardHints: 'lockout / verifying de-energized (live-dead-live), GFCI requirements near water, terminations, box fill, grounding',
    criticalHints: [
      'verifying the circuit is dead before touching it',
      'shock protection near water',
      'grounding and the equipment ground',
      'a second circuit or shared neutral in the same box'
    ],
    twists: [
      'the homeowner is cooking dinner and wants the kitchen back fast',
      'the panel directory is faded and half the labels are guesses',
      'the box is old metal with cloth-covered wiring',
      'a handyman did the last repair and it shows',
      'the countertop backsplash is tile and the box is set deep',
      'the homeowner keeps asking if the dishwasher will still work'
    ],
    fixture: 'electrical.json'
  },
  hvac: {
    label: 'HVAC: braze a suction line',
    brief: 'An HVAC apprentice brazes a replacement section of copper suction line on a residential split system outdoors.',
    hazardHints: 'hot work and fire prevention, nitrogen purge while brazing, heat protection of valves, refrigerant recovery, pressure and vacuum testing',
    criticalHints: [
      'hot work and fire prevention',
      'opening or heating a line that still holds refrigerant or pressure',
      'pressure testing with the right gas through a regulator',
      'electrical disconnect at the condenser before working on it'
    ],
    twists: [
      'it is ninety five degrees out and the customer wants cooling today',
      'the condenser is tight against a wooden fence',
      'the leak is right next to the service valves',
      'the nitrogen bottle is almost empty',
      'it is windy and the torch flame keeps getting pushed around',
      'the homeowner\'s kids are playing in the yard'
    ],
    fixture: 'brazing.json'
  },
  automotive: {
    label: 'Automotive: front brake job',
    brief: 'An automotive apprentice replaces front brake pads and rotors on a sedan in a small shop with no lift available.',
    hazardHints: 'vehicle support (jack stands), caliper and hose handling, brake dust, torque specs, pumping the pedal and road testing',
    criticalHints: [
      'vehicle support and jack stands',
      'a firm brake pedal before the car moves',
      'wheel and lug nut tightening',
      'caliper and bracket fasteners'
    ],
    twists: [
      'the customer is waiting in the lobby and asks for it in an hour',
      'one of the caliper slide pins is seized',
      'the rotors are rusted onto the hubs',
      'the shop is out of the right brake cleaner',
      'the car has an electronic parking brake',
      'the lug nuts were put on with an impact last time and are stuck'
    ],
    fixture: 'brakes.json'
  }
};

export function listTrades() {
  return Object.entries(TRADES).map(([id, t]) => ({ id, label: t.label }));
}
