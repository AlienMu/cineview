import type { ReactNode } from 'react';
import { Animate } from '../index';

export function ValidStaggerComposition(): React.JSX.Element {
  return (
    <Animate enterAnimation="fade-in" stagger={{ each: 80 }}>
      <div>
        <span>A</span>
        <span>B</span>
      </div>
    </Animate>
  );
}

export function InvalidStaggerRenderProp(): React.JSX.Element {
  return (
    // @ts-expect-error stagger with render prop is invalid
    <Animate enterAnimation="fade-in" stagger={{ each: 80 }}>
      {(_state): ReactNode => <div />}
    </Animate>
  );
}

export function InvalidStaggerSiblingArray(): React.JSX.Element {
  return (
    // @ts-expect-error stagger with sibling array is invalid
    <Animate enterAnimation="fade-in" stagger={{ each: 80 }}>
      <span>A</span>
      <span>B</span>
    </Animate>
  );
}

export function InvalidEmptyAnimate(): React.JSX.Element {
  return (
    // @ts-expect-error an Animate requires an enter or loop animation
    <Animate>
      <div />
    </Animate>
  );
}

export function InvalidExitOnlyAnimate(): React.JSX.Element {
  return (
    // @ts-expect-error an exit animation requires an enter or loop animation
    <Animate exitAnimation="fade-out">
      <div />
    </Animate>
  );
}

export function InvalidInfiniteStagger(): React.JSX.Element {
  return (
    // @ts-expect-error stagger requires an enter animation, not a loop alone
    <Animate loopAnimation="pulse" stagger={{ each: 80 }}>
      <div>
        <span>A</span>
      </div>
    </Animate>
  );
}
