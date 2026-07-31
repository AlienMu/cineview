import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  createTicks,
  DIAL_SWEEP_MS,
  readDialEpoch,
  tickSweepDelay,
} from '../../../site/src/components/temporal-drag/DialTicks';
import {
  ACT1_ENTER_DELAY_MS,
  ACT1_ENTER_MS,
  ACT1_LIVE_SPIN_SECONDS,
  createHandSweepContract,
} from '../../../site/src/components/temporal-drag/SceneRolling';

const ROOT = path.resolve(__dirname, '../../..');
const ACT1_FILES = [
  path.join(ROOT, 'site/src/components/temporal-drag/DialTicks.tsx'),
  path.join(ROOT, 'site/src/components/temporal-drag/SceneRolling.tsx'),
];
const APP_FILE = path.join(ROOT, 'site/src/App.tsx');
const CSS_FILE = path.join(ROOT, 'site/src/styles/temporal-drag.css');
const ZH_FILE = path.join(ROOT, 'site/src/i18n/zh.ts');
const EN_FILE = path.join(ROOT, 'site/src/i18n/en.ts');

function parse(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

function propertyName(name: ts.PropertyName | undefined): string | undefined {
  if (!name) return undefined;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

function jsxTagName(node: ts.JsxTagNameExpression): string {
  return node.getText();
}

function jsxAttributeName(node: ts.JsxAttributeName): string | undefined {
  return ts.isIdentifier(node) ? node.text : undefined;
}

function stripComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('/drag W1 calibration dial contract', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('samples one real-clock epoch with fractional minute-hand advance', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T12:34:45.000Z'));

    expect(readDialEpoch()).toEqual({ secondAngle: 270, minuteAngle: 208.5 });
  });

  it('maps the 60 independent tick lanes onto one closed 3000ms sweep', () => {
    expect(DIAL_SWEEP_MS).toBe(3000);

    const ticks = createTicks(90, 240, 720, (milliseconds) => milliseconds);
    expect(ticks).toHaveLength(60);
    expect(ticks.map((tick) => tick.animateId)).toEqual(
      Array.from({ length: 60 }, (_, index) => `s01-tick-${index}`)
    );
    expect(new Set(ticks.map((tick) => tick.animateId)).size).toBe(60);
    expect(ticks.every((tick) => tick.duration.enter === 240 && tick.duration.exit === 720)).toBe(
      true
    );

    expect(tickSweepDelay(15, 90)).toBe(0);
    expect(tickSweepDelay(16, 90)).toBe(50);
    expect(tickSweepDelay(14, 90)).toBe(2950);
    expect(tickSweepDelay(0, 354)).toBe(50);
    expect(tickSweepDelay(59, 354)).toBe(0);

    const sortedDelays = ticks.map((tick) => tick.timeline.delay).sort((a, b) => a - b);
    expect(sortedDelays).toEqual(Array.from({ length: 60 }, (_, index) => index * 50));
    expect(sortedDelays.filter((delay) => delay < 300)).toHaveLength(6);
  });

  it('keeps the authored opening budget and hand lifecycle exact', () => {
    expect(ACT1_ENTER_DELAY_MS).toEqual({
      ring: 0,
      hand: 0,
      number: 60,
      eyebrow: 80,
      title: 140,
      lang: 200,
      actions: 300,
    });
    expect(ACT1_ENTER_MS).toEqual({
      ring: 420,
      handFade: 880,
      handSweep: 3000,
      number: 460,
      eyebrow: 440,
      title: 560,
      lang: 400,
      actions: 460,
    });
    expect(ACT1_LIVE_SPIN_SECONDS).toEqual({ second: 60, minute: 3600 });

    expect(createHandSweepContract(270)).toEqual({
      enterAnimation: {
        initial: { rotate: 270 },
        animate: { rotate: 630 },
      },
      exitAnimation: { exit: { rotate: 270 } },
    });
  });

  it('wires descriptors, one epoch, live hands, and the in-scene language toggle', () => {
    const forbiddenTimelineProperties: string[] = [];
    const sceneFile = parse(ACT1_FILES[1]);
    const tickFile = parse(ACT1_FILES[0]);
    let createTicksCalls = 0;
    let tickMapAnimateBindings = 0;
    let handContractCalls = 0;
    let handContractEnterBindings = 0;
    let handContractExitBindings = 0;
    let epochInitializerCount = 0;
    let liveLaneBindings = 0;
    let langToggleCount = 0;
    let gatedLangToggleCount = 0;

    for (const file of [sceneFile, tickFile]) {
      walk(file, (node) => {
        if (
          (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
          ['waitFor', 'stagger'].includes(propertyName(node.name) ?? '')
        ) {
          forbiddenTimelineProperties.push(`${path.basename(file.fileName)}:${node.getText()}`);
        }
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'createTicks'
        ) {
          createTicksCalls += 1;
          expect(node.arguments.map((argument) => argument.getText())).toEqual([
            'epoch.secondAngle',
            'timing.duration(TICK_ENTER_MS)',
            'timing.duration(exitMs)',
            'timing.delay',
          ]);
        }
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText() === 'ticks' &&
          node.expression.name.text === 'map'
        ) {
          const callback = node.arguments[0];
          if (callback) {
            walk(callback, (child) => {
              if (!ts.isJsxOpeningElement(child) || jsxTagName(child.tagName) !== 'Animate') return;
              const attributes = new Map(
                child.attributes.properties
                  .filter(ts.isJsxAttribute)
                  .map((attribute) => [
                    jsxAttributeName(attribute.name),
                    attribute.initializer?.getText(),
                  ])
              );
              if (
                attributes.get('key') === '{tick.animateId}' &&
                attributes.get('animateId') === '{tick.animateId}' &&
                attributes.get('duration') === '{tick.duration}' &&
                attributes.get('timeline') === '{tick.timeline}'
              ) {
                tickMapAnimateBindings += 1;
              }
            });
          }
        }
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'createHandSweepContract'
        ) {
          handContractCalls += 1;
        }
        if (ts.isJsxAttribute(node) && jsxAttributeName(node.name) === 'enterAnimation') {
          if (node.initializer?.getText() === '{sweep.enterAnimation}')
            handContractEnterBindings += 1;
        }
        if (ts.isJsxAttribute(node) && jsxAttributeName(node.name) === 'exitAnimation') {
          if (node.initializer?.getText() === '{sweep.exitAnimation}')
            handContractExitBindings += 1;
        }
        if (
          ts.isVariableDeclaration(node) &&
          node.name.getText() === '[epoch]' &&
          node.initializer?.getText() === 'useState<DialEpoch>(readDialEpoch)'
        ) {
          epochInitializerCount += 1;
        }
        if (
          ts.isJsxAttribute(node) &&
          jsxAttributeName(node.name) === 'infiniteAnimation' &&
          node.initializer?.getText().includes('timing.reduced') &&
          node.initializer.getText().includes('? undefined') &&
          node.initializer.getText().includes('ACT1_LIVE_SPIN_SECONDS[variant]') &&
          node.initializer.getText().includes('repeat: Infinity')
        ) {
          liveLaneBindings += 1;
        }
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          jsxTagName(node.tagName) === 'LangToggle'
        ) {
          langToggleCount += 1;
        }
        if (ts.isJsxElement(node) && jsxTagName(node.openingElement.tagName) === 'Animate') {
          const isLangLane = node.openingElement.attributes.properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              jsxAttributeName(attribute.name) === 'animateId' &&
              attribute.initializer?.getText() === '{ROLL.lang}'
          );
          if (isLangLane) {
            let nestedLangToggleCount = 0;
            for (const child of node.children) {
              walk(child, (descendant) => {
                if (
                  (ts.isJsxOpeningElement(descendant) || ts.isJsxSelfClosingElement(descendant)) &&
                  jsxTagName(descendant.tagName) === 'LangToggle'
                ) {
                  nestedLangToggleCount += 1;
                }
              });
            }
            if (nestedLangToggleCount === 1) gatedLangToggleCount += 1;
          }
        }
      });
    }

    expect(forbiddenTimelineProperties).toEqual([]);
    expect(createTicksCalls).toBe(1);
    expect(tickMapAnimateBindings).toBe(1);
    expect(handContractCalls).toBe(1);
    expect(handContractEnterBindings).toBe(1);
    expect(handContractExitBindings).toBe(1);
    expect(epochInitializerCount).toBe(1);
    expect(liveLaneBindings).toBe(1);
    expect(langToggleCount).toBe(1);
    expect(gatedLangToggleCount).toBe(1);

    const sceneSource = stripComments(fs.readFileSync(ACT1_FILES[1], 'utf8'));
    expect(sceneSource).toContain('<DialTicks epoch={epoch}');
    expect(sceneSource).toContain('startAngle={epoch.secondAngle}');
    expect(sceneSource).toContain('startAngle={epoch.minuteAngle}');

    const app = stripComments(fs.readFileSync(APP_FILE, 'utf8'));
    expect(app).toContain("const isDrag = pathname === '/drag'");
    expect(app).toContain('{isDrag || isAcceptance ? null : <LangToggle />}');
  });

  it('keeps the deleted subtitle and directional-sector treatment out of act 1', () => {
    const runtime = stripComments(
      ACT1_FILES.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
    );
    const css = stripComments(fs.readFileSync(CSS_FILE, 'utf8'));
    const dictionaries = `${fs.readFileSync(ZH_FILE, 'utf8')}\n${fs.readFileSync(EN_FILE, 'utf8')}`;

    expect(runtime).not.toMatch(/s01-subtitle|is-forward-sector|is-backward-sector/);
    expect(css).not.toMatch(/\.s01-subtitle\b|\.is-forward-sector\b|\.is-backward-sector\b/);
    expect(dictionaries).not.toContain('dragTemporal.s01.subtitle');
  });
});
