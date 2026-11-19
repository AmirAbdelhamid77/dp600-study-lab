/**
 * DP-600 Study Lab — extraction pipeline.
 *
 * Read-only over the existing workspace. Produces:
 *   data/bank.js               window.DP600_BANK = {...}
 *   reports/extraction-report.json
 *
 * Sources (all pre-existing in D:/BeUI):
 *   A. amir-portfolio/content/fabric/questions/*.json   (27 packs, answer key + explanation)
 *   B. amir-portfolio/content/fabric/additions/questions.json (DP-600 subset)
 *   C. amir-portfolio/content/fabric/r11/questions.json (revised 222, partial answers)
 *   D. records/dp600-questions-2026-10-25.json          (222 source questions + community discussion)
 *   E. amir-portfolio/content/fabric/index.json         (domain / objective / scope metadata)
 *   F. amir-portfolio/content/fabric/cases.json         (case studies)
 *   G. amir-portfolio/content/fabric/notes.json         (study notes)
 *   H. amir-portfolio/content/fabric/sources.json       (reference URLs)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/BeUI';
const APP = path.join(ROOT, 'dp600-study-lab');
const P = (...p) => path.join(ROOT, ...p);

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readJsonSafe = (p) => {
  try { return readJson(p); } catch (e) { console.error('  ! failed', p, e.message); return null; }
};

/* ------------------------------------------------------------------ */
/* text helpers                                                        */
/* ------------------------------------------------------------------ */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  '#x27': "'", '#39': "'", '#x2F': '/', '#47': '/', '#x3D': '=', '#61': '=',
  '#x60': '`', '#96': '`', '#x2019': '\u2019', '#x2018': '\u2018',
  '#x201C': '\u201C', '#x201D': '\u201D', '#x2014': '\u2014', '#x2013': '\u2013',
};

function decodeEntities(s) {
  if (!s) return '';
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, k) => {
    const key = k.toLowerCase();
    if (ENTITIES[key] !== undefined) return ENTITIES[key];
    if (key.startsWith('#x')) {
      const n = parseInt(key.slice(2), 16);
      if (Number.isFinite(n)) return String.fromCodePoint(n);
    }
    if (key.startsWith('#')) {
      const n = parseInt(key.slice(1), 10);
      if (Number.isFinite(n)) return String.fromCodePoint(n);
    }
    return m;
  });
}

function sanitize(s) {
  if (s === null || s === undefined || s === '') return '';
  if (typeof s !== 'string') s = Array.isArray(s) ? s.join(' ') : String(s);
  return s
    .replace(/\uFFFD\+\'/g, '\u2192')
    .replace(/\uFFFD\?"/g, '\u2014')
    .replace(/\uFFFD\?o/g, '\u201C')
    .replace(/\uFFFD\?\?/g, '\u201D')
    .replace(/\uFFFD\?T/g, '\u2019')
    .replace(/\uFFFD\uFFFD/g, '\u201D')
    .replace(/\uFFFD/g, '');
}

function stripHtml(html) {
  if (!html) return '';
  let s = sanitize(html);
  s = s.replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/table|\/ul|\/ol)\s*>/gi, '\n');
  s = s.replace(/<\s*(li|td|th)\b[^>]*>/gi, ' ');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  s = s.replace(/\r/g, '');
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function normKey(s) {
  return stripHtml(s)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect the shared "this is a series" preamble. The PDF text is hard-wrapped,
 * so paragraph boundaries are unreliable; cut through the first "review screen."
 * sentence, which both known variants end with, and fall back to the goals line.
 */
function isSeriesStem(s) {
  if (!s) return false;
  const t = String(s).replace(/\r/g, '').trim();
  const head = t.slice(0, 1100);
  if (/^This question is part of a series/i.test(t)) return true;
  return (
    /^Note:/i.test(t) &&
    /(series of questions|sets? of questions|same answer choices|same scenario and problem)/i.test(head)
  );
}

/** Remove the shared "this is a series" preamble so sibling questions don't look identical. */
function stripSeriesBoilerplate(s) {
  if (!s) return '';
  let t = String(s).replace(/\r/g, '').trim();
  if (!isSeriesStem(t)) return t;
  const head = t.slice(0, 1200);
  const cut = (m) => t.slice(m.index + m[0].length).trim();
  let m = head.match(/review screen\./i);
  if (m) return cut(m);
  m = head.match(/stated goals\??\./i);
  if (m) return cut(m);
  m = head.match(/solve the problem\./i);
  if (m) return cut(m);
  return t;
}

/** Normalized control identity: text before ":" or "(", with generic labels keyed by position. */
function controlKey(c, i) {
  const raw = String(c && c.label ? c.label : '').replace(/\s+/g, ' ').trim();
  const base = raw.split(/[:(]/)[0].trim();
  if (!base) return `#${i + 1}`;
  if (/^(target|blank|step|line|dropdown|answer choice|d)\s*\d*$/i.test(base)) return `#${i + 1}`;
  return normKey(base);
}

function controlSetKey(q) {
  const cs = (q && q.controls) || (q && q.answer && q.answer.controls) || [];
  return cs.map((c) => `${normKey(c.label)}[${(c.options || []).map(normKey).join('/')}]`).join('||');
}

function optionText(options, letter) {
  const o = (options || []).find((x) => String(x.key).toUpperCase() === String(letter).toUpperCase());
  return o ? o.text : '';
}

function mapLettersToOptions(letters, fromOptions, toOptions) {
  if (!letters || !letters.length || !fromOptions || !fromOptions.length || !toOptions || !toOptions.length) return null;
  const fromByKey = new Map(fromOptions.map((o) => [String(o.key).toUpperCase(), o]));
  const toByText = new Map();
  for (const o of toOptions) {
    const k = normKey(o.text);
    if (k && !toByText.has(k)) toByText.set(k, String(o.key).toUpperCase());
  }
  const out = [];
  for (const l of letters) {
    const src = fromByKey.get(String(l).toUpperCase());
    if (!src) return null;
    const key = toByText.get(normKey(src.text));
    if (!key) return null;
    out.push(key);
  }
  return [...new Set(out)].sort();
}

function mapOrderToOptions(order, fromOptions, toOptions) {
  if (!order || !order.length || !fromOptions || !fromOptions.length || !toOptions || !toOptions.length) return null;
  const fromByKey = new Map(fromOptions.map((o) => [String(o.key).toUpperCase(), o]));
  const toByText = new Map();
  for (const o of toOptions) {
    const k = normKey(o.text);
    if (k && !toByText.has(k)) toByText.set(k, String(o.key).toUpperCase());
  }
  const out = [];
  for (const l of order) {
    const src = fromByKey.get(String(l).toUpperCase());
    if (!src) return null;
    const key = toByText.get(normKey(src.text));
    if (!key) return null;
    out.push(key);
  }
  return out;
}

/**
 * Express a source answer in the canonical question's option letters, so shuffled
 * option orders do not look like conflicting keys. Returns { answer, options }.
 */
function canonicalAnswer(q, canon) {
  const a = q && q.answer;
  if (!a) return null;
  if (a.letters && q.options && canon.options) {
    const mapped = mapLettersToOptions(a.letters, q.options, canon.options);
    if (mapped) return { answer: { letters: mapped }, options: canon.options };
  }
  if (a.order && q.options && canon.options) {
    const mapped = mapOrderToOptions(a.order, q.options, canon.options);
    if (mapped) return { answer: { order: mapped }, options: canon.options };
  }
  if (a.controls) {
    const canonControls = (canon.controls && canon.controls.length ? canon.controls : canon.answer && canon.answer.controls) || [];
    const canonByKey = new Map(canonControls.map((c, i) => [controlKey(c, i), c]));
    const controls = a.controls.map((c, i) => {
      const target = canonByKey.get(controlKey(c, i));
      return target ? { ...c, label: target.label, options: target.options && target.options.length ? target.options : c.options } : c;
    });
    return { answer: { controls }, options: canon.options || [] };
  }
  return { answer: a, options: q.options || [] };
}

function comparisonSignature(ca) {
  if (!ca || !ca.answer) return '';
  const a = ca.answer;
  if (a.letters) return a.letters.map((l) => normKey(optionText(ca.options, l))).join('||');
  if (a.order) return a.order.map((l) => normKey(optionText(ca.options, l))).join('>');
  if (a.controls) return a.controls.map((c, i) => `${controlKey(c, i)}=${normKey(c.answer)}`).join('|');
  return '';
}

function words(s) {
  return normKey(s).split(' ').filter((w) => w.length > 2);
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Fraction of options that pair one-to-one with an equal or near-equal option.
 * Stricter than concatenating all option text, which makes short options look
 * similar even when the actual choices (and therefore the answer) differ.
 */
function optionMatchRatio(a, b) {
  if (!a || !b || !a.length || a.length !== b.length) return 0;
  const used = new Set();
  let matched = 0;
  for (const oa of a) {
    let best = -1;
    let bestSim = 0;
    for (let j = 0; j < b.length; j++) {
      if (used.has(j)) continue;
      const na = normKey(oa.text);
      const nb = normKey(b[j].text);
      const sim = na && na === nb ? 1 : jaccard(new Set(words(oa.text)), new Set(words(b[j].text)));
      if (sim > bestSim) { bestSim = sim; best = j; }
    }
    if (best >= 0 && bestSim >= 0.92) {
      used.add(best);
      matched++;
    }
  }
  return matched / a.length;
}

/** Split a combined scenario+question HTML blob into a scenario part and the question part. */
function splitScenario(html) {
  if (!html) return { scenarioHtml: '', stemHtml: '' };
  const blocks = [];
  const re = /<(p|ul|ol|table|pre|h[1-6]|div)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let m;
  let last = 0;
  while ((m = re.exec(html))) {
    if (m.index > last) {
      const between = html.slice(last, m.index).trim();
      if (between) blocks.push(between);
    }
    blocks.push(m[0]);
    last = re.lastIndex;
  }
  if (last < html.length) {
    const tail = html.slice(last).trim();
    if (tail) blocks.push(tail);
  }
  if (blocks.length < 2) return { scenarioHtml: '', stemHtml: sanitize(html) };

  const plain = blocks.map((b) => stripHtml(b).toLowerCase());
  const questionRe = /(\?\s*$)|(^you (need|must|are|have|plan|want|to need))|^(what|which|how|why|when|where|who)\b|select the appropriate|arrange the|drag the appropriate|for each of the following statements/;
  let idx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (questionRe.test(plain[i])) { idx = i; break; }
  }
  if (idx <= 0) return { scenarioHtml: '', stemHtml: sanitize(html) };
  return {
    scenarioHtml: blocks.slice(0, idx).join('\n'),
    stemHtml: blocks.slice(idx).join('\n'),
  };
}

/* ------------------------------------------------------------------ */
/* taxonomy (Microsoft DP-600 skills measured as of 19 Oct 2026)        */
/* ------------------------------------------------------------------ */

const DOMAINS = {
  '1': { id: '1', title: 'Maintain a data analytics solution', weight: '25–30%' },
  '2': { id: '2', title: 'Prepare data', weight: '45–50%' },
  '3': { id: '3', title: 'Implement and manage semantic models', weight: '25–30%' },
};

const OBJECTIVES = {
  '1.1': { id: '1.1', domain: '1', title: 'Implement security and governance' },
  '1.2': { id: '1.2', domain: '1', title: 'Maintain the analytics development lifecycle' },
  '2.1': { id: '2.1', domain: '2', title: 'Get data' },
  '2.2': { id: '2.2', domain: '2', title: 'Transform data' },
  '2.3': { id: '2.3', domain: '2', title: 'Query and analyze data' },
  '3.1': { id: '3.1', domain: '3', title: 'Design and build semantic models' },
  '3.2': { id: '3.2', domain: '3', title: 'Optimize enterprise-scale semantic models' },
};

const OBJECTIVE_RULES = [
  ['3.2', 6, [
    'performance analyzer', 'dax performance', 'slow', 'optimize', 'optimization', 'direct lake fallback',
    'fallback', 'incremental refresh', 'query folding', 'aggregation table', 'large semantic model',
    'model size', 'cardinality reduction', 'reduce model size', 'refresh performance', 'query performance',
  ]],
  ['3.1', 5, [
    'dax', 'measure', 'calculated column', 'calculation group', 'field parameter', 'format string',
    'selectedmeasure', 'storage mode', 'direct lake', 'composite model', 'relationship', 'many-to-many',
    'bridge table', 'star schema', 'semantic model', 'time intelligence', 'summarize', 'role-playing',
    'inactive relationship', 'bi-directional', 'calculated table', 'what-if', 'parameter table',
  ]],
  ['1.1', 6, [
    'workspace role', 'permission', 'access control', 'row-level security', 'rls', 'column-level',
    'object-level', 'ols', 'cls', 'sensitivity label', 'endorse', 'certified', 'promoted', 'governance',
    'domain', 'admin portal', 'tenant setting', 'least privilege', 'security group', 'entra', 'share',
    'data loss prevention', 'dlp', 'masking', 'oneLake security', 'file-level',
  ]],
  ['1.2', 5, [
    'git', 'version control', 'deployment pipeline', 'lifecycle', 'impact analysis', 'lineage', 'pbip',
    'pbit', 'pbids', 'template', 'xmla endpoint', 'deploy', 'branch', 'repository', 'release', 'cicd',
    'ci/cd', 'source control', 'workspace folder',
  ]],
  ['2.3', 4, [
    't-sql', 'kql', 'sql query', 'dax query', 'visual query', 'select ', 'where ', 'group by', 'join',
    'summarize', 'top ', 'window function', 'query editor', 'queryset', 'stored procedure',
  ]],
  ['2.2', 3, [
    'transform', 'dataflow', 'power query', 'merge', 'join', 'denormalize', 'duplicate', 'null',
    'data type', 'filter', 'aggregate', 'enrich', 'cleanse', 'scd', 'slowly changing', 'view',
    'function', 'pivot', 'unpivot', 'split column',
  ]],
  ['2.1', 3, [
    'ingest', 'get data', 'data connection', 'shortcut', 'mirroring', 'copy activity', 'copy job',
    'gateway', 'onelake catalog', 'real-time hub', 'eventstream', 'lakehouse', 'warehouse',
    'eventhouse', 'data store', 'source', 'connector', 'pipeline', 'notebook', 'spark',
  ]],
];

function classify(text) {
  const t = ' ' + normKey(text) + ' ';
  const scores = {};
  for (const [obj, weight, keys] of OBJECTIVE_RULES) {
    let s = 0;
    for (const k of keys) {
      const kk = normKey(k);
      if (!kk) continue;
      const re = new RegExp('(^| )' + kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)', 'g');
      const hits = (t.match(re) || []).length;
      if (hits) s += weight * Math.min(hits, 3);
    }
    scores[obj] = s;
  }
  let best = null;
  let bestScore = 0;
  for (const [obj, s] of Object.entries(scores)) {
    if (s > bestScore) { best = obj; bestScore = s; }
  }
  if (!best || bestScore < 3) return { domain: '2', objective: '2.1', confidence: 'low', basis: 'derived' };
  return {
    domain: OBJECTIVES[best].domain,
    objective: best,
    confidence: bestScore >= 12 ? 'high' : bestScore >= 6 ? 'medium' : 'low',
    basis: 'derived',
  };
}

/* ------------------------------------------------------------------ */
/* answer helpers                                                      */
/* ------------------------------------------------------------------ */

const LETTERS = 'ABCDEFGHIJ';

function lettersFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim().toUpperCase())
      .filter((v) => /^[A-J]$/.test(v))
      .sort();
  }
  const s = String(value).toUpperCase().replace(/[^A-J]/g, '');
  return [...new Set(s.split(''))].sort();
}

function answerSignature(a) {
  if (!a) return '';
  if (a.letters && a.letters.length) return a.letters.join('');
  if (a.order && a.order.length) return a.order.join('>');
  if (a.controls && a.controls.length) return a.controls.map((c, i) => `${controlKey(c, i)}=${normKey(c.answer)}`).join('|');
  if (a.statements && a.statements.length) return a.statements.map((c, i) => `${controlKey(c, i)}=${normKey(c.answer)}`).join('|');
  return '';
}

function optionsKey(q) {
  return (q.options || [])
    .map((o) => normKey(o.text))
    .filter(Boolean)
    .sort()
    .join(' || ')
    .slice(0, 600);
}

function answerCount(a) {
  if (!a) return 0;
  if (a.letters) return a.letters.length;
  if (a.order) return a.order.length;
  if (a.controls) return a.controls.length;
  if (a.statements) return a.statements.length;
  return 0;
}

/* ------------------------------------------------------------------ */
/* load metadata                                                       */
/* ------------------------------------------------------------------ */

console.log('Loading metadata…');
const index = readJson(P('amir-portfolio/content/fabric/index.json'));
const indexById = new Map(index.map((q) => [q.id, q]));
const casesRaw = readJson(P('amir-portfolio/content/fabric/cases.json'));
const caseById = new Map(casesRaw.map((c) => [c.id, c]));
const notes = readJson(P('amir-portfolio/content/fabric/notes.json'));
const sourcesRaw = readJson(P('amir-portfolio/content/fabric/sources.json'));
const sourceById = new Map(sourcesRaw.map((s) => [s.id, s]));
const packsRaw = readJson(P('amir-portfolio/content/fabric/packs.json'));
const packByKey = new Map(packsRaw.map((p) => [p.key, p]));

const r11 = readJson(P('amir-portfolio/content/fabric/r11/questions.json'));
const r11BySource = new Map(r11.map((q) => [q.sourceId, q]));
const r11Cases = readJson(P('amir-portfolio/content/fabric/r11/case-studies.json'));
const r11CaseById = new Map(r11Cases.map((c) => [c.id, c]));

const records = readJson(P('records/dp600-questions-2026-10-25.json'));
const recordById = new Map(records.questions.map((q) => [q.id, q]));
const recordCaseById = new Map((records.caseStudies || []).map((c) => [c.id, c]));

const additionsRaw = readJson(P('amir-portfolio/content/fabric/additions/questions.json'));
const additions = additionsRaw.filter((q) => q.exam === 'DP-600');

/* ------------------------------------------------------------------ */
/* case study text                                                     */
/* ------------------------------------------------------------------ */

function cleanCaseText(text) {
  if (!text) return '';
  let s = sanitize(text).replace(/\r/g, '');
  const marker = s.indexOf('Overview\n');
  if (marker > 0) s = s.slice(marker);
  s = s.replace(/^HOTSPOT\s*\n-\s*\nCase study\s*\n-\s*\n/i, '');
  s = s.replace(/\n-\n/g, '\n');
  s = s.replace(/\uFFFD\uFFFD/g, '\u2022');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

const caseBank = {};
for (const c of [...r11Cases, ...(records.caseStudies || []), ...casesRaw]) {
  if (!c || !c.id) continue;
  if (caseBank[c.id]) continue;
  caseBank[c.id] = {
    id: c.id,
    name: c.name || c.title || c.id,
    text: cleanCaseText(c.text || ''),
  };
}

/* ------------------------------------------------------------------ */
/* normalization                                                       */
/* ------------------------------------------------------------------ */

const questions = [];
const stats = {
  sourcesInspected: [],
  rawCounts: {},
  skipped: {},
  duplicates: [],
};

stats.sourcesInspected.push(
  { path: 'amir-portfolio/content/fabric/packs.json', kind: 'pack-metadata', questions: packsRaw.length },
  { path: 'amir-portfolio/content/fabric/index.json', kind: 'question-metadata', questions: index.length },
  { path: 'amir-portfolio/content/fabric/cases.json', kind: 'case-studies', questions: casesRaw.length },
  { path: 'amir-portfolio/content/fabric/notes.json', kind: 'study-notes', questions: notes.length },
  { path: 'amir-portfolio/content/fabric/sources.json', kind: 'reference-urls', questions: sourcesRaw.length },
);

/* ---- A. fabric question packs ---- */
console.log('Reading question packs…');
const packDir = P('amir-portfolio/content/fabric/questions');
const packFiles = fs.readdirSync(packDir).filter((f) => f.endsWith('.json')).sort();
stats.rawCounts.packs = 0;

for (const file of packFiles) {
  const arr = readJsonSafe(path.join(packDir, file));
  if (!Array.isArray(arr)) continue;
  stats.sourcesInspected.push({
    path: `amir-portfolio/content/fabric/questions/${file}`,
    kind: 'question-pack',
    questions: arr.length,
  });
  const packKey = arr[0]?.pack || file.replace('.json', '');
  const packMeta = packByKey.get(packKey);
  for (const q of arr) {
    const meta = indexById.get(q.id) || {};
    const options = (q.options || []).map((o) => ({
      key: String(o.id || o.letter || '').toUpperCase(),
      text: sanitize(o.text || ''),
      why: o.why ? sanitize(o.why) : '',
    })).filter((o) => o.key && o.text);
    let answer = null;
    if (q.type === 'sequence') {
      answer = { order: (q.correct || []).map((x) => String(x).toUpperCase()) };
    } else {
      const letters = lettersFrom(q.correct);
      if (letters.length) answer = { letters };
    }
    const refs = (q.refs || []).map((r) => {
      const s = sourceById.get(r);
      return s ? { title: s.title, url: s.url } : null;
    }).filter(Boolean);

    const topicText = [q.topic, q.title, q.prompt, q.explanation, q.sourceObjective].filter(Boolean).join(' ');
    const cls = meta.domain
      ? {
          domain: String(meta.domain),
          objective: meta.objectiveId || null,
          confidence: meta.confidence || 'medium',
          basis: meta.objectiveBasis || 'source',
        }
      : classify(topicText);

    questions.push({
      id: q.id,
      sourceKey: `pack:${q.id}`,
      type: q.type === 'sequence' ? 'sequence' : q.type === 'multi' ? 'multi' : 'single',
      stem: sanitize(q.prompt || ''),
      stemHtml: '',
      scenario: '',
      scenarioHtml: '',
      options,
      answer,
      answerStatus: 'documented',
      answerNote: 'Documentation-backed answer key supplied with the source pack; not independently re-validated here.',
      explanation: sanitize(q.explanation || ''),
      explanationHtml: '',
      code: sanitize(q.code || ''),
      refs,
      topic: {
        domain: cls.domain,
        objective: cls.objective,
        confidence: cls.confidence,
        basis: cls.basis,
      },
      pack: packKey,
      packLabel: packMeta?.label || packKey,
      sourceName: packMeta?.title || packKey,
      sourcePath: `amir-portfolio/content/fabric/questions/${file}`,
      sourceLocator: q.sourceId || q.id,
      caseStudyId: q.caseStudyId || null,
      difficulty: q.difficulty || null,
      difficultyBasis: q.difficulty ? 'source' : null,
      scope: meta.scope || 'core',
      subjects: meta.subjects || (meta.subject ? [meta.subject] : []),
      origin: q.origin || null,
      provenance: sanitize(q.provenance || ''),
      validation: sanitize(q.validation || ''),
      license: packKey === 'howard-dp600' ? 'MIT' : packKey === 'patrick-dp600' ? 'CC BY 4.0' : 'Hansa original',
      videoUrl: q.sourceVideoUrl || packMeta?.video?.id ? `https://www.youtube.com/watch?v=${packMeta?.video?.id}` : null,
      flags: [],
      aliases: [],
      community: null,
    });
    stats.rawCounts.packs++;
  }
}

/* ---- B. additions ---- */
console.log('Reading additions…');
stats.rawCounts.additions = 0;
stats.sourcesInspected.push({
  path: 'amir-portfolio/content/fabric/additions/questions.json',
  kind: 'consolidated-additions',
  questions: additions.length,
});

for (const q of additions) {
  const prefix = (q.sourceId || '').split(':')[0];
  const fullHtml = sanitize(q.stemHtml || '');
  const split = splitScenario(fullHtml);

  let options = (q.options || []).map((o) => ({
    key: String(o.id || o.letter || '').toUpperCase(),
    text: sanitize(o.text || ''),
    why: o.why ? sanitize(o.why) : '',
  })).filter((o) => o.key && o.text);

  let answer = null;
  let type = q.mode === 'multi' ? 'multi' : 'single';
  let controls = [];

  if (q.mode === 'controls') {
    type = 'controls';
    controls = (q.controls || []).map((c) => ({
      label: sanitize(c.label || ''),
      options: (c.options || []).map((x) => sanitize(x)),
      answer: sanitize(c.answer || ''),
    }));
    if (controls.length && controls.every((c) => c.answer)) {
      answer = { controls };
    }
  } else {
    const letters = lettersFrom(q.answers);
    if (letters.length) answer = { letters };
  }

  const refs = (q.refs || []).map((r) => ({
    title: sanitize(r.title || 'Microsoft documentation'),
    url: r.url || '',
  })).filter((r) => r.url);

  const caseId = prefix === 'litware' ? 'litware' : prefix === 'json' ? (q.caseLabel ? q.caseLabel.toLowerCase() : null) : null;

  const topicText = [q.caseLabel, q.stemHtml, q.explanationHtml, ...(q.refs || []).map((r) => r.title)].filter(Boolean).join(' ');
  const cls = classify(topicText);

  const flags = [];
  if ((q.blockers || []).length) flags.push('missing-exhibit');

  questions.push({
    id: q.id,
    sourceKey: `add:${q.id}`,
    type,
    stem: stripHtml(split.stemHtml),
    stemHtml: split.stemHtml,
    scenario: stripHtml(split.scenarioHtml),
    scenarioHtml: split.scenarioHtml,
    options,
    controls,
    answer,
    answerStatus: 'source',
    answerNote: q.review || 'Source-supplied answer; not independently validated.',
    explanation: stripHtml(q.explanationHtml || ''),
    explanationHtml: sanitize(q.explanationHtml || ''),
    code: '',
    refs,
    topic: cls,
    pack: `additions/${prefix}`,
    packLabel: prefix === 'litware' ? 'Litware case study' : prefix === 'mixed' ? 'Mixed DP-600 scenarios' : prefix === 'json' ? 'DP-600 discussion bank' : 'Study Hub',
    sourceName:
      prefix === 'litware' ? 'Litware interactive case (source-supplied)' :
      prefix === 'mixed' ? 'Mixed DP-600 interactive set (source-supplied)' :
      prefix === 'json' ? 'DP-600 discussion bank (source-supplied)' :
      'DP-600 / PL-300 Study Hub (source-supplied)',
    sourcePath: 'amir-portfolio/content/fabric/additions/questions.json',
    sourceLocator: q.sourceId || q.id,
    caseStudyId: caseId,
    difficulty: null,
    difficultyBasis: null,
    scope: 'core',
    subjects: [],
    origin: 'community',
    provenance: '',
    validation: q.review || '',
    license: 'Source-supplied',
    videoUrl: null,
    flags,
    aliases: (q.sourceRecords || []).map((r) => `record:${r}`),
    community: null,
    images: (q.images || []).map((i) => ({ src: i.src, caption: i.caption })),
    blockers: q.blockers || [],
  });
  stats.rawCounts.additions++;
}

/* ---- C/D. revised 222 (R11) and original discussion bank ---- */
console.log('Reading R11 / discussion bank…');
stats.rawCounts.r11 = r11.length;
stats.rawCounts.records = records.questions.length;
stats.sourcesInspected.push({ path: 'amir-portfolio/content/fabric/r11/questions.json', kind: 'revised-222', questions: r11.length });
stats.sourcesInspected.push({ path: 'records/dp600-questions-2026-10-25.json', kind: 'source-discussion-bank', questions: records.questions.length });

const additionsBySource = new Map(additions.map((q) => [q.sourceId, q]));

for (const r of r11) {
  const orig = recordById.get(r.sourceId);
  const add = additionsBySource.get(`json:${r.sourceId}`);
  const hasAnswer = Boolean(r.answer);

  if (hasAnswer) {
    const options = (r.options || []).map((o) => ({
      key: String(o.letter || '').toUpperCase(),
      text: sanitize(o.text || ''),
      why: '',
    })).filter((o) => o.key && o.text);
    const letters = lettersFrom(r.answer);
    const type = r.type === 'multi' ? 'multi' : 'single';
    const caseId = r.caseStudy || null;
    const cls = classify([r.stem, r.explanation, ...(r.refs || []).map((x) => x.title)].join(' '));
    const status =
      r.scientificStatus === 'APPROVED_CORRECTED' ? 'verified' :
      r.r10Status === 'APPROVED' || r.r10Status === 'APPROVED_WITH_NONBLOCKING_EDITS' ? 'documented' :
      'source';

    questions.push({
      id: `r11:${r.sourceId}`,
      sourceKey: `r11:${r.sourceId}`,
      type,
      stem: sanitize(r.stem || ''),
      stemHtml: '',
      scenario: caseId && caseBank[caseId] ? caseBank[caseId].text : '',
      scenarioHtml: '',
      options,
      answer: letters.length ? { letters } : null,
      answerStatus: status,
      answerNote:
        r.scientificStatus === 'APPROVED_CORRECTED'
          ? `Scientifically reviewed and corrected. ${sanitize(r.reviewNote || '')}`.trim()
          : `Revised R11 item. ${sanitize(r.reviewNote || '')}`.trim() || 'Revised wording; answer carried from source review.',
      explanation: sanitize(r.explanation || ''),
      explanationHtml: '',
      code: '',
      refs: (r.refs || []).map((x) => ({ title: sanitize(x.title || 'Microsoft documentation'), url: x.url })),
      topic: cls,
      pack: 'r11',
      packLabel: 'Revised DP-600 bank (R11)',
      sourceName: 'DP-600 discussion bank — R11 revision',
      sourcePath: 'amir-portfolio/content/fabric/r11/questions.json',
      sourceLocator: r.sourceId,
      caseStudyId: caseId,
      difficulty: null,
      difficultyBasis: null,
      scope: 'core',
      subjects: [],
      origin: 'community',
      provenance: 'Revised, image-free wording derived from the DP-600 discussion bank.',
      validation: sanitize(r.reviewNote || ''),
      license: 'Source-supplied',
      videoUrl: null,
      flags: r.gradingEnabled ? [] : ['review-pending'],
      aliases: [
        `record:${r.sourceId}`,
        r.hansaId ? `add:${r.hansaId}` : null,
      ].filter(Boolean),
      community: null,
      originalStem: orig ? sanitize(orig.stem || '') : null,
      originalAnswer: orig ? sanitize(orig.answer || orig.officialAnswer || '') : null,
      scientificStatus: r.scientificStatus || null,
      r10Status: r.r10Status || null,
    });
  } else if (add) {
    // No revised answer: keep the original source question (stem + key) so answer and wording stay consistent.
    const q = questions.find((x) => x.sourceKey === `add:${add.id}`);
    if (q) {
      q.answerStatus = 'source';
      q.aliases.push(`r11:${r.sourceId}`, `record:${r.sourceId}`);
      q.revisionNote = sanitize(r.reviewNote || '');
      q.scientificStatus = r.scientificStatus || null;
      q.r10Status = r.r10Status || null;
      q.flags = q.flags.filter((f) => f !== 'review-pending');
      if (r.scientificStatus === 'BLOCKED_SOURCE' || r.scientificStatus === 'BLOCKED_RUNTIME') {
        q.flags.push('blocked');
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* enrich with community discussion + pdf pages                        */
/* ------------------------------------------------------------------ */

console.log('Enriching community metadata…');
let enriched = 0;
for (const q of questions) {
  const rid = q.sourceLocator;
  const rec = recordById.get(rid);
  if (!rec) continue;
  enriched++;
  q.pdfPages = rec.pdfPages || [];
  q.communityVote = rec.communityVote || null;
  q.disagree = Boolean(rec.disagree);
  q.community = {
    vote: rec.communityVote || null,
    comments: (rec.comments || []).slice(0, 6).map((c) => ({
      user: c.user,
      badge: c.badge || null,
      age: c.age || null,
      selected: c.selected || null,
      body: sanitize(c.body || '').slice(0, 700),
      upvotes: c.upvotes || 0,
    })),
  };
  if (rec.disagree && !q.flags.includes('community-disagreement')) q.flags.push('community-disagreement');
  if (rec.officialAnswer && rec.answer && rec.officialAnswer !== rec.answer && !q.flags.includes('key-mismatch')) {
    q.flags.push('key-mismatch');
  }
  if (rec.type === 'dragdrop' && !rec.answer) {
    if (!q.flags.includes('no-answer')) q.flags.push('no-answer');
  }
}

/* Attach case-study text to items that only carry a caseStudyId. */
let scenarioFilled = 0;
for (const q of questions) {
  if (!q.scenario && q.caseStudyId && caseBank[q.caseStudyId]) {
    q.scenario = caseBank[q.caseStudyId].text;
    scenarioFilled++;
  }
}
for (const q of questions) {
  if (q.caseStudyId && !q.scenario && !q.flags.includes('missing-case')) q.flags.push('missing-case');
}
console.log(`Case scenarios attached: ${scenarioFilled}`);

/* ------------------------------------------------------------------ */
/* dedupe                                                              */
/* ------------------------------------------------------------------ */

console.log(`Deduplicating ${questions.length} raw items…`);

function quality(q) {
  let s = 0;
  if (q.answer) s += 40;
  if (q.answerStatus === 'verified') s += 25;
  else if (q.answerStatus === 'documented') s += 18;
  else if (q.answerStatus === 'source') s += 10;
  s += Math.min((q.explanation || '').length / 80, 25);
  s += Math.min((q.options || []).length * 2, 12);
  if (q.scenario) s += 3;
  if (q.refs && q.refs.length) s += 5;
  if (q.sourceKey.startsWith('pack:')) s += 6;
  return s;
}

/** Full-stem signature; controls include their label/option sets so siblings stay apart. */
function questionSignature(q) {
  const stem = normKey(stripSeriesBoilerplate(q.stem));
  const extra = q.type === 'controls' ? controlSetKey(q) : optionsKey(q);
  return `${q.type}|${stem}|${extra}`;
}

const bySignature = new Map();
for (const q of questions) {
  const sig = questionSignature(q);
  if (!bySignature.has(sig)) bySignature.set(sig, []);
  bySignature.get(sig).push(q);
}

const groups = [];
const consumed = new Set();
for (const q of questions) {
  if (consumed.has(q)) continue;
  const sig = questionSignature(q);
  const exact = bySignature.get(sig) || [q];
  const group = [q];
  consumed.add(q);
  for (const o of exact) {
    if (o === q || consumed.has(o)) continue;
    group.push(o);
    consumed.add(o);
  }
  groups.push(group);
}

// Conservative fuzzy pass: near-identical wording AND near-identical options.
// Series siblings share a scenario but differ by their "Solution:" line, so they
// are never fuzzy-merged; their exact signatures already keep each solution apart.
const reps = [];
for (const g of groups) {
  const q0 = g[0];
  const series = isSeriesStem(q0.stem);
  const repTokens = new Set(words(stripSeriesBoilerplate(q0.stem)));
  let merged = false;
  if (q0.type !== 'controls' && !series) {
    for (const r of reps) {
      if (r.type !== q0.type || r.series) continue;
      if (repTokens.size < 12) continue;
      if (q0.caseStudyId && r.caseStudyId && q0.caseStudyId !== r.caseStudyId) continue;
      if ((q0.options || []).length !== r.optionCount) continue;
      const sim = jaccard(repTokens, r.tokens);
      if (sim < 0.96) continue;
      if (optionMatchRatio(q0.options || [], r.options) < 0.95) continue;
      r.group.push(...g);
      merged = true;
      break;
    }
  }
  if (!merged) reps.push({
    type: q0.type,
    tokens: repTokens,
    options: q0.options || [],
    optionCount: (q0.options || []).length,
    stem: normKey(stripSeriesBoilerplate(q0.stem)),
    caseStudyId: q0.caseStudyId,
    series,
    group: g,
  });
}

const merged = [];
for (const r of reps) {
  const group = r.group.slice().sort((a, b) => quality(b) - quality(a));
  const canon = group[0];

  // Compare answers by option TEXT, not by letter: duplicates often shuffle choices.
  const signatures = new Map();
  for (const g of group) {
    const ca = canonicalAnswer(g, canon);
    const s = comparisonSignature(ca);
    if (!s) continue;
    if (!signatures.has(s)) signatures.set(s, []);
    signatures.get(s).push({ q: g, ca });
  }

  let answer = canon.answer;
  let answerStatus = canon.answerStatus;
  let answerNote = canon.answerNote;
  const flags = new Set(canon.flags || []);

  if (signatures.size > 1) {
    const sorted = [...signatures.entries()].sort((a, b) => b[1].length - a[1].length);
    const top = sorted[0];
    answer = top[1][0].ca.answer;
    answerStatus = 'conflict';
    flags.add('conflicting-answers');
    answerNote =
      'Sources disagree on the answer. The most common key is shown; all variants are listed under “Conflicting solutions”.';
  } else if (signatures.size === 1) {
    const only = [...signatures.values()][0][0];
    answer = only.ca.answer;
    if (!canon.answer) {
      answerStatus = only.q.answerStatus;
      answerNote = only.q.answerNote;
    }
  } else if (!answer) {
    answerStatus = 'missing';
    flags.add('no-answer');
  }

  const refs = [];
  const refSeen = new Set();
  for (const g of group) {
    for (const ref of g.refs || []) {
      const k = ref.url || ref.title;
      if (!k || refSeen.has(k)) continue;
      refSeen.add(k);
      refs.push(ref);
    }
  }

  const aliases = [...new Set(group.flatMap((g) => [g.sourceKey, ...(g.aliases || [])]))].filter(
    (a) => a !== canon.sourceKey
  );

  const chosenSig = comparisonSignature(canonicalAnswer(canon, canon));
  const conflictVariants = [...signatures.entries()]
    .filter(([s]) => s !== chosenSig)
    .map(([s, gs]) => ({
      answer: gs[0].ca ? answerSignature(gs[0].ca.answer) : s,
      answerData: gs[0].ca ? gs[0].ca.answer : null,
      sources: gs.map(({ q }) => ({
        name: q.sourceName,
        path: q.sourcePath,
        locator: q.sourceLocator,
        rawAnswer: answerSignature(q.answer) || null,
      })),
    }));

  const community = group.map((g) => g.community).find(Boolean) || null;

  merged.push({
    ...canon,
    id: canon.id,
    aliases,
    answer,
    answerStatus,
    answerNote,
    flags: [...flags],
    refs,
    conflictVariants,
    community,
    sources: group.map((g) => {
      const ca = canonicalAnswer(g, canon);
      return {
        key: g.sourceKey,
        name: g.sourceName,
        path: g.sourcePath,
        locator: g.sourceLocator,
        pack: g.pack,
        answer: ca ? answerSignature(ca.answer) || null : null,
        answerData: ca ? ca.answer : null,
        rawAnswer: answerSignature(g.answer) || null,
        status: g.answerStatus,
      };
    }),
    duplicateCount: group.length,
  });
}

/* ------------------------------------------------------------------ */
/* post-processing: ids, difficulty, topic fill, flags                 */
/* ------------------------------------------------------------------ */

const usedIds = new Set();
function uniqueId(base) {
  let id = String(base).replace(/[^a-zA-Z0-9:_-]+/g, '-');
  if (!usedIds.has(id)) { usedIds.add(id); return id; }
  let n = 2;
  while (usedIds.has(`${id}-${n}`)) n++;
  id = `${id}-${n}`;
  usedIds.add(id);
  return id;
}

for (const q of merged) {
  q.id = uniqueId(q.id);

  if (!q.topic || !q.topic.domain) {
    q.topic = classify([q.stem, q.scenario, ...(q.options || []).map((o) => o.text), q.explanation].join(' '));
  }
  if (!OBJECTIVES[q.topic.objective]) {
    q.topic.objective = Object.values(OBJECTIVES).find((o) => o.domain === q.topic.domain)?.id || '2.1';
  }

  // estimated difficulty (no source difficulty metadata exists)
  if (!q.difficulty) {
    const len = (q.stem || '').length;
    const nOpts = (q.options || []).length;
    let d = 2;
    if (q.type === 'multi' || q.type === 'sequence' || q.type === 'controls') d = 3;
    else if (len < 220 && nOpts <= 4) d = 1;
    if (len > 600) d = 3;
    if ((q.explanation || '').length > 1400 && d < 3) d = 3;
    q.difficulty = d;
    q.difficultyBasis = 'estimated';
  }

  if (!q.answer) {
    q.answerStatus = 'missing';
    if (!q.flags.includes('no-answer')) q.flags.push('no-answer');
  }
  if (q.flags.includes('missing-exhibit') && !q.flags.includes('visual-dependent')) {
    q.flags.push('visual-dependent');
  }
  if (q.scenario && q.scenario.length > 5000) {
    q.scenario = q.scenario.slice(0, 5000) + '…';
  }
  q.explanation = q.explanation || '';
  q.stem = stripSeriesBoilerplate(q.stem) || stripHtml(q.stemHtml) || '(stem missing)';
}

/* ------------------------------------------------------------------ */
/* sort & topic grouping                                               */
/* ------------------------------------------------------------------ */

const ORDER = { '1.1': 1, '1.2': 2, '2.1': 3, '2.2': 4, '2.3': 5, '3.1': 6, '3.2': 7 };
merged.sort((a, b) => {
  const oa = ORDER[a.topic.objective] || 99;
  const ob = ORDER[b.topic.objective] || 99;
  if (oa !== ob) return oa - ob;
  return a.id.localeCompare(b.id);
});

/* ------------------------------------------------------------------ */
/* study notes                                                         */
/* ------------------------------------------------------------------ */

const notesOut = notes.map((n) => ({
  pack: n.pack,
  label: packByKey.get(n.pack)?.label || n.pack,
  chapters: (n.chapters || []).map((c) => ({
    id: c.id,
    title: c.title,
    points: sanitize(c.points || ''),
    caveat: sanitize(c.caveat || ''),
    refs: Array.isArray(c.refs) ? c.refs : String(c.refs || '').split(/\s+/).filter(Boolean),
    videoSeconds: c.videoSeconds || null,
  })),
}));

/* ------------------------------------------------------------------ */
/* report + output                                                     */
/* ------------------------------------------------------------------ */

const byStatus = merged.reduce((a, q) => { a[q.answerStatus] = (a[q.answerStatus] || 0) + 1; return a; }, {});
const byDomain = merged.reduce((a, q) => { a[q.topic.domain] = (a[q.topic.domain] || 0) + 1; return a; }, {});
const byObjective = merged.reduce((a, q) => { a[q.topic.objective] = (a[q.topic.objective] || 0) + 1; return a; }, {});
const byType = merged.reduce((a, q) => { a[q.type] = (a[q.type] || 0) + 1; return a; }, {});
const flagCounts = merged.reduce((a, q) => { for (const f of q.flags) a[f] = (a[f] || 0) + 1; return a; }, {});
const duplicateRemoved = questions.length - merged.length;

const report = {
  generatedAt: new Date().toISOString(),
  exam: 'DP-600',
  title: 'Implementing Analytics Solutions Using Microsoft Fabric',
  blueprint: { asOf: '2026-10-19', domains: DOMAINS, objectives: OBJECTIVES },
  sourcesInspected: stats.sourcesInspected,
  rawCounts: stats.rawCounts,
  extracted: merged.length,
  duplicatesRemoved: duplicateRemoved,
  byStatus,
  byDomain,
  byObjective,
  byType,
  flagCounts,
  excluded: {
    'drafts/stark-v2-dp600.json': '1,213 questions; answer key not shipped (gradingEnabled=false), no licence. Excluded from the graded bank.',
    'drafts/chaturcr48-dp600.json': '71 questions; answer key not shipped. Excluded.',
    'drafts/warren-dp600.json': '122 questions; answer key not shipped; duplicate of the discussion bank. Excluded.',
    'drafts/dp600-r18.json': '222 questions; answersShipped=false. Excluded.',
    'additions PL-300 subset': '80 PL-300 questions; adjacent exam, excluded.',
  },
};

fs.mkdirSync(path.join(APP, 'data'), { recursive: true });
fs.mkdirSync(path.join(APP, 'reports'), { recursive: true });

const bank = {
  meta: {
    exam: 'DP-600',
    title: 'Implementing Analytics Solutions Using Microsoft Fabric',
    generatedAt: report.generatedAt,
    blueprintAsOf: '2026-10-19',
    counts: {
      total: merged.length,
      graded: merged.filter((q) => q.answer).length,
      studyOnly: merged.filter((q) => !q.answer).length,
    },
    domains: DOMAINS,
    objectives: OBJECTIVES,
    packs: packsRaw.map((p) => ({ key: p.key, label: p.label, title: p.title, questionCount: p.questionCount })),
    audit: {
      rawItems: questions.length,
      duplicatesRemoved: duplicateRemoved,
      byStatus,
      byDomain,
      byObjective,
      byType,
      flagCounts,
      sourcesInspected: stats.sourcesInspected,
      excluded: report.excluded,
      confidenceLegend: {
        verified: 'Reviewed and corrected in the revised R11 pass (scientificStatus APPROVED_CORRECTED).',
        documented: 'Answer key supplied with the source pack or approved in the earlier R10 review; not independently re-validated here.',
        source: 'Answer supplied by a community/study-hub source without independent validation.',
        conflict: 'Sources disagree. The most common key is shown; all variants are preserved.',
        missing: 'No answer key was supplied. The item is study-only and excluded from scored sessions by default.',
      },
    },
  },
  questions: merged,
  cases: caseBank,
  notes: notesOut,
  sources: sourcesRaw.map((s) => ({ id: s.id, title: s.title, url: s.url })),
};

const js = `/* Generated by tools/extract.mjs — do not edit by hand. */\nwindow.DP600_BANK = ${JSON.stringify(bank)};\n`;
fs.writeFileSync(path.join(APP, 'data', 'bank.js'), js, 'utf8');
fs.writeFileSync(path.join(APP, 'reports', 'extraction-report.json'), JSON.stringify(report, null, 2), 'utf8');

console.log('\n— Summary —');
console.log('raw items      :', questions.length);
console.log('unique         :', merged.length);
console.log('duplicates     :', duplicateRemoved);
console.log('answer status  :', byStatus);
console.log('domains        :', byDomain);
console.log('objectives     :', byObjective);
console.log('types          :', byType);
console.log('flags          :', flagCounts);
console.log('bank size      :', (js.length / 1024 / 1024).toFixed(2), 'MB');
console.log('written        : data/bank.js, reports/extraction-report.json');
