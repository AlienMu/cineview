import type { ModeId } from '../routing';

interface ExperienceHeaderProps {
  mode: ModeId;
  subtitle: string;
}

export default function ExperienceHeader({
  mode,
  subtitle,
}: ExperienceHeaderProps): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        top: 22,
        left: 22,
        zIndex: 12000,
        padding: '12px 14px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.78)',
        border: '1px solid rgba(100, 124, 170, 0.16)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 18px 42px rgba(139, 165, 209, 0.18)',
      }}
    >
      <div style={{ color: '#7482A4', fontSize: 12, marginBottom: 8 }}>
        Orbit S1 / {mode.toUpperCase()}
      </div>
      <div style={{ color: '#203050', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Reference Imaging Console
      </div>
      <div style={{ color: '#617092', fontSize: 12, maxWidth: 320, lineHeight: 1.5 }}>
        {subtitle}
      </div>
    </div>
  );
}
