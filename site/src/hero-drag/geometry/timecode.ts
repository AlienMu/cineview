const FRAMES_PER_SECOND = 25;

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
