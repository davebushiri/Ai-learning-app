#!/usr/bin/env node
// F1a-T11: `npm run check:ticket <ticketId> [--base <ref>]` compares the files a branch changed
// with the ticket's `Files:` line in docs/specs/*/tasks.md (CLAUDE.md "Definition of done":
// only the files listed in the ticket were touched). Not part of `npm test`.
//
// Exit 0: every changed file is listed (or always allowed). Exit 1: unknown or malformed
// ticket id, or extra files (each printed). Exit 2: git missing or failing; QA then lists the
// changed files by hand in the QA report.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TICKET_ID = /^F1a-T\d\d[a-d]?$/;
export const GIT_UNAVAILABLE = 'git unavailable: list changed files by hand in the QA report';

// Edits any ticket may make (F1a-T11 Interfaces): the deny-list ratchet and QA's todo removals.
export const ALWAYS_ALLOWED = [
  'tests/fixtures/deny-list-allow.json',
  'tests/acceptance/F1a.test.js',
  'tests/e2e/F1a.e2e.mjs',
];

// `[{file, text}]` for every docs/specs/*/tasks.md under `root`.
export function readTasks(root = SCRIPT_ROOT) {
  const specs = path.join(root, 'docs', 'specs');
  if (!existsSync(specs)) return [];
  return readdirSync(specs, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(path.join(specs, d.name, 'tasks.md')))
    .map(d => {
      const file = path.join(specs, d.name, 'tasks.md');
      return { file, text: readFileSync(file, 'utf8') };
    });
}

// The backticked paths of the ticket's first `Files:` line, or undefined when no `### <id>`
// heading exists. The id must be followed by a space or the line end, so `F1a-T07` never
// matches `F1a-T07a`. Parenthesised commentary ("(an `after` hook only)") is dropped.
export function findTicketFiles(tasks, id) {
  const heading = new RegExp(`^###\\s+${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
  for (const { text } of tasks) {
    const lines = text.split('\n');
    const start = lines.findIndex(l => heading.test(l));
    if (start < 0) continue;
    for (let i = start + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]); i++) {
      const m = lines[i].match(/^\s*-\s+\*\*Files:\*\*(.*)$/);
      if (!m) continue;
      const body = m[1].replace(/\([^()]*\)/g, '');
      return [...body.matchAll(/`([^`]+)`/g)].map(x => x[1].trim());
    }
    return [];
  }
  return undefined;
}

// A listed entry may use `*` (one segment) or `**` (any depth).
function entryToRegExp(entry) {
  let re = '';
  for (let i = 0; i < entry.length; i++) {
    if (entry.startsWith('**', i)) { re += '.*'; i += 1; continue; }
    const c = entry[i];
    re += c === '*' ? '[^/]*' : c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

// Changed files that neither the ticket lists nor ALWAYS_ALLOWED covers, sorted.
export function compareFiles(changed, listed) {
  const res = [...listed, ...ALWAYS_ALLOWED].map(entryToRegExp);
  return [...new Set(changed)].filter(f => !res.some(r => r.test(f))).sort();
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function changedFiles(base, cwd) {
  const lines = s => s.split('\n').map(x => x.trim()).filter(Boolean);
  return [...lines(git(['diff', '--name-only', base], cwd)), ...lines(git(['ls-files', '-o', '--exclude-standard'], cwd))];
}

function parseArgs(argv) {
  const out = { id: undefined, base: 'main' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') out.base = argv[++i];
    else if (out.id === undefined) out.id = argv[i];
    else return { error: `unexpected argument: ${argv[i]}` };
  }
  if (!out.base) return { error: '--base needs a ref' };
  return out;
}

export function main(argv, { cwd = process.cwd(), out = console.log, err = console.error } = {}) {
  const usage = 'usage: check-ticket <ticketId> [--base <ref>]';
  const args = parseArgs(argv);
  if (args.error) { err(`${args.error}\n${usage}`); return 1; }
  if (!args.id || !TICKET_ID.test(args.id)) {
    err(`ticket id must match ${TICKET_ID.source}, got ${JSON.stringify(args.id ?? '')}\n${usage}`);
    return 1;
  }
  let root;
  let changed;
  try {
    root = git(['rev-parse', '--show-toplevel'], cwd).trim();
    changed = changedFiles(args.base, root);
  } catch {
    err(GIT_UNAVAILABLE);
    return 2;
  }
  const listed = findTicketFiles(readTasks(root), args.id);
  if (listed === undefined) { err(`unknown ticket: ${args.id} (no "### ${args.id}" heading in docs/specs/*/tasks.md)`); return 1; }
  if (!listed.length) { err(`${args.id} has no Files: line`); return 1; }
  const extra = compareFiles(changed, listed);
  if (extra.length) {
    err(`${args.id}: ${extra.length} file(s) changed against ${args.base} but not in its Files line:`);
    for (const f of extra) err(`  ${f}`);
    return 1;
  }
  out(`${args.id}: ok, ${new Set(changed).size} changed file(s) against ${args.base}, all listed`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
