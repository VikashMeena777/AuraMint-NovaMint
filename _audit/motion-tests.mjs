/**
 * Regression tests for the motion pass.
 *
 * These render the REAL shared React components on the server (the same
 * transpile-and-require trick as `aura-number-tests.mjs`) and assert on the
 * resulting markup. They cannot observe animation frames or pixels — they pin
 * the structural contract: SSR output is visible, the icons emit real animated
 * SVG parts, and nothing interactive is nested inside a control.
 *
 * Run: node --test _audit/motion-tests.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

const overrides = {};

function loadSource(relative) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const source = readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.require = (id) => (Object.hasOwn(overrides, id) ? overrides[id] : require(id));
  loaded._compile(outputText, filename);
  return loaded.exports;
}

function register(id, relative) {
  const exports = loadSource(relative);
  overrides[id] = exports;
  return exports;
}

// CSS modules do not exist in Node: hand back the class name unchanged.
overrides["@/components/ui/mint-motion.module.css"] = new Proxy(
  {},
  { get: (_target, key) => String(key) }
);
overrides["next/image"] = function ImageStub({ src, alt, ...rest }) {
  return React.createElement("img", { src, alt, ...rest });
};

const utils = register("@/lib/utils", "../src/lib/utils.ts");
overrides["@/lib/utils"] = utils;
const marks = register("@/components/icons/marks", "../src/components/icons/marks.tsx");
overrides["@/components/icons/marks"] = marks;
const registry = register("@/components/icons/registry", "../src/components/icons/registry.tsx");
overrides["@/components/icons/registry"] = registry;
const animatedIcon = register(
  "@/components/ui/animated-icon",
  "../src/components/ui/animated-icon.tsx"
);
overrides["@/components/ui/animated-icon"] = animatedIcon;
const mintIcon = register("@/components/icons/mint-icon", "../src/components/icons/mint-icon.tsx");
overrides["@/components/icons/mint-icon"] = mintIcon;
const auraNumber = register("@/components/ui/aura-number", "../src/components/ui/aura-number.tsx");
overrides["@/components/ui/aura-number"] = auraNumber;
const receipt = register("@/components/ui/receipt", "../src/components/ui/receipt.tsx");
overrides["@/components/ui/receipt"] = receipt;
const mintMotion = register("@/components/ui/mint-motion", "../src/components/ui/mint-motion.tsx");
overrides["@/components/ui/mint-motion"] = mintMotion;

const { AnimatedIcon } = animatedIcon;
const { MintIcon } = mintIcon;
const { HeroSpecimen, Reveal } = mintMotion;
const { Stamp, Loader2 } = require("lucide-react");

/* ══════════════════════════════════════════════════════════════════════ */

test("a registered icon renders animated SVG parts, not an <img> or a nested control", () => {
  const markup = renderToStaticMarkup(React.createElement(AnimatedIcon, { icon: Stamp }));
  const svg = markup.match(/<svg[\s\S]*<\/svg>/)?.[0] ?? "";
  assert.ok(svg.length > 0, "svg rendered");
  // The stamp mark's three own paths (die, platen, bed) are present.
  assert.match(markup, /M14 13V8\.5C14 7 15 7 15 5a3 3 0 0 0-6 0/);
  assert.match(markup, /M5 22h14/);
  // Decorative, and never an interactive descendant.
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /<button|<a |tabindex/i);
});

test("an unregistered icon keeps the plain Lucide glyph", () => {
  const markup = renderToStaticMarkup(React.createElement(AnimatedIcon, { icon: Loader2 }));
  assert.match(markup, /lucide-loader-circle|lucide-loader/);
  assert.doesNotMatch(markup, /transform-box/);
});

test("marks that draw strokes emit pathLength-driven parts", () => {
  const markup = renderToStaticMarkup(
    React.createElement(AnimatedIcon, { icon: require("lucide-react").Search })
  );
  assert.match(markup, /pathLength/, "search lens/handle carry a stroke draw");
});

test("MintIcon resolves a mark by name (the server-component path)", () => {
  const markup = renderToStaticMarkup(React.createElement(MintIcon, { name: "crown" }));
  assert.match(markup, /M11\.562 3\.266a\.5\.5 0 0 1 \.876 0L15\.39 8\.87/, "crown geometry");
});

test("every mark name used by the landing page exists in the registry", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  // Both spellings: `<MintIcon name="stamp" />` and `icon: "gauge"` data rows.
  const names = [
    ...[...page.matchAll(/name="([a-z-]+)"/g)].map((match) => match[1]),
    ...[...page.matchAll(/icon: "([a-z-]+)"/g)].map((match) => match[1]),
  ];
  const unique = [...new Set(names)];
  assert.ok(unique.length >= 15, `expected many named icons, saw ${unique.length}: ${unique.join(", ")}`);
  for (const name of unique) {
    assert.ok(marks.MARKS[name], `unknown mark name in page.tsx: ${name}`);
  }
});

test("HeroSpecimen SSRs the whole receipt visible, with a real button for the press", () => {
  const markup = renderToStaticMarkup(
    React.createElement(HeroSpecimen, {
      rows: [
        { label: "Paid for everyone's chai", value: "+1,500", tone: "positive" },
        { label: "Sunglasses, indoors, at night", value: "−800", tone: "negative" },
      ],
      total: 1600,
      serials: ["#0048213", "#0048214"],
    })
  );

  // Content is present in the HTML, never gated behind JS.
  assert.match(markup, /Specimen · today’s ledger/);
  assert.match(markup, /Paid for everyone&#x27;s chai/);
  assert.match(markup, /1,600/);
  assert.match(markup, /#0048213/);
  assert.match(markup, /awaiting first strike/);

  // The press is a button with an accessible name, and the coin is inside it.
  assert.match(markup, /<button[^>]*type="button"[^>]*aria-describedby="hero-press-note"/);
  assert.match(markup, /<button[^>]*aria-label="Strike the specimen coin"/);
  assert.match(markup, /auramint-coin\.svg/);
  // The overprint exists but is transparent until a strike lands.
  assert.match(markup, /class="[^"]*opacity-0[^"]*"[^>]*>Struck</);
  // No inline hidden styles anywhere in the SSR output.
  assert.doesNotMatch(markup, /style="[^"]*opacity:\s*0(\.0+)?[;"]/);
  // The live region exists and is empty before any press.
  assert.match(markup, /aria-live="polite"[^>]*><\/p>/);
});

test("Reveal renders its children visible by default (no armed class in SSR)", () => {
  const markup = renderToStaticMarkup(
    React.createElement(Reveal, { delay: 80 }, React.createElement("p", null, "ledger copy"))
  );
  assert.match(markup, /ledger copy/);
  assert.doesNotMatch(markup, /armed/, "nothing is hidden before the first paint");
});

test("the landing page keeps the real ladder, prices and free-tier limit", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  for (const claim of ["5 logs a day", "₹0", "₹99", "formatBand", "AURA_TIERS"]) {
    assert.ok(page.includes(claim), `landing copy missing: ${claim}`);
  }
  for (const fabricated of ["50K+", "12K+", "4.8★", "Active Users"]) {
    assert.ok(!page.includes(fabricated), `fabricated claim returned: ${fabricated}`);
  }
});
