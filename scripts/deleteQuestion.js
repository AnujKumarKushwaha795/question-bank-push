#!/usr/bin/env node
/**
 * deleteQuestion.js
 * Removes a question by ID from its paper file, then rebuilds indexes.
 *
 * Usage:
 *   node scripts/deleteQuestion.js <questionId>
 *   node scripts/deleteQuestion.js <questionId> --confirm
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const INDEXES   = join(REPO_ROOT, 'data', 'indexes');

const questionId = process.argv[2];
const CONFIRMED  = process.argv.includes('--confirm');

if (!questionId) {
  console.error('Usage: node scripts/deleteQuestion.js <questionId> [--confirm]');
  process.exit(1);
}

// Find via index
const byId  = JSON.parse(readFileSync(join(INDEXES, 'questions-by-id.json'), 'utf8'));
const entry = byId[questionId];
if (!entry) { console.error(`Question "${questionId}" not found in index`); process.exit(1); }

const filePath = join(REPO_ROOT, entry.file);
const questions = JSON.parse(readFileSync(filePath, 'utf8'));
const q = questions[entry.index];

console.log(`\nQuestion to delete:`);
console.log(`  ID      : ${q.id}`);
console.log(`  Paper   : ${q.paperTitle}`);
console.log(`  Subject : ${q.subject} / ${q.chapter}`);
console.log(`  File    : ${entry.file}  (${questions.length} questions)`);

// Prompt if not confirmed
if (!CONFIRMED) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => rl.question('\nAre you sure? Type "yes" to confirm: ', resolve));
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') { console.log('Aborted.'); process.exit(0); }
}

// Delete
const filtered = questions.filter(q => q.id !== questionId);
writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf8');
console.log(`\n✅ Deleted question "${questionId}". Paper now has ${filtered.length} questions.`);

// Rebuild
console.log('Rebuilding indexes...');
execSync('node scripts/rebuildIndexes.js', { cwd: REPO_ROOT, stdio: 'inherit' });
