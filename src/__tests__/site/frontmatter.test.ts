import { parseDocSource } from '../../../site/src/content/docs/frontmatter';

it('removes header quoting without losing the title’s inner quotes or body', () => {
  expect(
    parseDocSource(
      "---\ntitle: \"Horizontal direction: 'x'\"\neyebrow: 'ADVANCED / DIRECTION'\n---\n\nBody."
    )
  ).toEqual({
    title: "Horizontal direction: 'x'",
    eyebrow: 'ADVANCED / DIRECTION',
    markdown: '\nBody.',
  });
});

it.each([
  ['"A \\"quoted\\" title"', 'A "quoted" title'],
  ["'It''s ready'", "It's ready"],
])('decodes quoted scalar %s', (value, expected) => {
  expect(parseDocSource('---\r\ntitle: ' + value + '\r\neyebrow: GUIDE\r\n---\r\nText').title).toBe(
    expected
  );
});

it('retains plain metadata and unheaded Markdown', () => {
  expect(parseDocSource('---\ntitle: Introduction\neyebrow: START\n---\nText')).toEqual({
    title: 'Introduction',
    eyebrow: 'START',
    markdown: 'Text',
  });
  expect(parseDocSource('Unheaded text')).toEqual({
    title: '',
    eyebrow: '',
    markdown: 'Unheaded text',
  });
});
