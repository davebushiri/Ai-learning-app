// F1a-T11 / FR-039: every path in the repo has exactly one owner, parsed from the
// "File ownership" table in CLAUDE.md. Paths come from `git ls-files -co --exclude-standard`
// (tracked plus untracked-not-ignored, so a file a ticket just created is checked before it is
// committed). Without git, or when git exits non-zero, the lister walks the filesystem, emits
// a TAP diagnostic and the test still asserts: it never skips (SC-004 requires `# skipped 0`).
//
// The CLAUDE.md table belongs to the founder. A failure here is a bug to file against the
// spec, never a reason to edit CLAUDE.md or loosen this test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_TICKET = path.join(ROOT, 'tests', 'tools', 'check-ticket.mjs');
const SELF = 'tests/ownership.test.js';
export const WALK_DIAGNOSTIC = 'ownership: git unavailable, used filesystem walk';
const GIT_UNAVAILABLE = 'git unavailable: list changed files by hand in the QA report';

// ---------------------------------------------------------------------------------------------
// Table parser
//
// Parse rules (F1a-T11 Interfaces):
// - each backticked token in the Path cell is a glob; `<id>` is one path segment;
// - `dir/` and `dir/**` mean everything below `dir`;
// - tokens inside "(except …)" exclude paths from the preceding glob; a bare token there is
//   relative to that glob's directory (`scripts/` (except `eval-prompts.js`));
// - any other parenthesised text is commentary and ignored;
// - a token without `/` is relative to the directory of the previous token in the same cell
//   (`docs/specs/<id>/spec.md`, `tasks.md`). "Directory" is read as the parent of a concrete
//   file token. After a wildcard or directory token (`packs/**`, `README.md`) the bare token
//   is repo-root relative; the literal path.dirname reading would turn README.md into
//   packs/README.md and DEMO.md into docs/team/templates/DEMO.md (filed as F1a-B50).
// - owner = the first backticked token in the Owner cell, else its first word lowercased.

function globToRegExp(glob) {
  let g = glob.endsWith('/') ? `${glob}**` : glob;
  let re = '';
  for (let i = 0; i < g.length; i++) {
    if (g.startsWith('<id>', i)) { re += '[^/]+'; i += 3; continue; }
    if (g.startsWith('/**', i) && i + 3 === g.length) { re += '/.+'; i += 2; continue; }
    if (g.startsWith('**/', i)) { re += '(?:[^/]+/)*'; i += 2; continue; }
    if (g.startsWith('**', i)) { re += '.*'; i += 1; continue; }
    const c = g[i];
    if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const isConcreteFile = tok => !tok.endsWith('/') && !/[*?]/.test(tok.split('/').pop());
const parentDir = tok => (tok.includes('/') ? tok.slice(0, tok.lastIndexOf('/') + 1) : '');
const globDir = tok => (tok.endsWith('/') ? tok : parentDir(tok));

function parsePathCell(cell) {
  const globs = [];
  let prev = null;
  const re = /\(except([^)]*)\)|\(([^)]*)\)|`([^`]+)`/g;
  for (const m of cell.matchAll(re)) {
    if (m[1] !== undefined) {
      if (!globs.length) throw new Error(`"(except …)" with no preceding glob in: ${cell}`);
      const target = globs[globs.length - 1];
      const toks = [...m[1].matchAll(/`([^`]+)`/g)].map(x => x[1]);
      if (!toks.length) throw new Error(`"(except …)" without a backticked path in: ${cell}`);
      for (const t of toks) {
        const full = t.includes('/') ? t : globDir(target.glob) + t;
        target.except.push(full);
        target.exceptRe.push(globToRegExp(full));
      }
      continue;
    }
    if (m[2] !== undefined) continue; // commentary, e.g. "(prompt text)"
    const tok = m[3];
    const full = tok.includes('/') || prev === null || !isConcreteFile(prev) ? tok : parentDir(prev) + tok;
    globs.push({ glob: full, re: globToRegExp(full), except: [], exceptRe: [] });
    prev = full;
  }
  return globs;
}

function parseOwner(cell) {
  const tick = cell.match(/`([^`]+)`/);
  if (tick) return tick[1].trim();
  const word = cell.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z-]/g, '');
  return word || null;
}

export function parseOwnershipTable(markdown) {
  const lines = markdown.split('\n');
  const start = lines.findIndex(l => /^##\s+File ownership\b/.test(l));
  if (start < 0) throw new Error('CLAUDE.md has no "## File ownership" heading');
  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith('|')) {
    if (lines[i].startsWith('#')) throw new Error('"File ownership" section has no table');
    i++;
  }
  const table = [];
  while (i < lines.length && lines[i].startsWith('|')) table.push(lines[i++]);
  if (table.length < 3) throw new Error('"File ownership" table has no rows');
  const cells = l => l.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(s => s.trim());
  const header = cells(table[0]);
  if (!/^path$/i.test(header[0]) || !/^owner/i.test(header[1] ?? '')) {
    throw new Error(`unexpected ownership table header: ${table[0]}`);
  }
  if (!/^[\s|:-]+$/.test(table[1])) throw new Error('ownership table has no separator row');
  const rows = [];
  for (const line of table.slice(2)) {
    const [pathCell, ownerCell] = cells(line);
    const globs = parsePathCell(pathCell ?? '');
    const owner = parseOwner(ownerCell ?? '');
    if (!globs.length) throw new Error(`ownership row has no backticked path: ${line}`);
    if (!owner) throw new Error(`ownership row has no owner: ${line}`);
    for (const g of globs) rows.push({ glob: g.glob, owner, except: g.except, re: g.re, exceptRe: g.exceptRe, row: rows.length ? undefined : 0, line });
  }
  // Number rows by source line so two globs of one row count as one owner.
  const lineIndex = new Map();
  for (const r of rows) {
    if (!lineIndex.has(r.line)) lineIndex.set(r.line, lineIndex.size);
    r.row = lineIndex.get(r.line);
  }
  return rows;
}

// Every row (by table line) that owns `p`.
export function ownersOf(p, rows) {
  const hits = new Map();
  for (const r of rows) {
    if (r.re.test(p) && !r.exceptRe.some(x => x.test(p))) hits.set(r.row, r.owner);
  }
  return [...hits.values()];
}

export function classify(paths, rows) {
  const unowned = [];
  const multiple = [];
  for (const p of paths) {
    const owners = ownersOf(p, rows);
    if (owners.length === 0) unowned.push(p);
    else if (owners.length > 1) multiple.push({ path: p, owners });
  }
  return { unowned, multiple };
}

function report({ unowned, multiple }) {
  return [
    unowned.length ? `no owner (${unowned.length}):\n  ${unowned.join('\n  ')}` : '',
    multiple.length ? `more than one owner (${multiple.length}):\n  ${multiple.map(m => `${m.path} -> ${m.owners.join(', ')}`).join('\n  ')}` : '',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------------------------
// Path lister

// Plain .gitignore lines only: no comments, negations or glob characters (FR-039).
function plainIgnorePatterns(root) {
  const file = path.join(root, '.gitignore');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split(/\r?\n/).map(s => s.trim())
    .filter(s => s && !s.startsWith('#') && !s.startsWith('!') && !/[*?[\]\\]/.test(s))
    .map(s => {
      const dirOnly = s.endsWith('/');
      const body = s.replace(/^\/+/, '').replace(/\/+$/, '');
      // git: a pattern with a slash before its end is anchored to the root.
      return { body, dirOnly, anchored: s.replace(/\/+$/, '').includes('/') };
    });
}

function ignored(rel, isDir, patterns) {
  const name = rel.split('/').pop();
  return patterns.some(p => (p.dirOnly && !isDir ? false : p.anchored ? rel === p.body : name === p.body));
}

function walk(root) {
  const patterns = plainIgnorePatterns(root);
  const out = [];
  const visit = rel => {
    for (const d of readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) {
        if (d.name === '.git' || d.name === 'node_modules' || ignored(r, true, patterns)) continue;
        visit(r);
      } else if (!ignored(r, false, patterns)) {
        out.push(r);
      }
    }
  };
  visit('');
  return out.sort();
}

// `{source: 'git' | 'walk', paths}`. `diagnostic` receives the walk message (pass t.diagnostic).
export function listPaths({ root = ROOT, env = process.env, diagnostic = () => {} } = {}) {
  try {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
      cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { source: 'git', paths: [...new Set(out.split('\0').filter(Boolean))].sort() };
  } catch {
    diagnostic(WALK_DIAGNOSTIC);
    return { source: 'walk', paths: walk(root) };
  }
}

// ---------------------------------------------------------------------------------------------
// Tests

const claudeMd = () => readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

test('CLAUDE.md ownership table parses', () => {
  const rows = parseOwnershipTable(claudeMd());
  assert.ok(rows.length > 0, 'no globs parsed');
  for (const r of rows) {
    assert.match(r.owner, /^[a-z][a-z-]*$/, `owner of ${r.glob} is not a role: ${r.owner}`);
    assert.ok(!/\s/.test(r.glob), `glob with whitespace: ${r.glob}`);
  }
  // Each parse rule, checked on the real table with hypothetical paths.
  const one = p => ownersOf(p, rows);
  assert.deepEqual(one('docs/specs/F9-x/tasks.md'), ['technical-product-manager'], 'bare token after a file = sibling');
  assert.deepEqual(one('docs/specs/F9-x/spec.md'), ['technical-product-manager'], '<id> = one segment');
  assert.deepEqual(one('docs/specs/a/b/spec.md'), [], '<id> must not span two segments');
  assert.deepEqual(one('tests/fixtures/recorded/grade@2.json'), ['evals-engineer'], '(except) on tests/**');
  assert.deepEqual(one('scripts/eval-prompts.js'), ['evals-engineer'], '(except) bare token is relative to its glob');
  assert.deepEqual(one('scripts/simulate.js'), ['backend-engineer'], 'dir/ = everything below');
  assert.deepEqual(one('docs/adr/0009-x.md'), ['principal-architect']);
  assert.deepEqual(one('docs/team/threads/0009-x.md'), ['everyone'], 'first word lowercased');
  assert.deepEqual(one('CLAUDE.md'), ['founder']);
  assert.deepEqual(one('README.md'), ['backend-engineer'], 'bare token after a dir glob is root-relative');
  assert.deepEqual(one('DEMO.md'), ['founder'], 'bare token after a dir glob is root-relative');
  assert.deepEqual(one('package-lock.json'), ['backend-engineer'], '* inside a segment');
  assert.deepEqual(one('server/prompts/grade.js'), ['backend-engineer'], 'two globs of one row are one owner');

  assert.throws(() => parseOwnershipTable('# CLAUDE.md\n\nno table here\n'), /File ownership/);
  assert.throws(() => parseOwnershipTable('## File ownership\n\n| Path | Owner |\n|---|---|\n| no ticks | `x` |\n'), /no backticked path/);
});

test('every listed path has exactly one owner', t => {
  const rows = parseOwnershipTable(claudeMd());
  const { source, paths } = listPaths({ diagnostic: m => t.diagnostic(m) });
  t.diagnostic(`ownership: ${paths.length} paths from ${source}`);
  assert.ok(paths.includes('CLAUDE.md') && paths.includes(SELF), 'lister missed known files');
  const result = classify(paths, rows);
  assert.deepEqual(result, { unowned: [], multiple: [] }, report(result));
});

test('unowned path is reported', () => {
  const rows = parseOwnershipTable(claudeMd());
  const result = classify(['CLAUDE.md', 'nowhere/orphan.txt', 'web/app.js', 'stray.txt'], rows);
  assert.deepEqual(result, { unowned: ['nowhere/orphan.txt', 'stray.txt'], multiple: [] });
  assert.match(report(result), /no owner \(2\):\n {2}nowhere\/orphan\.txt\n {2}stray\.txt/);
});

test('path matching two rows is reported', () => {
  const md = [
    '## File ownership', '',
    '| Path | Owner |', '|---|---|',
    '| `lib/**` | `backend-engineer` |',
    '| `lib/ui/button.js`, `x.md` | `frontend-engineer` |',
    '| `docs/` (except `private.md`) | Everyone |', '',
  ].join('\n');
  const rows = parseOwnershipTable(md);
  const result = classify(['lib/core.js', 'lib/ui/button.js', 'lib/ui/x.md', 'docs/private.md', 'docs/a.md'], rows);
  assert.deepEqual(result, {
    unowned: ['docs/private.md'],
    multiple: [{ path: 'lib/ui/button.js', owners: ['backend-engineer', 'frontend-engineer'] },
      { path: 'lib/ui/x.md', owners: ['backend-engineer', 'frontend-engineer'] }],
  });
  assert.match(report(result), /lib\/ui\/button\.js -> backend-engineer, frontend-engineer/);
});

test('without git: filesystem walk with a diagnostic, never skipped', t => {
  const rows = parseOwnershipTable(claudeMd());
  const gitPaths = listPaths().paths; // taken first; the walk must cover every one still on disk

  for (const env of [
    { ...process.env, PATH: '' }, // git missing
    { ...process.env, GIT_DIR: path.join(ROOT, 'no-such-git-dir') }, // git exits non-zero
  ]) {
    const seen = [];
    const { source, paths } = listPaths({ env, diagnostic: m => { seen.push(m); t.diagnostic(m); } });
    assert.equal(source, 'walk');
    assert.deepEqual(seen, [WALK_DIAGNOSTIC]);
    for (const known of ['CLAUDE.md', 'package.json', '.gitignore', SELF]) assert.ok(paths.includes(known), `walk missed ${known}`);
    const leaked = paths.filter(p => /^(\.git|node_modules|data)\//.test(p) || p.split('/').includes('node_modules') || p === '.env');
    assert.deepEqual(leaked, [], 'walk must exclude .git/, node_modules/ and plain .gitignore lines');
    const missing = gitPaths.filter(p => !paths.includes(p) && existsSync(path.join(ROOT, p)));
    assert.deepEqual(missing, [], 'walk missed files git lists');
    const result = classify(paths, rows);
    assert.deepEqual(result, { unowned: [], multiple: [] }, report(result));
  }
});

const runCheckTicket = (args, env = process.env) =>
  spawnSync(process.execPath, [CHECK_TICKET, ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 30_000 });

test('check-ticket exits 2 without git', () => {
  const r = runCheckTicket(['F1a-T20'], { ...process.env, PATH: '' });
  assert.equal(r.status, 2, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  assert.ok(r.stderr.includes(GIT_UNAVAILABLE), r.stderr);
});

test('check-ticket finds the Files line of a suffixed ticket (F1a-T07a) and rejects the bare F1a-T07', async () => {
  const { findTicketFiles, readTasks } = await import(CHECK_TICKET);
  const tasks = readTasks(ROOT);
  const t07a = findTicketFiles(tasks, 'F1a-T07a');
  assert.ok(Array.isArray(t07a), 'F1a-T07a heading not found');
  for (const f of ['server/packs.js', 'tests/pack.test.js', 'server/index.js']) assert.ok(t07a.includes(f), `T07a Files lacks ${f}`);
  assert.ok(!t07a.includes('shared/contract.js'), 'T07a picked up T07b\'s Files line');
  assert.ok(findTicketFiles(tasks, 'F1a-T07b').includes('shared/contract.js'));
  assert.equal(findTicketFiles(tasks, 'F1a-T07'), undefined);

  const bare = runCheckTicket(['F1a-T07']);
  assert.equal(bare.status, 1, bare.stderr);
  assert.match(bare.stderr, /unknown ticket/);
  const malformed = runCheckTicket(['F1a-T7']);
  assert.equal(malformed.status, 1, malformed.stderr);
  assert.match(malformed.stderr, /\^F1a-T\\d\\d\[a-d\]\?\$/);
});

test('check-ticket compare: extra files are reported; listed, globbed and always-allowed files pass', async () => {
  const { compareFiles } = await import(CHECK_TICKET);
  const listed = ['server/packs.js', 'tests/fixtures/golden/runs/*.json', 'web/speech.js'];
  assert.deepEqual(compareFiles(['server/packs.js', 'tests/fixtures/golden/runs/a.json', 'web/speech.js',
    'tests/fixtures/deny-list-allow.json', 'tests/acceptance/F1a.test.js', 'tests/e2e/F1a.e2e.mjs'], listed), []);
  assert.deepEqual(compareFiles(['server/packs.js', 'server/rogue.js', 'tests/fixtures/golden/runs/x/a.json'], listed),
    ['server/rogue.js', 'tests/fixtures/golden/runs/x/a.json']);
});
