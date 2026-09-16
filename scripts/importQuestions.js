#!/usr/bin/env node
/**
 * importQuestions.js
 * Imports an array of question objects from a source JSON file into the
 * correct paper file(s) in data/questions/<exam>/<year>/<paperId>.json.
 * After import, automatically rebuilds all indexes.
 *
 * Usage:
 *   node scripts/importQuestions.js <sourceFile.json> [--dry-run] [--no-rebuild]
 *
 * The source file must be a JSON array of question objects matching the schema.
 * Questions are grouped by paperId and written to the correct destination file.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const DRY_RUN    = process.argv.includes('--dry-run');
const NO_REBUILD = process.argv.includes('--no-rebuild');
const SOURCE     = process.argv.find(a => a.endsWith('.json') && !a.includes('scripts/'));

if (!SOURCE) {
  console.error('Usage: node scripts/importQuestions.js <sourceFile.json> [--dry-run] [--no-rebuild]');
  process.exit(1);
}

// ── Load and validate source ───────────────────────────────────────────────
let incoming;
try { incoming = JSON.parse(readFileSync(SOURCE, 'utf8')); }
catch (e) { console.error(`Cannot parse ${SOURCE}: ${e.message}`); process.exit(1); }
if (!Array.isArray(incoming)) { console.error('Source must be a JSON array'); process.exit(1); }

console.log(`Importing ${incoming.length} questions from ${SOURCE}...`);

// ── Group by paperId ───────────────────────────────────────────────────────
const groups = {};
const skipped = [];

incoming.forEach((q, idx) => {
  if (!q.paperId || !q.exam || !q.year) {
    skipped.push({ idx, reason: 'Missing paperId, exam, or year', q });
    return;
  }
  const key = q.paperId;
  if (!groups[key]) groups[key] = { exam: q.exam, year: parseInt(q.year, 10), questions: [] };
  groups[key].questions.push(q);
});

if (skipped.length) {
  console.warn(`\nSkipped ${skipped.length} questions with missing required fields:`);
  skipped.forEach(s => console.warn(`  [${s.idx}] ${s.reason}`));
}

// ── Write each paper file ──────────────────────────────────────────────────
let imported = 0;
let merged   = 0;
let created  = 0;

for (const [paperId, { exam, year, questions }] of Object.entries(groups)) {
  const destDir  = join(REPO_ROOT, 'data', 'questions', exam, String(year));
  const destFile = join(destDir, `${paperId}.json`);
  const relPath  = `data/questions/${exam}/${year}/${paperId}.json`;

  let existing = [];
  if (existsSync(destFile)) {
    try { existing = JSON.parse(readFileSync(destFile, 'utf8')); }
    catch { existing = []; }
    merged++;
  } else {
    created++;
  }

  // Merge: keep existing questions, add/update incoming ones (by id)
  const existingById = {};
  existing.forEach(q => { if (q.id) existingById[q.id] = q; });
  questions.forEach(q => {
    if (q.id) existingById[q.id] = { ...existingById[q.id], ...q, updatedAt: new Date().toISOString() };
  });
  const merged_arr = Object.values(existingById);

  console.log(`  ${existsSync(destFile) ? 'MERGE' : 'CREATE'} ${relPath}  (${merged_arr.length} questions total, +${questions.length} new)`);

  if (!DRY_RUN) {
    mkdirSync(destDir, { recursive: true });
    writeFileSync(destFile, JSON.stringify(merged_arr, null, 2), 'utf8');
  }
  imported += questions.length;
}

console.log(`\nImport complete:`);
console.log(`  Imported  : ${imported} questions`);
console.log(`  Created   : ${created} new paper files`);
console.log(`  Merged    : ${merged} existing paper files`);
if (DRY_RUN) console.log('\n[DRY RUN] No files were written.');

// ── Rebuild indexes ────────────────────────────────────────────────────────
if (!DRY_RUN && !NO_REBUILD) {
  console.log('\nRebuilding indexes...');
  execSync('node scripts/rebuildIndexes.js', { cwd: REPO_ROOT, stdio: 'inherit' });
}
