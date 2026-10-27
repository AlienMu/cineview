import { join } from 'node:path';

const clamp = (p) => Math.max(0, Math.min(1, p));
const near = (a, b, tolerance = 0.05) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;
const declarations = {
  'E-F':
    'hue(90deg) entry, wipe(left) entry, hue(180deg) exit, wipe(right) exit, hue(270deg) entry, wipe(center) entry',
  'E-R':
    'wipe(center) entry, hue(270deg) entry, wipe(right) exit, hue(180deg) exit, wipe(left) entry, hue(90deg) entry',
  'E-G':
    'hue(180deg) exit, wipe(right) exit, hue(90deg) entry, wipe(left) entry, hue(270deg) entry, wipe(center) entry',
  'N-F': 'hue(90deg), wipe(left), hue(180deg) cover, wipe(right) cover',
  'N-R': 'wipe(right) cover, hue(180deg) cover, wipe(left), hue(90deg)',
};
const inset = (value) => {
  const n = value.match(/[-\d.]+/g)?.map(Number) ?? [];
  return [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]];
};

/** Range-group order, shared variables and whole versus piece clip ownership. */
export async function runFxRangeOwners({ page, row, check, frames, bounded, output }) {
  const { context, engine } = row;
  const drag = context === 'drag',
    zone = context.startsWith('zone-');
  row.profileId = 'AUTH-FX-RANGE-OWNERS';
  row.authoring = {
    source: 'view(self)',
    box: [320, 200],
    viewport: [1280, 800],
    zoneDuration: zone ? 1200 : 0,
    text: 'MMMM MMMM',
    font: '32px Arial',
    lineHeight: 48,
    textOffset: { hostPadding: 0, relativeSpanTop: 144, referencePaddingTop: 144 },
    scope:
      'Finite range-group/output ownership; view progress derives from geometry, not the public time frame.',
  };
  row.commands = [];
  row.nativeCoverage = [];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [order, fx] of Object.entries(declarations))
    for (const split of [false, true]) {
      const caseId = `${order}-${split ? 'S' : 'W'}`;
      await bounded(
        page.evaluate(
          async ({ context, zone, drag, order, fx, split }) => {
            history.replaceState(null, '', location.pathname + location.search);
            window.fxRangeInputController?.abort();
            const ready = bench.mount({ ids: [], context, variant: 'mixed-source' });
            const stage = document.querySelector('cv-stage'),
              a = document.querySelector('#A');
            if (drag) {
              stage.setAttribute('unit', 'percent');
              stage.setAttribute('scale', '1');
            }
            a.removeAttribute('duration');
            a.setAttribute('on', 'view(self)');
            a.setAttribute('fx', fx);
            a.setAttribute('ease', 'linear');
            a.style.cssText =
              'display:block;position:absolute;left:240px;top:40px;width:320px;height:200px;box-sizing:border-box;margin:0;border:0;padding:0';
            if (order.startsWith('N')) {
              a.setAttribute('from', '--cv-hue:10deg; clip:inset(0 80% 0 0)');
              a.setAttribute('to', '--cv-hue:30deg; clip:inset(0 0 0 0)');
            }
            const textStyle =
              'font:32px/48px Arial,sans-serif;font-weight:400;letter-spacing:0;color:#151515;text-align:left;white-space:normal;box-sizing:border-box';
            if (split) {
              a.setAttribute('split', 'words');
              a.style.cssText += ';' + textStyle;
              a.innerHTML =
                '<span id="range-text" style="position:relative;top:144px">MMMM MMMM</span>';
            } else {
              a.innerHTML =
                '<div id="range-subject" style="display:block;position:relative;width:320px;height:200px;background:linear-gradient(90deg,#c46a39 50%,#306558 50%)"><span id="range-consumer" style="position:absolute;left:148px;top:88px;width:24px;height:24px;background:black;transform:rotate(var(--cv-hue,0deg))"></span></div>';
            }
            const sheet = document.querySelector('#middle .sheet');
            sheet.style.cssText =
              'display:flow-root;position:relative;padding:0;margin:0;border:0;height:800px;min-height:800px';
            const reference = document.createElement('div');
            reference.id = 'range-reference';
            reference.style.cssText =
              'position:absolute;left:800px;top:40px;width:320px;height:200px;margin:0;border:0;padding:144px 0 0;' +
              textStyle;
            reference.textContent = 'MMMM MMMM';
            sheet.append(reference);
            if (zone) {
              const carrier = document.createElement('cv-animate');
              carrier.id = 'range-carrier';
              carrier.setAttribute('duration', '1200');
              carrier.setAttribute('aria-hidden', 'true');
              sheet.append(carrier);
            }
            const control = document.createElement('cv-animate');
            control.id = 'range-control';
            control.setAttribute('on', 'page');
            control.setAttribute('fx', 'fade');
            control.setAttribute('ease', 'linear');
            control.style.cssText = 'position:absolute;left:20px;top:240px;width:180px;height:40px';
            control.innerHTML =
              '<div style="width:180px;height:40px;background:#172b29;color:white">Page opacity control</div>';
            sheet.append(control);
            window.fxRangeInputs = [];
            const controller = new AbortController();
            window.fxRangeInputController = controller;
            for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel'])
              window.addEventListener(
                type,
                (e) => {
                  window.fxRangeInputs.push({
                    type,
                    time: e.timeStamp,
                    trusted: e.isTrusted,
                    x: e.clientX,
                    y: e.clientY,
                    deltaY: e.deltaY,
                  });
                },
                { capture: true, passive: true, signal: controller.signal }
              );
            await ready;
            await document.fonts.ready;
          },
          { context, zone, drag, order, fx, split }
        )
      );
      await frames(page);
      const documentTop = await page.evaluate(
        () => document.querySelector('#middle').getBoundingClientRect().top + scrollY
      );
      const groups = order.startsWith('N')
        ? order === 'N-F'
          ? ['null', 'cover']
          : ['cover', 'null']
        : order === 'E-G'
          ? ['exit', 'entry']
          : ['entry', 'exit'];
      const capture = async (tag, targetTop, phase, main = true, oracle = 'commanded geometry') => {
        const s = await page.evaluate(() => {
          const stage = document.querySelector('cv-stage'),
            scene = document.querySelector('#middle'),
            a = document.querySelector('#A'),
            reference = document.querySelector('#range-reference');
          const rect = a.getBoundingClientRect(),
            physical = [...new Set(a.layers.map((l) => l.el))];
          const layers = a.layers.map((l) => {
            const css = getComputedStyle(l.el);
            return {
              source: l.source,
              subject: l.subject,
              kind: l.kind,
              select: l.select,
              range: l.range,
              piece: l.piece,
              item: l.item,
              physical: physical.indexOf(l.el),
              sharedMembers: l.shared?.layers.length ?? 0,
              native: !!l.native,
              nativeTimeline: l.native?.timeline?.constructor.name,
              seek: !!l.seek,
              animations: l.el
                .getAnimations()
                .map((a) => ({ playState: a.playState, timeline: a.timeline?.constructor.name })),
              hue: css.getPropertyValue('--cv-hue'),
              inlineHue: l.el.style.getPropertyValue('--cv-hue'),
              clip: css.clipPath,
              rect: l.el.getBoundingClientRect().toJSON(),
              text: l.el.textContent,
              fragments: l.piece
                ? [...l.el.children].map((el) => ({
                    text: el.textContent,
                    hue: getComputedStyle(el).getPropertyValue('--cv-hue'),
                    rect: el.getBoundingClientRect().toJSON(),
                  }))
                : [],
            };
          });
          const text = reference.firstChild,
            range = document.createRange();
          const words = [
            [0, 4],
            [5, 9],
          ].map(([start, end]) => {
            range.setStart(text, start);
            range.setEnd(text, end);
            return {
              text: text.data.slice(start, end),
              rect: range.getBoundingClientRect().toJSON(),
            };
          });
          const subject = document.querySelector('#range-subject'),
            consumer = document.querySelector('#range-consumer');
          const matrix = consumer
            ? new DOMMatrixReadOnly(getComputedStyle(consumer).transform)
            : null;
          const points = [0.05, 0.125, 0.55, 0.875, 0.95].map((f) => {
            const x = rect.left + rect.width * f,
              y =
                Math.max(0, rect.top) +
                Math.max(0, Math.min(800, rect.bottom) - Math.max(0, rect.top)) / 2,
              target = document.elementFromPoint(x, y);
            return {
              fraction: f,
              x,
              y,
              tag: target?.localName ?? null,
              id: target?.id ?? null,
              scene: target?.closest('cv-scene')?.id ?? null,
              hit: subject ? subject.contains(target) : null,
            };
          });
          const copy = a.shadowRoot.querySelector('[part="split"]'),
            source = a.shadowRoot.querySelector('[part="split-source"]'),
            clips = a.layers.filter((l) => l.kind === 'clip');
          const original = document.querySelector('#range-text')?.firstChild;
          const originalWords = original
            ? [
                [0, 4],
                [5, 9],
              ].map(([start, end]) => {
                range.setStart(original, start);
                range.setEnd(original, end);
                return range.getBoundingClientRect().toJSON();
              })
            : [];
          return {
            stamp: performance.now(),
            scrollY,
            maxScrollY: document.documentElement.scrollHeight - innerHeight,
            viewport: [innerWidth, innerHeight],
            stageHeight: stage.clientHeight,
            current: stage.current,
            scene: scene.getBoundingClientRect().toJSON(),
            shell: scene.shadowRoot.querySelector('.shell').getBoundingClientRect().toJSON(),
            documentTop: scene.getBoundingClientRect().top + scrollY,
            sceneInteraction: {
              id: scene.id,
              index: [...stage.children].filter((el) => el.localName === 'cv-scene').indexOf(scene),
              inert: scene.inert,
              attribute: scene.hasAttribute('inert'),
              ancestor: a.closest('[inert]')?.id ?? null,
            },
            host: rect.toJSON(),
            total: scene.solution.total,
            frame: { ...a.timeline.frame },
            declaration: {
              on: a.getAttribute('on'),
              fx: a.getAttribute('fx'),
              split: a.getAttribute('split'),
              from: a.getAttribute('from'),
              to: a.getAttribute('to'),
            },
            layers,
            physicalCount: physical.length,
            clipNested: clips.length === 2 && clips[0].el.contains(clips[1].el),
            reference: {
              host: reference.getBoundingClientRect().toJSON(),
              words,
              font: getComputedStyle(reference).font,
              fontLoaded: document.fonts.check('32px Arial'),
            },
            splitState: copy
              ? {
                  pointerEvents: getComputedStyle(copy).pointerEvents,
                  visibility: getComputedStyle(copy).visibility,
                  sourceOpacity: getComputedStyle(source).opacity,
                  sourceRect: source.getBoundingClientRect().toJSON(),
                  copyRect: copy.getBoundingClientRect().toJSON(),
                  originalWords,
                }
              : null,
            matrix: matrix ? [matrix.a, matrix.b, matrix.c, matrix.d] : null,
            consumerHue: subject ? getComputedStyle(subject).getPropertyValue('--cv-hue') : null,
            points,
            control: document
              .querySelector('#range-control')
              .layers.map((l) => ({
                source: l.source,
                attached: !!l.native,
                timeline: l.native?.timeline?.constructor.name,
                opacity: +getComputedStyle(l.el).opacity,
              })),
            supported: {
              view: typeof ViewTimeline === 'function',
              scroll: typeof ScrollTimeline === 'function',
            },
            inputs: [...window.fxRangeInputs],
            errors: bench.snapshot().errors,
          };
        });
        const top = targetTop,
          e = clamp((800 - top) / 200),
          x = clamp(-top / 200),
          q = clamp((800 - top) / 1000);
        Object.assign(s, { caseId, order, split, tag, phase, main, oracle, targetTop, e, x, q });
        row.samples.push(s);
        const expectedCurrent = drag ? (phase === 'incoming' ? 0 : 1) : null,
          expectedInert = drag && expectedCurrent === 0;
        check(
          s.viewport[0] === 1280 &&
            s.viewport[1] === 800 &&
            near(s.host.left, 240) &&
            near(s.host.top, top, 0.75) &&
            near(s.host.width, 320) &&
            near(s.host.height, 200) &&
            near(s.shell.top + 40, top, 0.75) &&
            near(s.scene.height, zone ? 2000 : 800, 0.75) &&
            s.total === (zone ? 1200 : 0),
          'fixed self subject and authored Scene geometry matches commanded placement',
          s
        );
        check(
          s.sceneInteraction.id === 'middle' &&
            s.sceneInteraction.index === 1 &&
            (expectedCurrent === null || s.current === expectedCurrent) &&
            s.sceneInteraction.inert === expectedInert &&
            s.sceneInteraction.attribute === expectedInert &&
            s.sceneInteraction.ancestor === (expectedInert ? 'middle' : null),
          'Scene interaction eligibility follows the independently scripted phase',
          { expectedCurrent, expectedInert, s }
        );
        check(
          s.declaration.on === 'view(self)' &&
            s.declaration.fx === fx &&
            s.layers.length === 4 &&
            s.layers.every(
              (l) =>
                l.source === 'view' &&
                l.subject === 'self' &&
                !l.native &&
                !l.seek &&
                l.animations.length === 0
            ),
          'public pure-view declarations retain four nonnative logical range plans',
          s
        );
        check(
          s.reference.fontLoaded &&
            s.reference.words.every(
              (w) => w.text === 'MMMM' && w.rect.width > 0 && w.rect.height > 0
            ) &&
            near(s.reference.host.top, top, 0.75) &&
            near(s.reference.host.left, 800),
          'loaded two-word reference preserves independent font geometry',
          s.reference
        );
        const key = (l) => (l.range === null ? 'null' : l.range?.[0]?.name);
        const validRange = (l) =>
          l.range === null ||
          (l.range.length === 2 &&
            l.range[0].name === l.range[1].name &&
            l.range[0].offset === 0 &&
            l.range[1].offset === 1);
        check(
          s.layers.every(validRange),
          'range keys preserve exact null or full named edge declarations',
          s.layers
        );
        const pageProgress = drag ? clamp((1 - s.scene.top / 800) / 2) : s.scrollY / s.maxScrollY;
        check(
          s.control.length === 1 &&
            s.control[0].source === 'page' &&
            near(s.control[0].opacity, pageProgress, 0.015),
          'page control follows independent document or continuous Scene geometry',
          s
        );
        const wholeHue =
          order === 'E-G'
            ? 270 * e
            : order.startsWith('E')
              ? 180 * x
              : order === 'N-F'
                ? 180 * q
                : 10 + 20 * q;
        if (!split) {
          const spaces = s.layers.filter((l) => l.kind === 'space'),
            clips = s.layers.filter((l) => l.kind === 'clip');
          check(
            s.physicalCount === 3 &&
              spaces.length === 2 &&
              clips.length === 2 &&
              spaces[0].physical === spaces[1].physical &&
              spaces.every((l) => l.sharedMembers === 2 && l.select === 'rest') &&
              clips[0].physical !== clips[1].physical &&
              s.clipNested &&
              clips.every((l) => l.select === 'clip') &&
              spaces.map(key).join(',') === groups.join(',') &&
              clips.map(key).join(',') === groups.join(','),
            'whole ranges share the space output and retain separate nested clip owners',
            s
          );
          check(
            spaces.every((l) => near(parseFloat(l.hue), wholeHue)) &&
              near(parseFloat(s.consumerHue), wholeHue),
            'last range group owns the shared whole variable',
            { wholeHue, s }
          );
          const angle = (wholeHue * Math.PI) / 180;
          check(
            s.matrix.every((v, i) =>
              near(
                v,
                [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle)][i],
                0.001
              )
            ),
            'whole author content consumes the independently expected variable',
            { wholeHue, s }
          );
          const expectedClips = order.startsWith('E')
            ? {
                entry:
                  order === 'E-R' ? [0, 100 * (1 - e), 0, 0] : [0, 50 * (1 - e), 0, 50 * (1 - e)],
                exit: [0, 0, 0, 100 * (1 - x)],
              }
            : { null: [0, 80 * (1 - q), 0, 0], cover: [0, 0, 0, 100 * (1 - q)] };
          for (const l of clips)
            check(
              inset(l.clip).every((n, i) => near(n, expectedClips[key(l)][i])),
              'each named whole clip matches its independent range formula',
              { expected: expectedClips[key(l)], layer: l, s }
            );
          const left = Math.max(...Object.values(expectedClips).map((c) => c[3] / 100)),
            right = Math.min(...Object.values(expectedClips).map((c) => 1 - c[1] / 100));
          s.expectedPaintInterval = [left, right];
          for (const point of s.points) {
            const paint =
              top < 800 &&
              top + 200 > 0 &&
              left < right &&
              point.fraction >= left - 1e-12 &&
              point.fraction < right;
            check(
              point.hit === (paint && !expectedInert),
              'whole hit eligibility applies the independent intersection and Scene inert state',
              { point, left, right, expectedInert, s }
            );
          }
        } else {
          check(
            s.physicalCount === 2 &&
              s.layers.every(
                (l) => l.kind === 'space' && l.select === 'all' && l.piece && l.sharedMembers === 2
              ) &&
              s.splitState?.pointerEvents === 'none' &&
              s.splitState.visibility === 'visible' &&
              +s.splitState.sourceOpacity === 0,
            'two measured pieces share range outputs and keep noninteractive copies visible',
            s
          );
          check(
            s.splitState?.originalWords.length === 2 &&
              s.splitState.originalWords.every(
                (r, k) =>
                  near(r.left, s.reference.words[k].rect.left - 560, 0.1) &&
                  near(r.top, s.reference.words[k].rect.top, 0.1) &&
                  near(r.width, s.reference.words[k].rect.width, 0.1) &&
                  near(r.height, s.reference.words[k].rect.height, 0.1)
              ),
            'authored text offset matches the independently padded reference before copy comparison',
            s
          );
          for (let k = 0; k < 2; k++) {
            const pieces = s.layers.filter((l) => l.item === k),
              reference = s.reference.words[k].rect,
              ek = clamp((e - k / 6) / (5 / 6)),
              xk = clamp((x - k / 6) / (5 / 6)),
              qk = clamp((q - k / 6) / (5 / 6));
            const hue =
              order === 'E-G'
                ? 270 * ek
                : order.startsWith('E')
                  ? 180 * xk
                  : order === 'N-F'
                    ? 180 * qk
                    : 10 + 20 * qk;
            const expectedClip =
              order === 'E-G'
                ? [0, 50 * (1 - ek), 0, 50 * (1 - ek)]
                : order.startsWith('E')
                  ? [0, 0, 0, 100 * (1 - xk)]
                  : order === 'N-F'
                    ? [0, 0, 0, 100 * (1 - qk)]
                    : [0, 80 * (1 - qk), 0, 0];
            check(
              pieces.length === 2 &&
                pieces[0].physical === pieces[1].physical &&
                pieces.map(key).join(',') === groups.join(',') &&
                pieces.every(
                  (l) =>
                    l.text === 'MMMM' &&
                    near(parseFloat(l.hue), hue) &&
                    inset(l.clip).every((v, i) => near(v, expectedClip[i]))
                ),
              'each piece uses independent two-word range windows and last-group replacements',
              { k, ek, xk, qk, hue, expectedClip, s }
            );
            check(
              pieces.every(
                (l) =>
                  near(l.rect.left, reference.left - 560, 0.1) &&
                  near(l.rect.top, reference.top, 0.1) &&
                  near(l.rect.width, reference.width, 0.1) &&
                  near(l.rect.height, reference.height, 0.1) &&
                  l.fragments.length === 1 &&
                  l.fragments[0].text === 'MMMM' &&
                  near(parseFloat(l.fragments[0].hue), hue)
              ),
              'piece boxes and inherited variables match the independent static text reference',
              { k, hue, reference, s }
            );
          }
        }
        check(!s.errors.length, 'no cv-error in any range-owner mount', s.errors);
        const witness =
          (caseId === 'E-F-W' && top === -50) ||
          (caseId === 'E-G-S' && top === -50) ||
          (caseId === 'N-F-W' && top === 300) ||
          (caseId === 'N-R-S' && top === 300);
        if (main && witness) {
          const path = join(output, `${engine}-${context}-${caseId}-range-owner.png`);
          await page.screenshot({ path });
          (row.screenshots ??= []).push({
            path,
            caseId,
            sample: row.samples.length - 1,
            targetTop: top,
          });
        }
        return s;
      };
      const position = async (top, tag = 'position', main = true) => {
        const y = top > 40 ? documentTop + 40 - top : documentTop + (zone ? 1200 : 0) + 40 - top;
        row.commands.push({ caseId, kind: 'document-position', top, y });
        await page.evaluate((y) => scrollTo(0, y), y);
        await frames(page);
        const s = await capture(tag, top, 'scroll', main);
        check(
          near(s.scrollY, y, 0.75),
          'actual document position reaches the independent passage command',
          { y, s }
        );
        return s;
      };
      if (drag) {
        await page.mouse.move(1100, 760);
        await page.mouse.down();
        try {
          await page.mouse.move(1100, 759);
          await frames(page);
          for (const f of [0.05, 0.175, 0.3, 0.675]) {
            row.commands.push({ caseId, kind: 'incoming-pointer', fraction: f, y: 759 - 800 * f });
            await page.mouse.move(1100, 759 - 800 * f);
            await frames(page);
            await capture('incoming', 840 - 800 * f, 'incoming');
          }
          await page.waitForTimeout(350);
        } finally {
          await page.mouse.up();
        }
        await page.waitForTimeout(1400);
        await capture('committed', 40, 'current');
        await page.mouse.move(1100, 760);
        await page.mouse.down();
        try {
          await page.mouse.move(1100, 759);
          await frames(page);
          for (const f of [0.05, 0.1125, 0.175, 0.2375, 0.3, 0.175]) {
            row.commands.push({ caseId, kind: 'outgoing-pointer', fraction: f, y: 759 - 800 * f });
            await page.mouse.move(1100, 759 - 800 * f);
            await frames(page);
            await capture('outgoing', 40 - 800 * f, 'current');
          }
          await page.waitForTimeout(350);
        } finally {
          await page.mouse.up();
        }
        await page.waitForTimeout(1000);
        await capture('cancelled', 40, 'current');
      } else {
        for (const top of [800, 700, 600, 300, 40, 0, -50, -100, -150, -200, -100, 40])
          await position(top);
        if (caseId === 'N-F-W') {
          await position(300, 'wheel-before', false);
          await page.mouse.move(1150, 500);
          for (const delta of [120, -80]) {
            const before = await page.evaluate(() => scrollY);
            row.commands.push({ caseId, kind: 'wheel', delta });
            await page.mouse.wheel(0, delta);
            await page.waitForTimeout(180);
            await frames(page);
            const actual = await page.evaluate(() => scrollY),
              top = documentTop + 40 - actual,
              s = await capture(
                'wheel',
                top,
                'scroll',
                false,
                'actual document geometry with trusted wheel'
              );
            check(
              (delta > 0 ? actual > before : actual < before) &&
                s.inputs.some((e) => e.type === 'wheel' && e.trusted && e.deltaY === delta),
              'trusted wheel changes the actual passage used by the output oracle',
              s
            );
          }
        }
      }
      const last = row.samples.at(-1),
        requested = context.endsWith('auto'),
        supported = last.supported.view && last.supported.scroll;
      row.nativeCoverage.push({
        caseId,
        requested,
        supported,
        control: last.control,
        outputs: last.layers.map((l) => ({
          range: l.range,
          kind: l.kind,
          piece: l.piece,
          native: l.native,
        })),
        scope: 'Control attachment only; shared range outputs remain direct-write.',
      });
      check(
        requested && supported ? last.control[0].attached : !last.control[0].attached,
        'page control attachment matches the actual platform and selected context',
        last
      );
      if (drag) {
        const ups = last.inputs.filter((e) => e.type === 'pointerup'),
          downs = last.inputs.filter((e) => e.type === 'pointerdown');
        check(
          ups.length === 2 &&
            downs.length === 2 &&
            ups.every((e, i) => e.trusted && downs[i].trusted && e.time - downs[i].time > 300),
          'both real releases use the independently authored long-gesture path',
          { downs, ups }
        );
      }
    }
  await page.evaluate(() => window.fxRangeInputController?.abort());
}
