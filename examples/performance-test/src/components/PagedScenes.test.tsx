import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Container } from 'cineview';
import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { renderDragScenes } from './PagedScenes';

interface ElementProps {
  animateId?: string;
  at?: { x?: number; y?: number };
  children?: ReactNode;
  style?: { width?: number };
  width?: number;
}

function elements(children: ReactNode): ReactElement<ElementProps>[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) {
      return [];
    }
    if (child.type === Fragment) {
      return elements((child.props as ElementProps).children);
    }
    return [child as ReactElement<ElementProps>];
  });
}

function findPositionByAnimateId(
  positions: ReactElement<ElementProps>[],
  animateId: string
): ReactElement<ElementProps> {
  const position = positions.find((candidate) => {
    const animate = elements(candidate.props.children)[0];
    return animate?.props.animateId === animateId;
  });

  if (!position) {
    throw new Error(`Missing Position for ${animateId}`);
  }

  return position;
}

function getPositionContent(position: ReactElement<ElementProps>): ReactElement<ElementProps> {
  const animate = elements(position.props.children)[0];
  const content = animate ? elements(animate.props.children)[0] : undefined;
  if (!content) {
    throw new Error('Expected positioned Animate content');
  }
  return content;
}

describe('drag scene layout', () => {
  it('keeps the control-surface copy, media, and notes in separate columns', () => {
    const scene = renderDragScenes(PERFORMANCE_EXPERIENCE.sections)[1];
    const container = elements(scene.props.children).find((child) => child.type === Container);
    if (!container) {
      throw new Error('Expected the control-surface Scene Container');
    }

    const positions = elements(container.props.children);
    const copy = findPositionByAnimateId(positions, 'drag-highlights-copy');
    const media = findPositionByAnimateId(positions, 'drag-highlights-media');
    const notes = findPositionByAnimateId(positions, 'drag-highlights-details');
    const copyWidth = getPositionContent(copy).props.style?.width ?? 0;
    const mediaWidth = getPositionContent(media).props.width ?? 0;
    const notesWidth = getPositionContent(notes).props.style?.width ?? 0;

    expect((copy.props.at?.x ?? 0) + copyWidth).toBeLessThan(media.props.at?.x ?? 0);
    expect((media.props.at?.x ?? 0) + mediaWidth).toBeLessThan(notes.props.at?.x ?? 0);
    expect((notes.props.at?.x ?? 0) + notesWidth).toBeLessThanOrEqual(1440);
  });
});
