import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PandaColors,
  SectionHeader,
  PandaCard,
  StatBlock,
  GalleryFrame,
  CtaButton,
  FunFactBubble,
  ProgressDots,
  BambooDivider,
} from './PandaSharedBlocks';

describe('SectionHeader', () => {
  it('renders number, title, and subtitle', () => {
    const markup = renderToStaticMarkup(
      <SectionHeader number="01 / 档案" title="熊猫档案" subtitle="了解大熊猫" />
    );

    expect(markup).toContain('01 / 档案');
    expect(markup).toContain('熊猫档案');
    expect(markup).toContain('了解大熊猫');
    expect(markup).toContain('🐼');
  });

  it('uses custom color when provided', () => {
    const markup = renderToStaticMarkup(<SectionHeader number="04" title="趣知" color="#FF7043" />);

    expect(markup).toContain('04');
    expect(markup).toContain('趣知');
    // Should have styled badge with the custom color
    expect(markup).toContain('#FF7043');
  });
});

describe('PandaCard', () => {
  it('renders emoji, title, and description', () => {
    const markup = renderToStaticMarkup(<PandaCard emoji="⚖️" title="体重" desc="70 – 125 kg" />);

    expect(markup).toContain('⚖️');
    expect(markup).toContain('体重');
    expect(markup).toContain('70 – 125 kg');
  });

  it('renders without optional desc', () => {
    const markup = renderToStaticMarkup(<PandaCard emoji="🎋" title="竹子" />);

    expect(markup).toContain('🎋');
    expect(markup).toContain('竹子');
  });

  it('accepts width and accentColor props', () => {
    const markup = renderToStaticMarkup(
      <PandaCard emoji="🌍" title="Test" width={200} accentColor="#FF8F00" />
    );

    expect(markup).toContain('Test');
    expect(markup).toContain('200'); // width applied to style
    expect(markup).toContain('#FF8F00'); // accent color in gradient
  });
});

describe('StatBlock', () => {
  it('renders value, label, and icon', () => {
    const markup = renderToStaticMarkup(<StatBlock value="~1,864" label="野外种群" icon="🌍" />);

    expect(markup).toContain('~1,864');
    expect(markup).toContain('野外种群');
    expect(markup).toContain('🌍');
  });

  it('renders without optional icon', () => {
    const markup = renderToStaticMarkup(<StatBlock value="600+" label="圈养数量" />);

    expect(markup).toContain('600+');
    expect(markup).toContain('圈养数量');
  });
});

describe('GalleryFrame', () => {
  it('renders children and optional label', () => {
    const markup = renderToStaticMarkup(
      <GalleryFrame size={100} label="竹林">
        <span>🖼️</span>
      </GalleryFrame>
    );

    expect(markup).toContain('🖼️');
    expect(markup).toContain('竹林');
  });

  it('renders without label', () => {
    const markup = renderToStaticMarkup(
      <GalleryFrame size={140}>
        <span>🎨</span>
      </GalleryFrame>
    );

    expect(markup).toContain('🎨');
  });
});

describe('CtaButton', () => {
  it('renders button with label', () => {
    const markup = renderToStaticMarkup(<CtaButton label="🔄 再看一次" />);

    expect(markup).toContain('🔄 再看一次');
    expect(markup).toContain('<button');
    expect(markup).toContain('#FF8F00'); // default warmOrange color
  });

  it('accepts custom color and size', () => {
    const markup = renderToStaticMarkup(<CtaButton label="测试" color="#4CAF50" size="large" />);

    expect(markup).toContain('测试');
    expect(markup).toContain('#4CAF50');
    expect(markup).toContain('button');
  });
});

describe('FunFactBubble', () => {
  it('renders fact text', () => {
    const markup = renderToStaticMarkup(
      <FunFactBubble fact="大熊猫每天花10-16小时进食" color={PandaColors.bamboo} align="left" />
    );

    expect(markup).toContain('大熊猫每天花10-16小时进食');
    expect(markup).toContain(PandaColors.bamboo);
  });

  it('renders right-aligned variant', () => {
    const markup = renderToStaticMarkup(
      <FunFactBubble fact="熊猫幼崽在18个月大时才离开母亲" align="right" />
    );

    expect(markup).toContain('熊猫幼崽在18个月大时才离开母亲');
    // Right alignment uses different border-radius pattern
    expect(markup).toContain('20px 20px 4px 20px');
  });
});

describe('ProgressDots', () => {
  it('renders correct number of dots', () => {
    const markup = renderToStaticMarkup(<ProgressDots total={7} current={2} />);

    // Should render 7 dot elements
    const dotMatches = markup.match(/width:(\d+)px/g);
    expect(dotMatches?.length).toBe(7);
  });

  it('highlights the current dot with full width', () => {
    const markup = renderToStaticMarkup(<ProgressDots total={7} current={3} />);

    // The current dot (index 3) should have width: 24px
    const dotWidths = markup
      .match(/width:(\d+)px/g)
      ?.map((m) => parseInt(m.replace('width:', '').replace('px', ''), 10));
    expect(dotWidths?.[3]).toBe(24);
    // Other dots should have width: 8px
    expect(dotWidths?.[0]).toBe(8);
    expect(dotWidths?.[1]).toBe(8);
  });

  it('uses custom color', () => {
    const markup = renderToStaticMarkup(<ProgressDots total={5} current={0} color="#FF8F00" />);

    expect(markup).toContain('#FF8F00');
  });
});

describe('BambooDivider', () => {
  it('renders bamboo emoji divider', () => {
    const markup = renderToStaticMarkup(<BambooDivider />);

    expect(markup).toContain('🎋');
  });
});

describe('PandaColors', () => {
  it('provides all expected color tokens', () => {
    expect(PandaColors).toHaveProperty('bambooDark', '#1B5E20');
    expect(PandaColors).toHaveProperty('bamboo', '#4CAF50');
    expect(PandaColors).toHaveProperty('bambooLight', '#A5D6A7');
    expect(PandaColors).toHaveProperty('warmOrange', '#FF8F00');
    expect(PandaColors).toHaveProperty('coral', '#FF7043');
    expect(PandaColors).toHaveProperty('sunYellow', '#FFD54F');
    expect(PandaColors).toHaveProperty('cream', '#F5F0EB');
    expect(PandaColors).toHaveProperty('darkText', '#263238');
    expect(PandaColors).toHaveProperty('mutedText', '#5D6D7E');
    expect(PandaColors).toHaveProperty('skyBlue', '#81D4FA');
  });
});
