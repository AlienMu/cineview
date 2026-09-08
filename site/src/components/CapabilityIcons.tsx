/**
 * Act2 cinema equipment line icons (16×16, strokeWidth 1.5, same syntax as IconArrow/IconBook in HeroScene).
 * Six icons corresponding to the six preset frames in SHOT01: aperture/dolly/zoom/film-roll/clapper/handheld.
 */

interface IconProps {
  size?: number;
}

function svgProps(size: number): React.SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
}

/** Aperture — fade-in */
export function IconAperture({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 1.8v4.4M13.4 4.9l-3.8 2.2M13.4 11.1l-3.8-2.2M8 14.2V9.8M2.6 11.1l3.8-2.2M2.6 4.9l3.8 2.2" />
    </svg>
  );
}

/** Dolly — slide-up */
export function IconDolly({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="4" y="3" width="8" height="5.5" rx="1" />
      <path d="M8 8.5v2.5" />
      <path d="M2 13.5h12" />
      <circle cx="5.5" cy="11.8" r="0.9" />
      <circle cx="10.5" cy="11.8" r="0.9" />
    </svg>
  );
}

/** Zoom lens — zoom-in */
export function IconZoomLens({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <circle cx="7" cy="7" r="4.4" />
      <circle cx="7" cy="7" r="1.6" />
      <path d="M10.4 10.4L14 14" />
    </svg>
  );
}

/** Film roll — rotate-in */
export function IconFilmRoll({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <circle cx="7.5" cy="7.5" r="5.7" />
      <circle cx="7.5" cy="7.5" r="1.4" />
      <circle cx="7.5" cy="4.2" r="0.7" />
      <circle cx="10.8" cy="7.5" r="0.7" />
      <circle cx="7.5" cy="10.8" r="0.7" />
      <circle cx="4.2" cy="7.5" r="0.7" />
      <path d="M13.2 9.5V14h-4" />
    </svg>
  );
}

/** Clapper board — bounce */
export function IconClapper({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M2.5 6.5h11v6.5a0.8 0.8 0 0 1-0.8 0.8H3.3a0.8 0.8 0 0 1-0.8-0.8V6.5z" />
      <path d="M2.7 6.4l0.8-3.2 10.3 1.2-0.6 2" />
      <path d="M5.4 3.7l1.6 2.5M8.6 4.1l1.6 2.4" />
    </svg>
  );
}

/** Handheld stabilizer — shake */
export function IconHandheld({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="5" y="2.5" width="6" height="4.5" rx="1" />
      <path d="M8 7v2" />
      <path d="M8 9c-2 0-2.6 1.2-2.6 2.4V14M8 9c2 0 2.6 1.2 2.6 2.4V14" />
    </svg>
  );
}

/** Page flip — flip */
export function IconFlip({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M7.3 2.8L3 4v8l4.3 1.2z" />
      <path d="M8.7 3.1L13 4.3v7.4l-4.3 1.2" />
      <path d="M8 2.4v11.2" />
    </svg>
  );
}

/** Spring — elastic */
export function IconElastic({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 2.6h8" />
      <path d="M4 13.4h8" />
      <path d="M6 4.2l4 2-4 2 4 2" />
    </svg>
  );
}

/** Defocus — blur-in */
export function IconBlur({ size = 16 }: IconProps): import('react').JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="2" />
      <circle cx="8" cy="8" r="5.3" strokeDasharray="1.6 2.2" />
    </svg>
  );
}
