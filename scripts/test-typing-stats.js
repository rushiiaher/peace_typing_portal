// Self-check for Marathi canonicalisation + word-aligned scoring. Run from repo root: node scripts/test-typing-stats.js
const root = process.cwd();
const fs = require('fs'), assert = require('assert'), Module = require('module');
const ts = require(require.resolve('typescript', { paths: [root] }));
const load = (rel, deps = {}) => {
  const js = ts.transpileModule(fs.readFileSync(`${root}/src/utils/${rel}.ts`, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = new Module(rel); m.require = (d) => deps[d]; m._compile(js, rel + '.js'); return m.exports;
};
const mt = load('marathiText');
const { computeWordStats, getWordStates } = load('typingStats', { './marathiText': mt });

// Kruti Dev → Unicode
const K = {
  'ikB': 'पाठ', 'dz-': 'क्र.', 'lè;kP;k': 'सध्याच्या', 'Hkkjr': 'भारत', 'egkjk"Vª': 'महाराष्ट्र',
  'dk;Z': 'कार्य', 'fo|kFkhZ': 'विद्यार्थी', 'fLFkrh': 'स्थिती', 'vkSj': 'और', 'gS': 'है', 'esa': 'में',
  'dks': 'को', 'Dks': 'को', "'kklu": 'शासन', 'fdlh': 'किसी', 'dhfrZ': 'कीर्ति', 'ifjfLFkrhr': 'परिस्थितीत',
  'dqVqackr': 'कुटुंबात', 'eqya': 'मुलं', 'izR;sd': 'प्रत्येक', 'vkgs]': 'आहे,',
};
for (const [k, u] of Object.entries(K)) assert.strictEqual(mt.canonicalWord(k, true), u.normalize('NFC'), `kruti ${k}`);
assert.strictEqual(mt.canonicalWord('’kklu', true), 'शासन', 'Word smart-quote in Kruti');
assert.strictEqual(mt.canonicalWord('१२', true), '12', 'Devanagari digits');
assert.strictEqual(mt.canonicalWord('आहे।', true), 'आहे.', 'danda');
assert.strictEqual(mt.canonicalWord('hello', false), 'hello', 'english untouched');

// Alignment: one skipped / extra / wrong word costs exactly one mistake
const P = 'a b c d e';
assert.deepStrictEqual(computeWordStats('a c d e', P, { final: true }), { typedWordCount: 4, correctWords: 4, mistakes: 1, accuracy: 80 });
assert.strictEqual(computeWordStats('a x b c d e', P, { final: true }).mistakes, 1);
assert.strictEqual(computeWordStats('a bb c d e', P, { final: true }).mistakes, 1);
const long = Array.from({ length: 60 }, (_, i) => 'w' + i);
assert.strictEqual(computeWordStats(long.filter((_, i) => i !== 1).join(' '), long.join(' '), { final: true }).mistakes, 1, 'no cascade');
assert.deepStrictEqual(getWordStates('a c ', 'a b c'), ['correct', 'wrong', 'correct']);

// Live partial word
assert.deepStrictEqual(getWordStates('hel', 'hello world'), ['current', 'pending']);
assert.strictEqual(computeWordStats('hel', 'hello world').mistakes, 0);
assert.strictEqual(computeWordStats('hex', 'hello world').mistakes, 1);

// Marathi: Unicode passage ⇄ Kruti typing, both directions
const uni = 'सध्याच्या परिस्थितीत प्रत्येक सर्वसामान्य कुटुंबात';
const kru = 'lè;kP;k ifjfLFkrhr izR;sd loZlkekU; dqVqackr';
assert.strictEqual(computeWordStats(kru, uni, { final: true }).accuracy, 100, 'kruti typed vs unicode passage');
assert.strictEqual(computeWordStats(uni, kru, { final: true, marathi: true }).accuracy, 100, 'unicode typed vs kruti passage');
assert.strictEqual(computeWordStats('don\'t stop', 'don’t stop', { final: true }).accuracy, 100, 'curly quotes');

console.log('typing-stats: all checks passed');
