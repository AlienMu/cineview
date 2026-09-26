import { useRef } from 'react';
import { Animate, AnimateVideo, Cineview, Scene, type CineviewRef } from 'cineview';
import { useLocation } from 'react-router-dom';
import './VideoTimelinePreviewPage.css';

const copy = {
  zh: {
    intro: '拖动，展开下一帧。',
    instruction: '向上拖到两幕之间，停住，再前后移动。视频与文字会跟随同一次手势。',
    title: '光影之间',
    caption: '标题先出现，说明随后淡入。',
    video: '光影剪辑演示',
    hint: '向上拖动进入 · 向下拖动返回',
    restart: '重新体验',
  },
  en: {
    intro: 'Drag into the next frame.',
    instruction:
      'Drag up, pause between scenes, then move back and forth. The video and text follow the same gesture.',
    title: 'Light in motion',
    caption: 'The title appears first. The caption follows.',
    video: 'Light and motion film',
    hint: 'Drag up to enter · Drag down to return',
    restart: 'Start again',
  },
} as const;

export default function VideoTimelinePreviewPage(): React.JSX.Element {
  const { search } = useLocation();
  const language = new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'zh';
  const text = copy[language];
  const cineview = useRef<CineviewRef>(null);

  return (
    <div className="video-timeline-preview" lang={language}>
      <Cineview ref={cineview} mode="drag" unit="percent" a11y={{ label: text.video }}>
        <Scene sceneId="intro">
          <section className="video-timeline-preview__intro">
            <span className="video-timeline-preview__label">AnimateVideo / 01</span>
            <h1>{text.intro}</h1>
            <p>{text.instruction}</p>
          </section>
        </Scene>
        <Scene sceneId="film" assets={{ preloadImages: ['/act3-edit.mp4'] }}>
          <section className="video-timeline-preview__film">
            <div className="video-timeline-preview__screen">
              <AnimateVideo
                src="/act3-edit.mp4"
                poster="/act3-edit-poster.jpg"
                aria-label={text.video}
                duration={{ enter: 1000 }}
                width="100%"
                height="100%"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="video-timeline-preview__copy">
              <Animate
                animateId="detail-title"
                enterAnimation="fade-in"
                duration={{ enter: 600 }}
                timeline={{ delay: 100 }}
              >
                <h2>{text.title}</h2>
              </Animate>
              <Animate
                enterAnimation="fade-in"
                duration={{ enter: 400 }}
                timeline={{ after: 'detail-title', delay: 100 }}
              >
                <p>{text.caption}</p>
              </Animate>
            </div>
          </section>
        </Scene>
      </Cineview>
      <footer className="video-timeline-preview__footer">
        <span>{text.hint}</span>
        <button type="button" onClick={() => cineview.current?.goToScene(0, false)}>
          {text.restart}
        </button>
      </footer>
    </div>
  );
}
