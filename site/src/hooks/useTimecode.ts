import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';

const FRAMES_PER_SECOND = 25;
const REST_FRAME_INTERVAL_MS = 40;
const DRAG_FRAME_INTERVAL_MS = 20;

export function formatTimecode(frame: number): string {
  const safeFrame = Math.max(0, Math.floor(frame));
  const frames = safeFrame % FRAMES_PER_SECOND;
  const totalSeconds = Math.floor(safeFrame / FRAMES_PER_SECOND);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60) % 100;

  return [hours, minutes, seconds, frames].map((part) => String(part).padStart(2, '0')).join(':');
}

function writeTimecode(element: HTMLDivElement, value: string): void {
  const characters = element.querySelectorAll<HTMLElement>('[data-timecode-char]');
  if (characters.length === value.length) {
    characters.forEach((character, index) => {
      const nextCharacter = value[index];
      if (character.textContent !== nextCharacter) character.textContent = nextCharacter;
    });
    return;
  }

  element.textContent = value;
}

export function useTimecode(
  startFrame: number,
  isDragging: boolean,
  paused = false
): {
  timecodeRef: RefObject<HTMLDivElement>;
  frameRef: MutableRefObject<number>;
} {
  const timecodeRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(startFrame);

  useEffect(() => {
    frameRef.current = startFrame;
    const element = timecodeRef.current;
    if (element) writeTimecode(element, formatTimecode(startFrame));
  }, [startFrame]);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let animationFrame = 0;
    let previousTimestamp = performance.now();
    const interval = isDragging ? DRAG_FRAME_INTERVAL_MS : REST_FRAME_INTERVAL_MS;

    const tick = (timestamp: number): void => {
      const elapsed = timestamp - previousTimestamp;
      if (elapsed >= interval) {
        const advancedFrames = Math.max(1, Math.floor(elapsed / interval));
        frameRef.current += advancedFrames;
        previousTimestamp = timestamp - (elapsed % interval);
        const element = timecodeRef.current;
        if (element) writeTimecode(element, formatTimecode(frameRef.current));
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return (): void => window.cancelAnimationFrame(animationFrame);
  }, [isDragging, paused]);

  return { timecodeRef, frameRef };
}
