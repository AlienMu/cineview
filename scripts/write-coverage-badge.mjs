// Writes the README's coverage badge data (shields.io endpoint JSON) from a Jest json-summary:
// line coverage of the runtime source, served by the site at /coverage.json.
//
//   pnpm test:coverage    runs the unit tests with coverage, then this script
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function writeCoverageBadge(summaryPath, outputPath) {
  const coverage = JSON.parse(readFileSync(summaryPath, 'utf8')).total.lines.pct;
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 100) {
    throw new Error('Line coverage is missing or invalid.');
  }
  const message = `${Math.round(coverage)}%`;
  const color = coverage >= 90 ? '2c7a4b' : coverage >= 70 ? 'a66a20' : 'b0413e';
  writeFileSync(outputPath, JSON.stringify({ schemaVersion: 1, label: 'line coverage', message, color }, null, 2) + '\n');
  return message;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  console.log(`coverage badge: ${writeCoverageBadge(`${root}coverage/coverage-summary.json`, `${root}site/public/coverage.json`)}`);
}
