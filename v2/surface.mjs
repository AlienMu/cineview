/**
 * The authoring surface as data (plan v3 §3.6 support; review F-14).
 *
 * Pages, editors, and AI agents need one machine-readable list of what a page may write: the
 * attribute interfaces, preset names, progress sources, eases, events, and error codes. They live
 * across several files that each own their semantics; this walks those files with the TypeScript
 * compiler API (no regex guessing) and writes `v2/dist/surface.json` during the build.
 *
 * Run: `node v2/surface.mjs` (build.mjs calls it after the declarations are emitted).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');

/** Union of string literals behind `type Name = …`. */
function unionMembers(source, file, name) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let out = [];
  const visit = (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
      const collect = (n) => {
        if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal)) out.push(n.literal.text);
        else ts.forEachChild(n, collect);
      };
      collect(node.type);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** `attr` / `'attr'` members of an interface, with optionality and the leading comment's first line. */
function interfaceMembers(source, file, name) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let out = [];
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      for (const m of node.members) {
        if (!ts.isPropertySignature(m) || !m.name) continue;
        const key = m.name.getText(sf).replace(/^['"]|['"]$/g, '');
        const type = m.type ? m.type.getText(sf) : '';
        out.push({ name: key, type, optional: !!m.questionToken });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/**
 * Keys of an object literal assigned to `export const NAME`, counting shorthand properties
 * (`linear,`) as well as `key: value` pairs. Module-level keys are visited shallowly so a nested
 * object inside a value does not leak its own keys into the list.
 */
function objectKeys(source, file, name) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let out = [];
  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
        if (!ts.isObjectLiteralExpression(d.initializer)) continue;
        for (const prop of d.initializer.properties) {
          if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
            out.push(prop.name.getText(sf).replace(/^['"]|['"]$/g, ''));
          } else if (ts.isSpreadAssignment(prop)) {
            out.push(`…${prop.expression.getText(sf)}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Property names of an interface (`CvEventMap`), in declaration order. */
function interfaceKeys(source, file, name) {
  return interfaceMembers(source, file, name).map((m) => m.name);
}

/** Names registered through `presets.set('name', …)`. */
function presetNames(source) {
  return [...source.matchAll(/presets\.set\('([a-z0-9-]+)'/g)].map((m) => m[1]);
}

/** Mode rules (in `stage.ts`): which progress sources each input accepts. */
function modeRules(source) {
  const rules = [];
  const re = /on="\$\{on\}" is not supported/g;
  if (re.test(source)) {
    rules.push({
      input: 'scroll',
      rejectedInZone: ['enter', 'eye'],
      rejectedInOrdinary: ['scene'],
      note: 'Zone and ordinary scroll differ; `clock` is accepted in both. Drag accepts enter/eye/scene.',
    });
  }
  return rules;
}

export async function buildSurface({ write = true } = {}) {
  const read = (p) => readFile(join(here, p), 'utf8');
  const [jsx, typesSrc, fx, ease, time, errors] = await Promise.all([
    read('src/jsx.ts'),
    read('src/types.ts'),
    read('src/core/fx.ts'),
    read('src/core/ease.ts'),
    read('src/core/time.ts'),
    read('src/core/errors.ts'),
  ]);

  const elements = {};
  for (const [tag, iface] of [
    ['cv-stage', 'CvStageAttributes'],
    ['cv-scene', 'CvSceneAttributes'],
    ['cv-animate', 'CvAnimateAttributes'],
    ['cv-stack', 'CvStackAttributes'],
    ['cv-pause', 'CvPauseAttributes'],
  ]) {
    elements[tag] = interfaceMembers(jsx, 'src/jsx.ts', iface);
  }
  // `<cv-fixed>` declares no attributes; `<cv-video>` extends the animate attributes.
  elements['cv-fixed'] = [];
  elements['cv-video'] = interfaceMembers(jsx, 'src/jsx.ts', 'CvVideoAttributes');

  const surface = {
    generated: new Date().toISOString(),
    versionSource: 'v2/src/jsx.ts (attributes), v2/src/core/{fx,ease,time,errors}.ts',
    elements,
    presets: presetNames(fx).sort(),
    sources: unionMembers(fx, 'src/core/fx.ts', 'Source'),
    eases: objectKeys(ease, 'src/core/ease.ts', 'EASES'),
    events: interfaceKeys(typesSrc, 'src/types.ts', 'CvEventMap'),
    errorCodes: {
      reported: unionMembers(errors, 'src/core/errors.ts', 'ErrorCode'),
      timing: unionMembers(time, 'src/core/time.ts', 'TimeErrorCode'),
    },
    modeRules: modeRules(await read('src/elements/stage.ts')),
    pendingSyntax: [
      {
        name: 'threshold (named form)',
        status: 'not implemented',
        note: 'short:8%, long:50%, time:300ms — see docs/ai/declarative-design.md',
      },
    ],
  };

  if (write) {
    await mkdir(join(here, 'dist'), { recursive: true });
    await writeFile(join(here, 'dist/surface.json'), JSON.stringify(surface, null, 1) + '\n');
  }
  return surface;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const s = await buildSurface();
  console.log(
    `surface: ${Object.keys(s.elements).length} element groups, ${s.presets.length} presets, ` +
      `${s.sources.length} sources, ${s.eases.length} eases, ${s.events.length} events`
  );
}
