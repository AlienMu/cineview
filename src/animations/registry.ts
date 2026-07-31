export type AnimateTimelineDriver = 'drag' | 'scroll' | 'visibility';

export function isWaitForDriverCompatible(
  followerDriver: AnimateTimelineDriver,
  leaderDriver: AnimateTimelineDriver
): boolean {
  return (
    followerDriver === leaderDriver ||
    (followerDriver === 'visibility' && leaderDriver === 'scroll')
  );
}

export interface AnimateRegistrationInfo {
  delay: number;
  duration: number;
  waitFor?: string;
  /** Concrete runtime driver. Optional only for legacy/internal callers while the
   * registration API migrates to owner-safe leases. */
  driver?: AnimateTimelineDriver;
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
    }
  | {
      type: 'incompatible-driver';
      animateId: string;
      waitFor: string;
      followerDriver: AnimateTimelineDriver;
      leaderDriver: AnimateTimelineDriver;
    };

export interface AnimationRegistrySnapshot {
  registrations: Map<string, AnimateRegistrationInfo>;
  calculatedDelays: Map<string, number>;
  issues: AnimationRegistryIssue[];
  timelineDuration: number;
}

/** Immutable registry compilation captured by prepared scenes and transactions. */
export interface FrozenAnimationRegistrySnapshot {
  readonly registrations: ReadonlyMap<string, Readonly<AnimateRegistrationInfo>>;
  readonly calculatedDelays: ReadonlyMap<string, number>;
  readonly issues: readonly AnimationRegistryIssue[];
  readonly timelineDuration: number;
}

class ImmutableMapView<K, V> implements ReadonlyMap<K, V> {
  declare private readonly source: Map<K, V>;

  constructor(entries: Iterable<readonly [K, V]>) {
    this.source = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.source.size;
  }

  get(key: K): V | undefined {
    return this.source.get(key);
  }

  has(key: K): boolean {
    return this.source.has(key);
  }

  forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
    this.source.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
  }

  entries(): MapIterator<[K, V]> {
    return this.source.entries();
  }

  keys(): MapIterator<K> {
    return this.source.keys();
  }

  values(): MapIterator<V> {
    return this.source.values();
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }

  get [Symbol.toStringTag](): string {
    return 'ImmutableMapView';
  }
}

export function createImmutableMap<K, V>(entries: Iterable<readonly [K, V]>): ReadonlyMap<K, V> {
  return new ImmutableMapView(entries);
}

export function freezeAnimationRegistrySnapshot(
  snapshot: AnimationRegistrySnapshot
): FrozenAnimationRegistrySnapshot {
  const registrations: Array<readonly [string, Readonly<AnimateRegistrationInfo>]> = [];
  snapshot.registrations.forEach((info, animateId) => {
    registrations.push([animateId, Object.freeze({ ...info })]);
  });

  return Object.freeze({
    registrations: createImmutableMap(registrations),
    calculatedDelays: createImmutableMap(snapshot.calculatedDelays),
    issues: Object.freeze([...snapshot.issues]),
    timelineDuration: snapshot.timelineDuration,
  });
}

export interface BuildAnimationRegistrySnapshotOptions {
  baseDuration: number;
  registrations: Map<string, AnimateRegistrationInfo>;
  /** Driver-only declarations never enter registrations or extend timelineDuration. */
  declaredDrivers?: ReadonlyMap<string, AnimateTimelineDriver>;
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
    case 'incompatible-driver':
      return `${issue.type}:${issue.animateId}:${issue.waitFor}:${issue.followerDriver}:${issue.leaderDriver}`;
  }
}

function pushIssueOnce(issues: AnimationRegistryIssue[], issue: AnimationRegistryIssue): void {
  const nextKey = issueKey(issue);
  if (issues.some((current) => issueKey(current) === nextKey)) {
    return;
  }
  issues.push(issue);
}

function canonicalizeCycle(cycle: string[]): string[] {
  const members = cycle.slice(0, -1);
  let firstIndex = 0;
  for (let index = 1; index < members.length; index += 1) {
    if (members[index] < members[firstIndex]) firstIndex = index;
  }
  const canonical = members.slice(firstIndex).concat(members.slice(0, firstIndex));
  return canonical.concat(canonical[0]);
}

export function buildAnimationRegistrySnapshot({
  baseDuration,
  registrations,
  declaredDrivers = new Map(),
  duplicateIds = [],
}: BuildAnimationRegistrySnapshotOptions): AnimationRegistrySnapshot {
  const calculatedDelays = new Map<string, number>();
  const issues: AnimationRegistryIssue[] = [];
  const visiting = new Set<string>();
  const circularFollowers = new Set<string>();

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
      const cycle = canonicalizeCycle(chain.slice(cycleStart).concat(animateId));
      cycle.slice(0, -1).forEach((cycleId) => circularFollowers.add(cycleId));
      pushIssueOnce(issues, { type: 'circular-dependency', animateId: cycle[0], cycle });
      calculatedDelays.set(animateId, info.delay);
      return info.delay;
    }

    visiting.add(animateId);

    let totalDelay = info.delay;
    if (info.waitFor) {
      const waitForInfo = registrations.get(info.waitFor);
      const declaredLeaderDriver = declaredDrivers.get(info.waitFor);
      if (!waitForInfo) {
        if (
          info.driver !== undefined &&
          declaredLeaderDriver !== undefined &&
          !isWaitForDriverCompatible(info.driver, declaredLeaderDriver)
        ) {
          pushIssueOnce(issues, {
            type: 'incompatible-driver',
            animateId,
            waitFor: info.waitFor,
            followerDriver: info.driver,
            leaderDriver: declaredLeaderDriver,
          });
        } else {
          pushIssueOnce(issues, {
            type: 'missing-dependency',
            animateId,
            waitFor: info.waitFor,
          });
        }
      } else if (
        info.driver !== undefined &&
        waitForInfo.driver !== undefined &&
        !isWaitForDriverCompatible(info.driver, waitForInfo.driver)
      ) {
        pushIssueOnce(issues, {
          type: 'incompatible-driver',
          animateId,
          waitFor: info.waitFor,
          followerDriver: info.driver,
          leaderDriver: waitForInfo.driver,
        });
      } else {
        const waitForDelay = resolveDelay(info.waitFor, chain.concat(animateId));
        const runtimeCompletionOnly =
          info.driver === 'visibility' && waitForInfo.driver === 'scroll';
        if (!runtimeCompletionOnly && !circularFollowers.has(animateId)) {
          totalDelay += waitForDelay + waitForInfo.duration;
        }
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
