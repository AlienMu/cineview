import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../..');
const DRAG_DIR = path.join(ROOT, 'site/src/components/temporal-drag');
const DRAG_CSS = path.join(ROOT, 'site/src/styles/temporal-drag.css');

function sourceFile(filePath: string): ts.SourceFile {
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

function propertyName(node: ts.PropertyName | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function dragSourceFiles(directory = DRAG_DIR): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return dragSourceFiles(entryPath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function jsxTagName(node: ts.JsxTagNameExpression): string | undefined {
  return ts.isIdentifier(node) ? node.text : undefined;
}

function jsxAttributeName(node: ts.JsxAttributeName): string | undefined {
  return ts.isIdentifier(node) ? node.text : undefined;
}

function stringAttribute(attributes: ts.JsxAttributes, attributeName: string): string | undefined {
  const attribute = attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && jsxAttributeName(property.name) === attributeName
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('/drag W0 global baseline contract', () => {
  it('uses the framework default time scale without a local override', () => {
    const file = sourceFile(path.join(DRAG_DIR, 'TemporalDragExperience.tsx'));
    const candidates: ts.ObjectLiteralExpression[] = [];

    walk(file, (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        propertyName(node.name) === 'drag' &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        const names = node.initializer.properties.map((property) => propertyName(property.name));
        if (names.includes('direction') && names.includes('transitionDuration')) {
          candidates.push(node.initializer);
        }
      }
    });

    expect(candidates).toHaveLength(1);
    const properties = new Map(
      candidates[0].properties.map((property) => [propertyName(property.name), property])
    );
    expect(properties.has('scale')).toBe(false);
    const unit = properties.get('unit');
    expect(unit && ts.isPropertyAssignment(unit) && ts.isStringLiteral(unit.initializer)).toBe(
      true
    );
    if (unit && ts.isPropertyAssignment(unit) && ts.isStringLiteral(unit.initializer)) {
      expect(unit.initializer.text).toBe('time');
    }
  });

  it('contains no runtime waitFor property in the temporal-drag implementation', () => {
    const offenders: string[] = [];

    for (const filePath of dragSourceFiles()) {
      const file = sourceFile(filePath);
      walk(file, (node) => {
        if (
          (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
          propertyName(node.name) === 'waitFor'
        ) {
          offenders.push(
            `${path.basename(filePath)}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
          );
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it('keeps deleted chrome, scene labels, and act2 overlays out of runtime and CSS', () => {
    for (const fileName of ['HeaderHUD.tsx', 'FooterBar.tsx', 'TimecodeDisplay.tsx']) {
      expect(fs.existsSync(path.join(DRAG_DIR, fileName))).toBe(false);
    }

    const forbiddenComponentNames = new Set(['HeaderHUD', 'FooterBar', 'TimecodeDisplay']);
    const forbiddenClassPrefixes = [
      /^tp-hud(?:$|__|--)/,
      /^tp-footer(?:$|__|--)/,
      /^s0[1-5]-slate(?:$|__|--)/,
      /^s02-light__viewfinder(?:$|__|--)/,
      /^s02-light__scene-number(?:$|__|--)/,
    ];
    const offenders: string[] = [];

    for (const filePath of dragSourceFiles()) {
      const file = sourceFile(filePath);
      walk(file, (node) => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          forbiddenComponentNames.has(jsxTagName(node.tagName) ?? '')
        ) {
          offenders.push(`${path.relative(DRAG_DIR, filePath)}:${jsxTagName(node.tagName)}`);
        }
        if (ts.isJsxAttribute(node) && jsxAttributeName(node.name) === 'className') {
          const literal =
            node.initializer && ts.isStringLiteral(node.initializer) ? node.initializer.text : '';
          for (const className of literal.split(/\s+/)) {
            if (forbiddenClassPrefixes.some((pattern) => pattern.test(className))) {
              offenders.push(`${path.relative(DRAG_DIR, filePath)}:${className}`);
            }
          }
        }
      });
    }
    expect(offenders).toEqual([]);

    const css = stripCssComments(fs.readFileSync(DRAG_CSS, 'utf8'));
    expect(css).not.toMatch(
      /\.(?:tp-hud|tp-footer|s0[1-5]-slate|s02-light__viewfinder|s02-light__scene-number)(?:\b|__|--)/
    );
  });

  it('keeps all five scenes mounted with their intended bodies', () => {
    const file = sourceFile(path.join(DRAG_DIR, 'TemporalDragExperience.tsx'));
    const actual = new Map<string, string[]>();

    walk(file, (node) => {
      if (!ts.isJsxElement(node) || jsxTagName(node.openingElement.tagName) !== 'Scene') return;
      const sceneId = stringAttribute(node.openingElement.attributes, 'sceneId');
      if (!sceneId) return;
      const childComponents = node.children.flatMap((child) => {
        if (ts.isJsxSelfClosingElement(child)) return [jsxTagName(child.tagName)].filter(Boolean);
        if (ts.isJsxElement(child))
          return [jsxTagName(child.openingElement.tagName)].filter(Boolean);
        return [];
      }) as string[];
      actual.set(sceneId, childComponents);
    });

    expect(Object.fromEntries(actual)).toEqual({
      rolling: ['SceneRolling', 'SceneTexture'],
      slate: ['SceneSlate', 'SceneTexture'],
      sync: ['SceneSync', 'SceneTexture'],
      flux: ['SceneFlux', 'SceneTexture'],
      cut: ['SceneCut', 'SceneTexture'],
    });
  });
});
