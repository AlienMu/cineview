import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import { SceneCut } from '../../../site/src/components/temporal-drag/SceneCut';

interface CapturedAnimateProps {
  animateId?: string;
  duration?: { enter?: number; exit?: number };
  timeline?: { delay?: number };
  children?: ReactNode;
}

const captured: CapturedAnimateProps[] = [];
const ROOT = path.resolve(__dirname, '../../..');
const CSS_FILE = path.join(ROOT, 'site/src/styles/temporal-scenes-03-05.css');

jest.mock(
  'cineview',
  () => ({
    Animate: (props: CapturedAnimateProps) => {
      captured.push(props);
      return <>{props.children}</>;
    },
  }),
  { virtual: true }
);

jest.mock('../../../site/src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../site/src/components/temporal-drag/TemporalMotion', () => ({
  useTemporalMotion: () => ({
    reduced: false,
    duration: (milliseconds: number) => milliseconds,
    delay: (milliseconds: number) => milliseconds,
    seconds: (seconds: number) => seconds,
  }),
}));

function lane(animateId: string): CapturedAnimateProps {
  const match = captured.find((props) => props.animateId === animateId);
  if (!match) throw new Error(`Missing Animate lane: ${animateId}`);
  return match;
}

describe('/drag act 5 curtain-call contract', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it('keeps only projector light, dust, and unframed curtain-call text', () => {
    const { container } = render(<SceneCut />);
    const curtainCall = container.querySelector('.s05-curtain-call');

    expect(curtainCall).not.toBeNull();
    expect(curtainCall?.querySelectorAll('.s05-credit')).toHaveLength(5);
    expect(curtainCall?.querySelector('.s05-the-end')?.textContent).toBe('THE END');
    expect(container.querySelector('.s05-beam')).not.toBeNull();
    expect(container.querySelector('.s05-beam__dust')).not.toBeNull();

    expect(container.querySelector('.s05-house')).toBeNull();
    expect(container.querySelector('.s05-house__screen')).toBeNull();
    expect(container.querySelector('.s05-house__wall')).toBeNull();
    expect(container.querySelector('.s05-house__row')).toBeNull();
    expect(container.querySelector('.s05-house__seat')).toBeNull();
  });

  it('removes auditorium geometry styles instead of hiding them', () => {
    render(<SceneCut />);
    const css = fs.readFileSync(CSS_FILE, 'utf8');

    expect(css).not.toContain('.s05-house');
    expect(css).toContain('.s05-beam');
    expect(css).toContain('.s05-beam__dust');
    expect(css).toContain('.s05-curtain-call');
  });

  it('uses the approved 1800ms rise and 420ms stagger', () => {
    render(<SceneCut />);

    const creditLanes = Array.from({ length: 5 }, (_, index) => lane(`s05-credit-${index}`));
    expect(creditLanes.map((credit) => credit.duration?.enter)).toEqual([
      1800, 1800, 1800, 1800, 1800,
    ]);
    expect(creditLanes.map((credit) => credit.timeline?.delay)).toEqual([
      1000, 1420, 1840, 2260, 2680,
    ]);
    expect(lane('s05-the-end').timeline?.delay).toBe(4660);
  });
});
