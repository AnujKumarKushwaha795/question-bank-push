#!/usr/bin/env node
/**
 * updateQuestion.js
 * Updates an existing question by ID with a partial patch object.
 *
 * Usage:
 *   node scripts/updateQuestion.js <questionId> <patchFile.json>
 *   node scripts/updateQuestion.js <questionId> '{"difficulty":"hard"}'
 *
 * The patch is merged (shallow) into the existing question.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const INDEXES   = join(REPO_ROOT, 'data', 'indexes');

const [,, questionId, patchArg] = process.argv;

if (!questionId || !patchArg) {
  console.error('Usage: node scripts/updateQuestion.js <questionId> <patchFile.json|patchJSON>');
  process.exit(1);
}

// Parse patch
let patch;
try {
  patch = patchArg.endsWith('.json') && existsSync(patchArg)
    ? JSON.parse(readFileSync(patchArg, 'utf8'))
    : JSON.parse(patchArg);
} catch { console.error('Invalid patch JSON'); process.exit(1); }

// Find question via index
const byId = JSON.parse(readFileSync(join(INDEXES, 'questions-by-id.json'), 'utf8'));
const entry = byId[questionId];
if (!entry) { console.error(`Question "${questionId}" not found in index`); process.exit(1); }

const filePath = join(REPO_ROOT, entry.file);
if (!existsSync(filePath)) { console.error(`Paper file not found: ${filePath}`); process.exit(1); }

const questions = JSON.parse(readFileSync(filePath, 'utf8'));
const idx = questions.findIndex(q => q.id === questionId);
if (idx < 0) {
  console.error(`Question "${questionId}" not found in file (index mismatch). Run rebuildIndexes.js.`);
  process.exit(1);
}

// Apply patch (prevent overwriting id)
delete patch.id;
questions[idx] = { ...questions[idx], ...patch, updatedAt: new Date().toISOString() };

writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf8');
console.log(`✅ Updated question "${questionId}" in ${entry.file}`);
console.log('Changed fields:', Object.keys(patch).join(', '));

// Rebuild
console.log('Rebuilding indexes...');
execSync('node scripts/rebuildIndexes.js', { cwd: REPO_ROOT, stdio: 'inherit' });
