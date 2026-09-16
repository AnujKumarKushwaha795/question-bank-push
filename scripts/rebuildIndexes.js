#!/usr/bin/env node
/**
 * rebuildIndexes.js
 * Reads all question files from data/questions/<exam>/<year>/<paperId>.json
 * and rebuilds all 5 index files + 4 hierarchy files from scratch.
 *
 * Usage:
 *   node scripts/rebuildIndexes.js
 *
 * Requires Node.js 18+ (uses fs/promises, no external dependencies).
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DATA_ROOT = join(REPO_ROOT, 'data');
const INDEXES   = join(DATA_ROOT, 'indexes');
const HIERARCHY = join(DATA_ROOT, 'hierarchy');

[INDEXES, HIERARCHY].forEach(d => mkdirSync(d, { recursive: true }));

// ── Data structures ────────────────────────────────────────────────────────
const questionsById    = {};
const questionsByPaper = {};
const questionsBySubj  = {};
const questionsByTopic = {};
const papersIndex      = {};
const globalTree       = {};   // exam -> subj -> chapter -> Set<topic>

// ── Walk data/questions/<exam>/<year>/*.json ────────────────────────────────
const questionsRoot = join(DATA_ROOT, 'questions');
let totalQuestions  = 0;
let totalPapers     = 0;

for (const exam of readdirSync(questionsRoot).sort()) {
  const examDir = join(questionsRoot, exam);
  if (!statSync(examDir).isDirectory()) continue;

  for (const year of readdirSync(examDir).sort()) {
    const yearDir = join(examDir, year);
    if (!statSync(yearDir).isDirectory()) continue;

    for (const filename of readdirSync(yearDir).sort()) {
      if (!filename.endsWith('.json')) continue;
      const filePath = join(yearDir, filename);
      const relPath  = relative(REPO_ROOT, filePath).replace(/\\/g, '/');

      let questions;
      try { questions = JSON.parse(readFileSync(filePath, 'utf8')); }
      catch { console.warn(`SKIP (parse): ${filename}`); continue; }
      if (!Array.isArray(questions) || questions.length === 0) continue;

      totalPapers++;
      const q0         = questions[0];
      const paperId    = (q0.paperId    || '').trim();
      const paperTitle = (q0.paperTitle || '').trim();
      const yearNum    = parseInt(year, 10);

      // papers.json
      papersIndex[paperId] = { paperId, exam, year: yearNum, title: paperTitle, file: relPath, questionCount: questions.length };

      // questions-by-paper.json
      const qIds = questions.map(q => q.id).filter(Boolean);
      questionsByPaper[paperId] = { file: relPath, questionIds: qIds };

      // per-question
      questions.forEach((q, idx) => {
        if (!q.id) return;
        totalQuestions++;

        const subj    = (q.subject || '').trim().toLowerCase();
        const chapter = (q.chapter || '').trim().toLowerCase();
        const topic   = (q.topic   || '').trim().toLowerCase();

        // by-id
        questionsById[q.id] = { file: relPath, index: idx };

        // by-subject
        if (exam && subj) {
          const sk = `${exam}|${subj}`;
          if (!questionsBySubj[sk]) questionsBySubj[sk] = [];
          questionsBySubj[sk].push(q.id);
        }

        // by-topic
        if (exam && subj && chapter && topic) {
          const tk = `${exam}|${subj}|${chapter}|${topic}`;
          if (!questionsByTopic[tk]) questionsByTopic[tk] = [];
          questionsByTopic[tk].push(q.id);
        }

        // hierarchy tree
        if (!globalTree[exam]) globalTree[exam] = {};
        if (subj) {
          if (!globalTree[exam][subj]) globalTree[exam][subj] = {};
          if (chapter) {
            if (!globalTree[exam][subj][chapter]) globalTree[exam][subj][chapter] = new Set();
            if (topic) globalTree[exam][subj][chapter].add(topic);
          }
        }
      });
    }
  }
}

// ── Write index files ───────────────────────────────────────────────────────
function writeJson(file, obj) {
  const data = JSON.stringify(obj, null, 2);
  writeFileSync(file, data, 'utf8');
  const kb = Math.round(Buffer.byteLength(data, 'utf8') / 1024);
  console.log(`  [OK] ${relative(REPO_ROOT, file).replace(/\\/g, '/')}  (${kb} KB)`);
}

const displayName = (type, slug) => {
  const map = { exam: { 'jee-main': 'JEE Main', 'jee-advanced': 'JEE Advanced', neet: 'NEET' }, subject: { physics: 'Physics', chemistry: 'Chemistry', mathematics: 'Mathematics', biology: 'Biology' } };
  return map[type]?.[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

console.log('\nWriting index files...');
writeJson(join(INDEXES, 'questions-by-id.json'),      questionsById);
writeJson(join(INDEXES, 'questions-by-paper.json'),   questionsByPaper);
writeJson(join(INDEXES, 'questions-by-subject.json'), questionsBySubj);
writeJson(join(INDEXES, 'questions-by-topic.json'),   questionsByTopic);
writeJson(join(INDEXES, 'papers.json'),               papersIndex);

// ── Build hierarchy ─────────────────────────────────────────────────────────
const examsOut    = {};
const subjectsOut = {};
const chaptersOut = {};
const topicsOut   = {};

for (const exam of Object.keys(globalTree).sort()) {
  examsOut[exam] = { id: exam, name: displayName('exam', exam), subjects: Object.keys(globalTree[exam]).sort() };
  subjectsOut[exam] = {};
  chaptersOut[exam] = {};

  for (const subj of Object.keys(globalTree[exam]).sort()) {
    subjectsOut[exam][subj] = { id: subj, name: displayName('subject', subj), chapters: Object.keys(globalTree[exam][subj]).sort() };
    chaptersOut[exam][subj] = {};

    for (const ch of Object.keys(globalTree[exam][subj]).sort()) {
      const topics = [...globalTree[exam][subj][ch]].sort();
      chaptersOut[exam][subj][ch] = {
        id: ch,
        name: ch.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        topics,
      };
      topics.forEach(topic => {
        const key = `${exam}|${subj}|${ch}|${topic}`;
        topicsOut[key] = { exam, subject: subj, chapter: ch, topic, name: topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
      });
    }
  }
}

console.log('\nWriting hierarchy files...');
writeJson(join(HIERARCHY, 'exams.json'),    examsOut);
writeJson(join(HIERARCHY, 'subjects.json'), subjectsOut);
writeJson(join(HIERARCHY, 'chapters.json'), chaptersOut);
writeJson(join(HIERARCHY, 'topics.json'),   topicsOut);

console.log(`\n✅ Done!\n   Papers: ${totalPapers}  |  Questions: ${totalQuestions}  |  Topics: ${Object.keys(topicsOut).length}`);
