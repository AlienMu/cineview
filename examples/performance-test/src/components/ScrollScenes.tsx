import { Animate, Container, Position, Scene } from 'cineview';
import type { ExperienceSection } from '../content/performanceExperience';
import {
  BulletColumn,
  DetailList,
  LabPill,
  MediaFrame,
  MetricRail,
  SceneWash,
  SectionCopy,
  StatGrid,
} from './SharedBlocks';

export function renderScrollScenes(sections: ExperienceSection[]): JSX.Element[] {
  const sceneNodes = sections.map((section, index) => {
    const sceneHeight = resolveSceneHeight(section);
    const takeover = section.composition.scroll.takeover;

    return (
      <Scene
        key={`scroll-${section.id}`}
        assets={{ preloadImages: section.media ? [section.media.src] : [] }}
        layout={{ height: sceneHeight }}
        scroll={
          takeover
            ? {
                zoneId: takeover.zoneId ?? `${section.id}-takeover`,
                trigger: takeover.trigger ?? 'center-lock',
              }
            : undefined
        }
      >
        <SceneWash accent={section.accent} />
        <Container>{renderSceneBody(section, index, Boolean(takeover))}</Container>
      </Scene>
    );
  });

  return [...sceneNodes, renderOrdinaryDocumentInterlude()];
}

function renderOrdinaryDocumentInterlude(): JSX.Element {
  return (
    <article
      key="ordinary-document-interlude"
      data-testid="ordinary-document-interlude"
      style={{
        minHeight: '82vh',
        paddingTop: '150px',
        paddingInline: 'max(48px, 10vw)',
        paddingBottom: 'max(560px, 64vh)',
        background: '#EEF4F8',
        color: '#172033',
      }}
    >
      <Animate
        animateId="ordinary-document-visibility"
        enterAnimation="fade-in"
        exitAnimation="fade-out"
        infiniteAnimation="pulse"
        duration={{ enter: 640, exit: 240 }}
        timeline={{ sceneControlled: false }}
      >
        <div style={{ maxWidth: 760 }}>
          <div
            style={{
              color: '#4670A8',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0,
              marginBottom: 18,
              textTransform: 'uppercase',
            }}
          >
            Ordinary document block
          </div>
          <h2 style={{ margin: 0, fontSize: 46, lineHeight: 1.05 }}>
            This chapter is plain document flow, not a Scene.
          </h2>
          <p style={{ margin: '24px 0 0', fontSize: 18, lineHeight: 1.7, color: '#45546E' }}>
            The visibility animation here proves scroll mode can host normal article content between
            authored takeover scenes without requiring a Scene wrapper.
          </p>
        </div>
      </Animate>
      <div
        style={{
          marginTop: 84,
          maxWidth: 820,
          display: 'grid',
          gap: 18,
          fontSize: 16,
          lineHeight: 1.75,
          color: '#45546E',
        }}
      >
        <p style={{ margin: 0 }}>
          Below the animated lead, the page keeps behaving like ordinary document flow. There is no
          Scene wrapper here, no separate scroll speed knob, and no authored fixed layer holding the
          viewport in place.
        </p>
        <p style={{ margin: 0 }}>
          That extra runway is deliberate. It gives the visibility-driven block enough room to reach
          its center state, continue into exit, and then return naturally when you reverse back up
          through the tail of the page.
        </p>
        <p style={{ margin: 0 }}>
          In other words: the route can end in plain prose and still preserve the same authored
          motion language the earlier chapters used under Scene.scroll.
        </p>
      </div>
      <AcceptanceFixtures />
    </article>
  );
}

function AcceptanceFixtures(): JSX.Element {
  return (
    <section
      data-testid="scroll-acceptance-fixtures"
      style={{
        marginTop: 72,
        maxWidth: 920,
        display: 'grid',
        gap: 24,
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 20 }}>Nested scroll ownership fixture</h3>
        <div
          data-testid="nested-scroll-fixture"
          tabIndex={0}
          style={{
            maxHeight: 180,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            border: '1px solid rgba(23,32,51,0.18)',
            padding: 20,
            background: '#FFFFFF',
            color: '#45546E',
            fontSize: 15,
            lineHeight: 1.7,
          }}
        >
          {[
            'The inner panel should consume wheel/touch deltas while it can still scroll.',
            'CineView should receive ownership only when this panel reaches its boundary.',
            'This fixture exists so browser acceptance can verify nested scrolling directly.',
            'Line four adds enough overflow to make scrollHeight larger than clientHeight.',
            'Line five gives the test a stable lower boundary.',
            'Line six keeps repeated wheel input deterministic.',
            'Line seven should be reachable without advancing the document first.',
            'Line eight marks the end of the nested scrollable content.',
          ].map((line) => (
            <p key={line} style={{ margin: '0 0 14px' }}>
              {line}
            </p>
          ))}
        </div>
      </div>
      <details
        data-testid="dynamic-layout-fixture"
        style={{
          border: '1px solid rgba(23,32,51,0.18)',
          padding: 20,
          background: '#FFFFFF',
        }}
      >
        <summary data-testid="dynamic-layout-toggle" style={{ cursor: 'pointer', fontWeight: 700 }}>
          Dynamic layout mutation fixture
        </summary>
        <div
          data-testid="dynamic-layout-expanded-content"
          style={{ marginTop: 18, color: '#45546E', fontSize: 15, lineHeight: 1.75 }}
        >
          <p style={{ margin: 0 }}>
            Opening this native details block increases the document footprint after initial layout.
          </p>
          <p style={{ margin: '14px 0 0' }}>
            Browser acceptance should verify that subsequent scroll/center-lock behavior remains
            stable after the mutation.
          </p>
        </div>
      </details>
    </section>
  );
}

function renderSceneBody(
  section: ExperienceSection,
  index: number,
  takeover: boolean
): JSX.Element {
  switch (section.composition.scroll.style) {
    case 'document-hero':
      return <DocumentHero section={section} index={index} takeover={takeover} />;
    case 'editorial-split':
      return <EditorialSplit section={section} index={index} />;
    case 'spec-takeover':
      return <SpecTakeover section={section} index={index} takeover={takeover} />;
    case 'exploded-story':
      return <ExplodedStory section={section} index={index} />;
    case 'scenario-takeover':
      return <ScenarioTakeover section={section} index={index} takeover={takeover} />;
    case 'decision-appendix':
      return <DecisionAppendix section={section} index={index} />;
    default:
      return <DocumentHero section={section} index={index} takeover={takeover} />;
  }
}

function DocumentHero({
  section,
  index,
  takeover,
}: {
  section: ExperienceSection;
  index: number;
  takeover: boolean;
}): JSX.Element {
  return (
    <>
      <Position at={{ x: 112, y: 96 }} layer={{ fixed: takeover }}>
        <Animate
          animateId={`${section.id}-badge`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 280 }}
          timeline={{ sceneControlled: false }}
        >
          <LabPill>{`${String(index + 1).padStart(2, '0')} / ${takeover ? 'Scene.scroll takeover' : 'Document chapter'}`}</LabPill>
        </Animate>
      </Position>
      <Position at={{ x: 110, y: 182 }}>
        <Animate
          animateId={`${section.id}-copy`}
          enterAnimation="slide-up"
          exitAnimation="slide-up"
          duration={{ enter: 780 }}
          timeline={{ sceneControlled: false }}
        >
          <SectionCopy maxWidth={590} section={section} titleSize="hero" />
        </Animate>
      </Position>
      <Position at={{ x: 838, y: 154 }}>
        <Animate
          animateId={`${section.id}-media`}
          enterAnimation="zoom-in"
          exitAnimation="zoom-out"
          infiniteAnimation={takeover ? undefined : 'pulse'}
          duration={{ enter: 900 }}
          timeline={takeover ? { phase: { start: 0.08, end: 0.68 } } : { sceneControlled: false }}
        >
          <MediaFrame priority={index === 0} section={section} width={520} />
        </Animate>
      </Position>
      <Position at={{ x: 112, y: 834 }}>
        <Animate
          animateId={`${section.id}-rail`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 620 }}
          timeline={takeover ? { phase: { start: 0.42, end: 1 } } : { sceneControlled: false }}
        >
          <div style={{ width: 1216 }}>
            <MetricRail section={section} />
          </div>
        </Animate>
      </Position>
    </>
  );
}

function EditorialSplit({
  section,
  index,
}: {
  section: ExperienceSection;
  index: number;
}): JSX.Element {
  return (
    <>
      <Position at={{ x: 116, y: 116 }}>
        <Animate
          animateId={`${section.id}-pill`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 260 }}
          timeline={{ sceneControlled: false }}
        >
          <LabPill>{`${String(index + 1).padStart(2, '0')} / Editorial flow`}</LabPill>
        </Animate>
      </Position>
      <Position at={{ x: 116, y: 232 }}>
        <Animate
          animateId={`${section.id}-copy`}
          enterAnimation="slide-right"
          exitAnimation="slide-right"
          duration={{ enter: 640 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 460 }}>
            <SectionCopy maxWidth={460} section={section} titleSize="medium" />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 642, y: 218 }}>
        <Animate
          animateId={`${section.id}-media`}
          enterAnimation="slide-left"
          exitAnimation="slide-left"
          duration={{ enter: 760 }}
          timeline={{ sceneControlled: false }}
        >
          <MediaFrame section={section} width={620} />
        </Animate>
      </Position>
      <Position at={{ x: 116, y: 770 }}>
        <Animate
          animateId={`${section.id}-stats`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          infiniteAnimation="pulse"
          duration={{ enter: 520 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 1146 }}>
            <StatGrid compact={true} section={section} />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 116, y: 1012 }}>
        <Animate
          animateId={`${section.id}-notes`}
          enterAnimation="blur-in"
          exitAnimation="blur-out"
          duration={{ enter: 420 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 540 }}>
            <DetailList
              accent={section.accent}
              items={section.secondaryPoints}
              title="Why this scene stays in document flow"
            />
          </div>
        </Animate>
      </Position>
    </>
  );
}

function SpecTakeover({
  section,
  index,
  takeover,
}: {
  section: ExperienceSection;
  index: number;
  takeover: boolean;
}): JSX.Element {
  return (
    <>
      <Position at={{ x: 1080, y: 104 }} layer={{ fixed: takeover }}>
        <Animate
          animateId={`${section.id}-pill`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 240 }}
          timeline={{ phase: { start: 0, end: 0.22 } }}
        >
          <LabPill>{`${String(index + 1).padStart(2, '0')} / Sticky layer + scroll`}</LabPill>
        </Animate>
      </Position>
      <Position at={{ x: 120, y: 180 }}>
        <Animate
          animateId={`${section.id}-copy`}
          enterAnimation="slide-up"
          exitAnimation="slide-up"
          duration={{ enter: 700 }}
          timeline={{ phase: { start: 0, end: 0.34 } }}
        >
          <SectionCopy maxWidth={680} section={section} titleSize="large" />
        </Animate>
      </Position>
      <Position at={{ x: 142, y: 514 }}>
        <Animate
          animateId={`${section.id}-stats`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 560 }}
          timeline={{ phase: { start: 0.04, end: 0.48 } }}
        >
          <div style={{ width: 510 }}>
            <StatGrid columns={2} section={section} />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 752, y: 272 }}>
        <Animate
          animateId={`${section.id}-media`}
          enterAnimation="rotate-in"
          exitAnimation="rotate-out"
          duration={{ enter: 900 }}
          timeline={{ phase: { start: 0.12, end: 0.76 } }}
        >
          <MediaFrame section={section} width={580} />
        </Animate>
      </Position>
      <Position at={{ x: 860, y: 844 }}>
        <Animate
          animateId={`${section.id}-bullets`}
          enterAnimation="blur-in"
          exitAnimation="blur-out"
          duration={{ enter: 420 }}
          timeline={{ phase: { start: 0.28, end: 0.92 } }}
        >
          <div style={{ width: 360 }}>
            <BulletColumn section={section} />
          </div>
        </Animate>
      </Position>
    </>
  );
}

function ExplodedStory({
  section,
  index,
}: {
  section: ExperienceSection;
  index: number;
}): JSX.Element {
  return (
    <>
      <Position at={{ x: 120, y: 112 }}>
        <Animate
          animateId={`${section.id}-pill`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 260 }}
          timeline={{ sceneControlled: false }}
        >
          <LabPill>{`${String(index + 1).padStart(2, '0')} / Visibility timeline`}</LabPill>
        </Animate>
      </Position>
      <Position at={{ x: 120, y: 220 }}>
        <Animate
          animateId={`${section.id}-copy`}
          enterAnimation="slide-up"
          exitAnimation="slide-up"
          duration={{ enter: 680 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 540 }}>
            <SectionCopy maxWidth={540} section={section} titleSize="medium" />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 798, y: 204 }}>
        <Animate
          animateId={`${section.id}-media`}
          enterAnimation="zoom-in"
          exitAnimation="zoom-out"
          infiniteAnimation="wave"
          duration={{ enter: 780 }}
          timeline={{ sceneControlled: false }}
        >
          <MediaFrame section={section} width={520} />
        </Animate>
      </Position>
      <Position at={{ x: 120, y: 706 }}>
        <Animate
          animateId={`${section.id}-rail`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 560 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 1200 }}>
            <MetricRail section={section} />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 120, y: 1010 }}>
        <Animate
          animateId={`${section.id}-notes`}
          enterAnimation="slide-up"
          exitAnimation="slide-up"
          duration={{ enter: 500 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 480 }}>
            <DetailList
              accent={section.accent}
              items={section.secondaryPoints}
              title="Module story"
            />
          </div>
        </Animate>
      </Position>
    </>
  );
}

function ScenarioTakeover({
  section,
  index,
  takeover,
}: {
  section: ExperienceSection;
  index: number;
  takeover: boolean;
}): JSX.Element {
  return (
    <>
      <Position at={{ x: 118, y: 102 }} layer={{ fixed: takeover }}>
        <Animate
          animateId={`${section.id}-pill`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 260 }}
          timeline={{ phase: { start: 0, end: 0.2 } }}
        >
          <LabPill>{`${String(index + 1).padStart(2, '0')} / Shared authored content`}</LabPill>
        </Animate>
      </Position>
      <Position at={{ x: 334, y: 160 }}>
        <Animate
          animateId={`${section.id}-copy`}
          enterAnimation="zoom-in"
          exitAnimation="zoom-out"
          duration={{ enter: 640 }}
          timeline={{ phase: { start: 0, end: 0.38 } }}
        >
          <SectionCopy align="center" maxWidth={760} section={section} titleSize="large" />
        </Animate>
      </Position>
      <Position at={{ x: 118, y: 470 }}>
        <Animate
          animateId={`${section.id}-left`}
          enterAnimation="slide-right"
          exitAnimation="slide-right"
          duration={{ enter: 620 }}
          timeline={{ phase: { start: 0.04, end: 0.46 } }}
        >
          <div style={{ width: 350 }}>
            <BulletColumn section={section} />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 474, y: 430 }}>
        <Animate
          animateId={`${section.id}-center`}
          enterAnimation="focus-in"
          exitAnimation="blur-out"
          duration={{ enter: 760 }}
          timeline={{ phase: { start: 0.12, end: 0.72 } }}
        >
          <MediaFrame section={section} width={500} />
        </Animate>
      </Position>
      <Position at={{ x: 1002, y: 470 }}>
        <Animate
          animateId={`${section.id}-right`}
          enterAnimation="slide-left"
          exitAnimation="slide-left"
          duration={{ enter: 620 }}
          timeline={{ phase: { start: 0.24, end: 0.9 } }}
        >
          <div style={{ width: 320 }}>
            <DetailList
              accent={section.accent}
              items={section.secondaryPoints}
              title="Kit variations"
            />
          </div>
        </Animate>
      </Position>
    </>
  );
}

function DecisionAppendix({
  section,
  index,
}: {
  section: ExperienceSection;
  index: number;
}): JSX.Element {
  return (
    <>
      <Position at={{ x: 118, y: 112 }}>
        <Animate
          animateId={`${section.id}-pill`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ enter: 240 }}
          timeline={{ sceneControlled: false }}
        >
          <LabPill>{`${String(index + 1).padStart(2, '0')} / Comparison close`}</LabPill>
        </Animate>
      </Position>
      <Position at={{ x: 300, y: 200 }}>
        <Animate
          animateId={`${section.id}-copy`}
          enterAnimation="slide-up"
          exitAnimation="slide-up"
          duration={{ enter: 660 }}
          timeline={{ sceneControlled: false }}
        >
          <SectionCopy align="center" maxWidth={820} section={section} titleSize="large" />
        </Animate>
      </Position>
      <Position at={{ x: 140, y: 518 }}>
        <Animate
          animateId={`${section.id}-grid`}
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          infiniteAnimation="pulse"
          duration={{ enter: 540 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 1160 }}>
            <StatGrid section={section} />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 468, y: 842 }}>
        <Animate
          animateId={`${section.id}-rail`}
          enterAnimation="blur-in"
          exitAnimation="blur-out"
          duration={{ enter: 480 }}
          timeline={{ sceneControlled: false }}
        >
          <div style={{ width: 520 }}>
            <DetailList
              accent={section.accent}
              items={section.secondaryPoints}
              title="What the framework is showing here"
            />
          </div>
        </Animate>
      </Position>
    </>
  );
}

function resolveSceneHeight(section: ExperienceSection): number {
  const configuredHeight = section.composition.scroll.sceneHeight;
  if (configuredHeight === 'screen') {
    return 1200;
  }

  return configuredHeight ?? 1200;
}
