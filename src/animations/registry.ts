export interface AnimateRegistrationInfo {
  delay: number;
  duration: number;
  waitFor?: string;
}

export type AnimationRegistryIssue =
  | {
      type: 'missing-dependency';
      animateId: string;
      waitFor: string;
    }
  | {
      type: 'circular-dependency';
      animateId: string;
      cycle: string[];
    }
  | {
      type: 'duplicate-id';
      animateId: string;
    };

export interface AnimationRegistrySnapshot {
  registrations: Map<string, AnimateRegistrationInfo>;
  calculatedDelays: Map<string, number>;
  issues: AnimationRegistryIssue[];
  timelineDuration: number;
}

export interface BuildAnimationRegistrySnapshotOptions {
  baseDuration: number;
  registrations: Map<string, AnimateRegistrationInfo>;
  duplicateIds?: Iterable<string>;
}

function issueKey(issue: AnimationRegistryIssue): string {
  switch (issue.type) {
    case 'missing-dependency':
      return `${issue.type}:${issue.animateId}:${issue.waitFor}`;
    case 'circular-dependency':
      return `${issue.type}:${issue.animateId}:${issue.cycle.join('>')}`;
    case 'duplicate-id':
      return `${issue.type}:${issue.animateId}`;
  }
}

function pushIssueOnce(issues: AnimationRegistryIssue[], issue: AnimationRegistryIssue): void {
  const nextKey = issueKey(issue);
  if (issues.some((current) => issueKey(current) === nextKey)) {
    return;
  }
  issues.push(issue);
}

export function buildAnimationRegistrySnapshot({
  baseDuration,
  registrations,
  duplicateIds = [],
}: BuildAnimationRegistrySnapshotOptions): AnimationRegistrySnapshot {
  const calculatedDelays = new Map<string, number>();
  const issues: AnimationRegistryIssue[] = [];
  const visiting = new Set<string>();

  Array.from(duplicateIds).forEach((animateId) => {
    pushIssueOnce(issues, { type: 'duplicate-id', animateId });
  });

  const resolveDelay = (animateId: string, chain: string[]): number => {
    const cached = calculatedDelays.get(animateId);
    if (cached !== undefined) {
      return cached;
    }

    const info = registrations.get(animateId)!;

    if (visiting.has(animateId)) {
      const cycleStart = chain.indexOf(animateId);
      const cycle = chain.slice(cycleStart).concat(animateId);
      pushIssueOnce(issues, { type: 'circular-dependency', animateId, cycle });
      calculatedDelays.set(animateId, info.delay);
      return info.delay;
    }

    visiting.add(animateId);

    let totalDelay = info.delay;
    if (info.waitFor) {
      const waitForInfo = registrations.get(info.waitFor);
      if (!waitForInfo) {
        pushIssueOnce(issues, {
          type: 'missing-dependency',
          animateId,
          waitFor: info.waitFor,
        });
      } else {
        const waitForDelay = resolveDelay(info.waitFor, chain.concat(animateId));
        totalDelay += waitForDelay + waitForInfo.duration;
      }
    }

    visiting.delete(animateId);
    calculatedDelays.set(animateId, totalDelay);
    return totalDelay;
  };

  registrations.forEach((_info, animateId) => {
    resolveDelay(animateId, []);
  });

  let timelineDuration = Math.max(baseDuration, 0);
  registrations.forEach((info, animateId) => {
    const calculatedDelay = calculatedDelays.get(animateId)!;
    timelineDuration = Math.max(timelineDuration, calculatedDelay + info.duration);
  });

  return {
    registrations: new Map(registrations),
    calculatedDelays,
    issues,
    timelineDuration,
  };
}
