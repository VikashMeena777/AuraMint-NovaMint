import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const overrides = {};
function loadSource(relative) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.require = (id) => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  loaded._compile(outputText, filename);
  return loaded.exports;
}
overrides['@/lib/utils'] = loadSource('../src/lib/utils.ts');
overrides['./mint'] = loadSource('../src/components/aura/mint.ts');
overrides['next/link'] = ({ children, href, ...rest }) => React.createElement('a', { href, ...rest }, children);
overrides['@/lib/actions/aura-actions'] = new Proxy({}, { get() { return () => { throw new Error('No live actions allowed in render test'); }; } });
overrides['./aura-number'] = { AuraNumber: ({ value }) => React.createElement('span', null, value) };
overrides['./tier-mark'] = { TierMark: () => null };
overrides['./share-card-modal'] = { ShareCardModal: () => null };
overrides['@/lib/utils/sound'] = { playHapticPop() {} };
overrides['./primitives'] = {
  Plate: ({ children }) => React.createElement('div', null, children),
  Chip: ({ children }) => React.createElement('span', null, children),
  EmojiMark: ({ emoji }) => React.createElement('span', null, emoji),
};
const { AuraEventCard } = loadSource('../src/components/aura/aura-event-card.tsx');
function buttons(event) {
  const markup = renderToStaticMarkup(React.createElement(AuraEventCard, { event: {
    id: 'fixture', user_id: 'viewer', description: 'A sample moment', aura_points: 50,
    created_at: '2026-09-17T00:00:00Z', upvotes: 3, downvotes: 2,
    reaction_counts: { fire: 4 }, ...event,
  } }));
  return [...markup.matchAll(/<button\b[^>]*>/g)].map(([tag]) => ({
    label: tag.match(/aria-label="([^"]*)"/)?.[1],
    pressed: tag.match(/aria-pressed="([^"]*)"/)?.[1],
  }));
}
for (const vote of [1, -1]) {
  test(`feed card restores viewer vote ${vote} and fire reaction`, () => {
    const rendered = buttons({ viewer_vote: vote, viewer_reaction: 'fire' });
    assert.equal(rendered.find(b => b.label === 'Vote W (3)').pressed, String(vote === 1));
    assert.equal(rendered.find(b => b.label === 'Vote L (2)').pressed, String(vote === -1));
    assert.equal(rendered.find(b => b.label === 'React Fire (4)').pressed, 'true');
    assert.equal(rendered.filter(b => b.pressed === 'true').length, 2);
  });
}
test('missing viewer state renders no selected reactions or votes', () => {
  assert.equal(buttons({}).filter(b => b.pressed === 'true').length, 0);
});
