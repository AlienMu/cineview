import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { MediaFrame } from './SharedBlocks';

describe('MediaFrame preload policy', () => {
  const section = PERFORMANCE_EXPERIENCE.sections.find((candidate) => candidate.media);

  it('keeps the first scene eager and later scenes lazy', () => {
    if (!section) {
      throw new Error('The performance fixture requires a media section');
    }

    const priorityMarkup = renderToStaticMarkup(
      <MediaFrame priority section={section} width={540} />
    );
    const backgroundMarkup = renderToStaticMarkup(<MediaFrame section={section} width={540} />);

    expect(priorityMarkup).toContain('loading="eager"');
    expect(backgroundMarkup).toContain('loading="lazy"');
  });
});
