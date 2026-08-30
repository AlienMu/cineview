export type AnimateTimelineLane = 'drag' | 'scroll' | 'visibility';

export function isLaneCompatible(
  followerLane: AnimateTimelineLane,
  leaderLane: AnimateTimelineLane
): boolean {
  return followerLane === leaderLane || (followerLane === 'visibility' && leaderLane === 'scroll');
}

export interface AnimateRegistrationInfo {
  delay: number;
  duration: number;
  after?: string;
  /** Concrete runtime driver. Optional only for legacy/internal callers while the
   * registration API migrates to owner-safe leases. */
  lane?: AnimateTimelineLane;
}

export type AnimationRegistryIssue =
  | {
      type: 'missing-dependency';
      animateId: string;
      after: string;
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
      type: 'incompatible-lane';
      animateId: string;
      after: string;
      followerLane: AnimateTimelineLane;
      leaderLane: AnimateTimelineLane;
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
  declaredLanes?: ReadonlyMap<string, AnimateTimelineLane>;
  duplicateIds?: Iterable<string>;
}

function issueKey(issue: AnimationRegistryIssue): string {
  switch (issue.type) {
    case 'missing-dependency':
      return `${issue.type}:${issue.animateId}:${issue.after}`;
    case 'circular-dependency':
      return `${issue.type}:${issue.animateId}:${issue.cycle.join('>')}`;
    case 'duplicate-id':
      return `${issue.type}:${issue.animateId}`;
    case 'incompatible-lane':
      return `${issue.type}:${issue.animateId}:${issue.after}:${issue.followerLane}:${issue.leaderLane}`;
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
  declaredLanes = new Map(),
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
    if (info.after) {
      const leaderInfo = registrations.get(info.after);
      const declaredLeaderDriver = declaredLanes.get(info.after);
      if (!leaderInfo) {
        if (
          info.lane !== undefined &&
          declaredLeaderDriver !== undefined &&
          !isLaneCompatible(info.lane, declaredLeaderDriver)
        ) {
          pushIssueOnce(issues, {
            type: 'incompatible-lane',
            animateId,
            after: info.after,
            followerLane: info.lane,
            leaderLane: declaredLeaderDriver,
          });
        } else {
          pushIssueOnce(issues, {
            type: 'missing-dependency',
            animateId,
            after: info.after,
          });
        }
      } else if (
        info.lane !== undefined &&
        leaderInfo.lane !== undefined &&
        !isLaneCompatible(info.lane, leaderInfo.lane)
      ) {
        pushIssueOnce(issues, {
          type: 'incompatible-lane',
          animateId,
          after: info.after,
          followerLane: info.lane,
          leaderLane: leaderInfo.lane,
        });
      } else {
        const waitForDelay = resolveDelay(info.after, chain.concat(animateId));
        const runtimeCompletionOnly = info.lane === 'visibility' && leaderInfo.lane === 'scroll';
        if (!runtimeCompletionOnly && !circularFollowers.has(animateId)) {
          totalDelay += waitForDelay + leaderInfo.duration;
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
