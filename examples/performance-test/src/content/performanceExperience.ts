export type ExperienceSectionId = 'hero' | 'highlights' | 'specs' | 'details' | 'scenarios' | 'cta';

export interface ExperienceStat {
  label: string;
  value: string;
  detail: string;
}

export type ScrollChapterStyle =
  | 'document-hero'
  | 'editorial-split'
  | 'spec-takeover'
  | 'exploded-story'
  | 'scenario-takeover'
  | 'decision-appendix';

export type DragChapterStyle =
  | 'hero-stage'
  | 'control-surface'
  | 'data-wall'
  | 'service-ribbon'
  | 'kit-constellation'
  | 'closing-brief';

export interface ExperienceSection {
  id: ExperienceSectionId;
  eyebrow: string;
  title: string;
  summary: string;
  accent: string;
  backdrop: string;
  media?: {
    src: string;
    alt: string;
    caption: string;
    width: number;
    height: number;
  };
  primaryStats: ExperienceStat[];
  secondaryPoints: string[];
  composition: {
    scroll: {
      style: ScrollChapterStyle;
      sceneHeight?: number | 'screen';
      takeover?: {
        trigger?: 'center-lock';
        zoneId?: string;
      };
    };
    drag: {
      style: DragChapterStyle;
    };
  };
}

export const PERFORMANCE_EXPERIENCE = {
  productName: 'Orbit S1',
  category: 'Reference Imaging Console',
  overview:
    'Orbit S1 is a flagship field imaging console built for calibration-heavy camera rigs, industrial inspection, and mobile post pipelines.',
  cta: {
    primary: 'Book lab session',
    secondary: 'Download spec sheet',
  },
  sections: [
    {
      id: 'hero',
      eyebrow: 'Launch configuration',
      title: 'Reference-grade monitoring that travels like field gear.',
      summary:
        'Orbit S1 combines a daylight-safe 7.2-inch reference panel, low-latency ingest, and sealed controls in a chassis tuned for location work.',
      accent: '#F28B82',
      backdrop: 'linear-gradient(180deg, #070A0E 0%, #111A24 100%)',
      media: {
        src: '/assets/orbit-s1-hero.svg',
        alt: 'Orbit S1 hero render',
        caption: 'Matte chassis, calibrated display stack, side I/O spine.',
        width: 640,
        height: 480,
      },
      primaryStats: [
        { label: 'Peak brightness', value: '1600 nits', detail: 'HDR focus pull in direct sun' },
        { label: 'Glass-to-glass', value: '14 ms', detail: 'Low-latency preview path' },
        { label: 'Hot-swap runtime', value: '6.2 h', detail: 'Dual pack power rail' },
      ],
      secondaryPoints: [
        'Magnesium shell with sealed tactile wheel',
        'Four assignable soft keys with glove-safe spacing',
        'Scene-local asset preloading on every image-led chapter',
      ],
      composition: {
        scroll: { style: 'document-hero', sceneHeight: 'screen' },
        drag: { style: 'hero-stage' },
      },
    },
    {
      id: 'highlights',
      eyebrow: 'Core advantages',
      title: 'A control surface designed for crews, not showrooms.',
      summary:
        'The hardware story stays operational: clearer signal checks, fewer hidden menus, and controls that resolve by feel under pressure.',
      accent: '#58B9F7',
      backdrop: 'linear-gradient(180deg, #091018 0%, #162434 100%)',
      media: {
        src: '/assets/orbit-s1-hero.svg',
        alt: 'Orbit S1 angled display',
        caption: 'Tactile surface layout with isolated function clusters.',
        width: 640,
        height: 480,
      },
      primaryStats: [
        { label: 'Assignable profiles', value: '12 banks', detail: 'Recall LUT + scope stacks' },
        { label: 'Waveform refresh', value: '120 Hz', detail: 'Clean confidence while panning' },
        { label: 'Fan noise', value: '18 dBA', detail: 'Near-silent close-mic work' },
      ],
      secondaryPoints: [
        'Status rail surfaces power, media, and sync without overlays',
        'Dedicated wheel toggles between exposure, LUT gain, and false color',
        'Lab-style layout keeps the test instrumentation close but quiet',
      ],
      composition: {
        scroll: { style: 'editorial-split', sceneHeight: 1240 },
        drag: { style: 'control-surface' },
      },
    },
    {
      id: 'specs',
      eyebrow: 'Performance envelope',
      title: 'The numbers stay visible because crews buy margin.',
      summary:
        'Orbit S1 is tuned for high-confidence review on set, in carts, and in inspection bays where reliability beats marketing copy.',
      accent: '#78C96E',
      backdrop: 'linear-gradient(180deg, #0A1114 0%, #182320 100%)',
      media: {
        src: '/assets/orbit-s1-exploded.svg',
        alt: 'Orbit S1 performance layout',
        caption: 'Thermal separation and compute bay architecture.',
        width: 640,
        height: 480,
      },
      primaryStats: [
        {
          label: 'Input matrix',
          value: '12G-SDI / HDMI 2.1',
          detail: 'Dual path ingest and loop-out',
        },
        { label: 'Color pipeline', value: '12-bit 4:4:4', detail: 'Reference LUT and QC overlays' },
        { label: 'Ingress seal', value: 'IP54', detail: 'Dust and splash tolerant body' },
      ],
      secondaryPoints: [
        'Dedicated thermal path separates panel, compute, and battery rails',
        'Persistent hardware scopes survive profile changes mid-session',
        'Designed to keep frame pacing stable under rich chapter transitions',
      ],
      composition: {
        scroll: {
          style: 'spec-takeover',
          sceneHeight: 'screen',
          takeover: {
            trigger: 'center-lock',
            zoneId: 'specs-takeover',
          },
        },
        drag: { style: 'data-wall' },
      },
    },
    {
      id: 'details',
      eyebrow: 'Teardown logic',
      title: 'Every fast move is backed by serviceable hardware decisions.',
      summary:
        'The chassis opens around three replaceable modules: calibration display, compute core, and the side I/O cassette that crews abuse first.',
      accent: '#FF9F6E',
      backdrop: 'linear-gradient(180deg, #120F12 0%, #241A1C 100%)',
      media: {
        src: '/assets/orbit-s1-exploded.svg',
        alt: 'Orbit S1 exploded view',
        caption: 'Replaceable compute core, thermal bridge, and I/O cassette.',
        width: 640,
        height: 480,
      },
      primaryStats: [
        { label: 'Service time', value: '4 min', detail: 'Tool-light module swap' },
        { label: 'Thermal headroom', value: '+18%', detail: 'Across sustained waveform use' },
        {
          label: 'Encoder wheel',
          value: '72 detents',
          detail: 'Positive feedback without chatter',
        },
      ],
      secondaryPoints: [
        'Front glass floats above the chassis to reduce palm grease transfer',
        'Rear spine concentrates heat and ports away from handheld grip zones',
        'Module seams are service seams, not decorative segmentation',
      ],
      composition: {
        scroll: { style: 'exploded-story', sceneHeight: 1360 },
        drag: { style: 'service-ribbon' },
      },
    },
    {
      id: 'scenarios',
      eyebrow: 'Field kits',
      title: 'One core device, three working contexts.',
      summary:
        'Orbit S1 ships as a console core, cart kit, or inspection bundle so teams can keep the same UI language while changing rigs.',
      accent: '#7B8CFF',
      backdrop: 'linear-gradient(180deg, #090C11 0%, #18202D 100%)',
      media: {
        src: '/assets/orbit-s1-kit.svg',
        alt: 'Orbit S1 kit system',
        caption: 'Console core, shoulder rig adapter, and cart dock.',
        width: 640,
        height: 480,
      },
      primaryStats: [
        { label: 'Cart dock I/O', value: '8 ports', detail: 'Live ingest, power, and review' },
        { label: 'Shoulder rig mass', value: '1.9 kg', detail: 'Balanced for handheld use' },
        { label: 'Inspection kit boot', value: '11 s', detail: 'Fast startup for repeat checks' },
      ],
      secondaryPoints: [
        'Same interface hierarchy across mobile, cart, and bench deployments',
        'Accessory rail exposes power, metadata, and quick-lock mounting',
        'Preloaded image chapters let reviewers compare modes without waiting',
      ],
      composition: {
        scroll: {
          style: 'scenario-takeover',
          sceneHeight: 'screen',
          takeover: {
            trigger: 'center-lock',
            zoneId: 'scenarios-takeover',
          },
        },
        drag: { style: 'kit-constellation' },
      },
    },
    {
      id: 'cta',
      eyebrow: 'Decision point',
      title: 'Built for buyers who compare behavior, not adjectives.',
      summary:
        'Use this example as a mode-by-mode review surface: the same hardware story, two distinct motion engines, one shared authored content system.',
      accent: '#F28B82',
      backdrop: 'linear-gradient(180deg, #090B0F 0%, #151B24 100%)',
      media: {
        src: '/assets/orbit-s1-kit.svg',
        alt: 'Orbit S1 final system composition',
        caption: 'Console, dock, and field kit anchored in one product family.',
        width: 640,
        height: 480,
      },
      primaryStats: [
        { label: 'Mode count', value: '2 engines', detail: 'drag, scroll' },
        { label: 'Shared story', value: '6 chapters', detail: 'One authored product narrative' },
        { label: 'Review posture', value: 'Lab-ready', detail: 'Metrics hidden until needed' },
      ],
      secondaryPoints: [
        'The hub route compares both navigation models from one entry point',
        'Performance instrumentation stays available without dominating the page',
        'All content lives in hand-authored section data rather than scene generation',
      ],
      composition: {
        scroll: { style: 'decision-appendix', sceneHeight: 920 },
        drag: { style: 'closing-brief' },
      },
    },
  ] satisfies ExperienceSection[],
};
