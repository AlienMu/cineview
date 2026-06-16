import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CineViewProvider } from '../../context/CineViewContext';
import { Image } from './Image';

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

  it('converts numeric width and height with CineView viewport scale', () => {
    setViewport(500, 400);

    const { getByAltText } = render(
      <CineViewProvider designWidth={1000} designHeight={800}>
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
      <CineViewProvider designWidth={1000} designHeight={800}>
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
