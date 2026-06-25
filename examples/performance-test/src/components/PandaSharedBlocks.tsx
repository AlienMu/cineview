/**
 * Panda Shared UI Blocks
 * Cartoon-style reusable components for the panda demo
 */
import type { ReactNode, CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Design Tokens
// ---------------------------------------------------------------------------
export const PandaColors = {
  bambooDark: '#1B5E20',
  bamboo: '#4CAF50',
  bambooLight: '#A5D6A7',
  warmOrange: '#FF8F00',
  coral: '#FF7043',
  sunYellow: '#FFD54F',
  cream: '#F5F0EB',
  white: '#FAFAFA',
  darkText: '#263238',
  mutedText: '#5D6D7E',
  skyBlue: '#81D4FA',
  cardBg: 'rgba(255,255,255,0.90)',
  cardBorder: 'rgba(76,175,80,0.18)',
  cardShadow: '0 8px 32px rgba(76,175,80,0.12)',
} as const;

// ---------------------------------------------------------------------------
// Section Header with cartoon badge
// ---------------------------------------------------------------------------
export function SectionHeader({
  number,
  title,
  subtitle,
  color = PandaColors.bambooDark,
}: {
  number: string;
  title: string;
  subtitle?: string;
  color?: string;
}): JSX.Element {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 18px',
          borderRadius: 999,
          background: `linear-gradient(135deg, ${color}18, ${PandaColors.sunYellow}22)`,
          border: `2px solid ${color}22`,
          color,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 20 }}>🐼</span>
        <span>{number}</span>
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 30,
          fontWeight: 800,
          color: PandaColors.darkText,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 14,
            color: PandaColors.mutedText,
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panda Card — cartoon rounded card with image or emoji
// ---------------------------------------------------------------------------
export function PandaCard({
  emoji,
  title,
  desc,
  width = 280,
  accentColor = PandaColors.bamboo,
  children,
}: {
  emoji?: string;
  title: string;
  desc?: string;
  width?: number;
  accentColor?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        width,
        padding: '20px 22px',
        borderRadius: 20,
        background: PandaColors.cardBg,
        border: `2px solid ${PandaColors.cardBorder}`,
        boxShadow: PandaColors.cardShadow,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        backdropFilter: 'blur(10px)',
      }}
    >
      {emoji ? (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            flexShrink: 0,
          }}
        >
          {emoji}
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: PandaColors.darkText,
          }}
        >
          {title}
        </h4>
        {desc ? (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: PandaColors.mutedText,
              lineHeight: 1.5,
            }}
          >
            {desc}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Block — big number + label
// ---------------------------------------------------------------------------
export function StatBlock({
  value,
  label,
  icon,
  color = PandaColors.bamboo,
}: {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: '18px 16px',
        borderRadius: 18,
        background: PandaColors.cardBg,
        border: `2px solid ${PandaColors.cardBorder}`,
        boxShadow: PandaColors.cardShadow,
        textAlign: 'center',
        minWidth: 100,
      }}
    >
      {icon ? <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div> : null}
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: PandaColors.mutedText,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery Frame — image wrapper with cartoon styling
// ---------------------------------------------------------------------------
export function GalleryFrame({
  size = 140,
  borderRadius = 18,
  children,
  bgColor,
  label,
}: {
  size?: number;
  borderRadius?: number;
  children?: ReactNode;
  bgColor?: string;
  label?: string;
}): JSX.Element {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        background: bgColor || PandaColors.cardBg,
        border: `2px solid ${PandaColors.cardBorder}`,
        boxShadow: '0 6px 24px rgba(76,175,80,0.10)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {children}
      {label ? (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            padding: '4px 8px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CTA Button — cartoon styled action button
// ---------------------------------------------------------------------------
export function CtaButton({
  label,
  onClick,
  color = PandaColors.warmOrange,
  size = 'medium' as const,
}: {
  label: string;
  onClick?: () => void;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}): JSX.Element {
  const sizes: Record<string, CSSProperties> = {
    small: { padding: '8px 20px', fontSize: 13, borderRadius: 14 },
    medium: { padding: '14px 32px', fontSize: 16, borderRadius: 18 },
    large: { padding: '18px 40px', fontSize: 18, borderRadius: 22 },
  };

  return (
    <button
      onClick={onClick}
      style={{
        ...sizes[size],
        background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        border: 'none',
        color: 'white',
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: `0 6px 20px ${color}44`,
        letterSpacing: 0.5,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
        (e.target as HTMLButtonElement).style.boxShadow = `0 8px 28px ${color}66`;
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLButtonElement).style.transform = 'scale(1)';
        (e.target as HTMLButtonElement).style.boxShadow = `0 6px 20px ${color}44`;
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Fun Fact Bubble — speech bubble style
// ---------------------------------------------------------------------------
export function FunFactBubble({
  fact,
  color = PandaColors.coral,
  align = 'left' as const,
}: {
  fact: string;
  color?: string;
  align?: 'left' | 'right';
}): JSX.Element {
  return (
    <div
      style={{
        position: 'relative',
        padding: '16px 20px',
        borderRadius: align === 'left' ? '20px 20px 20px 4px' : '20px 20px 4px 20px',
        background: `linear-gradient(135deg, ${color}15, ${color}08)`,
        border: `2px solid ${color}22`,
        color: PandaColors.darkText,
        fontSize: 14,
        lineHeight: 1.6,
        fontWeight: 600,
        maxWidth: 240,
      }}
    >
      <span style={{ fontSize: 18, marginRight: 6 }}>
        {['💡', '🎯', '✨', '🌟', '💫'][Math.floor(Math.random() * 5)]}
      </span>
      {fact}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene Wash Background — gradient overlay for scenes
// ---------------------------------------------------------------------------
export function PandaSceneWash({
  style,
  children,
}: {
  style?: CSSProperties;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse at 15% 18%, rgba(76,175,80,0.12) 0%, transparent 32%), radial-gradient(ellipse at 85% 85%, rgba(255,143,0,0.06) 0%, transparent 30%), linear-gradient(180deg, #F5F0EB 0%, #F0F7EE 35%, #EDF5EC 70%, #F5F0EB 100%)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene Image — wrapper around the cineview Image component for panda photos
// ---------------------------------------------------------------------------
export function ScenePhoto({
  src,
  alt,
  width,
  height,
  borderRadius = 20,
  shadow = true,
}: {
  src: string;
  alt: string;
  width: number;
  height?: number;
  borderRadius?: number;
  shadow?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        width,
        borderRadius,
        overflow: 'hidden',
        border: `2px solid ${PandaColors.cardBorder}`,
        boxShadow: shadow ? '0 12px 40px rgba(76,175,80,0.15)' : undefined,
        background: PandaColors.cream,
      }}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          objectFit: 'cover',
        }}
        loading="lazy"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Dots — scene indicator
// ---------------------------------------------------------------------------
export function ProgressDots({
  total,
  current,
  color = PandaColors.bamboo,
}: {
  total: number;
  current: number;
  color?: string;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: i === current ? color : `${color}33`,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bamboo Divider
// ---------------------------------------------------------------------------
export function BambooDivider(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '8px 0',
      }}
    >
      <div
        style={{
          width: 32,
          height: 2,
          borderRadius: 1,
          background: `linear-gradient(90deg, transparent, ${PandaColors.bambooLight})`,
        }}
      />
      <span style={{ fontSize: 18 }}>🎋</span>
      <div
        style={{
          width: 32,
          height: 2,
          borderRadius: 1,
          background: `linear-gradient(270deg, transparent, ${PandaColors.bambooLight})`,
        }}
      />
    </div>
  );
}
