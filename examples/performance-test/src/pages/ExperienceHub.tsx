import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { MODE_ROUTES, buildModeHref } from '../routing';

export function ExperienceHub(): import('react').JSX.Element {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top right, rgba(118,208,255,0.12), transparent 28%), linear-gradient(180deg, #05070A 0%, #0F161E 100%)',
        color: '#F4F7FB',
        padding: '64px 56px 88px',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ maxWidth: 940, marginBottom: 42 }}>
        <div
          style={{
            display: 'inline-flex',
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: '#D9E3EE',
            fontSize: 13,
            marginBottom: 22,
          }}
        >
          CineView example / two authored motion studies
        </div>
        <h1 style={{ margin: 0, fontSize: 80, lineHeight: 0.94, fontWeight: 600 }}>Orbit S1</h1>
        <p
          style={{
            margin: '20px 0 0',
            maxWidth: 740,
            color: 'rgba(231,237,245,0.76)',
            fontSize: 20,
            lineHeight: 1.65,
          }}
        >
          A reference imaging console presented through one shared hardware story and two distinct
          motion systems: drag for release-led progression and scroll for real document reading
          mixed with authored Scene.scroll takeovers.
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 24,
          marginBottom: 30,
        }}
      >
        <article
          style={{
            padding: 28,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ color: 'rgba(231,237,245,0.54)', fontSize: 12, marginBottom: 16 }}>
            Product overview
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.1, marginBottom: 16 }}>
            {PERFORMANCE_EXPERIENCE.category}
          </div>
          <div style={{ color: 'rgba(231,237,245,0.74)', fontSize: 17, lineHeight: 1.65 }}>
            {PERFORMANCE_EXPERIENCE.overview}
          </div>
        </article>

        <article
          style={{
            padding: 28,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ color: 'rgba(231,237,245,0.54)', fontSize: 12, marginBottom: 16 }}>
            Shared chapter map
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {PERFORMANCE_EXPERIENCE.sections.map((section, index) => (
              <div
                key={section.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <div style={{ color: section.accent, fontSize: 14 }}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{section.title}</div>
                  <div style={{ color: 'rgba(231,237,245,0.58)', fontSize: 13 }}>
                    {section.eyebrow}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 18,
        }}
      >
        {MODE_ROUTES.map((route) => (
          <article
            key={route.id}
            style={{
              padding: 24,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'grid',
              gap: 18,
              minHeight: 240,
            }}
          >
            <div style={{ color: 'rgba(231,237,245,0.54)', fontSize: 12 }}>Motion mode</div>
            <h2 style={{ margin: 0, fontSize: 34, fontWeight: 600 }}>{route.label}</h2>
            <p
              style={{ margin: 0, color: 'rgba(231,237,245,0.74)', fontSize: 16, lineHeight: 1.65 }}
            >
              {route.summary}
            </p>
            <a
              href={buildModeHref(route.id)}
              style={{
                alignSelf: 'end',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 124,
                padding: '12px 16px',
                borderRadius: 999,
                background: 'rgba(242,179,106,0.14)',
                border: '1px solid rgba(242,179,106,0.28)',
                color: '#F6C78B',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              Open {route.label}
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
