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
