import { useEffect, useState } from 'react';
import { Animate, AnimateVideo, CineView, Scene, useAnimateTimeline } from 'cineview';

interface AcceptanceCounts {
  starts: number;
  blocked: number;
  cancels: number;
  commits: number;
}

const initialCounts: AcceptanceCounts = {
  starts: 0,
  blocked: 0,
  cancels: 0,
  commits: 0,
};

const VIDEO_SCRUB_RANGE = [0, 10] as const;
const ACCEPTANCE_VIDEO_URL = new URL('../../../../site/public/video.mp4', import.meta.url).href;

function ColdStartProbe(): JSX.Element {
  const timeline = useAnimateTimeline();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-page="framework-drag-acceptance"]');
    if (!root) return;

    let previousProgress = timeline.frame.get().progress;
    let minimumProgress = previousProgress;
    let maximumProgress = previousProgress;
    let frameCount = 0;
    let monotonic = true;
    let complete = false;

    const publish = (frame: ReturnType<typeof timeline.frame.get>): void => {
      if (complete) return;
      frameCount += 1;
      minimumProgress = Math.min(minimumProgress, frame.progress);
      maximumProgress = Math.max(maximumProgress, frame.progress);
      if (frame.progress + 0.0001 < previousProgress) monotonic = false;
      previousProgress = frame.progress;

      root.dataset.coldFrames = String(frameCount);
      root.dataset.coldMinimum = String(minimumProgress);
      root.dataset.coldMaximum = String(maximumProgress);
      root.dataset.coldMonotonic = String(monotonic);
      if (frame.phase === 'entering') root.dataset.coldSawEntering = 'true';
      if (frame.phase === 'entered' && frame.progress >= 0.999) {
        root.dataset.coldComplete = 'true';
        complete = true;
      }
    };

    publish(timeline.frame.get());
    return timeline.frame.on('change', publish);
  }, [timeline]);

  return <span data-cold-start-probe aria-hidden="true" />;
}

function markVideoError(): void {
  const root = document.querySelector<HTMLElement>('[data-page="framework-drag-acceptance"]');
  if (root) root.dataset.videoError = 'true';
}

export default function AcceptanceDragPage(): JSX.Element {
  const [currentScene, setCurrentScene] = useState(0);
  const [counts, setCounts] = useState(initialCounts);

  const increment = (key: keyof AcceptanceCounts): void => {
    setCounts((current) => ({ ...current, [key]: current[key] + 1 }));
  };

  return (
    <main
      data-page="framework-drag-acceptance"
      data-current-scene={currentScene}
      data-drag-starts={counts.starts}
      data-drag-blocked={counts.blocked}
      data-drag-cancels={counts.cancels}
      data-drag-commits={counts.commits}
      data-authored-scenes="3"
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <CineView
        callbacks={{
          onDragStart: () => increment('starts'),
          onDragBlocked: () => increment('blocked'),
          onDragCancel: () => increment('cancels'),
          onDragEnd: (detail) => {
            increment('commits');
            setCurrentScene(detail.targetSceneIndex);
          },
        }}
        designWidth={390}
        mode="drag"
        direction="y"
        transitionDuration={180}
      >
        {[0, 1, 2].map((index) => (
          <Scene key={index} drag={index === 2 ? { enabled: false } : undefined}>
            <div
              data-scene-index={index}
              style={{
                alignItems: 'center',
                background: index % 2 === 0 ? '#0a0a0f' : '#181824',
                color: '#fff',
                display: 'flex',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 32,
                height: '100%',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <Animate
                animateId={`acceptance-scene-${index}`}
                duration={{ enter: index === 0 ? 650 : 1200, exit: 120 }}
                enterAnimation="fade-in"
              >
                <span>{`Framework scene ${index}`}</span>
                {index === 0 ? <ColdStartProbe /> : null}
              </Animate>
              {index === 1 ? (
                <AnimateVideo
                  animateId="acceptance-video-1"
                  aria-label="acceptance-video-1"
                  duration={{ enter: 1200 }}
                  onError={markVideoError}
                  preload
                  scrubRange={VIDEO_SCRUB_RANGE}
                  src={ACCEPTANCE_VIDEO_URL}
                  style={{ height: 120, objectFit: 'cover', position: 'absolute', width: 220 }}
                />
              ) : null}
            </div>
          </Scene>
        ))}
      </CineView>
    </main>
  );
}
