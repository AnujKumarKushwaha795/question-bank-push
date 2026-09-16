#!/usr/bin/env node
/**
 * addQuestion.js
 * Adds a single question to the repo, then rebuilds indexes.
 *
 * Usage (interactive):
 *   node scripts/addQuestion.js
 *
 * Usage (pipe JSON):
 *   echo '{"id":"...","exam":"jee-main",...}' | node scripts/addQuestion.js
 *   cat question.json | node scripts/addQuestion.js
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const VALID_TYPES = ['single-select','multiple-select','integer','match','subjective','true-false'];
const VALID_DIFF  = ['easy','medium','hard'];

function validateQuestion(q) {
  const errors = [];
  ['id','exam','subject','chapter','topic','paperId','paperTitle','questionType','question_text','correct_answer','year'].forEach(
    f => { if (!q[f] && q[f] !== 0) errors.push(`Missing: ${f}`); }
  );
  if (q.questionType && !VALID_TYPES.includes(q.questionType)) errors.push(`Invalid questionType: ${q.questionType}`);
  if (q.difficulty   && !VALID_DIFF.includes(q.difficulty))   errors.push(`Invalid difficulty: ${q.difficulty}`);
  if (!Number.isInteger(q.year))                              errors.push(`year must be integer`);
  return errors;
}

async function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

let question;

// Try reading from stdin if not a TTY
if (!process.stdin.isTTY) {
  const raw = await readStdin();
  try { question = JSON.parse(raw.trim()); }
  catch { console.error('Invalid JSON on stdin'); process.exit(1); }
} else {
  console.log('Paste the question JSON (then press Ctrl+D when done):');
  const raw = await readStdin();
  try { question = JSON.parse(raw.trim()); }
  catch { console.error('Invalid JSON'); process.exit(1); }
}

// Validate
const errors = validateQuestion(question);
if (errors.length) {
  console.error('Validation errors:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}

// Find destination file
const { exam, year, paperId } = question;
const yearStr  = String(parseInt(year, 10));
const destDir  = join(REPO_ROOT, 'data', 'questions', exam, yearStr);
const destFile = join(destDir, `${paperId}.json`);

// Load or create paper file
let questions = [];
if (existsSync(destFile)) {
  questions = JSON.parse(readFileSync(destFile, 'utf8'));
  const existing = questions.findIndex(q => q.id === question.id);
  if (existing >= 0) {
    console.error(`Question ID "${question.id}" already exists in ${paperId}. Use updateQuestion.js instead.`);
    process.exit(1);
  }
}

// Stamp timestamps
question.createdAt = question.createdAt || new Date().toISOString();
question.updatedAt = new Date().toISOString();

// Append
questions.push(question);
mkdirSync(destDir, { recursive: true });
writeFileSync(destFile, JSON.stringify(questions, null, 2), 'utf8');

console.log(`✅ Added question "${question.id}" to ${exam}/${yearStr}/${paperId}.json (${questions.length} questions total)`);

// Rebuild
console.log('Rebuilding indexes...');
execSync('node scripts/rebuildIndexes.js', { cwd: REPO_ROOT, stdio: 'inherit' });
