/**
 * Focused RED/GREEN audit for the premium return-status mapping.
 *
 * Subject: `normaliseStatus` in src/app/(app)/premium/premium-client.tsx.
 * The real function (and its PaymentState type alias) are extracted from the real
 * source with the TypeScript AST and transpiled in memory — no copied implementation.
 * The only wrapper added is an `export { normaliseStatus }` so the extracted node can
 * be evaluated as a module; the declaration text itself is byte-for-byte the file's.
 *
 * Context: the payments verify route (src/app/api/payments/verify/route.ts) redirects
 * to `/premium?status=<token>` for non-PAID provider order statuses, preserving the
 * provider token verbatim (covered by _audit/payment-verify-route-tests.mjs, case
 * `["ACTIVE", "ACTIVE"]`). This suite pins how that token must be normalised client-side.
 *
 * Run: node _audit/premium-status-tests.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const SOURCE = fileURLToPath(
  new URL('../src/app/(app)/premium/premium-client.tsx', import.meta.url)
);
const sourceText = readFileSync(SOURCE, 'utf8');

function extractDeclaration(predicate, label) {
  const sf = ts.createSourceFile(SOURCE, sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const hits = sf.statements.filter(predicate);
  assert.equal(hits.length, 1, `expected exactly one ${label} in ${SOURCE}, found ${hits.length}`);
  const text = hits[0].getText(sf);
  assert.ok(sourceText.includes(text), `${label} text must come verbatim from the real file`);
  return text;
}

const typeText = extractDeclaration(
  (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'PaymentState',
  'PaymentState type alias'
);
const fnText = extractDeclaration(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'normaliseStatus',
  'normaliseStatus function'
);

const { outputText } = ts.transpileModule(`${typeText}\n${fnText}\nexport { normaliseStatus };\n`, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: SOURCE,
});
const extracted = new Module(SOURCE);
extracted.filename = SOURCE;
extracted.require = require;
extracted._compile(outputText, SOURCE);
const { normaliseStatus } = extracted.exports;

/* ── RED first: the return route can deliver the ACTIVE provider token ── */

test('normaliseStatus(ACTIVE) is pending, the token the verify route preserves', () => {
  assert.equal(normaliseStatus('ACTIVE'), 'pending');
});

test('active / Active normalise to pending (mapper lowercases before comparing)', () => {
  assert.equal(normaliseStatus('active'), 'pending');
  assert.equal(normaliseStatus('Active'), 'pending');
});

/* ── Controls: behaviour that already existed must not move ── */

const SUPPORTED = [
  ['success', 'success'],
  ['SUCCESS', 'success'],
  ['paid', 'success'],
  ['PAID', 'success'],
  ['pending', 'pending'],
  ['PENDING', 'pending'],
  ['processing', 'pending'],
  ['PROCESSING', 'pending'],
  ['cancelled', 'cancelled'],
  ['canceled', 'cancelled'],
  ['user_dropped', 'cancelled'],
  ['USER_DROPPED', 'cancelled'],
  ['failed', 'failed'],
  ['FAILED', 'failed'],
  ['failure', 'failed'],
  ['error', 'failed'],
  ['ERROR', 'failed'],
];

test('supported statuses map exactly as before (controls)', () => {
  for (const [raw, expected] of SUPPORTED) {
    assert.equal(normaliseStatus(raw), expected, `${raw} -> ${expected}`);
  }
});

test('unknown and empty inputs still fall through to idle', () => {
  for (const raw of [null, '', 'garbage']) {
    assert.equal(normaliseStatus(raw), 'idle', `${JSON.stringify(raw)} -> idle`);
  }
});

test('out-of-scope provider tokens (EXPIRED, TERMINATED) deliberately remain idle', () => {
  // Scope guard for this change: only ACTIVE joins the pending branch; these two are
  // documented here as still-idle so a future edit must consciously update this test.
  assert.equal(normaliseStatus('EXPIRED'), 'idle');
  assert.equal(normaliseStatus('TERMINATED'), 'idle');
});

/* ── Provenance: the subject really is the component's declaration ── */

test('the tested function is the real component declaration, not a stub', () => {
  assert.match(fnText, /function normaliseStatus\(raw: string \| null\): PaymentState/);
  assert.ok(fnText.includes('return "idle"'), 'fall-through return must be part of the extracted body');
  assert.equal(normaliseStatus.length, 1, 'extracted function keeps its one-parameter signature');
});
