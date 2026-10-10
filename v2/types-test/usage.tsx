/**
 * Compile-only check of the public declarations (v2/dist/types), run by v2/build.mjs: what a page
 * or a React 19 app writes must type-check, and internals must stay out of reach.
 */
import { useEffect, useRef, type ReactElement } from 'react';
import {
  CvStage,
  type CvEventMap,
  type CvProgressDetail,
  type CvStageElement,
  type ErrorCode,
  type TimelineFrame,
} from 'cineview';
import type {} from 'cineview/jsx';

// ---- elements by tag name --------------------------------------------------------------------
const stage = document.querySelector('cv-stage');
if (stage) {
  stage.goTo('intro', { animated: false });
  stage.goTo(2);
  stage.pause();
  stage.play();
  stage.refresh();
  stage.input = 'drag';
  stage.paused = true;
  const current: number = stage.current;
  void current;
  void stage.ready.then(() => stage.goTo(0));
  // @ts-expect-error read-only
  stage.ready = Promise.resolve();
  // @ts-expect-error internal
  stage.report('message');
  // @ts-expect-error internal
  void stage.engine;
  // @ts-expect-error read-only
  stage.current = 1;
}
const animate = document.createElement('cv-animate');
const stop = animate.timeline.subscribe((frame: TimelineFrame) => frame.progress);
stop();
const phase: 'idle' | 'entering' | 'entered' | 'exiting' | 'exited' = animate.timeline.phase;
void phase;
// @ts-expect-error internal
animate.sendFrame(animate.timeline.frame);
void document.createElement('cv-video').video?.play();

// ---- events ----------------------------------------------------------------------------------
document.addEventListener('cv-enter', (e) => {
  const to: number = e.detail.to;
  const direction: 'forward' | 'backward' = e.detail.direction;
  void [to, direction];
});
document.addEventListener('cv-progress', (e) => {
  const d: CvProgressDetail = e.detail;
  if (d.kind === 'page') void d.direction;
  if (d.kind === 'load') void d.loaded;
  // @ts-expect-error zone progress has no direction
  if (d.kind === 'zone') void d.direction;
});
document.addEventListener('cv-error', (e) => {
  const code: ErrorCode = e.detail.code;
  void [code, e.detail.element];
});
window.addEventListener('cv-ready', () => undefined);
stage?.addEventListener('cv-dragend', (e) => void e.detail.to);
// @ts-expect-error not an error code
const wrongCode: ErrorCode = 'nope';
void wrongCode;

// ---- classes ---------------------------------------------------------------------------------
const first = document.body.firstElementChild;
if (first instanceof CvStage) first.goTo(0);
export class Story extends CvStage {}

// ---- React 19 JSX ----------------------------------------------------------------------------
export const view = (
  <cv-stage
    id="s"
    input="drag"
    transition-duration={800}
    paused={false}
    oncv-enter={(e) => void e.detail.from}
    oncv-error={(e) => void e.detail.code}
  >
    <cv-scene zone preload className="intro">
      <cv-animate
        fx="rise"
        duration={600}
        after="intro"
        stagger
        oncv-progress={(e) => void e.detail.kind}
      >
        <p>Hello</p>
      </cv-animate>
      <cv-video src="a.mp4" range="0 3.2" preload="none" ref={(v) => void v?.timeline} />
    </cv-scene>
    <cv-scene stack covered="recede">
      <cv-stack step={8} covered="dim" duration={500} ref={(k) => void k?.timeline.progress}>
        <div />
        <div />
      </cv-stack>
    </cv-scene>
    <cv-pause for="s">Pause</cv-pause>
  </cv-stage>
);
// @ts-expect-error unknown input
export const wrongInput = <cv-stage input="sideways" />;
// @ts-expect-error covered is dim or recede
export const wrongCovered = <cv-stack covered="fade" />;
// @ts-expect-error handlers get the event's detail type
export const wrongHandler = <cv-scene oncv-enter={(e: CustomEvent<number>) => e.detail} />;

// Server-rendered and hydrated: listeners through a ref (React does not attach oncv-* props while
// hydrating), the ready moment through the promise.
export function Hydrated(): ReactElement {
  const ref = useRef<CvStageElement>(null);
  useEffect(() => {
    const s = ref.current;
    if (!s) return;
    const onEnter = (e: CvEventMap['cv-enter']): void => void e.detail.to;
    s.addEventListener('cv-enter', onEnter);
    void s.ready.then(() => s.goTo(0));
    return (): void => s.removeEventListener('cv-enter', onEnter);
  }, []);
  return <cv-stage ref={ref} />;
}
