import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function loadSource(relative, overrides = {}) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.require = (id) => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  loaded._compile(outputText, filename);
  return loaded.exports;
}
const utils = loadSource('../src/lib/utils.ts');
const { AuraNumber } = loadSource('../src/components/ui/aura-number.tsx', { '@/lib/utils': utils });
for (const [label, value, signed, expected] of [
  ['negative balance retains minus', -1500, false, '−1,500'],
  ['negative delta has exactly one minus', -1500, true, '−1,500'],
  ['positive balance omits plus', 1500, false, '1,500'],
  ['positive delta has exactly one plus', 1500, true, '+1,500'],
  ['zero balance has no sign', 0, false, '0'],
  ['zero delta has no sign', 0, true, '0'],
]) {
  test(label, () => {
    const markup = renderToStaticMarkup(React.createElement(AuraNumber, { value, signed, animateOnChange: false }));
    const text = markup.replace(/<[^>]*>/g, '');
    assert.equal(text, expected);
    if (value < 0) assert.match(markup, /oxide-500/);
  });
}
