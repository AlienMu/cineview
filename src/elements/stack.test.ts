import { CvStack } from './stack';
import { CvScene } from './scene';

beforeAll(() => {
  customElements.define('cv-stack', CvStack);
  customElements.define('cv-scene', CvScene);
});

function deck(content: string, dealt: boolean) {
  const scene = document.createElement('cv-scene') as CvScene;
  const stack = document.createElement('cv-stack') as CvStack;
  stack.innerHTML = content + '<article>Next</article>';
  stack.setAttribute('covered', 'dim');
  stack.setAttribute('step', '40');
  stack.style.setProperty('--cv-veil', 'rgb(255 0 0 / 60%)');
  stack.scene = scene;
  scene.animates.add(stack);
  const report = jest.fn();
  const build = () => {
    stack.build(
      stack.plan({ timeSource: dealt ? 'scene' : 'enter', reducedMotion: false }, report)
    );
    scene.solve(false);
    stack.cards.forEach((card, i) => {
      card.getBoundingClientRect = () => new DOMRect(0, dealt ? i * 40 : i * 300, 400, 300);
    });
    if (dealt) {
      stack.measureDealt(0, 800);
      stack.writeTime(stack.solved!.end);
    } else {
      stack.measureFlow(0);
      stack.writeScroll(300);
    }
  };
  build();
  return { stack, report, build };
}

it.each([false, true])(
  'tints HTML container cards with nested images/SVG and clears its output (dealt %s)',
  (dealt) => {
    const { stack, report } = deck('<article><img alt=""><svg></svg></article>', dealt);
    const card = stack.cards[0]!;
    expect(report).not.toHaveBeenCalled();
    expect(card.style.getPropertyValue('--cv-cover')).toBe('1');
    expect(card.style.filter).toBe('');
    stack.release();
    expect(card.style.getPropertyValue('--cv-cover')).toBe('');
    expect(card.style.position).toBe('');
    expect(stack.hasAttribute('data-cv-veil')).toBe(false);
    expect(stack.children).toHaveLength(2);
  }
);

it.each(['<img alt="">', '<svg></svg>', '<video></video>'])(
  'reports a direct media card and retains default dimming: %s',
  (content) => {
    const { stack, report, build } = deck(content, true);
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining('--cv-veil requires HTML container cards')
    );
    expect(stack.hasAttribute('data-cv-veil')).toBe(false);
    expect(stack.cards[0]!.style.filter).toBe('brightness(0.5)');
    expect(stack.cards[0]!.style.getPropertyValue('--cv-cover')).toBe('');
    // Correcting the markup uses the same stack and the same tint implementation on rebuild.
    stack.innerHTML = '<article>' + content + '</article><article>Next</article>';
    report.mockClear();
    build();
    expect(report).not.toHaveBeenCalled();
    expect(stack.cards[0]!.style.getPropertyValue('--cv-cover')).toBe('1');
    expect(stack.cards[0]!.style.filter).toBe('');
    stack.release();
  }
);
