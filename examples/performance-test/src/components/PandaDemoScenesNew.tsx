/**
 * Panda Discovery Journey — Full Feature Demo (7 scenes)
 * Route: http://localhost:3000/#/panda-pro
 *
 * Uses the framework's built-in components (Scene, Animate, Position, Container)
 * and ScenePhoto (which wraps <img>) for all images.
 */

import { Animate, Scene, Position, Container } from 'cineview';
import type { AnimationType, PresetAnimation } from 'cineview';
import {
  PandaColors,
  SectionHeader,
  PandaCard,
  StatBlock,
  GalleryFrame,
  CtaButton,
  FunFactBubble,
  PandaSceneWash,
  ScenePhoto,
} from './PandaSharedBlocks';

// ---------------------------------------------------------------------------
// Image base path
// ---------------------------------------------------------------------------
const IMG = '/images/panda';

// ---------------------------------------------------------------------------
// Custom / composed animations
// ---------------------------------------------------------------------------
const customGlowIn: AnimationType = {
  initial: { opacity: 0, filter: 'blur(8px)', transform: 'scale(0.9)' },
  animate: {
    opacity: 1,
    filter: 'blur(0px)',
    transform: 'scale(1)',
    transition: { duration: 0.8, ease: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
  },
};

const composedPopIn: AnimationType = {
  animations: ['scale-up' as PresetAnimation, 'fade-in' as PresetAnimation],
  mode: 'parallel',
};

const composedSequential: AnimationType = {
  animations: ['slide-up' as PresetAnimation, 'pulse' as PresetAnimation],
  mode: 'sequential',
};

// ---------------------------------------------------------------------------
// Scene transitions
// ---------------------------------------------------------------------------
const T = [
  { enter: 'slide-up' as AnimationType, exit: 'fade-out' as AnimationType, exitDuration: 900 },
  { enter: 'blur-in' as AnimationType, exit: 'slide-up' as AnimationType, exitDuration: 800 },
  { enter: 'zoom-in' as AnimationType, exit: 'rotate-out' as AnimationType, exitDuration: 1000 },
  { enter: 'flip-x' as AnimationType, exit: 'blur-out' as AnimationType, exitDuration: 900 },
  { enter: 'rotate-in' as AnimationType, exit: 'slide-down' as AnimationType, exitDuration: 800 },
  {
    enter: 'jack-in-the-box' as AnimationType,
    exit: 'zoom-out' as AnimationType,
    exitDuration: 1100,
  },
  { enter: 'focus-in' as AnimationType, exit: 'fade-out' as AnimationType, exitDuration: 1200 },
];

// ---------------------------------------------------------------------------
// scene dimensions used by the design: 375 x 700 (mobile portrait)
// content is laid out so nothing overflows
// ---------------------------------------------------------------------------

// ============================================================================
// SCENE 0 — Cover
// ============================================================================
function renderScene0Cover(): JSX.Element {
  return (
    <Scene
      key="panda-0"
      sceneId="panda-cover"
      assets={{ preloadImages: [`${IMG}/panda-face.jpg`] }}
      transition={{
        enterAnimation: T[0].enter,
        exitAnimation: T[0].exit,
        exitDuration: T[0].exitDuration,
      }}
    >
      <PandaSceneWash />
      <Container>
        <Position at={{ x: 25, y: 60 }}>
          <Animate animateId="s0-img" enterAnimation="zoom-in" duration={{ enter: 900, exit: 500 }}>
            <ScenePhoto src={`${IMG}/panda-face.jpg`} alt="Giant Panda" width={325} height={260} />
          </Animate>
        </Position>

        <Position at={{ x: 8, y: 100 }}>
          <Animate
            animateId="s0-deco1"
            enterAnimation="slide-left"
            duration={{ enter: 500 }}
            timeline={{ delay: 400 }}
          >
            <span style={{ fontSize: 50, opacity: 0.5 }}>🎋</span>
          </Animate>
        </Position>

        <Position at={{ x: 310, y: 180 }}>
          <Animate
            animateId="s0-deco2"
            enterAnimation="slide-right"
            duration={{ enter: 500 }}
            timeline={{ delay: 500 }}
          >
            <span style={{ fontSize: 40, opacity: 0.4 }}>🎋</span>
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 350 }}>
          <Animate
            animateId="s0-title"
            enterAnimation="zoom-in"
            duration={{ enter: 700, exit: 400 }}
            timeline={{ waitFor: 's0-img' }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 900,
                color: PandaColors.darkText,
                lineHeight: 1.1,
              }}
            >
              你好，熊猫！
            </h1>
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 420 }}>
          <Animate
            animateId="s0-sub"
            enterAnimation="slide-up"
            duration={{ enter: 550, exit: 350 }}
            timeline={{ waitFor: 's0-title' }}
          >
            <p style={{ margin: 0, fontSize: 15, color: PandaColors.mutedText, lineHeight: 1.65 }}>
              探索大熊猫的奇妙世界
              <br />
              从竹林深处到你的心间 ✨
            </p>
          </Animate>
        </Position>

        <Position at={{ x: 80, y: 540 }}>
          <Animate
            animateId="s0-hint"
            enterAnimation="fade-in"
            duration={{ enter: 500 }}
            timeline={{ delay: 1600 }}
            infiniteAnimation="pulse"
          >
            <span style={{ fontSize: 13, color: PandaColors.bambooLight, fontWeight: 600 }}>
              向上滑动开始探索 ↑
            </span>
          </Animate>
        </Position>
      </Container>
    </Scene>
  );
}

// ============================================================================
// SCENE 1 — Profile
// ============================================================================
function renderScene1Profile(): JSX.Element {
  return (
    <Scene
      key="panda-1"
      sceneId="panda-profile"
      assets={{ preloadImages: [`${IMG}/panda-sitting.jpg`] }}
      transition={{
        enterAnimation: T[1].enter,
        exitAnimation: T[1].exit,
        exitDuration: T[1].exitDuration,
      }}
    >
      <PandaSceneWash />
      <Container>
        <Position at={{ x: 20, y: 32 }}>
          <Animate
            animateId="s1-header"
            enterAnimation="slide-up"
            duration={{ enter: 500, exit: 300 }}
          >
            <SectionHeader number="01 / 档案" title="熊猫档案" subtitle="了解大熊猫的基本信息" />
          </Animate>
        </Position>

        <Position at={{ x: 25, y: 160 }}>
          <Animate animateId="s1-img" enterAnimation="blur-in" duration={{ enter: 700, exit: 400 }}>
            <ScenePhoto
              src={`${IMG}/panda-sitting.jpg`}
              alt="Panda Profile"
              width={150}
              height={180}
            />
          </Animate>
        </Position>

        <Position at={{ x: 195, y: 160 }}>
          <Animate
            animateId="s1-card1"
            enterAnimation="slide-right"
            duration={{ enter: 550, exit: 300 }}
            timeline={{ delay: 200 }}
          >
            <PandaCard emoji="⚖️" title="体重" desc="70 – 125 kg" width={155} />
          </Animate>
        </Position>

        <Position at={{ x: 195, y: 248 }}>
          <Animate
            animateId="s1-card2"
            enterAnimation="slide-right"
            duration={{ enter: 550, exit: 300 }}
            timeline={{ delay: 350 }}
          >
            <PandaCard emoji="📏" title="体长" desc="1.2 – 1.9 米" width={155} />
          </Animate>
        </Position>

        <Position at={{ x: 195, y: 336 }}>
          <Animate
            animateId="s1-card3"
            enterAnimation="slide-right"
            duration={{ enter: 550, exit: 300 }}
            timeline={{ delay: 500 }}
          >
            <PandaCard emoji="⏳" title="寿命" desc="野生 20 年 / 圈养 30 年" width={155} />
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 400 }}>
          <Animate
            animateId="s1-stats"
            enterAnimation="fade-in"
            duration={{ enter: 600, exit: 300 }}
            timeline={{ waitFor: 's1-card3' }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              <StatBlock value="~1,864" label="野外种群" icon="🌍" color={PandaColors.bambooDark} />
              <StatBlock value="600+" label="圈养数量" icon="🏠" color={PandaColors.warmOrange} />
              <StatBlock value="VU" label="保护级别" icon="🛡️" color={PandaColors.coral} />
            </div>
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 540 }}>
          <Animate
            animateId="s1-fact"
            enterAnimation="rubber-band"
            duration={{ enter: 600, exit: 300 }}
            timeline={{ waitFor: 's1-stats' }}
            infiniteAnimation="pulse"
          >
            <FunFactBubble
              fact="大熊猫每天花 10-16 小时进食，可以吃掉 12-38 公斤竹子！"
              color={PandaColors.bamboo}
            />
          </Animate>
        </Position>
      </Container>
    </Scene>
  );
}

// ============================================================================
// SCENE 2 — Bamboo Feast (gallery grid)
// ============================================================================
function renderScene2Feast(): JSX.Element {
  const items = [
    { img: `${IMG}/bamboo-forest.jpg`, label: '竹林', delay: 0 },
    { img: `${IMG}/panda-eating.jpg`, label: '进食', delay: 120 },
    { img: `${IMG}/panda-forest.jpg`, label: '栖息', delay: 240 },
    { img: `${IMG}/panda-sitting.jpg`, label: '休息', delay: 360 },
    { img: `${IMG}/panda-cute.jpg`, label: '可爱', delay: 480 },
    { img: `${IMG}/panda-cub.jpg`, label: '幼崽', delay: 600 },
  ];
  const animations: PresetAnimation[] = [
    'flip',
    'bounce-in',
    'rotate-in',
    'elastic',
    'jack-in-the-box',
    'tada',
  ];

  return (
    <Scene
      key="panda-2"
      sceneId="panda-feast"
      assets={{ preloadImages: [`${IMG}/panda-eating.jpg`, `${IMG}/bamboo-forest.jpg`] }}
      transition={{
        enterAnimation: T[2].enter,
        exitAnimation: T[2].exit,
        exitDuration: T[2].exitDuration,
      }}
    >
      <PandaSceneWash />
      <Container>
        <Position at={{ x: 20, y: 32 }}>
          <Animate
            animateId="s2-header"
            enterAnimation="fade-in"
            duration={{ enter: 400, exit: 300 }}
          >
            <SectionHeader number="02 / 美食" title="竹子盛宴 🎋" subtitle="大熊猫的日常菜单" />
          </Animate>
        </Position>

        <Position at={{ x: 18, y: 140 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, width: 340 }}>
            {items.map((item, i) => (
              <Animate
                key={i}
                animateId={`s2-g-${i}`}
                enterAnimation={i === 3 ? composedPopIn : animations[i]}
                duration={{ enter: 650, exit: 350 }}
                timeline={{ delay: item.delay }}
              >
                <GalleryFrame size={100} borderRadius={16} label={item.label}>
                  <img
                    src={item.img}
                    alt={item.label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </GalleryFrame>
              </Animate>
            ))}
          </div>
        </Position>

        <Position at={{ x: 20, y: 430 }}>
          <Animate
            animateId="s2-info"
            enterAnimation="slide-up"
            duration={{ enter: 600, exit: 300 }}
            timeline={{ delay: 800, waitFor: 's2-g-5' }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              <PandaCard emoji="🎋" title="竹子" desc="99% 的食物来源" width={155} />
              <PandaCard
                emoji="🍎"
                title="水果"
                desc="偶尔的小零食"
                width={155}
                accentColor={PandaColors.coral}
              />
            </div>
          </Animate>
        </Position>

        <Position at={{ x: 135, y: 570 }}>
          <Animate
            animateId="s2-panda"
            enterAnimation="jello"
            duration={{ enter: 700, exit: 400 }}
            timeline={{ delay: 1200 }}
            infiniteAnimation="pulse"
          >
            <span style={{ fontSize: 40 }}>🐼</span>
          </Animate>
        </Position>
      </Container>
    </Scene>
  );
}

// ============================================================================
// SCENE 3 — Habitat (layout + stack + fixed + scene driver)
// ============================================================================
function renderScene3Habitat(): JSX.Element {
  return (
    <Scene
      key="panda-3"
      sceneId="panda-habitat"
      layout={{ anchor: 'center', overflow: 'hidden' }}
      stack={{ mode: 'cover', zIndex: 5 }}
      assets={{ preloadImages: [`${IMG}/panda-forest.jpg`, `${IMG}/panda-climbing.jpg`] }}
      transition={{
        enterAnimation: T[3].enter,
        exitAnimation: T[3].exit,
        exitDuration: T[3].exitDuration,
      }}
    >
      <PandaSceneWash />
      <Container>
        <Position at={{ x: 20, y: 28 }} layer={{ fixed: true }}>
          <Animate
            animateId="s3-header"
            enterAnimation="slide-right"
            duration={{ enter: 500, exit: 300 }}
            timeline={{ driver: 'scene' }}
          >
            <SectionHeader
              number="03 / 家园"
              title="栖息家园"
              subtitle="四川、陕西、甘肃的竹林深处"
            />
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 150 }}>
          <Animate
            animateId="s3-landscape"
            enterAnimation="zoom-in"
            duration={{ enter: 800, exit: 500 }}
            timeline={{ driver: 'scene' }}
          >
            <ScenePhoto
              src={`${IMG}/panda-forest.jpg`}
              alt="Bamboo Forest"
              width={335}
              height={170}
            />
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 350 }}>
          <Animate
            animateId="s3-info1"
            enterAnimation="heartbeat"
            duration={{ enter: 800, exit: 400 }}
            timeline={{ driver: 'scene' }}
          >
            <PandaCard emoji="🏔️" title="海拔" desc="1,500 – 3,000 米的高山竹林" width={335} />
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 445 }}>
          <Animate
            animateId="s3-climb"
            enterAnimation="wave"
            duration={{ enter: 700, exit: 400 }}
            timeline={{ driver: 'scene', delay: 200 }}
          >
            <ScenePhoto
              src={`${IMG}/panda-climbing.jpg`}
              alt="Panda Climbing"
              width={160}
              height={120}
            />
          </Animate>
        </Position>

        <Position at={{ x: 195, y: 445 }}>
          <Animate
            animateId="s3-info2"
            enterAnimation="wobble"
            duration={{ enter: 650, exit: 350 }}
            timeline={{ driver: 'scene', delay: 300 }}
          >
            <PandaCard
              emoji="🌿"
              title="竹林生态"
              desc="与小熊猫、金丝猴等共生"
              width={160}
              accentColor={PandaColors.warmOrange}
            />
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 600 }}>
          <Animate
            animateId="s3-fact"
            enterAnimation="fade-in"
            duration={{ enter: 500, exit: 300 }}
            timeline={{ driver: 'scene' }}
            infiniteAnimation="pulse"
          >
            <FunFactBubble
              fact="中国拥有世界上唯一的野生大熊猫种群，分布在 6 大山系中。"
              color={PandaColors.bambooDark}
            />
          </Animate>
        </Position>
      </Container>
    </Scene>
  );
}

// ============================================================================
// SCENE 4 — Fun Facts (phase + visibility + replayOnReenter)
// ============================================================================
function renderScene4FunFacts(): JSX.Element {
  const leftFacts = [
    {
      fact: '熊猫的"拇指"其实是腕骨特化而成，帮助抓握竹子',
      ani: 'shake' as PresetAnimation,
      phase: { start: 0, end: 0.35 },
    },
    {
      fact: '刚出生的熊猫体重仅 100 克，是母亲的 1/900',
      ani: 'swing' as PresetAnimation,
      phase: { start: 0.1, end: 0.5 },
    },
    {
      fact: '熊猫每天排便约 40 次，因为竹子纤维难以消化',
      ani: 'vibrate' as PresetAnimation,
      phase: { start: 0.2, end: 0.65 },
    },
  ];
  const rightFacts = [
    {
      fact: '野外大熊猫没有固定的巢穴，哪里有竹子就在哪里安家',
      ani: 'roll-in' as PresetAnimation,
      phase: { start: 0.15, end: 0.55 },
    },
    {
      fact: '熊猫幼崽在 18 个月大时才离开母亲独立生活',
      ani: 'hinge' as PresetAnimation,
      phase: { start: 0.3, end: 0.75 },
    },
    {
      fact: '大熊猫在地球上已经生存了至少 800 万年！',
      ani: 'flash' as PresetAnimation,
      phase: { start: 0.4, end: 0.9 },
    },
  ];

  return (
    <Scene
      key="panda-4"
      sceneId="panda-funfacts"
      callbacks={{
        onVisibilityChange: (d) => {
          console.log(`[Scene4] visible=${d.visible} progress=${(d.progress * 100).toFixed(0)}%`);
        },
      }}
      transition={{
        enterAnimation: T[4].enter,
        exitAnimation: T[4].exit,
        exitDuration: T[4].exitDuration,
      }}
    >
      <PandaSceneWash
        style={{ background: 'linear-gradient(180deg, #FFF8E1 0%, #F0F7EE 40%, #FFF8E1 100%)' }}
      />
      <Container>
        <Position at={{ x: 20, y: 28 }}>
          <Animate
            animateId="s4-header"
            enterAnimation="slide-up"
            duration={{ enter: 500, exit: 300 }}
          >
            <SectionHeader
              number="04 / 趣知"
              title="你知道吗？"
              subtitle="关于熊猫的有趣冷知识"
              color={PandaColors.coral}
            />
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 145 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {leftFacts.map((item, i) => (
              <Animate
                key={i}
                animateId={`s4-fl-${i}`}
                enterAnimation={item.ani}
                exitAnimation="fade-out"
                duration={{ enter: 500, exit: 250 }}
                timeline={{ phase: item.phase }}
                visibility={{ replayOnReenter: true }}
              >
                <FunFactBubble fact={item.fact} color={PandaColors.bamboo} align="left" />
              </Animate>
            ))}
          </div>
        </Position>

        <Position at={{ x: 190, y: 260 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rightFacts.map((item, i) => (
              <Animate
                key={i}
                animateId={`s4-fr-${i}`}
                enterAnimation={item.ani}
                exitAnimation="fade-out"
                duration={{ enter: 500, exit: 250 }}
                timeline={{ phase: item.phase }}
                visibility={{ replayOnReenter: true }}
              >
                <FunFactBubble fact={item.fact} color={PandaColors.warmOrange} align="right" />
              </Animate>
            ))}
          </div>
        </Position>

        <Position at={{ x: 145, y: 560 }}>
          <Animate
            animateId="s4-panda"
            enterAnimation="zoom-in"
            duration={{ enter: 600, exit: 300 }}
            infiniteAnimation="swing"
          >
            <span style={{ fontSize: 48 }}>🐼</span>
          </Animate>
        </Position>

        <Position at={{ x: 50, y: 630 }}>
          <Animate
            animateId="s4-hint"
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            timeline={{ delay: 1000 }}
            visibility={{ replayOnReenter: true }}
          >
            <span style={{ fontSize: 11, color: PandaColors.mutedText }}>
              提示：上下滑动可重播动画 ↑↓
            </span>
          </Animate>
        </Position>
      </Container>
    </Scene>
  );
}

// ============================================================================
// SCENE 5 — Conservation (custom + composed animations)
// ============================================================================
function renderScene5Conservation(): JSX.Element {
  return (
    <Scene
      key="panda-5"
      sceneId="panda-conservation"
      assets={{ preloadImages: [`${IMG}/panda-cute.jpg`, `${IMG}/panda-cub.jpg`] }}
      transition={{
        enterAnimation: T[5].enter,
        exitAnimation: T[5].exit,
        exitDuration: T[5].exitDuration,
      }}
    >
      <PandaSceneWash
        style={{ background: 'linear-gradient(180deg, #E8F5E9 0%, #FFF8E1 50%, #FCE4EC 100%)' }}
      />
      <Container>
        <Position at={{ x: 20, y: 28 }}>
          <Animate
            animateId="s5-header"
            enterAnimation="slide-down"
            duration={{ enter: 500, exit: 300 }}
          >
            <SectionHeader
              number="05 / 保护"
              title="守护熊猫"
              subtitle="你可以做什么来帮助它们？"
              color={PandaColors.warmOrange}
            />
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 150 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { emoji: '🌍', title: '支持保护组织', desc: 'WWF 等组织致力于大熊猫栖息地保护' },
              { emoji: '♻️', title: '可持续生活', desc: '减少碳足迹，保护地球生态环境' },
              { emoji: '📚', title: '传播知识', desc: '让更多人了解熊猫的生存现状' },
            ].map((item, i) => (
              <Animate
                key={i}
                animateId={`s5-card-${i}`}
                enterAnimation={
                  i === 1 ? composedSequential : i === 0 ? 'slide-right' : 'slide-left'
                }
                duration={{ enter: 600, exit: 300 }}
                timeline={{ delay: i * 150 }}
              >
                <PandaCard
                  emoji={item.emoji}
                  title={item.title}
                  desc={item.desc}
                  width={335}
                  accentColor={PandaColors.warmOrange}
                />
              </Animate>
            ))}
          </div>
        </Position>

        <Position at={{ x: 100, y: 475 }}>
          <Animate
            animateId="s5-custom"
            enterAnimation={customGlowIn}
            duration={{ enter: 800, exit: 400 }}
            timeline={{ delay: 600 }}
          >
            <div style={{ textAlign: 'center' }}>
              <ScenePhoto
                src={`${IMG}/panda-cute.jpg`}
                alt="Protect Pandas"
                width={175}
                height={100}
              />
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: 12,
                  color: PandaColors.mutedText,
                  fontWeight: 600,
                }}
              >
                每一份关注都是力量
              </p>
            </div>
          </Animate>
        </Position>

        <Position at={{ x: 90, y: 630 }}>
          <Animate
            animateId="s5-cta"
            enterAnimation="bounce-in"
            duration={{ enter: 700, exit: 300 }}
            timeline={{ delay: 900 }}
            infiniteAnimation="pulse"
          >
            <CtaButton label="🔄 再看一次" color={PandaColors.warmOrange} size="medium" />
          </Animate>
        </Position>
      </Container>
    </Scene>
  );
}

// ============================================================================
// SCENE 6 — Goodbye
// ============================================================================
function renderScene6Goodbye(): JSX.Element {
  return (
    <Scene
      key="panda-6"
      sceneId="panda-goodbye"
      transition={{
        enterAnimation: T[6].enter,
        exitAnimation: T[6].exit,
        exitDuration: T[6].exitDuration,
      }}
    >
      <PandaSceneWash
        style={{ background: 'linear-gradient(180deg, #263238 0%, #37474F 40%, #455A64 100%)' }}
      />
      <Container>
        {[
          {
            id: 's6-star1',
            x: 40,
            y: 50,
            emoji: '✨',
            size: 24,
            delay: 100,
            infinite: 'pulse' as PresetAnimation,
          },
          {
            id: 's6-star2',
            x: 150,
            y: 30,
            emoji: '⭐',
            size: 20,
            delay: 250,
            infinite: 'flash' as PresetAnimation,
          },
          {
            id: 's6-star3',
            x: 260,
            y: 60,
            emoji: '🌟',
            size: 28,
            delay: 400,
            infinite: 'pulse' as PresetAnimation,
          },
          {
            id: 's6-star4',
            x: 320,
            y: 35,
            emoji: '💫',
            size: 18,
            delay: 550,
            infinite: 'flash' as PresetAnimation,
          },
        ].map((s) => (
          <Position key={s.id} at={{ x: s.x, y: s.y }}>
            <Animate
              animateId={s.id}
              enterAnimation="fade-in"
              duration={{ enter: 300 }}
              timeline={{ delay: s.delay }}
              infiniteAnimation={s.infinite}
            >
              <span style={{ fontSize: s.size }}>{s.emoji}</span>
            </Animate>
          </Position>
        ))}

        <Position at={{ x: 85, y: 120 }}>
          <Animate
            animateId="s6-panda"
            enterAnimation="focus-in"
            duration={{ enter: 800, exit: 500 }}
            infiniteAnimation="wobble"
          >
            <span style={{ fontSize: 100 }}>🐼</span>
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 320 }}>
          <Animate
            animateId="s6-title"
            enterAnimation="slide-up"
            duration={{ enter: 600, exit: 400 }}
            timeline={{ waitFor: 's6-panda' }}
          >
            <div style={{ width: 335, textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: '#ECEFF1' }}>
                再见啦！
              </h1>
              <p style={{ margin: '12px 0 0', fontSize: 14, color: '#90A4AE', lineHeight: 1.6 }}>
                希望你喜欢这次熊猫之旅
                <br />
                下次再来竹林找我们玩 🌿
              </p>
            </div>
          </Animate>
        </Position>

        <Position at={{ x: 20, y: 480 }}>
          <Animate
            animateId="s6-credits"
            enterAnimation="blur-in"
            exitAnimation="roll-out"
            duration={{ enter: 500, exit: 600 }}
            timeline={{ waitFor: 's6-title' }}
          >
            <div style={{ width: 335, display: 'flex', justifyContent: 'center', gap: 16 }}>
              {(['bounce-out', 'flip-y', 'hinge'] as PresetAnimation[]).map((ani, i) => {
                const emojis = ['🎋', '🍃', '🌟'];
                return (
                  <Animate
                    key={i}
                    animateId={`s6-credit-${i}`}
                    enterAnimation="zoom-in"
                    exitAnimation={ani}
                    duration={{ enter: 400, exit: 500 }}
                  >
                    <span style={{ fontSize: 32 }}>{emojis[i]}</span>
                  </Animate>
                );
              })}
            </div>
          </Animate>
        </Position>

        <Position at={{ x: 140, y: 590 }}>
          <Animate
            animateId="s6-zzz"
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            timeline={{ delay: 1800 }}
            infiniteAnimation="pulse"
          >
            <span style={{ fontSize: 20, color: '#78909C', letterSpacing: 4 }}>Z z z</span>
          </Animate>
        </Position>
      </Container>
    </Scene>
  );
}

// ============================================================================
// Export — flat <Scene> array (direct CineView children, NOT wrapper components)
// ============================================================================
export const PandaDemoScenesNew: JSX.Element[] = [
  renderScene0Cover(),
  renderScene1Profile(),
  renderScene2Feast(),
  renderScene3Habitat(),
  renderScene4FunFacts(),
  renderScene5Conservation(),
  renderScene6Goodbye(),
];
