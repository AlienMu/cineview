import { Animate, Container, Position, Scene } from 'cineview';
import type { PresetAnimation } from 'cineview';
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

const dragTransitions: Array<{ enter: PresetAnimation; exit: PresetAnimation }> = [
  { enter: 'slide-up', exit: 'fade-out' },
  { enter: 'focus-in', exit: 'fade-out' },
  { enter: 'zoom-in', exit: 'fade-out' },
  { enter: 'slide-left', exit: 'fade-out' },
  { enter: 'rotate-in', exit: 'fade-out' },
  { enter: 'blur-in', exit: 'fade-out' },
];

export function renderDragScenes(sections: ExperienceSection[]): JSX.Element[] {
  return sections.map((section, index) => {
    const transition = dragTransitions[index % dragTransitions.length];

    return (
      <Scene
        key={`drag-${section.id}`}
        assets={{ preloadImages: section.media ? [section.media.src] : [] }}
        transition={{
          enterAnimation: transition.enter,
          exitAnimation: transition.exit,
          exitDuration: 940,
        }}
      >
        <SceneWash accent={section.accent} style={{ backgroundBlendMode: 'screen' }} />
        <Container>{renderDragLayout(section, index)}</Container>
      </Scene>
    );
  });
}

function renderDragLayout(section: ExperienceSection, index: number): JSX.Element {
  const flavor = index % 3;

  if (flavor === 0) {
    return (
      <>
        <Position at={{ x: 112, y: 94 }}>
          <StagePill index={index} section={section} />
        </Position>
        <Position at={{ x: 820, y: 154 }}>
          <Animate
            animateId={`drag-${section.id}-media`}
            enterAnimation="focus-in"
            duration={{ enter: 500, exit: 520 }}
            timeline={{ delay: 90 }}
          >
            <MediaFrame priority={index === 0} section={section} width={540} />
          </Animate>
        </Position>
        <Position at={{ x: 104, y: 190 }}>
          <Animate
            exitAnimation="zoom-out"
            animateId={`drag-${section.id}-copy`}
            enterAnimation="slide-up"
            timeline={{ delay: 2000, after: `drag-${section.id}-media` }}
            duration={{ enter: 760, exit: 360 }}
          >
            <SectionCopy
              maxWidth={540}
              section={section}
              titleSize={index === 0 ? 'hero' : 'large'}
            />
          </Animate>
        </Position>
        <Position at={{ x: 106, y: 824 }}>
          <Animate
            animateId={`drag-${section.id}-rail`}
            enterAnimation="fade-in"
            duration={{ enter: 620, exit: 320 }}
            timeline={{ delay: 180 }}
          >
            <div style={{ width: 1220 }}>
              <MetricRail section={section} />
            </div>
          </Animate>
        </Position>
      </>
    );
  }

  if (flavor === 1) {
    return (
      <>
        <Position at={{ x: 110, y: 92 }}>
          <StagePill index={index} section={section} />
        </Position>
        <Position at={{ x: 96, y: 194 }}>
          <Animate
            animateId={`drag-${section.id}-copy`}
            timeline={{ delay: 100, after: `drag-${section.id}-media` }}
            enterAnimation="slide-right"
            duration={{ enter: 720, exit: 340 }}
          >
            <div style={{ width: 400 }}>
              <SectionCopy maxWidth={400} section={section} titleSize="medium" />
            </div>
          </Animate>
        </Position>
        <Position at={{ x: 560, y: 170 }}>
          <Animate
            animateId={`drag-${section.id}-media`}
            enterAnimation="slide-left"
            duration={{ enter: 900, exit: 460 }}
            timeline={{ delay: 120 }}
          >
            <MediaFrame section={section} width={500} />
          </Animate>
        </Position>
        <Position at={{ x: 1160, y: 184 }}>
          <Animate
            animateId={`drag-${section.id}-details`}
            enterAnimation="rotate-in"
            duration={{ enter: 720, exit: 340 }}
            timeline={{ delay: 0, after: `drag-${section.id}-copy` }}
          >
            <div style={{ width: 240 }}>
              <DetailList
                accent={section.accent}
                items={section.secondaryPoints}
                title="Crew notes"
              />
            </div>
          </Animate>
        </Position>
        <Position at={{ x: 96, y: 768 }}>
          <Animate
            animateId={`drag-${section.id}-stats`}
            enterAnimation="slide-up"
            duration={{ enter: 640, exit: 320 }}
            timeline={{ delay: 220 }}
          >
            <div style={{ width: 1252 }}>
              <StatGrid compact={true} section={section} />
            </div>
          </Animate>
        </Position>
      </>
    );
  }

  return (
    <>
      <Position at={{ x: 116, y: 96 }}>
        <StagePill index={index} section={section} />
      </Position>
      <Position at={{ x: 120, y: 150 }}>
        <Animate
          animateId={`drag-${section.id}-copy`}
          enterAnimation="zoom-in"
          duration={{ enter: 700, exit: 320 }}
        >
          <SectionCopy maxWidth={620} section={section} titleSize="large" />
        </Animate>
      </Position>
      <Position at={{ x: 120, y: 500 }}>
        <Animate
          animateId={`drag-${section.id}-stats`}
          enterAnimation="fade-in"
          duration={{ enter: 520, exit: 240 }}
          timeline={{ delay: 120 }}
        >
          <div style={{ width: 520 }}>
            <StatGrid columns={2} section={section} />
          </div>
        </Animate>
      </Position>
      <Position at={{ x: 1000, y: 414 }}>
        <Animate
          animateId={`drag-${section.id}-media`}
          enterAnimation="focus-in"
          duration={{ enter: 860, exit: 420 }}
          timeline={{ delay: 160 }}
        >
          <MediaFrame section={section} width={360} withCaption={false} />
        </Animate>
      </Position>
      <Position at={{ x: 960, y: 150 }}>
        <Animate
          animateId={`drag-${section.id}-bullet`}
          enterAnimation="blur-in"
          duration={{ enter: 560, exit: 260 }}
          timeline={{ delay: 220 }}
        >
          <div style={{ width: 360 }}>
            <BulletColumn section={section} />
          </div>
        </Animate>
      </Position>
    </>
  );
}

function StagePill({ index, section }: { index: number; section: ExperienceSection }): JSX.Element {
  return <LabPill>{`${String(index + 1).padStart(2, '0')} / ${section.eyebrow}`}</LabPill>;
}
