import type { ReactNode } from 'react';
import { Animate } from '../index';

export function ValidStaggerComposition(): JSX.Element {
  return (
    <Animate enterAnimation="fade-in" stagger={{ each: 80 }}>
      <div>
        <span>A</span>
        <span>B</span>
      </div>
    </Animate>
  );
}

export function InvalidStaggerRenderProp(): JSX.Element {
  return (
    // @ts-expect-error stagger requires one concrete container element, not render-prop children
    <Animate enterAnimation="fade-in" stagger={{ each: 80 }}>
      {(_state): ReactNode => <div />}
    </Animate>
  );
}

export function InvalidStaggerSiblingArray(): JSX.Element {
  return (
    // @ts-expect-error stagger requires one container whose direct children are staggered
    <Animate enterAnimation="fade-in" stagger={{ each: 80 }}>
      <span>A</span>
      <span>B</span>
    </Animate>
  );
}

export function InvalidEmptyAnimate(): JSX.Element {
  return (
    // @ts-expect-error Animate requires enterAnimation or loopAnimation
    <Animate>
      <div />
    </Animate>
  );
}

export function InvalidExitOnlyAnimate(): JSX.Element {
  return (
    // @ts-expect-error exitAnimation cannot be the only effective animation
    <Animate exitAnimation="fade-out">
      <div />
    </Animate>
  );
}

export function InvalidInfiniteStagger(): JSX.Element {
  return (
    // @ts-expect-error stagger requires enterAnimation, not loopAnimation alone
    <Animate loopAnimation="pulse" stagger={{ each: 80 }}>
      <div>
        <span>A</span>
      </div>
    </Animate>
  );
}
