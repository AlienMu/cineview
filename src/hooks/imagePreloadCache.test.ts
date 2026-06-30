/**
 * Coverage for the module-level preloaded-image cache: mark/query, the
 * dedupe-on-first-mark notification, subscribe/unsubscribe, and reset.
 */

import {
  markImageAsPreloaded,
  isImagePreloaded,
  subscribeToPreloadedImages,
  resetPreloadedImageCache,
} from './imagePreloadCache';

describe('imagePreloadCache', () => {
  afterEach(() => {
    resetPreloadedImageCache();
  });

  it('marks a url as preloaded and reports it', () => {
    expect(isImagePreloaded('/a.jpg')).toBe(false);
    markImageAsPreloaded('/a.jpg');
    expect(isImagePreloaded('/a.jpg')).toBe(true);
  });

  it('ignores an empty url on mark', () => {
    markImageAsPreloaded('');
    expect(isImagePreloaded('')).toBe(false);
  });

  it('treats an empty query string as not preloaded', () => {
    expect(isImagePreloaded('')).toBe(false);
  });

  it('notifies subscribers only on the first mark of a url', () => {
    const listener = jest.fn();
    subscribeToPreloadedImages(listener);

    markImageAsPreloaded('/b.jpg');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('/b.jpg');

    // Second mark of the same url is a no-op notification (already in the set).
    markImageAsPreloaded('/b.jpg');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToPreloadedImages(listener);

    markImageAsPreloaded('/c.jpg');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    markImageAsPreloaded('/d.jpg');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reset clears both the url set and the listeners', () => {
    const listener = jest.fn();
    subscribeToPreloadedImages(listener);
    markImageAsPreloaded('/e.jpg');

    resetPreloadedImageCache();

    expect(isImagePreloaded('/e.jpg')).toBe(false);
    // Listener was cleared too, so a post-reset mark does not call it.
    markImageAsPreloaded('/e.jpg');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
