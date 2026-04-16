import type { PresetAnimation } from 'cineview';

interface SceneElement {
  x: number;
  y: number;
  size: number;
  color: string;
  shape: 'circle' | 'square';
  animation: PresetAnimation;
  duration: number;
  delay: number;
  infiniteAnimation?: PresetAnimation;
}

interface SceneConfig {
  background: string;
  enterAnimation: PresetAnimation;
  exitAnimation: PresetAnimation;
  description: string;
  images: string[];
  elements: SceneElement[];
}

const backgrounds = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #f8b500 0%, #fceabb 100%)',
  'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
  'linear-gradient(135deg, #9890e3 0%, #b1f4cf 100%)',
  'linear-gradient(135deg, #ebc0fd 0%, #d9ded8 100%)',
  'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)',
];

// 场景级进场动画 - 多样化
const sceneEnterAnimations: PresetAnimation[] = [
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'fade-in',
  'zoom-in',
  'rotate-in',
  'flip-x',
  'flip-y',
  'bounce-in',
  'blur-in',
  'roll-in',
  'jack-in-the-box',
  'elastic',
  'rubber-band',
];

// 场景级退场动画 - 多样化
const sceneExitAnimations: PresetAnimation[] = [
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'fade-out',
  'zoom-out',
  'rotate-out',
  'flip-x',
  'flip-y',
  'bounce-out',
  'blur-out',
  'roll-out',
  'hinge',
  'fade-out',
  'zoom-out',
];

// 元素级进场动画 - 所有可用动画
const elementAnimations: PresetAnimation[] = [
  'fade-in',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-in',
  'scale-up',
  'rotate-in',
  'spin',
  'flip-x',
  'flip-y',
  'bounce-in',
  'blur-in',
  'focus-in',
  'elastic',
  'rubber-band',
  'roll-in',
  'jack-in-the-box',
];

// 持续动画 - 循环播放
const infiniteAnimations: PresetAnimation[] = [
  'pulse',
  'heartbeat',
  'wobble',
  'swing',
  'tada',
  'wave',
  'blink',
  'flash',
  'shake',
  'shake-x',
  'shake-y',
  'vibrate',
  'jello',
];

const colors = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
  '#F8B739',
  '#52B788',
  '#E74C3C',
  '#3498DB',
  '#9B59B6',
  '#1ABC9C',
  '#F39C12',
  '#E67E22',
  '#95A5A6',
  '#34495E',
  '#16A085',
  '#27AE60',
];

const descriptions = [
  '测试场景进退场动画性能',
  '评估多元素动画协调性',
  '测量持续动画内存占用',
  '分析复杂动画流畅度',
  '基准测试场景切换速度',
  '监控 GPU 加速效果',
  '测试图片预加载性能',
  '评估懒加载效率',
  '测量动画组合性能',
  '测试多种动画类型',
  '分析滚动手势性能',
  '基准测试手势检测',
  '测试响应式计算',
  '评估动画延迟效果',
  '测量上下文更新性能',
  '测试事件系统效率',
  '分析渲染优化效果',
  '基准测试状态管理',
  '测试动画合成器',
  '评估无限动画性能',
  '测量预加载效率',
  '测试跨浏览器兼容性',
  '分析内存清理机制',
  '基准测试 API 方法',
  '测试框架整体稳定性',
];

// 测试用图片 URL（使用 placeholder 服务）
const testImages = [
  'https://picsum.photos/400/300?random=1',
  'https://picsum.photos/400/300?random=2',
  'https://picsum.photos/400/300?random=3',
  'https://picsum.photos/400/300?random=4',
  'https://picsum.photos/400/300?random=5',
  'https://picsum.photos/400/300?random=6',
  'https://picsum.photos/400/300?random=7',
  'https://picsum.photos/400/300?random=8',
  'https://picsum.photos/400/300?random=9',
  'https://picsum.photos/400/300?random=10',
];

function generateElements(sceneIndex: number): SceneElement[] {
  // 每个场景 5-8 个元素
  const elementCount = 5 + (sceneIndex % 4);
  const elements: SceneElement[] = [];

  for (let i = 0; i < elementCount; i++) {
    // 分布在屏幕不同位置 - 从左到右排列
    const x = 80 + i * 100;
    const y = 450;
    const size = 60 + ((i * 10) % 40);

    // 每个场景至少有 2 个持续动画元素
    const useInfinite = i < 2 || (i === elementCount - 1 && sceneIndex % 2 === 0);

    elements.push({
      x,
      y,
      size,
      color: colors[(sceneIndex * 3 + i) % colors.length],
      shape: i % 2 === 0 ? 'circle' : 'square',
      animation: elementAnimations[(sceneIndex + i) % elementAnimations.length],
      // 增加延迟时间，让顺序效果更明显：每个元素延迟 300ms
      duration: 600 + i * 100,
      delay: i * 300, // 从 0ms, 300ms, 600ms, 900ms... 依次延迟
      infiniteAnimation: useInfinite
        ? infiniteAnimations[(sceneIndex * 2 + i) % infiniteAnimations.length]
        : undefined,
    });
  }

  return elements;
}

export function generateScenes(count: number): SceneConfig[] {
  const scenes: SceneConfig[] = [];

  for (let i = 0; i < count; i++) {
    // 每 5 个场景加载一张图片进行测试
    const shouldLoadImage = i % 5 === 0 && i < testImages.length;

    scenes.push({
      background: backgrounds[i % backgrounds.length],
      // 使用多样化的场景动画
      enterAnimation: sceneEnterAnimations[i % sceneEnterAnimations.length],
      exitAnimation: sceneExitAnimations[i % sceneExitAnimations.length],
      description: descriptions[i % descriptions.length],
      images: shouldLoadImage ? [testImages[Math.floor(i / 5)]] : [],
      elements: generateElements(i),
    });
  }

  return scenes;
}
