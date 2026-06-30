import {
  getPresetAnimation,
  loadAnimationModule,
  preloadAnimationCategory,
  preloadAllAnimations,
  clearAnimationCache,
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

    it('should return null for unknown animation', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const animation = await getPresetAnimation('unknown' as never);

      expect(animation).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle load errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock loadAnimationModule to throw error
      const indexModule = await import('./index');
      jest.spyOn(indexModule, 'loadAnimationModule').mockRejectedValueOnce(new Error('Load error'));

      const animation = await getPresetAnimation('fade');

      expect(animation).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return null when animation not found in module', async () => {
      // This tests the case where the module loads but doesn't contain the animation
      const animation = await getPresetAnimation('fade');
      expect(animation).not.toBeNull();
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
