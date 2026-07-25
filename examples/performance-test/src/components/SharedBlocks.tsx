import type { CSSProperties, ReactNode } from 'react';
import { Image } from 'cineview';
import type { ExperienceSection } from '../content/performanceExperience';

const textColor = '#1F2A44';
const mutedText = '#5F6C8D';
const panelBorder = '1px solid rgba(96, 120, 167, 0.18)';
const panelShadow = '0 24px 60px rgba(119, 146, 201, 0.18)';

export function LabPill({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.82)',
        border: panelBorder,
        color: '#38508A',
        fontSize: 12,
        fontWeight: 700,
        boxShadow: '0 12px 30px rgba(134, 163, 220, 0.14)',
      }}
    >
      {children}
    </div>
  );
}

export function SectionCopy({
  align = 'left',
  maxWidth,
  titleSize = 'large',
  section,
}: {
  align?: 'left' | 'center';
  maxWidth?: number;
  section: ExperienceSection;
  titleSize?: 'medium' | 'large' | 'hero';
}): JSX.Element {
  const resolvedTitleSize = titleSize === 'hero' ? 74 : titleSize === 'medium' ? 42 : 56;

  return (
    <div style={{ maxWidth: maxWidth ?? (align === 'center' ? 920 : 560), textAlign: align }}>
      <div
        style={{
          color: section.accent,
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 18,
          textTransform: 'uppercase',
        }}
      >
        {section.eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          color: textColor,
          fontSize: resolvedTitleSize,
          lineHeight: titleSize === 'hero' ? 0.96 : 1.02,
          fontWeight: 700,
        }}
      >
        {section.title}
      </h2>
      <p
        style={{
          margin: '22px 0 0',
          color: mutedText,
          fontSize: 18,
          lineHeight: 1.68,
        }}
      >
        {section.summary}
      </p>
    </div>
  );
}

export function StatGrid({
  columns = 3,
  compact = false,
  section,
}: {
  columns?: 2 | 3;
  compact?: boolean;
  section: ExperienceSection;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: compact ? 12 : 18,
      }}
    >
      {section.primaryStats.map((stat) => (
        <div
          key={`${section.id}-${stat.label}`}
          style={{
            padding: compact ? 18 : 22,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.88)',
            border: panelBorder,
            minHeight: compact ? 126 : 146,
            boxSizing: 'border-box',
            boxShadow: panelShadow,
          }}
        >
          <div style={{ color: mutedText, fontSize: 12, marginBottom: compact ? 12 : 16 }}>
            {stat.label}
          </div>
          <div
            style={{
              color: textColor,
              fontSize: compact ? 24 : 30,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {stat.value}
          </div>
          <div style={{ color: '#63708F', fontSize: 14, lineHeight: 1.5 }}>{stat.detail}</div>
        </div>
      ))}
    </div>
  );
}

export function BulletColumn({ section }: { section: ExperienceSection }): JSX.Element {
  return (
    <div
      style={{
        padding: 22,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.78)',
        border: panelBorder,
        boxShadow: panelShadow,
      }}
    >
      {section.secondaryPoints.map((point) => (
        <div
          key={`${section.id}-${point}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '14px 1fr',
            gap: 12,
            color: mutedText,
            fontSize: 15,
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          <div style={{ color: section.accent, fontSize: 16 }}>•</div>
          <div>{point}</div>
        </div>
      ))}
    </div>
  );
}

export function DetailList({
  accent,
  items,
  title,
}: {
  accent: string;
  items: string[];
  title: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.82)',
        border: panelBorder,
        boxShadow: panelShadow,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((item) => (
          <div
            key={`${title}-${item}`}
            style={{ color: mutedText, fontSize: 14, lineHeight: 1.55 }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MediaFrame({
  priority = false,
  section,
  width,
  withCaption = true,
}: {
  priority?: boolean;
  section: ExperienceSection;
  width: number;
  withCaption?: boolean;
}): JSX.Element | null {
  if (!section.media) {
    return null;
  }

  const height = Math.round((width / section.media.width) * section.media.height);

  return (
    <div style={{ width }}>
      <div
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: panelBorder,
          boxShadow: '0 28px 80px rgba(119, 146, 201, 0.24)',
          background: 'rgba(255,255,255,0.94)',
        }}
      >
        <Image
          alt={section.media.alt}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          preload={priority}
          src={section.media.src}
          style={{ display: 'block', width: '100%', height: 'auto', background: '#FFFFFF' }}
          width={width}
        />
      </div>
      {withCaption ? (
        <div style={{ marginTop: 14, color: '#7080A4', fontSize: 13, lineHeight: 1.5 }}>
          {section.media.caption}
        </div>
      ) : null}
    </div>
  );
}

export function MetricRail({
  section,
  stacked = false,
}: {
  section: ExperienceSection;
  stacked?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: stacked ? '1fr' : 'repeat(3, minmax(0, 1fr))',
        gap: 14,
      }}
    >
      {section.primaryStats.map((stat) => (
        <div
          key={`${section.id}-rail-${stat.label}`}
          style={{
            padding: 18,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.82)',
            border: panelBorder,
            boxShadow: panelShadow,
          }}
        >
          <div style={{ color: mutedText, fontSize: 12, marginBottom: 10 }}>{stat.label}</div>
          <div style={{ color: textColor, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            {stat.value}
          </div>
          <div style={{ color: '#657391', fontSize: 14, lineHeight: 1.45 }}>{stat.detail}</div>
        </div>
      ))}
    </div>
  );
}

export function SceneWash({
  accent,
  children,
  style,
}: {
  accent: string;
  children?: ReactNode;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 15% 18%, ${accent}33 0%, transparent 32%), radial-gradient(circle at 82% 20%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 34%), linear-gradient(180deg, #FFF9F2 0%, #F4F8FF 45%, #EEF6FF 100%)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
