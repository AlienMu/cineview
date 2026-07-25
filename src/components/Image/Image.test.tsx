import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CineViewProvider } from '../../context/CineViewContext';
import { Image } from './Image';
import { isImagePreloaded, resetPreloadedImageCache } from '../../hooks/imagePreloadCache';

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
}

describe('Image', () => {
  beforeEach(() => {
    setViewport(750, 1334);
  });

  it('renders as a native img-compatible element', () => {
    const onLoad = jest.fn();
    const onError = jest.fn();
    const ref = createRef<HTMLImageElement>();
    const { getByAltText } = render(
      <Image
        ref={ref}
        src="hero.jpg"
        alt="Hero"
        className="media"
        decoding="async"
        draggable={false}
        onError={onError}
        onLoad={onLoad}
        style={{ display: 'block', objectFit: 'cover' }}
        title="Hero title"
      />
    );

    const img = getByAltText('Hero') as HTMLImageElement;
    expect(ref.current).toBe(img);
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'hero.jpg');
    expect(img).toHaveAttribute('class', 'media');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('draggable', 'false');
    expect(img).toHaveAttribute('title', 'Hero title');
    expect(img).toHaveStyle({ display: 'block', objectFit: 'cover' });

    fireEvent.load(img);
    fireEvent.error(img);

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('preloads eagerly by default and can opt out with preload=false', () => {
    const { getByAltText, rerender } = render(<Image src="hero.jpg" alt="Hero" />);

    expect(getByAltText('Hero')).toHaveAttribute('loading', 'eager');

    rerender(<Image src="hero.jpg" alt="Hero" preload={false} />);

    expect(getByAltText('Hero')).toHaveAttribute('loading', 'lazy');
  });

  it('respects explicit native loading when provided', () => {
    const { getByAltText } = render(<Image src="hero.jpg" alt="Hero" loading="lazy" />);

    expect(getByAltText('Hero')).toHaveAttribute('loading', 'lazy');
  });

  it('does not issue a framework preload when native loading is explicitly lazy', () => {
    const loaders: string[] = [];
    const OriginalImage = window.Image;
    class MockImage {
      set src(value: string) {
        loaders.push(value);
      }
      addEventListener(): void {}
      removeEventListener(): void {}
    }
    (window as unknown as { Image: unknown }).Image = MockImage;

    try {
      render(<Image src="lazy-native.jpg" alt="Lazy" loading="lazy" preload={true} />);
      expect(loaders).not.toContain('lazy-native.jpg');
    } finally {
      (window as unknown as { Image: typeof OriginalImage }).Image = OriginalImage;
    }
  });

  it('registers a preloaded src with the shared preload cache when it loads', () => {
    resetPreloadedImageCache();
    const loaders: Array<{ src: string; dispatch: (type: string) => void }> = [];
    const OriginalImage = window.Image;
    // Capture the off-screen loader the component creates and let the test fire
    // its load event, so we can assert the URL lands in the shared cache that
    // useImagePreloader reads — the no-flash guarantee the old Preloader gave.
    class MockImage {
      private listeners: Record<string, Array<() => void>> = {};
      set src(value: string) {
        loaders.push({
          src: value,
          dispatch: (type: string) => this.listeners[type]?.forEach((fn) => fn()),
        });
      }
      addEventListener(type: string, fn: () => void): void {
        (this.listeners[type] ??= []).push(fn);
      }
      removeEventListener(): void {}
    }
    (window as unknown as { Image: unknown }).Image = MockImage;

    try {
      render(<Image src="warm.jpg" alt="Warm" />);
      expect(isImagePreloaded('warm.jpg')).toBe(false);

      const loader = loaders.find((l) => l.src === 'warm.jpg');
      expect(loader).toBeDefined();
      loader!.dispatch('load');

      expect(isImagePreloaded('warm.jpg')).toBe(true);
    } finally {
      (window as unknown as { Image: typeof OriginalImage }).Image = OriginalImage;
      resetPreloadedImageCache();
    }
  });

  it('does not warm the preload cache when preload is disabled', () => {
    resetPreloadedImageCache();
    const loaders: string[] = [];
    const OriginalImage = window.Image;
    class MockImage {
      set src(value: string) {
        loaders.push(value);
      }
      addEventListener(): void {}
      removeEventListener(): void {}
    }
    (window as unknown as { Image: unknown }).Image = MockImage;

    try {
      render(<Image src="lazy.jpg" alt="Lazy" preload={false} />);
      expect(loaders).not.toContain('lazy.jpg');
    } finally {
      (window as unknown as { Image: typeof OriginalImage }).Image = OriginalImage;
      resetPreloadedImageCache();
    }
  });

  it('converts numeric width and height with CineView viewport scale', () => {
    setViewport(500, 400);

    const { getByAltText } = render(
      <CineViewProvider designSize={1000}>
        <Image src="hero.jpg" alt="Hero" width={200} height={160} />
      </CineViewProvider>
    );

    const img = getByAltText('Hero') as HTMLImageElement;
    expect(img).toHaveAttribute('width', '100');
    expect(img).toHaveAttribute('height', '80');
  });

  it('converts numeric style lengths while preserving scalar img styles', () => {
    setViewport(500, 400);

    const { getByAltText } = render(
      <CineViewProvider designSize={1000}>
        <Image
          src="hero.jpg"
          alt="Hero"
          style={{
            borderRadius: 20,
            height: 160,
            left: 100,
            opacity: 0.5,
            padding: 20,
            position: 'absolute',
            top: 80,
            width: 200,
            zIndex: 2,
          }}
        />
      </CineViewProvider>
    );

    expect(getByAltText('Hero')).toHaveStyle({
      borderRadius: '10px',
      height: '80px',
      left: '50px',
      opacity: '0.5',
      padding: '10px',
      top: '40px',
      width: '100px',
      zIndex: '2',
    });
  });

  it('keeps numeric image dimensions unchanged outside CineView', () => {
    const { getByAltText } = render(
      <Image src="hero.jpg" alt="Hero" width={200} height={160} style={{ width: 200 }} />
    );

    const img = getByAltText('Hero') as HTMLImageElement;
    expect(img).toHaveAttribute('width', '200');
    expect(img).toHaveAttribute('height', '160');
    expect(img).toHaveStyle({ width: '200px' });
  });
});
