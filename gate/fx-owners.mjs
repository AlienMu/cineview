import { join } from 'node:path';

const clamp = (n) => Math.min(1, Math.max(0, n));
const near = (a, b, tolerance = 0.05) => Number.isFinite(a) && Math.abs(a - b) < tolerance;
const inset = (text) => {
  const n = text.match(/[-\d.]+/g)?.map(Number) ?? [];
  return [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]];
};

/** Ordinary same-source output semantics. Reuses the runtime gate's page and cleanup. */
export async function runFxOwners({ page, row, check, frames, bounded, output }) {
  const { context, engine } = row;
  const enter = context.startsWith('enter-'),
    zone = context.startsWith('zone-');
  row.profileId = 'AUTH-FX-LAST-OWNER';
  row.authoring = {
    duration: 1000,
    ease: 'linear',
    box: [320, 200],
    source: enter ? 'enter' : 'scene',
    drag: { unit: 'percent', scale: 1 },
    ordinaryOracle:
      'Paused public time progress witnesses output mapping; not an independent visibility-clock timing check. Unregistered variables use sampled keyframes in ordinary playback.',
  };
  row.commands = [];
  row.nativeCoverage = [];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const family of ['owners', 'raw', 'numeric'])
    for (const reverse of [false, true]) {
      await bounded(
        page.evaluate(
          async ({ context, enter, family, reverse }) => {
            history.replaceState(null, '', location.pathname + location.search);
            window.fxOwnerInputController?.abort();
            const ready = bench.mount({ ids: [], context, variant: 'mixed-source' });
            const stage = document.querySelector('cv-stage'),
              a = document.querySelector('#A');
            if (context === 'drag') {
              stage.setAttribute('unit', 'percent');
              stage.setAttribute('scale', '1');
            }
            if (enter) stage.pause();
            const items =
              family === 'numeric'
                ? ['rise(20px)', 'rise(40px)', 'push(1,1.2)', 'push(1,1.4)']
                : ['hue(90deg)', 'hue(180deg)', 'wipe(left)', 'wipe(right)'];
            a.setAttribute('fx', (reverse ? items.reverse() : items).join(', '));
            a.setAttribute('on', enter ? 'enter' : 'scene');
            a.setAttribute('duration', '1000');
            a.setAttribute('ease', 'linear');
            a.style.cssText =
              'position:absolute;left:240px;top:40px;width:320px;height:200px;margin:0;padding:0;border:0';
            a.firstElementChild.id = 'fx-subject';
            a.firstElementChild.style.cssText =
              'display:block;position:relative;width:320px;height:200px;margin:0;padding:0;border:0;background:linear-gradient(90deg,#c46a39 50%,#306558 50%);color:white';
            a.firstElementChild.innerHTML =
              'Ordinary effects <span id="fx-consumer" style="position:absolute;left:148px;top:88px;width:24px;height:24px;background:black;transform:rotate(var(--cv-hue,0deg))"></span>';
            if (family === 'raw') {
              a.setAttribute('from', '--cv-hue:10deg; clip:inset(0 80% 0 0)');
              a.setAttribute('to', '--cv-hue:30deg; clip:inset(0 0 0 0)');
            }
            const sheet = document.querySelector('#middle .sheet');
            sheet.style.cssText =
              'display:flow-root;position:relative;padding:0;margin:0;border:0;height:800px;min-height:800px';
            const control = document.createElement('cv-animate');
            control.id = 'fx-control';
            control.setAttribute('on', 'page');
            control.setAttribute('fx', 'fade');
            control.setAttribute('ease', 'linear');
            control.style.cssText = 'position:absolute;left:800px;top:40px;width:160px;height:80px';
            control.innerHTML =
              '<div style="width:160px;height:80px;background:#172b29;color:white">Page opacity control</div>';
            sheet.append(control);
            window.fxOwnerInputs = [];
            const controller = new AbortController();
            window.fxOwnerInputController = controller;
            for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel'])
              window.addEventListener(
                type,
                (e) => {
                  window.fxOwnerInputs.push({
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
          },
          { context, enter, family, reverse }
        )
      );
      await frames(page);
      const documentTop = await page.evaluate(
        () => document.querySelector('#middle').getBoundingClientRect().top + scrollY
      );
      const capture = async (
        tag,
        commandedProgress = null,
        oracle = commandedProgress === null ? 'public-progress mapping' : 'authored input'
      ) => {
        const s = await page.evaluate(() => {
          const stage = document.querySelector('cv-stage'),
            scene = document.querySelector('#middle'),
            a = document.querySelector('#A'),
            subject = a.firstElementChild;
          const bounds = subject.getBoundingClientRect(),
            control = document.querySelector('#fx-control');
          const layers = a.layers.map((l) => {
            const css = getComputedStyle(l.el);
            return {
              source: l.source,
              kind: l.kind,
              select: l.select,
              vars: [...l.vars],
              attached: !!l.native,
              opacity: +css.opacity,
              scale: css.scale,
              translate: css.translate,
              clip: css.clipPath,
              hue: css.getPropertyValue('--cv-hue'),
              inlineHue: l.el.style.getPropertyValue('--cv-hue'),
              animations: l.el.getAnimations().map((a) => ({
                currentTime: a.currentTime,
                playState: a.playState,
                timeline: a.timeline?.constructor.name,
              })),
            };
          });
          const matrix = new DOMMatrixReadOnly(
            getComputedStyle(document.querySelector('#fx-consumer')).transform
          );
          const hitTargets = [0.125, 0.875].map((fraction) => {
            const x = bounds.left + bounds.width * fraction,
              y = bounds.top + bounds.height / 2,
              target = document.elementFromPoint(x, y);
            return {
              x,
              y,
              tag: target?.localName ?? null,
              id: target?.id ?? null,
              scene: target?.closest('cv-scene')?.id ?? null,
              withinSubject: subject.contains(target),
            };
          });
          return {
            stamp: performance.now(),
            clock: stage.clock.now(),
            current: stage.current,
            paused: stage.paused,
            viewport: [innerWidth, innerHeight],
            stageHeight: stage.clientHeight,
            scrollY,
            maxScrollY: document.documentElement.scrollHeight - innerHeight,
            scene: scene.getBoundingClientRect().toJSON(),
            sceneInteraction: {
              id: scene.id,
              index: [...stage.children].filter((el) => el.localName === 'cv-scene').indexOf(scene),
              inert: scene.inert,
              inertAttribute: scene.hasAttribute('inert'),
              inertAncestor: subject.closest('[inert]')?.id ?? null,
            },
            total: scene.solution.total,
            base: a.getBoundingClientRect().toJSON(),
            probe: bounds.toJSON(),
            frame: { ...a.timeline.frame },
            declaration: {
              fx: a.getAttribute('fx'),
              from: a.getAttribute('from'),
              to: a.getAttribute('to'),
              on: a.getAttribute('on'),
            },
            layers,
            physicalCount: new Set(a.layers.map((l) => l.el)).size,
            nested: a.layers.length === 2 && a.layers[0].el.contains(a.layers[1].el),
            consumerHue: getComputedStyle(subject).getPropertyValue('--cv-hue'),
            matrix: [matrix.a, matrix.b, matrix.c, matrix.d],
            hitTargets,
            hits: hitTargets.map((target) => target.withinSubject),
            control: control.layers.map((l) => ({
              source: l.source,
              attached: !!l.native,
              opacity: +getComputedStyle(l.el).opacity,
              timeline: l.native?.timeline?.constructor.name,
            })),
            supported: {
              view: typeof ViewTimeline === 'function',
              scroll: typeof ScrollTimeline === 'function',
            },
            inputs: [...window.fxOwnerInputs],
            errors: bench.snapshot().errors,
          };
        });
        const p = commandedProgress ?? s.frame.progress;
        Object.assign(s, { family, reverse, tag, p, commandedProgress, oracle });
        row.samples.push(s);
        const expectedCurrent =
          context === 'drag' ? (['committed', 'coverage'].includes(tag) ? 1 : 0) : null;
        const expectedInert = context === 'drag' && expectedCurrent === 0;
        check(
          s.sceneInteraction.id === 'middle' &&
            s.sceneInteraction.index === 1 &&
            (expectedCurrent === null || s.current === expectedCurrent) &&
            s.sceneInteraction.inert === expectedInert &&
            s.sceneInteraction.inertAttribute === expectedInert &&
            s.sceneInteraction.inertAncestor === (expectedInert ? 'middle' : null),
          'Scene interaction eligibility matches the independently scripted phase',
          { expectedCurrent, expectedInert, s }
        );
        check(
          s.viewport[0] === 1280 &&
            s.viewport[1] === 800 &&
            near(s.base.x, 240) &&
            near(s.base.width, 320) &&
            near(s.base.height, 200) &&
            s.total === 1000,
          'fixed authored geometry and 1000ms window',
          s
        );
        check(
          s.layers.every((l) => l.source === (enter ? 'enter' : 'scene')) &&
            near(s.frame.progress, p, 0.003),
          'one contextual source matches the input witness',
          s
        );
        const pageProgress =
          context === 'drag'
            ? clamp((1 - s.scene.top / 800) / 2)
            : s.maxScrollY > 0
              ? s.scrollY / s.maxScrollY
              : 0;
        check(
          s.control.length === 1 &&
            s.control[0].source === 'page' &&
            near(s.control[0].opacity, pageProgress, 0.015),
          'eligible page control follows independent document or Scene geometry',
          s
        );
        if (family === 'numeric') {
          const scale = (1 + 0.2 * p) * (1 + 0.4 * p),
            y = 60 * (1 - p),
            l = s.layers[0];
          const xy =
            l.translate === 'none' ? [0, 0] : l.translate.split(/\s+/).map(Number.parseFloat);
          check(
            s.layers.length === 1 &&
              s.physicalCount === 1 &&
              l.kind === 'time' &&
              near(Number.parseFloat(l.scale), scale, 0.001) &&
              near(xy[0], 0) &&
              near(xy[1] ?? 0, y) &&
              near(l.opacity, p * p, 0.003),
            'ordinary offsets add and scales and opacity multiply',
            { p, scale, y, s }
          );
          check(
            near(s.probe.width, 320 * scale, 0.1) &&
              near(s.probe.height, 200 * scale, 0.1) &&
              near(s.probe.x - s.base.x, 160 * (1 - scale), 0.1) &&
              near(s.probe.y - s.base.y, 100 * (1 - scale) + y, 0.1),
            'author content geometry consumes the combined numeric output',
            { p, scale, y, s }
          );
        } else {
          const rest = s.layers.find((l) => l.kind === 'time'),
            clip = s.layers.find((l) => l.kind === 'clip');
          const hue = family === 'raw' ? 10 + 20 * p : (reverse ? 90 : 180) * p;
          const expectedClip =
            family === 'raw'
              ? [0, 80 * (1 - p), 0, 0]
              : reverse
                ? [0, 100 * (1 - p), 0, 0]
                : [0, 0, 0, 100 * (1 - p)];
          const actualClip = inset(clip?.clip ?? '');
          check(
            s.layers.length === 2 &&
              s.physicalCount === 2 &&
              s.nested &&
              rest?.vars.join(',') === '--cv-hue' &&
              clip?.vars.length === 0 &&
              clip?.inlineHue === '',
            'ordinary variable output and inner clip have separate physical owners',
            s
          );
          // Ordinary WAAPI custom properties are discrete between 60Hz keyframe samples.
          // Check the independently authored owner within half a sample; endpoints stay exact.
          const hueStep = family === 'raw' ? 20 : reverse ? 90 : 180;
          const hueTolerance = enter && p > 0 && p < 1 ? hueStep / 120 + 0.05 : 0.05;
          const actualHue = Number.parseFloat(rest?.hue),
            consumedAngle = (actualHue * Math.PI) / 180;
          check(
            near(actualHue, hue, hueTolerance) && near(Number.parseFloat(s.consumerHue), actualHue),
            'later ordinary effect or appended raw effect owns the inherited variable',
            { p, hue, hueTolerance, s }
          );
          check(
            s.matrix.every((n, i) =>
              near(
                n,
                [
                  Math.cos(consumedAngle),
                  Math.sin(consumedAngle),
                  -Math.sin(consumedAngle),
                  Math.cos(consumedAngle),
                ][i],
                0.001
              )
            ),
            'author content consumes the independently checked owner variable in its actual transform',
            { p, hue, actualHue, s }
          );
          check(
            clip?.clip.startsWith('inset(') && actualClip.every((n, i) => near(n, expectedClip[i])),
            'later ordinary effect or appended raw effect owns the clip',
            { p, expectedClip, s }
          );
          const expectedPaintRegion = [0.125, 0.875].map((x) => {
            const px = s.probe.left + s.probe.width * x,
              py = s.probe.top + s.probe.height / 2;
            return (
              px >= 0 &&
              px < 1280 &&
              py >= 0 &&
              py < 800 &&
              x > expectedClip[3] / 100 &&
              x < 1 - expectedClip[1] / 100
            );
          });
          const expectedHits = expectedPaintRegion.map((inside) => inside && !expectedInert);
          Object.assign(s, { expectedPaintRegion, expectedInteractiveHits: expectedHits });
          check(
            s.hits.every((hit, i) => hit === expectedHits[i]),
            'interactive hits match the independent clip and Scene eligibility',
            { p, expectedClip, expectedPaintRegion, expectedHits, s }
          );
        }
        check(!s.errors.length, 'no cv-error in any authored mount', s.errors);
        if (family === 'owners' && tag === 'middle') {
          const path = join(
            output,
            `${engine}-${context}-${reverse ? 'reverse' : 'forward'}-fx-owner.png`
          );
          if (!row.screenshots?.includes(path)) {
            await page.screenshot({ path });
            (row.screenshots ??= []).push(path);
          }
        }
        return s;
      };
      const wheel = async () => {
        if (zone) {
          await page.evaluate((y) => scrollTo(0, y), documentTop + 500);
          await frames(page);
        }
        const before = await capture('wheel-before');
        let previousY = before.scrollY;
        await page.mouse.move(1100, 500);
        for (const delta of [120, -80]) {
          row.commands.push({ family, reverse, kind: 'wheel', delta });
          await page.mouse.wheel(0, delta);
          await page.waitForTimeout(180);
          await frames(page);
          const actual = await page.evaluate(() => scrollY),
            p = zone ? clamp((actual - documentTop) / 1000) : before.p;
          const s = await capture(
            `wheel-${delta}`,
            p,
            zone ? 'document-geometry input' : 'held public-progress mapping'
          );
          check(
            (delta > 0 ? s.scrollY > previousY : s.scrollY < previousY) &&
              s.inputs.some((e) => e.type === 'wheel' && e.trusted && e.deltaY === delta),
            'actual wheel input is observed with the output',
            s
          );
          previousY = s.scrollY;
        }
      };
      if (context === 'drag') {
        await capture('initial', 0);
        await page.mouse.move(1100, 760);
        await page.mouse.down();
        try {
          await page.mouse.move(1100, 759);
          await frames(page);
          for (const p of [0.25, 0.5, 0.75, 0.5, 0.25]) {
            row.commands.push({
              family,
              reverse,
              kind: 'held-pointer',
              p,
              x: 1100,
              y: 759 - 800 * p,
            });
            await page.mouse.move(1100, 759 - 800 * p);
            await frames(page);
            const s = await capture(p === 0.5 ? 'middle' : 'held', p);
            check(
              near(s.scene.top, 800 * (1 - p), 0.75) &&
                s.stageHeight === 800 &&
                s.frame.source === 'gesture',
              'held input supplies independent time and Scene placement',
              s
            );
          }
          await page.waitForTimeout(350);
        } finally {
          await page.mouse.up();
        }
        await page.waitForTimeout(900);
        const cancelled = await capture('cancelled', 0);
        check(
          cancelled.current === 0 && near(cancelled.scene.top, 800, 0.75),
          'long quarter-page release returns and restores the start output',
          cancelled
        );
        await page.mouse.move(1100, 760);
        await page.mouse.down();
        try {
          await page.mouse.move(1100, 759);
          await page.mouse.move(1100, 159);
          await frames(page);
          await capture('commit-held', 0.75);
          await page.waitForTimeout(350);
        } finally {
          await page.mouse.up();
        }
        await page.waitForTimeout(1400);
        const complete = await capture('committed', 1);
        check(
          complete.current === 1 && near(complete.scene.top, 0, 0.75),
          'committed input reaches readable completed output',
          complete
        );
      } else if (zone) {
        for (const p of [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
          row.commands.push({
            family,
            reverse,
            kind: 'document-position',
            p,
            y: documentTop + 1000 * p,
          });
          await page.evaluate((y) => scrollTo(0, y), documentTop + 1000 * p);
          await frames(page);
          const s = await capture(p === 0.5 ? 'middle' : 'position', p);
          check(
            near(s.scrollY, documentTop + 1000 * p) &&
              near(s.scene.top, -1000 * p) &&
              near(s.scene.height, 1800) &&
              s.frame.source === 'scroll',
            'zone output uses authored milliseconds as scroll distance',
            s
          );
        }
      } else {
        await page.evaluate((y) => scrollTo(0, y), documentTop - 120);
        await frames(page);
        await page.waitForFunction(
          () => document.querySelector('#A').timeline.phase === 'entering'
        );
        await capture('initial', 0);
        for (const target of [0.25, 0.5, 0.75, 1]) {
          await page.evaluate(() => document.querySelector('cv-stage').play());
          await page.waitForFunction(
            (p) => document.querySelector('#A').timeline.progress >= p,
            target
          );
          await page.evaluate(() => document.querySelector('cv-stage').pause());
          await frames(page);
          const s = await capture(target === 0.5 ? 'middle' : 'paused');
          check(
            // Clock subtraction can put an exact target a few floating-point units below it.
            s.paused && s.p >= target - 1e-9 && s.p <= Math.min(1, target + 0.1) + 1e-9,
            'ordinary paused progress witnesses the declared output mapping',
            s
          );
          if (family === 'owners' && !reverse && target === 0.5) await wheel();
        }
        const held = await capture('held');
        await page.waitForTimeout(150);
        const still = await capture('held-still');
        check(near(held.p, still.p, 0.0001), 'ordinary completed output holds under public pause', {
          held,
          still,
        });
      }
      if (family === 'owners' && !reverse && zone) await wheel();
      const last = await capture('coverage');
      const requested = context.endsWith('auto'),
        pageNativeSupported = last.supported.view && last.supported.scroll,
        sceneNativeSupported = last.supported.view;
      row.nativeCoverage.push({
        family,
        reverse,
        requested,
        pageNativeSupported,
        sceneNativeSupported,
        layers: last.control,
        scope: 'Native scroll attachment, not compositor execution or performance.',
      });
      check(
        requested && pageNativeSupported ? last.control[0].attached : !last.control[0].attached,
        'eligible page-control attachment matches actual platform and selected input path',
        last
      );
      check(
        family === 'numeric' && context === 'zone-auto' && sceneNativeSupported
          ? last.layers[0].attached
          : last.layers.every((l) => !l.attached),
        'ordinary output records its actual eligible or ineligible scroll-native path',
        last
      );
    }
  await page.evaluate(() => window.fxOwnerInputController?.abort());
}
