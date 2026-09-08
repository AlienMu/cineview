import { act, render } from '@testing-library/react';
import { EditorialIndexScene } from '../../../site/src/components/EditorialIndexScene';
import { AboutScenesScene } from '../../../site/src/components/AboutScenesScene';
import { lutAt } from '../../../site/src/design/lut';
import type { AnimateProps } from '../../types';

let mockReduced = true;
const mockAnimateProps: AnimateProps[] = [];
const originalMatchMedia = window.matchMedia;

jest.mock('../../../site/node_modules/react', () => jest.requireActual('react'));
jest.mock(
  'cineview',
  () => ({
    Animate: (props: AnimateProps) => {
      mockAnimateProps.push(props);
      return props.children;
    },
  }),
  { virtual: true }
);
jest.mock('../../../site/src/i18n', () => ({ useI18n: () => ({ lang: 'zh' }) }));
jest.mock('../../../site/src/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockReduced,
}));

describe('homepage content composition', () => {
  beforeEach(() => {
    mockReduced = true;
    mockAnimateProps.length = 0;
    window.matchMedia = jest.fn(() => ({ matches: false }) as MediaQueryList);
  });
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });
  it('shows content without old implementation labels', () => {
    const view = render(<AboutScenesScene />);
    expect(view.getByRole('heading', { name: /先后有序，\s*时间恰好。/ })).toBeInTheDocument();
    expect(view.getAllByRole('article')).toHaveLength(3);
    expect(view.container.textContent).not.toMatch(/03\s*\/|Animate|SCENES|PAGE LAYERS/);
  });

  it('keeps one composition across skipped chapters, reverse navigation, and resizing', () => {
    const previous = window.IntersectionObserver;
    let notify: IntersectionObserverCallback;
    const disconnect = jest.fn();
    const observer = jest.fn((callback: IntersectionObserverCallback) => {
      notify = callback;
      return { observe: jest.fn(), disconnect };
    });
    window.IntersectionObserver = observer as unknown as typeof IntersectionObserver;
    const root = document.createElement('div');
    root.dataset.cineviewContainer = 'true';
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: 900 });
    document.body.append(root);
    const view = render(<EditorialIndexScene />, { container: root });
    try {
      expect(observer).toHaveBeenLastCalledWith(expect.any(Function), {
        root,
        rootMargin: '-288px 0px -611px 0px',
        threshold: 0,
      });
      const section = root.querySelector('.editorial-index');
      const composition = root.querySelector('figure');
      const chapters = root.querySelectorAll('[data-composition-step]');
      const change = (
        index: number,
        isIntersecting: boolean,
        height = isIntersecting ? 1 : 0
      ): IntersectionObserverEntry =>
        ({
          target: chapters[index],
          isIntersecting,
          intersectionRect: { height },
        }) as IntersectionObserverEntry;
      act(() => notify([change(2, true)], {} as IntersectionObserver));
      expect(section).toHaveAttribute('data-composition', 'lifecycle');
      act(() => notify([change(2, false), change(0, true)], {} as IntersectionObserver));
      expect(section).toHaveAttribute('data-composition', 'combine');
      expect(root.querySelector('figure')).toBe(composition);
      expect(view.getAllByRole('article')).toHaveLength(3);
      // A threshold-0 observer can first report edge contact with zero area,
      // then send no further entry while that same chapter crosses the band.
      act(() => notify([change(0, false), change(1, true, 0)], {} as IntersectionObserver));
      expect(section).toHaveAttribute('data-composition', 'sequence');
      act(() => notify([change(1, false), change(0, true, 0)], {} as IntersectionObserver));
      expect(section).toHaveAttribute('data-composition', 'combine');
      Object.defineProperty(root, 'clientHeight', { value: 600 });
      act(() => window.dispatchEvent(new Event('resize')));
      expect(observer).toHaveBeenLastCalledWith(expect.any(Function), {
        root,
        rootMargin: '-192px 0px -407px 0px',
        threshold: 0,
      });
      window.matchMedia = jest.fn(() => ({ matches: true }) as MediaQueryList);
      const visual = root.querySelector<HTMLElement>('.editorial-index__visual')!;
      visual.style.top = '80px';
      jest.spyOn(visual, 'getBoundingClientRect').mockReturnValue({ height: 320 } as DOMRect);
      act(() => window.dispatchEvent(new Event('resize')));
      expect(observer).toHaveBeenLastCalledWith(expect.any(Function), {
        root,
        rootMargin: '-424px 0px -175px 0px',
        threshold: 0,
      });
      view.unmount();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      view.unmount();
      root.remove();
      window.IntersectionObserver = previous;
    }
  });

  it('does not switch to the next topic while the current topic occupies the reading position', () => {
    const previous = window.IntersectionObserver;
    let notify: IntersectionObserverCallback;
    let margins: number[] = [];
    window.IntersectionObserver = jest.fn((callback, options) => {
      notify = callback;
      margins = options.rootMargin.split(' ').map((margin: string) => parseFloat(margin));
      return { observe: jest.fn(), disconnect: jest.fn() };
    }) as unknown as typeof IntersectionObserver;
    const root = document.createElement('div');
    root.dataset.cineviewContainer = 'true';
    Object.defineProperty(root, 'clientHeight', { value: 900 });
    document.body.append(root);
    const view = render(<EditorialIndexScene />, { container: root });
    try {
      const section = root.querySelector('.editorial-index');
      const chapters = root.querySelectorAll('[data-composition-step]');
      const deliver = (tops: number[]): void => {
        const bandTop = -margins[0];
        const bandBottom = 900 + margins[2];
        const changes = tops.map((top, index) => {
          const bottom = top + 432;
          const overlap = Math.max(0, Math.min(bottom, bandBottom) - Math.max(top, bandTop));
          return {
            target: chapters[index],
            isIntersecting: overlap > 0,
            intersectionRect: { height: overlap },
          } as IntersectionObserverEntry;
        });
        act(() => notify(changes, {} as IntersectionObserver));
      };
      deliver([-252, 180, 612]);
      expect(section).toHaveAttribute('data-composition', 'sequence');
      deliver([-604, -172, 260]);
      expect(section).toHaveAttribute('data-composition', 'lifecycle');
      deliver([-252, 180, 612]);
      expect(section).toHaveAttribute('data-composition', 'sequence');
      deliver([180, 612, 1044]);
      expect(section).toHaveAttribute('data-composition', 'combine');
    } finally {
      view.unmount();
      root.remove();
      window.IntersectionObserver = previous;
    }
  });

  it('connects the illustrated entrance to the title and composes multiple transform properties', () => {
    mockReduced = false;
    render(
      <>
        <AboutScenesScene />
        <EditorialIndexScene />
      </>
    );
    expect(
      mockAnimateProps.find((props) => props.animateId === 's03-spread-back')?.timeline
    ).toEqual({ driver: 'clock', after: 's03-copy', delay: 120 });
    expect(
      mockAnimateProps.find((props) => props.animateId === 's05-art-combine')?.enterAnimation
    ).toMatchObject({
      mode: 'parallel',
      animations: [{ initial: { x: -30, y: 45 } }, { initial: { scale: 0.72, rotate: -14 } }],
    });
    expect(
      mockAnimateProps.find((props) => props.animateId === 's05-type-combine')?.stagger
    ).toEqual({ each: 110 });
  });

  it('keeps the homepage accent stable without changing other route palettes', () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1])
      expect(lutAt(progress, true).accent).toBe('#d59273');
    expect(lutAt(0)).toEqual({
      top: '#f7dfbd',
      bot: '#fcf1e3',
      accent: '#d59273',
      accentInk: '#9e6344',
    });
    expect(lutAt(1)).toEqual({
      top: '#f1d5ba',
      bot: '#fbefe1',
      accent: '#b9784a',
      accentInk: '#885435',
    });
  });
});
