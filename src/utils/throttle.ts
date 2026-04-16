/**
 * 节流函数
 * 在指定时间间隔内只执行一次函数
 * @param fn - 要节流的函数
 * @param delay - 时间间隔（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: never[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>): void {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(
        () => {
          lastCall = Date.now();
          fn(...args);
        },
        delay - (now - lastCall)
      );
    }
  };
}
