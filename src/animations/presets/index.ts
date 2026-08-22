/**
 * Preset animation loading coordinator.
 *
 * Successful modules, permanent preset failures, and in-flight category promises
 * are shared across every CineView instance. Transient chunk/network failures are
 * reported to each consumer but are never permanently cached, so a later request
 * may retry.
 */

import type { Variant } from 'framer-motion';
import type { PresetAnimation as PresetAnimationName } from '../../types';
import { devError } from '../../utils/devLog';

export interface PresetAnimation {
  initial: Variant;
  animate: Variant;
  exit: Variant;
}

export type PresetLoadErrorCode = 'INVALID_ANIMATION' | 'ANIMATION_ASSET_LOAD_FAILED';
export type PresetLoadState =
  | 'idle'
  | 'pending'
  | 'success'
  | 'failed-permanent'
  | 'failed-transient';

export const PRESET_LOAD_TIMEOUT_MS = 3000;

export class PresetLoadError extends Error {
  declare readonly code: PresetLoadErrorCode;
  declare readonly permanent: boolean;
  declare readonly category?: string;
  declare readonly presetName?: string;
  declare readonly cause?: unknown;

  constructor(
    code: PresetLoadErrorCode,
    message: string,
    options: {
      permanent: boolean;
      category?: string;
      presetName?: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.code = code;
    this.permanent = options.permanent;
    this.category = options.category;
    this.presetName = options.presetName;
    this.cause = options.cause;
    this.name = 'PresetLoadError';
  }
}

export function isPresetLoadError(error: unknown): error is PresetLoadError {
  return error instanceof PresetLoadError;
}

const animationCategoryMap: Record<PresetAnimationName, string> = {
  fade: 'fade',
  'fade-in': 'fade',
  'fade-out': 'fade',
  'slide-up': 'slide',
  'slide-down': 'slide',
  'slide-left': 'slide',
  'slide-right': 'slide',
  'zoom-in': 'zoom',
  'zoom-out': 'zoom',
  'scale-up': 'zoom',
  'scale-down': 'zoom',
  rotate: 'rotate',
  'rotate-in': 'rotate',
  'rotate-out': 'rotate',
  spin: 'rotate',
  flip: 'flip',
  'flip-x': 'flip',
  'flip-y': 'flip',
  bounce: 'bounce',
  'bounce-in': 'bounce',
  'bounce-out': 'bounce',
  blink: 'blink',
  flash: 'blink',
  pulse: 'blink',
  shake: 'shake',
  'shake-x': 'shake',
  'shake-y': 'shake',
  vibrate: 'shake',
  jello: 'shake',
  'blur-in': 'blur',
  'blur-out': 'blur',
  'focus-in': 'blur',
  elastic: 'elastic',
  'rubber-band': 'elastic',
  wobble: 'elastic',
  swing: 'elastic',
  heartbeat: 'special',
  tada: 'special',
  wave: 'special',
  'roll-in': 'special',
  'roll-out': 'special',
  hinge: 'special',
  'jack-in-the-box': 'special',
};

const categories = [
  'fade',
  'slide',
  'zoom',
  'rotate',
  'flip',
  'bounce',
  'blink',
  'shake',
  'blur',
  'elastic',
  'special',
] as const;

type AnimationModule = Record<string, PresetAnimation>;
type CategoryLoader = (category: string) => Promise<AnimationModule>;

const animationCache = new Map<string, AnimationModule>();
const inFlightLoads = new Map<string, Promise<AnimationModule>>();
const categoryStates = new Map<string, PresetLoadState>();
const permanentCategoryFailures = new Map<string, PresetLoadError>();
const permanentPresetFailures = new Map<string, PresetLoadError>();
let cacheEpoch = 0;
let testLoader: CategoryLoader | null = null;

function isKnownCategory(category: string): boolean {
  return (categories as readonly string[]).includes(category);
}

async function importAnimationCategory(category: string): Promise<AnimationModule> {
  if (testLoader) {
    return testLoader(category);
  }

  switch (category) {
    case 'fade':
      return (await import('./fade')).fadeAnimations;
    case 'slide':
      return (await import('./slide')).slideAnimations;
    case 'zoom':
      return (await import('./zoom')).zoomAnimations;
    case 'rotate':
      return (await import('./rotate')).rotateAnimations;
    case 'flip':
      return (await import('./flip')).flipAnimations;
    case 'bounce':
      return (await import('./bounce')).bounceAnimations;
    case 'blink':
      return (await import('./blink')).blinkAnimations;
    case 'shake':
      return (await import('./shake')).shakeAnimations;
    case 'blur':
      return (await import('./blur')).blurAnimations;
    case 'elastic':
      return (await import('./elastic')).elasticAnimations;
    case 'special':
      return (await import('./special')).specialAnimations;
    default:
      throw new PresetLoadError('INVALID_ANIMATION', `Unknown animation category: ${category}`, {
        permanent: true,
        category,
      });
  }
}

function withPresetTimeout<T>(promise: Promise<T>, category: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new PresetLoadError(
          'ANIMATION_ASSET_LOAD_FAILED',
          `Timed out loading animation category "${category}".`,
          { permanent: false, category }
        )
      );
    }, PRESET_LOAD_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function normalizeCategoryError(category: string, error: unknown): PresetLoadError {
  if (isPresetLoadError(error)) {
    return error;
  }
  return new PresetLoadError(
    'ANIMATION_ASSET_LOAD_FAILED',
    `Failed to load animation category "${category}".`,
    { permanent: false, category, cause: error }
  );
}

/** Load one category, coalescing concurrent requests across all CineView roots. */
export function loadAnimationModule(category: string): Promise<AnimationModule> {
  const cached = animationCache.get(category);
  if (cached) return Promise.resolve(cached);

  const cachedFailure = permanentCategoryFailures.get(category);
  if (cachedFailure) return Promise.reject(cachedFailure);

  if (!isKnownCategory(category)) {
    const failure = new PresetLoadError(
      'INVALID_ANIMATION',
      `Unknown animation category: ${category}`,
      { permanent: true, category }
    );
    permanentCategoryFailures.set(category, failure);
    categoryStates.set(category, 'failed-permanent');
    return Promise.reject(failure);
  }

  const pending = inFlightLoads.get(category);
  if (pending) return pending;

  categoryStates.set(category, 'pending');
  const requestEpoch = cacheEpoch;
  const coordinated = withPresetTimeout(importAnimationCategory(category), category)
    .then((module) => {
      if (cacheEpoch === requestEpoch) {
        animationCache.set(category, module);
        categoryStates.set(category, 'success');
      }
      return module;
    })
    .catch((error: unknown) => {
      const normalized = normalizeCategoryError(category, error);
      if (cacheEpoch === requestEpoch) {
        categoryStates.set(
          category,
          normalized.permanent ? 'failed-permanent' : 'failed-transient'
        );
        if (normalized.permanent) {
          permanentCategoryFailures.set(category, normalized);
        }
      }
      throw normalized;
    })
    .finally(() => {
      if (inFlightLoads.get(category) === coordinated) {
        inFlightLoads.delete(category);
      }
    });

  inFlightLoads.set(category, coordinated);
  return coordinated;
}

/** Resolve one preset. Unknown names/missing exports are permanent failures. */
export async function getPresetAnimation(name: string): Promise<PresetAnimation> {
  const cachedFailure = permanentPresetFailures.get(name);
  if (cachedFailure) throw cachedFailure;

  const category = animationCategoryMap[name as PresetAnimationName];
  if (!category) {
    const failure = new PresetLoadError('INVALID_ANIMATION', `Unknown preset animation: ${name}`, {
      permanent: true,
      presetName: name,
    });
    permanentPresetFailures.set(name, failure);
    throw failure;
  }

  const requestEpoch = cacheEpoch;
  const module = await loadAnimationModule(category);
  const animation = module[name];
  if (animation) return animation;

  const failure = new PresetLoadError(
    'INVALID_ANIMATION',
    `Preset animation "${name}" is missing from category "${category}".`,
    { permanent: true, category, presetName: name }
  );
  if (cacheEpoch === requestEpoch) {
    permanentPresetFailures.set(name, failure);
  }
  throw failure;
}

export async function preloadAnimationCategory(category: string): Promise<void> {
  try {
    await loadAnimationModule(category);
  } catch (error) {
    devError(`Failed to preload animation category "${category}":`, error);
  }
}

export async function preloadAllAnimations(): Promise<void> {
  await Promise.all(categories.map((category) => preloadAnimationCategory(category)));
}

/** Clears success/permanent caches. Pending imports may finish but cannot repopulate a cleared epoch. */
export function clearAnimationCache(): void {
  cacheEpoch += 1;
  animationCache.clear();
  inFlightLoads.clear();
  categoryStates.clear();
  permanentCategoryFailures.clear();
  permanentPresetFailures.clear();
}

/** Read-only diagnostic state used by tests and development tooling. */
export function getPresetCategoryState(category: string): PresetLoadState {
  return categoryStates.get(category) ?? 'idle';
}

/** Test seam; intentionally not re-exported from the package barrel. */
export function setPresetCategoryLoaderForTests(loader: CategoryLoader | null): void {
  testLoader = loader;
  clearAnimationCache();
}
