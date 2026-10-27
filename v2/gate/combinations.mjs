/**
 * The 41 references are design concepts, not 41 presets. This catalog records the canonical
 * authoring route before execution. "runnable" is a test obligation, never a passing result.
 * Entry 21 deliberately requests an endless Stage, not a locally authored looping gallery.
 */
const item = (id, name, owner, route, source, properties = [], material = 'any') => ({
  id,
  name,
  owner,
  route,
  source,
  properties,
  material,
});

export const capabilities = [
  item(
    1,
    'Scroll Progress Timeline',
    'framework',
    'on=page; finite page position under drag',
    'v2/src/input/drag.ts',
    ['progress']
  ),
  item(
    2,
    'View Progress Timeline',
    'framework',
    'on=view(self); vertical passage under drag',
    'v2/src/core/view.ts',
    ['progress']
  ),
  item(
    3,
    'Pinning & Scrub',
    'declarative',
    'zone and fixed composition; drag is a continuation adaptation',
    'v2/src/elements/scene.ts',
    ['layout']
  ),
  item(4, 'Parallax', 'framework', 'drift(soft)', 'v2/src/core/fx.ts', ['translate']),
  item(
    5,
    'Horizontal Scroll Section',
    'framework',
    'track=x; scene time under drag',
    'v2/src/elements/scene.ts',
    ['layout', 'translate']
  ),
  item(
    6,
    'Sticky Stacking Cards',
    'framework',
    'cv-stack; arrival on scene time under drag',
    'v2/src/elements/stack.ts',
    ['layout', 'translate']
  ),
  item(
    7,
    'Scroll Velocity Skew',
    'framework',
    'skew; velocity rather than acceleration',
    'v2/src/input/signals.ts',
    ['skew', 'scale']
  ),
  item(
    8,
    'Timeline Scope',
    'declarative',
    'view(#subject) in the same Scene',
    'v2/src/elements/animate.ts',
    ['progress']
  ),
  item(
    9,
    'Path Drawing',
    'framework',
    'draw on stroked SVG geometry',
    'v2/src/elements/animate.ts',
    ['stroke'],
    'svg'
  ),
  item(
    10,
    'Word Scrub',
    'declarative',
    'split=words and authored word/image relationships',
    'v2/src/text/split.ts',
    ['opacity', 'split'],
    'text'
  ),
  item(11, 'Curtain Overlap', 'framework', 'Scene stack and covered', 'v2/src/input/drag.ts', [
    'layout',
  ]),
  item(
    12,
    'Depth of Field',
    'framework',
    'focus(band); vertical subject progress',
    'v2/src/core/fx.ts',
    ['blur', 'opacity']
  ),
  item(
    13,
    'Scroll-Triggered Count',
    'framework',
    'count; real final text',
    'v2/src/text/count.ts',
    ['count'],
    'number'
  ),
  item(
    14,
    'Scroll Snap',
    'page',
    'nested native scroller; not Stage pagination',
    'v2/src/input/drag.ts',
    ['native-scroll']
  ),
  item(15, 'Snap Stop', 'page', 'nested CSS scroll-snap-stop', 'v2/src/input/drag.ts', [
    'native-scroll',
  ]),
  item(
    16,
    'Scroll Markers',
    'page',
    'native feature where available; explicit anchor fallback',
    'v2/src/elements/stage.ts',
    ['navigation']
  ),
  item(
    17,
    'Scroll Buttons',
    'page',
    'buttons with goTo; explicit endpoint state',
    'v2/src/types.ts',
    ['navigation']
  ),
  item(
    18,
    'Sticky State Query',
    'declarative',
    'managed Scene data-cv-stuck; not arbitrary sticky queries',
    'v2/src/input/drag.ts',
    ['state']
  ),
  item(
    19,
    'Snapped State Query',
    'declarative',
    'data-cv-current adaptation; native snapped differs',
    'v2/src/elements/stage.ts',
    ['state']
  ),
  item(
    20,
    'Direction State',
    'framework',
    'data-cv-direction and direction source',
    'v2/src/elements/stage.ts',
    ['state']
  ),
  item(
    21,
    'Infinite Loop Scroll',
    'gap',
    'Stage has finite scenes; no Stage wrapping',
    'v2/src/input/drag.ts',
    ['navigation']
  ),
  item(
    22,
    'Kinetic Drag',
    'page',
    'author-owned local horizontal drag; not Stage inertia',
    'v2/src/input/drag.ts',
    ['native-scroll']
  ),
  item(
    23,
    'Scrollspy',
    'framework',
    'scene anchors and aria-current; finer headings are page-owned',
    'v2/src/elements/stage.ts',
    ['navigation']
  ),
  item(
    24,
    'Overscroll Containment',
    'page',
    'nested scroller CSS plus input ownership checks',
    'v2/src/input/drag.ts',
    ['native-scroll']
  ),
  item(
    25,
    'Blur-up (LQIP)',
    'framework',
    'develop plus reserved image dimensions and stand-in',
    'v2/src/media/stills.ts',
    ['image-copy'],
    'image'
  ),
  item(
    26,
    'Ken Burns',
    'page',
    'authored focus/pan/dissolve/pause; push alone is partial',
    'v2/src/core/fx.ts',
    ['translate', 'scale', 'image-copy'],
    'image'
  ),
  item(
    27,
    'Duotone',
    'framework',
    'duotone on actual images',
    'v2/src/media/stills.ts',
    ['image-copy'],
    'image'
  ),
  item(
    28,
    'Progressive Blur',
    'page',
    'layered blur and masks; not focus(band)',
    'v2/src/media/stills.ts',
    ['blur', 'mask'],
    'image'
  ),
  item(
    29,
    'Ordered Dithering',
    'page',
    'prepared image or local pixel processing',
    'v2/src/core/fx.ts',
    ['pixels'],
    'image'
  ),
  item(
    30,
    'Clip-path Reveal',
    'framework',
    'wipe; authored shape limitations apply',
    'v2/src/core/fx.ts',
    ['clip']
  ),
  item(
    31,
    'Image Comparison Slider',
    'page',
    'native range plus aligned image clipping',
    'v2/src/input/drag.ts',
    ['clip', 'control'],
    'image'
  ),
  item(
    32,
    'Split Text Reveal',
    'framework',
    'split=lines and rise(line)',
    'v2/src/text/split.ts',
    ['split', 'translate'],
    'text'
  ),
  item(
    33,
    'Variable Font Animation',
    'framework',
    'axis with an available variable font',
    'v2/src/core/fx.ts',
    ['font'],
    'text'
  ),
  item(
    34,
    'Text Mask',
    'page',
    'CSS text/background composition',
    'v2/src/core/fx.ts',
    ['mask'],
    'text'
  ),
  item(
    35,
    'Vertical Writing Mode',
    'page',
    'CSS writing-mode; unroll supplies motion only',
    'v2/src/core/fx.ts',
    ['layout'],
    'text'
  ),
  item(
    36,
    'Marquee',
    'page',
    'measured copies, CSS/WAAPI, pause and disposal',
    'v2/src/render/clock.ts',
    ['translate'],
    'text'
  ),
  item(
    37,
    'Token Interpolation',
    'declarative',
    'hue variable and authored color roles',
    'v2/src/core/fx.ts',
    ['custom']
  ),
  item(
    38,
    'Scoped Rotation',
    'page',
    'animated variables scoped to their consumers',
    'v2/src/dev/craft.ts',
    ['custom']
  ),
  item(
    39,
    'Gamut Arc',
    'page',
    'authored interpolation route; not a general gamut solver',
    'v2/src/core/props.ts',
    ['custom']
  ),
  item(
    40,
    'Difference Inversion',
    'framework',
    'invert; verify middle-gray readability',
    'v2/src/elements/animate.ts',
    ['blend']
  ),
  item(
    41,
    'Threshold Flip',
    'declarative',
    'Scene theme plus complete page palette; not drag threshold',
    'v2/src/elements/stage.ts',
    ['theme']
  ),
];

export const contexts = [
  { id: 'drag', input: 'drag', zone: false, fallback: false },
  { id: 'zone-auto', input: 'scroll', zone: true, fallback: false },
  { id: 'zone-fallback', input: 'scroll', zone: true, fallback: true },
  { id: 'enter-auto', input: 'scroll', zone: false, fallback: false },
  { id: 'enter-fallback', input: 'scroll', zone: false, fallback: true },
];

const byId = new Map(capabilities.map((c) => [c.id, c]));
export function getCapability(id) {
  const entry = byId.get(id);
  if (!entry) throw new RangeError(`Unknown reference ${id}`);
  return entry;
}

function choose(list, count, start = 0, prefix = [], out = []) {
  if (!count) out.push(prefix);
  else
    for (let i = start; i <= list.length - count; i++)
      choose(list, count - 1, i + 1, [...prefix, list[i]], out);
  return out;
}

/** Canonical co-presence cases. Shared-element/nested authoring is a separate, explicit variant. */
export function classify(ids, context) {
  const entries = ids.map(getCapability);
  if (new Set(ids).size !== ids.length) throw new TypeError('Use distinct reference IDs');
  const missing = entries.filter((c) => c.owner === 'gap');
  if (missing.length)
    return { status: 'unsupported', reason: missing.map((c) => `${c.id}: ${c.route}`).join('; ') };
  if (!context.zone && context.input === 'scroll' && ids.some((id) => id === 3 || id === 5)) {
    return {
      status: 'not-applicable',
      reason:
        'Canonical held/track scenario requires a zone; ordinary-scroll version would be a different authored scenario',
    };
  }
  return {
    status: 'runnable',
    reason:
      'Canonical sibling components share this Stage and input; this does not assert arbitrary same-element composition',
    adaptation:
      context.input === 'drag' && ids.some((id) => [1, 3, 5, 6, 10, 18, 19, 22].includes(id)),
  };
}

export function enumerateCoverage({ maxOrder = 3, contextIds = contexts.map((c) => c.id) } = {}) {
  if (!Number.isInteger(maxOrder) || maxOrder < 1 || maxOrder > capabilities.length)
    throw new RangeError('Invalid order');
  const selected = contextIds.map((id) => {
    const context = contexts.find((c) => c.id === id);
    if (!context) throw new RangeError(`Unknown context ${id}`);
    return context;
  });
  const concepts = [];
  const configs = [];
  for (let n = 1; n <= maxOrder; n++) {
    for (const ids of choose(
      capabilities.map((c) => c.id),
      n
    )) {
      const id = ids.map((v) => String(v).padStart(2, '0')).join('-');
      concepts.push({ id, order: n, ids });
      for (const context of selected)
        configs.push({
          id: `${context.id}/${id}`,
          ids,
          order: n,
          context: context.id,
          placement: 'siblings',
          ...classify(ids, context),
        });
    }
  }
  return { capabilities, contexts: selected, concepts, configs };
}

export function summarizeCoverage(coverage) {
  const byOrder = {},
    byStatus = {},
    byContext = {};
  for (const c of coverage.concepts) byOrder[c.order] = (byOrder[c.order] ?? 0) + 1;
  for (const c of coverage.configs) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    const row = (byContext[c.context] ??= {});
    row[c.status] = (row[c.status] ?? 0) + 1;
  }
  return {
    conceptSets: coverage.concepts.length,
    configs: coverage.configs.length,
    byOrder,
    byStatus,
    byContext,
    note: 'Counts are declared obligations, not executed/passing tests. Native versus fallback is observed at runtime. Same-element/nested/order-sensitive and higher-order templates are additional obligations.',
  };
}
