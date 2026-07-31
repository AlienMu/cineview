import { act, renderHook } from '@testing-library/react';
import type { PanInfo } from 'framer-motion';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useScenePointerInput } from './useScenePointerInput';

function createPanInfo(offsetY = 0): PanInfo {
  return {
    point: { x: 0, y: offsetY },
    delta: { x: 0, y: 0 },
    offset: { x: 0, y: offsetY },
    velocity: { x: 0, y: 0 },
  };
}

function createPointerDown(pointerId: number): ReactPointerEvent<HTMLDivElement> {
  const target = {
    setPointerCapture: jest.fn(),
    releasePointerCapture: jest.fn(),
  } as unknown as HTMLDivElement;
  return {
    pointerId,
    isPrimary: true,
    button: 0,
    clientX: 20,
    clientY: 20,
    target,
    currentTarget: target,
    defaultPrevented: false,
    nativeEvent: { pointerId, clientX: 20, clientY: 20 } as PointerEvent,
  } as unknown as ReactPointerEvent<HTMLDivElement>;
}

function setup() {
  const onCandidateStart = jest.fn(() => true);
  const onCandidateEnd = jest.fn();
  const onDragStart = jest.fn(() => false);
  const onPan = jest.fn();
  const onPanEnd = jest.fn();
  const view = renderHook(() =>
    useScenePointerInput({
      enabled: true,
      axis: 'y',
      onCandidateStart,
      onCandidateEnd,
      onDragStart,
      onPan,
      onPanEnd,
    })
  );
  return { view, onCandidateStart, onCandidateEnd, onDragStart };
}

describe('useScenePointerInput candidate cleanup', () => {
  it('releases an unresolved Framer suspension before a replacement sequence', () => {
    const { view, onCandidateStart, onCandidateEnd } = setup();

    act(() => view.result.current.onFramerPanStart());
    expect(onCandidateStart).toHaveBeenCalledTimes(1);
    expect(onCandidateEnd).not.toHaveBeenCalled();

    act(() => view.result.current.onFramerPanStart());
    expect(onCandidateEnd).toHaveBeenCalledTimes(1);
    expect(onCandidateStart).toHaveBeenCalledTimes(2);

    act(() => view.result.current.onFramerPanEnd(new MouseEvent('mouseup'), createPanInfo()));
    expect(onCandidateEnd).toHaveBeenCalledTimes(2);
  });

  it('releases an unresolved Framer suspension when native input takes over', () => {
    const { view, onCandidateEnd } = setup();

    act(() => view.result.current.onFramerPanStart());
    act(() => view.result.current.onPointerDown(createPointerDown(7)));
    act(() => view.result.current.onFramerPanEnd(new MouseEvent('mouseup'), createPanInfo()));

    expect(onCandidateEnd).toHaveBeenCalledTimes(1);
  });

  it('releases an unresolved Framer suspension on unmount exactly once', () => {
    const { view, onCandidateEnd } = setup();

    act(() => view.result.current.onFramerPanStart());
    view.unmount();

    expect(onCandidateEnd).toHaveBeenCalledTimes(1);
  });
});
