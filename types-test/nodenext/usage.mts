// Resolved through the package's own "exports" under Node's ES module rules (moduleResolution:
// nodenext), as an installed dependency would be. build.mjs links node_modules/cineview here.
import type { CvStageElement } from 'cineview';
import { defineEffect } from 'cineview';

// @ts-expect-error a number is not a stage: the types must not degrade to any.
const wrong: CvStageElement = 42;

const stage = document.querySelector('cv-stage');
stage?.addEventListener('cv-enter', (e) => {
  const to: number = e.detail.to;
  return to;
});
defineEffect('lift', { from: 'opacity:0; y:24', to: 'opacity:1; y:0' });

export { wrong };
