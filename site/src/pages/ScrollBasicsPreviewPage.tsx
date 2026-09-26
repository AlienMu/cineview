import { Animate, Cineview, Scene } from 'cineview';
import { useLocation } from 'react-router-dom';
import './ScrollBasicsPreviewPage.css';

const copy = {
  zh: {
    introLabel: '01 / 普通内容',
    introTitle: '先像平常一样阅读。',
    introBody: '标题按时间淡入。即使不滚动，入场动画也会继续播放。',
    zoneLabel: '02 / 锁定区',
    zoneTitle: '画面留在这里。',
    zoneBody: '继续滚动，下一句才会出现。停下或向上滚动，也能停在当前画面或回看。',
    zoneHint: '滚动位置决定动画进度',
    endLabel: '03 / 普通内容',
    endTitle: '接着往下读。',
    endBody: '页面恢复连续滚动。这段文字进入视窗后自行入场，停下滚动仍会播完。',
    scrollHint: '向下滚动',
  },
  en: {
    introLabel: '01 / ORDINARY CONTENT',
    introTitle: 'Read at your own pace.',
    introBody: 'The title fades in over time. Its entrance keeps playing even without scrolling.',
    zoneLabel: '02 / LOCKED ZONE',
    zoneTitle: 'The scene stays here.',
    zoneBody:
      'Keep scrolling to reveal the next line. Stop or scroll back to inspect an earlier frame.',
    zoneHint: 'Scroll position controls animation progress',
    endLabel: '03 / ORDINARY CONTENT',
    endTitle: 'Keep reading.',
    endBody:
      'The page scrolls as usual. This text plays its entrance when visible, even if scrolling stops.',
    scrollHint: 'Scroll down',
  },
} as const;

export default function ScrollBasicsPreviewPage(): React.JSX.Element {
  const location = useLocation();
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
  const text = copy[language];

  return (
    <div className="scroll-basics-preview" lang={language}>
      <Cineview mode="scroll" designWidth={750}>
        <Scene sceneId="reading-start" layout={{ height: '100vh' }}>
          <section className="scroll-basics-preview__scene scroll-basics-preview__scene--reading">
            <div className="scroll-basics-preview__content">
              <p className="scroll-basics-preview__label">{text.introLabel}</p>
              <Animate
                animateId="reading-clock-title"
                enterAnimation={{ initial: { opacity: 0, y: 36 }, animate: { opacity: 1, y: 0 } }}
                duration={{ enter: 1400 }}
                timeline={{ driver: 'clock' }}
              >
                <h1>{text.introTitle}</h1>
              </Animate>
              <Animate
                enterAnimation="fade-in"
                duration={{ enter: 900 }}
                timeline={{ driver: 'clock', after: 'reading-clock-title' }}
              >
                <p className="scroll-basics-preview__body">{text.introBody}</p>
              </Animate>
            </div>
            <p className="scroll-basics-preview__hint">{text.scrollHint} ↓</p>
          </section>
        </Scene>

        <Scene
          sceneId="reading-animation"
          layout={{ height: '100vh' }}
          scroll={{ zoneId: 'reading-animation' }}
        >
          <section className="scroll-basics-preview__scene scroll-basics-preview__scene--locked">
            <p className="scroll-basics-preview__label">{text.zoneLabel}</p>
            <div className="scroll-basics-preview__content">
              <Animate animateId="reading-title" enterAnimation="fade-in" duration={{ enter: 600 }}>
                <h1>{text.zoneTitle}</h1>
              </Animate>
              <Animate
                animateId="reading-detail"
                enterAnimation="fade-in"
                duration={{ enter: 400 }}
                timeline={{ after: 'reading-title', delay: 100 }}
              >
                <p className="scroll-basics-preview__body">{text.zoneBody}</p>
              </Animate>
            </div>
            <p className="scroll-basics-preview__hint">{text.zoneHint}</p>
          </section>
        </Scene>

        <Scene sceneId="reading-end" layout={{ height: '100vh' }}>
          <section className="scroll-basics-preview__scene scroll-basics-preview__scene--reading scroll-basics-preview__scene--end">
            <div className="scroll-basics-preview__content">
              <p className="scroll-basics-preview__label">{text.endLabel}</p>
              <Animate
                enterAnimation={{ initial: { opacity: 0, y: 36 }, animate: { opacity: 1, y: 0 } }}
                duration={{ enter: 1400 }}
                timeline={{ driver: 'clock' }}
              >
                <h1>{text.endTitle}</h1>
                <p className="scroll-basics-preview__body">{text.endBody}</p>
              </Animate>
            </div>
          </section>
        </Scene>
      </Cineview>
    </div>
  );
}
