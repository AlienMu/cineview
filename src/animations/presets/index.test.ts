import {
  PRESET_LOAD_TIMEOUT_MS,
  PresetLoadError,
  getPresetAnimation,
  getPresetCategoryState,
  loadAnimationModule,
  preloadAnimationCategory,
  preloadAllAnimations,
  clearAnimationCache,
  setPresetCategoryLoaderForTests,
} from './index';

// devWarn/devError (used for unknown-preset / load-failure diagnostics) only
// emit when NODE_ENV === 'development'. Force it so the console spies observe them.
const originalNodeEnv = process.env.NODE_ENV;
beforeAll(() => {
  process.env.NODE_ENV = 'development';
});
afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('animations/presets/index', () => {
  beforeEach(() => {
    clearAnimationCache();
  });

  afterEach(() => {
    setPresetCategoryLoaderForTests(null);
  });

  describe('loadAnimationModule', () => {
    it('should load fade animations', async () => {
      const module = await loadAnimationModule('fade');

      expect(module).toHaveProperty('fade');
      expect(module).toHaveProperty('fade-in');
      expect(module).toHaveProperty('fade-out');
    });

    it('should load slide animations', async () => {
      const module = await loadAnimationModule('slide');

      expect(module).toHaveProperty('slide-up');
      expect(module).toHaveProperty('slide-down');
      expect(module).toHaveProperty('slide-left');
      expect(module).toHaveProperty('slide-right');
    });

    it('should load zoom animations', async () => {
      const module = await loadAnimationModule('zoom');

      expect(module).toBeDefined();
    });

    it('should load rotate animations', async () => {
      const module = await loadAnimationModule('rotate');

      expect(module).toBeDefined();
    });

    it('should load flip animations', async () => {
      const module = await loadAnimationModule('flip');

      expect(module).toBeDefined();
    });

    it('should load bounce animations', async () => {
      const module = await loadAnimationModule('bounce');

      expect(module).toBeDefined();
    });

    it('should load blink animations', async () => {
      const module = await loadAnimationModule('blink');

      expect(module).toBeDefined();
    });

    it('should load shake animations', async () => {
      const module = await loadAnimationModule('shake');

      expect(module).toBeDefined();
    });

    it('should load blur animations', async () => {
      const module = await loadAnimationModule('blur');

      expect(module).toBeDefined();
    });

    it('should load elastic animations', async () => {
      const module = await loadAnimationModule('elastic');

      expect(module).toBeDefined();
    });

    it('should load special animations', async () => {
      const module = await loadAnimationModule('special');

      expect(module).toBeDefined();
    });

    it('should throw error for unknown category', async () => {
      await expect(loadAnimationModule('unknown')).rejects.toThrow('Unknown animation category');
    });

    it('should cache loaded modules', async () => {
      const module1 = await loadAnimationModule('fade');
      const module2 = await loadAnimationModule('fade');

      expect(module1).toBe(module2);
    });

    it('times out a stalled category as transient and allows a retry', async () => {
      jest.useFakeTimers();
      const fadeModule = {
        fade: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
      };
      const loader = jest
        .fn()
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValueOnce(fadeModule);
      setPresetCategoryLoaderForTests(loader);

      try {
        const stalled = getPresetAnimation('fade');
        const rejection = expect(stalled).rejects.toMatchObject({
          code: 'ANIMATION_ASSET_LOAD_FAILED',
          permanent: false,
        });

        await jest.advanceTimersByTimeAsync(PRESET_LOAD_TIMEOUT_MS);
        await rejection;
        expect(getPresetCategoryState('fade')).toBe('failed-transient');

        await expect(getPresetAnimation('fade')).resolves.toBe(fadeModule.fade);
        expect(loader).toHaveBeenCalledTimes(2);
        expect(getPresetCategoryState('fade')).toBe('success');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('getPresetAnimation', () => {
    it('should get fade animation', async () => {
      const animation = await getPresetAnimation('fade');

      expect(animation).not.toBeNull();
      expect(animation).toHaveProperty('initial');
      expect(animation).toHaveProperty('animate');
      expect(animation).toHaveProperty('exit');
    });

    it('should get slide-up animation', async () => {
      const animation = await getPresetAnimation('slide-up');

      expect(animation).not.toBeNull();
      expect(animation).toHaveProperty('initial');
      expect(animation).toHaveProperty('animate');
      expect(animation).toHaveProperty('exit');
    });

    it('caches unknown preset names as permanent INVALID_ANIMATION failures', async () => {
      const first = getPresetAnimation('unknown');
      const second = getPresetAnimation('unknown');

      await expect(first).rejects.toMatchObject({
        code: 'INVALID_ANIMATION',
        permanent: true,
        presetName: 'unknown',
      });
      await expect(second).rejects.toBeInstanceOf(PresetLoadError);
    });

    it('coalesces concurrent requests for the same category', async () => {
      let resolveModule!: (module: Record<string, never>) => void;
      const loader = jest.fn(
        () =>
          new Promise<Record<string, never>>((resolve) => {
            resolveModule = resolve;
          })
      );
      setPresetCategoryLoaderForTests(loader);

      const fade = getPresetAnimation('fade');
      const fadeIn = getPresetAnimation('fade-in');
      expect(loader).toHaveBeenCalledTimes(1);
      expect(getPresetCategoryState('fade')).toBe('pending');

      resolveModule({
        fade: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
        'fade-in': {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
      } as never);

      await expect(fade).resolves.toBeDefined();
      await expect(fadeIn).resolves.toBeDefined();
      expect(getPresetCategoryState('fade')).toBe('success');
    });

    it('does not cache transient failures and retries the category', async () => {
      const loader = jest
        .fn()
        .mockRejectedValueOnce(new Error('chunk unavailable'))
        .mockResolvedValueOnce({
          fade: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
          },
        });
      setPresetCategoryLoaderForTests(loader);

      await expect(getPresetAnimation('fade')).rejects.toMatchObject({
        code: 'ANIMATION_ASSET_LOAD_FAILED',
        permanent: false,
      });
      expect(getPresetCategoryState('fade')).toBe('failed-transient');

      await expect(getPresetAnimation('fade')).resolves.toBeDefined();
      expect(loader).toHaveBeenCalledTimes(2);
      expect(getPresetCategoryState('fade')).toBe('success');
    });

    it('caches a missing export as a permanent failure', async () => {
      const loader = jest.fn().mockResolvedValue({});
      setPresetCategoryLoaderForTests(loader);

      await expect(getPresetAnimation('fade')).rejects.toMatchObject({
        code: 'INVALID_ANIMATION',
        permanent: true,
        presetName: 'fade',
      });
      await expect(getPresetAnimation('fade')).rejects.toBeInstanceOf(PresetLoadError);
      expect(loader).toHaveBeenCalledTimes(1);
    });
  });

  describe('preloadAnimationCategory', () => {
    it('should preload animation category', async () => {
      await preloadAnimationCategory('fade');

      // Verify it's cached by loading again
      const module = await loadAnimationModule('fade');
      expect(module).toBeDefined();
    });

    it('should handle preload errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await preloadAnimationCategory('unknown');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('preloadAllAnimations', () => {
    it('should preload all animation categories', async () => {
      await preloadAllAnimations();

      // Verify all categories are cached
      const fadeModule = await loadAnimationModule('fade');
      const slideModule = await loadAnimationModule('slide');
      const zoomModule = await loadAnimationModule('zoom');

      expect(fadeModule).toBeDefined();
      expect(slideModule).toBeDefined();
      expect(zoomModule).toBeDefined();
    });
  });

  describe('clearAnimationCache', () => {
    it('should clear animation cache', async () => {
      // Load and cache a module
      await loadAnimationModule('fade');

      // Clear cache
      clearAnimationCache();

      // Load again - should not be from cache
      const module = await loadAnimationModule('fade');
      expect(module).toBeDefined();
    });

    it('isolates an old in-flight request from the new cache epoch', async () => {
      let resolveOld!: (module: Record<string, never>) => void;
      let resolveCurrent!: (module: Record<string, never>) => void;
      const oldModule = {
        fade: {
          initial: { opacity: 0 },
          animate: { opacity: 0.4 },
          exit: { opacity: 0 },
        },
      };
      const currentModule = {
        fade: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
      };
      const loader = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Record<string, never>>((resolve) => {
              resolveOld = resolve;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise<Record<string, never>>((resolve) => {
              resolveCurrent = resolve;
            })
        );
      setPresetCategoryLoaderForTests(loader);

      const oldRequest = loadAnimationModule('fade');
      clearAnimationCache();
      const currentRequest = loadAnimationModule('fade');
      expect(loader).toHaveBeenCalledTimes(2);
      expect(getPresetCategoryState('fade')).toBe('pending');

      resolveOld(oldModule as never);
      await expect(oldRequest).resolves.toBe(oldModule);

      // The obsolete request must neither publish success nor delete the current
      // epoch's in-flight entry when its finally handler runs.
      expect(getPresetCategoryState('fade')).toBe('pending');
      expect(loadAnimationModule('fade')).toBe(currentRequest);
      expect(loader).toHaveBeenCalledTimes(2);

      resolveCurrent(currentModule as never);
      await expect(currentRequest).resolves.toBe(currentModule);
      expect(getPresetCategoryState('fade')).toBe('success');
      await expect(loadAnimationModule('fade')).resolves.toBe(currentModule);
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });

  describe('animation categories', () => {
    it('should load all fade animations', async () => {
      const fade = await getPresetAnimation('fade');
      const fadeIn = await getPresetAnimation('fade-in');
      const fadeOut = await getPresetAnimation('fade-out');

      expect(fade).not.toBeNull();
      expect(fadeIn).not.toBeNull();
      expect(fadeOut).not.toBeNull();
    });

    it('should load all slide animations', async () => {
      const slideUp = await getPresetAnimation('slide-up');
      const slideDown = await getPresetAnimation('slide-down');
      const slideLeft = await getPresetAnimation('slide-left');
      const slideRight = await getPresetAnimation('slide-right');

      expect(slideUp).not.toBeNull();
      expect(slideDown).not.toBeNull();
      expect(slideLeft).not.toBeNull();
      expect(slideRight).not.toBeNull();
    });

    it('should load zoom animations', async () => {
      const zoomIn = await getPresetAnimation('zoom-in');
      const zoomOut = await getPresetAnimation('zoom-out');

      expect(zoomIn).not.toBeNull();
      expect(zoomOut).not.toBeNull();
    });

    it('should load rotate animations', async () => {
      const rotate = await getPresetAnimation('rotate');
      const spin = await getPresetAnimation('spin');

      expect(rotate).not.toBeNull();
      expect(spin).not.toBeNull();
    });

    it('should load flip animations', async () => {
      const flip = await getPresetAnimation('flip');
      const flipX = await getPresetAnimation('flip-x');
      const flipY = await getPresetAnimation('flip-y');

      expect(flip).not.toBeNull();
      expect(flipX).not.toBeNull();
      expect(flipY).not.toBeNull();
    });

    it('should load bounce animations', async () => {
      const bounce = await getPresetAnimation('bounce');
      const bounceIn = await getPresetAnimation('bounce-in');
      const bounceOut = await getPresetAnimation('bounce-out');

      expect(bounce).not.toBeNull();
      expect(bounceIn).not.toBeNull();
      expect(bounceOut).not.toBeNull();
    });

    it('should load blink animations', async () => {
      const blink = await getPresetAnimation('blink');
      const flash = await getPresetAnimation('flash');
      const pulse = await getPresetAnimation('pulse');

      expect(blink).not.toBeNull();
      expect(flash).not.toBeNull();
      expect(pulse).not.toBeNull();
    });

    it('should load shake animations', async () => {
      const shake = await getPresetAnimation('shake');
      const shakeX = await getPresetAnimation('shake-x');
      const shakeY = await getPresetAnimation('shake-y');
      const vibrate = await getPresetAnimation('vibrate');
      const jello = await getPresetAnimation('jello');

      expect(shake).not.toBeNull();
      expect(shakeX).not.toBeNull();
      expect(shakeY).not.toBeNull();
      expect(vibrate).not.toBeNull();
      expect(jello).not.toBeNull();
    });

    it('should load blur animations', async () => {
      const blurIn = await getPresetAnimation('blur-in');
      const blurOut = await getPresetAnimation('blur-out');
      const focusIn = await getPresetAnimation('focus-in');

      expect(blurIn).not.toBeNull();
      expect(blurOut).not.toBeNull();
      expect(focusIn).not.toBeNull();
    });

    it('should load elastic animations', async () => {
      const elastic = await getPresetAnimation('elastic');
      const rubberBand = await getPresetAnimation('rubber-band');
      const wobble = await getPresetAnimation('wobble');
      const swing = await getPresetAnimation('swing');

      expect(elastic).not.toBeNull();
      expect(rubberBand).not.toBeNull();
      expect(wobble).not.toBeNull();
      expect(swing).not.toBeNull();
    });

    it('should load special animations', async () => {
      const heartbeat = await getPresetAnimation('heartbeat');
      const tada = await getPresetAnimation('tada');
      const wave = await getPresetAnimation('wave');
      const rollIn = await getPresetAnimation('roll-in');
      const rollOut = await getPresetAnimation('roll-out');
      const hinge = await getPresetAnimation('hinge');
      const jackInTheBox = await getPresetAnimation('jack-in-the-box');

      expect(heartbeat).not.toBeNull();
      expect(tada).not.toBeNull();
      expect(wave).not.toBeNull();
      expect(rollIn).not.toBeNull();
      expect(rollOut).not.toBeNull();
      expect(hinge).not.toBeNull();
      expect(jackInTheBox).not.toBeNull();
    });
  });
});
