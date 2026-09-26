import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Animate, Cineview, Scene, useAnimateTimeline, type DragModeCallbacks } from 'cineview';
import { useLocation } from 'react-router-dom';
import './DragBasicsPreviewPage.css';

const copy = {
  zh: {
    firstLabel: '01 / 当前场景',
    firstTitle: '向上拖动，进入下一幕。',
    firstBody: '拖到两幕中间时先停住，看看它们如何同时出现在画面中。',
    nextLabel: '02 / 目标场景',
    nextTitle: '标题先出现。',
    nextBody: '说明在标题之后开始。确认切换后，未完成的动画接着播放。',
    titleMark: '100ms · 标题',
    detailMark: '800ms · 说明',
    distance: '拖拽距离',
    ready: '向上拖动，观察下一幕的动画。',
    returnHint: '停住后松手：还原当前页',
    nextHint: '停住后松手：前往下一页',
    previousHint: '停住后松手：返回上一页',
    edgeHint: '这个方向没有更多页面，松手还原。',
    fastHint: '快速释放可将阈值从 30% 降至 15%；快速反向释放会还原。',
    releasing: '已释放，等待切换或还原。',
    restored: '已还原。试着拖过 30%，停住再松手。',
    arrived: '已到下一页。向下拖动可返回。',
    elapsed: '第二页元素时间',
  },
  en: {
    firstLabel: '01 / CURRENT SCENE',
    firstTitle: 'Drag up to the next scene.',
    firstBody: 'Hold halfway to see both Scenes on screen at once.',
    nextLabel: '02 / TARGET SCENE',
    nextTitle: 'The title appears first.',
    nextBody: 'The detail follows. Commit the change and unfinished animation continues.',
    titleMark: '100ms · TITLE',
    detailMark: '800ms · DETAIL',
    distance: 'Drag distance',
    ready: 'Drag up to preview the next scene.',
    returnHint: 'Pause, then release: restore this page',
    nextHint: 'Pause, then release: go to the next page',
    previousHint: 'Pause, then release: go to the previous page',
    edgeHint: 'No page in this direction. Release to restore.',
    fastHint: 'A fast release lowers the threshold from 30% to 15%. A fast reversal cancels.',
    releasing: 'Released. Finishing the change or restoring.',
    restored: 'Restored. Drag past 30%, pause, then release.',
    arrived: 'Next page reached. Drag down to return.',
    elapsed: 'Second scene time',
  },
} as const;

function TimelineReadout({
  valueRef,
  fillRef,
}: {
  valueRef: RefObject<HTMLOutputElement | null>;
  fillRef: RefObject<HTMLDivElement | null>;
}): null {
  const { progress } = useAnimateTimeline();

  useEffect(() => {
    const write = (value: number): void => {
      if (valueRef.current) valueRef.current.textContent = `${Math.round(value * 1200)} / 1200 ms`;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${value})`;
    };
    write(progress.get());
    return progress.on('change', write);
  }, [progress, valueRef, fillRef]);

  return null;
}

export default function DragBasicsPreviewPage(): React.JSX.Element {
  const location = useLocation();
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
  const text = copy[language];
  const hintRef = useRef<HTMLParagraphElement>(null);
  const distanceRef = useRef<HTMLOutputElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef<HTMLOutputElement>(null);
  const elapsedFillRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const callbacks = useMemo<DragModeCallbacks>(() => {
    const hint = (message: string): void => {
      if (hintRef.current && hintRef.current.textContent !== message)
        hintRef.current.textContent = message;
    };
    const distance = (progress: number): void => {
      if (distanceRef.current) distanceRef.current.textContent = `${Math.round(progress * 100)}%`;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
    };
    return {
      onDragStart: () => {
        draggingRef.current = true;
      },
      onDragProgress: ({ progress, direction, sceneIndex }) => {
        distance(progress);
        const atEdge =
          (sceneIndex === 0 && direction === 'backward') ||
          (sceneIndex === 1 && direction === 'forward');
        hint(
          atEdge
            ? text.edgeHint
            : progress > 0.3
              ? direction === 'backward'
                ? text.previousHint
                : text.nextHint
              : text.returnHint
        );
      },
      onDragCancel: () => {
        draggingRef.current = false;
        distance(0);
        hint(text.restored);
      },
      onSceneLeave: ({ toIndex }) => {
        draggingRef.current = false;
        distance(0);
        hint(toIndex === 1 ? text.arrived : text.ready);
      },
    };
  }, [text]);

  return (
    <div
      className="drag-basics-preview"
      lang={language}
      onPointerUpCapture={() => {
        if (draggingRef.current && hintRef.current) hintRef.current.textContent = text.releasing;
      }}
    >
      <Cineview
        mode="drag"
        direction="y"
        designWidth={750}
        unit="percent"
        scale={1}
        callbacks={callbacks}
      >
        <Scene sceneId="drag-intro" layout={{ height: '100vh' }}>
          <section className="drag-basics-preview__scene drag-basics-preview__scene--first">
            <p className="drag-basics-preview__label">{text.firstLabel}</p>
            <div className="drag-basics-preview__content">
              <h1>{text.firstTitle}</h1>
              <p className="drag-basics-preview__body">{text.firstBody}</p>
            </div>
          </section>
        </Scene>

        <Scene sceneId="drag-next" layout={{ height: '100vh' }}>
          <section className="drag-basics-preview__scene drag-basics-preview__scene--next">
            <p className="drag-basics-preview__label">{text.nextLabel}</p>
            <div className="drag-basics-preview__content">
              <Animate
                animateId="drag-title"
                enterAnimation={{ initial: { opacity: 0, y: 45 }, animate: { opacity: 1, y: 0 } }}
                duration={{ enter: 600 }}
                timeline={{ delay: 100 }}
              >
                <h1>{text.nextTitle}</h1>
              </Animate>
              <Animate
                animateId="drag-detail"
                enterAnimation={{ initial: { opacity: 0, x: 35 }, animate: { opacity: 1, x: 0 } }}
                duration={{ enter: 400 }}
                timeline={{ after: 'drag-title', delay: 100 }}
              >
                <p className="drag-basics-preview__body">{text.nextBody}</p>
              </Animate>
            </div>
            <div className="drag-basics-preview__shape" aria-hidden="true">
              <Animate
                enterAnimation={{
                  initial: { opacity: 0.15, rotate: -60, scale: 0.5 },
                  animate: { opacity: 1, rotate: 0, scale: 1 },
                }}
                duration={{ enter: 1200 }}
              >
                <div className="drag-basics-preview__tile" />
              </Animate>
            </div>
            <div className="drag-basics-preview__readout">
              <Animate
                enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
                duration={{ enter: 1200 }}
              >
                <TimelineReadout valueRef={elapsedRef} fillRef={elapsedFillRef} />
              </Animate>
            </div>
            <div className="drag-basics-preview__timecode" aria-hidden="true">
              <div className="drag-basics-preview__timecode-line">
                <i />
                <i />
              </div>
              <span>{text.titleMark}</span>
              <span>{text.detailMark}</span>
            </div>
          </section>
        </Scene>
      </Cineview>
      <aside className="drag-basics-preview__feedback" aria-label={text.distance}>
        <div className="drag-basics-preview__meters">
          <div className="drag-basics-preview__distance">
            <span>{text.distance}</span>
            <output ref={distanceRef} aria-live="off">
              0%
            </output>
            <div className="drag-basics-preview__distance-track" aria-hidden="true">
              <div ref={fillRef} />
              <i style={{ left: '15%' }} />
              <i style={{ left: '30%' }} />
            </div>
          </div>
          <div className="drag-basics-preview__timeline">
            <span>{text.elapsed}</span>
            <output ref={elapsedRef} aria-live="off">
              0 / 1200 ms
            </output>
            <div className="drag-basics-preview__timeline-track" aria-hidden="true">
              <div ref={elapsedFillRef} />
            </div>
          </div>
        </div>
        <p ref={hintRef} className="drag-basics-preview__decision" role="status">
          {text.ready}
        </p>
        <p className="drag-basics-preview__speed-note">{text.fastHint}</p>
      </aside>
    </div>
  );
}
