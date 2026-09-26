import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function writeCoverageBadge(summaryPath, outputPath) {
  const coverage = JSON.parse(readFileSync(summaryPath, 'utf8')).total.lines.pct;
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 100) {
    throw new Error('Framework line coverage is missing or invalid.');
  }
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        label: 'framework line coverage',
        message: `${coverage}%`,
        color: coverage >= 90 ? '2c7a4b' : 'a66a20',
      },
      null,
      2
    ) + '\n'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeCoverageBadge('coverage/coverage-summary.json', 'site/public/coverage.json');
}
