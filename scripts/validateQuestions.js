#!/usr/bin/env node
/**
 * validateQuestions.js
 * Validates all question files against the schema rules.
 *
 * Usage:
 *   node scripts/validateQuestions.js [--fix]
 *
 * Options:
 *   --fix   Auto-fix normalizable issues (trim whitespace, fix questionType casing)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DATA_ROOT = join(REPO_ROOT, 'data', 'questions');
const FIX       = process.argv.includes('--fix');

const VALID_TYPES = new Set(['single-select','multiple-select','integer','match','subjective','true-false']);
const VALID_DIFF  = new Set(['easy','medium','hard']);
const REQUIRED    = ['id','exam','subject','chapter','topic','paperId','paperTitle','questionType','question_text','correct_answer','year'];

// Type aliases that can be auto-fixed
const TYPE_MAP = {
  'mcq': 'single-select', 'single': 'single-select', 'singleselect': 'single-select',
  'multiple': 'multiple-select', 'multiselect': 'multiple-select',
  'numerical': 'integer', 'number': 'integer',
};

let totalErrors = 0;
let totalWarnings = 0;
let totalFixed = 0;
let filesWithErrors = 0;

function validateQuestion(q, idx, filepath) {
  const errors   = [];
  const warnings = [];
  const fixes    = [];

  // Required fields
  REQUIRED.forEach(f => { if (!q[f] && q[f] !== 0) errors.push(`Missing required field: ${f}`); });

  // questionType
  if (q.questionType) {
    const t = q.questionType.trim().toLowerCase();
    if (VALID_TYPES.has(t)) {
      if (FIX && q.questionType !== t) { q.questionType = t; fixes.push(`questionType normalised to "${t}"`); }
    } else if (TYPE_MAP[t]) {
      if (FIX) { q.questionType = TYPE_MAP[t]; fixes.push(`questionType "${q.questionType}" auto-fixed to "${TYPE_MAP[t]}"`); }
      else      errors.push(`Unknown questionType: "${q.questionType}". Did you mean "${TYPE_MAP[t]}"?`);
    } else {
      errors.push(`Invalid questionType: "${q.questionType}". Valid: ${[...VALID_TYPES].join(', ')}`);
    }
  }

  // difficulty
  if (q.difficulty && !VALID_DIFF.has(q.difficulty.toLowerCase())) {
    errors.push(`Invalid difficulty: "${q.difficulty}". Valid: easy, medium, hard`);
  }

  // year
  if (typeof q.year !== 'number' || !Number.isInteger(q.year)) {
    errors.push(`year must be an integer, got: ${JSON.stringify(q.year)}`);
  }

  // explanations
  if (!Array.isArray(q.explanations)) {
    warnings.push('explanations should be an array');
  }

  // correct_answer for multiple-select should be array
  if (q.questionType === 'multiple-select' && typeof q.correct_answer === 'string') {
    warnings.push('correct_answer for multiple-select should be an array');
  }

  // Whitespace trimming in slug fields
  ['exam','subject','chapter','topic','paperId'].forEach(f => {
    if (typeof q[f] === 'string' && q[f] !== q[f].trim()) {
      if (FIX) { q[f] = q[f].trim().toLowerCase(); fixes.push(`trimmed whitespace in ${f}`); }
      else warnings.push(`Whitespace in field: ${f} = "${q[f]}"`);
    }
  });

  return { errors, warnings, fixes };
}

function processFile(filePath) {
  let questions;
  try { questions = JSON.parse(readFileSync(filePath, 'utf8')); }
  catch (e) { console.error(`  ERROR: Cannot parse ${filePath}: ${e.message}`); filesWithErrors++; return; }
  if (!Array.isArray(questions)) { console.error(`  ERROR: Not an array: ${filePath}`); filesWithErrors++; return; }

  let fileErrors   = 0;
  let fileWarnings = 0;
  let fileFixes    = 0;

  questions.forEach((q, idx) => {
    const { errors, warnings, fixes } = validateQuestion(q, idx, filePath);
    errors.forEach(e   => console.error(`  [Q${idx}] ERROR:   ${e}`));
    warnings.forEach(w => console.warn(`  [Q${idx}] WARN:    ${w}`));
    fixes.forEach(f    => console.log(`  [Q${idx}] FIXED:   ${f}`));
    fileErrors   += errors.length;
    fileWarnings += warnings.length;
    fileFixes    += fixes.length;
  });

  if (FIX && fileFixes > 0) {
    writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf8');
  }

  totalErrors   += fileErrors;
  totalWarnings += fileWarnings;
  totalFixed    += fileFixes;
  if (fileErrors > 0) filesWithErrors++;

  return { fileErrors, fileWarnings, fileFixes };
}

// Walk all question files
let totalFiles = 0;
for (const exam of readdirSync(DATA_ROOT).sort()) {
  const examDir = join(DATA_ROOT, exam);
  if (!statSync(examDir).isDirectory()) continue;
  for (const year of readdirSync(examDir).sort()) {
    const yearDir = join(examDir, year);
    if (!statSync(yearDir).isDirectory()) continue;
    for (const file of readdirSync(yearDir).sort()) {
      if (!file.endsWith('.json')) continue;
      const fp = join(yearDir, file);
      const rel = relative(REPO_ROOT, fp).replace(/\\/g, '/');
      process.stdout.write(`Validating ${rel}... `);
      const r = processFile(fp);
      if (r) {
        const status = r.fileErrors > 0 ? `FAIL (${r.fileErrors} errors)` : r.fileWarnings > 0 ? `WARN (${r.fileWarnings})` : 'OK';
        console.log(status);
      }
      totalFiles++;
    }
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`Files validated : ${totalFiles}`);
console.log(`Files with errors: ${filesWithErrors}`);
console.log(`Total errors    : ${totalErrors}`);
console.log(`Total warnings  : ${totalWarnings}`);
if (FIX) console.log(`Total fixed     : ${totalFixed}`);
console.log(totalErrors === 0 ? '\n✅ All questions valid!' : '\n❌ Validation failed. Fix errors and re-run.');
process.exit(totalErrors > 0 ? 1 : 0);
