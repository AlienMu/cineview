import type { ParsedAnimationVariant } from '../../types';
import {
  createImmutableMap,
  type FrozenAnimationRegistrySnapshot,
} from '../../animations/registry';
import {
  mapDragPercentToElapsed,
  type ResolvedDragTimelineConfig,
} from '../../utils/dragTimelineMapping';

export interface PreparedSceneSnapshot {
  readonly sceneIndex: number;
  readonly instanceId: symbol;
  readonly revision: number;
  readonly enabled: boolean;
  readonly mapping: Readonly<ResolvedDragTimelineConfig>;
  readonly registrySnapshot: FrozenAnimationRegistrySnapshot;
  readonly enterVariantsByAnimateId: ReadonlyMap<string, ParsedAnimationVariant>;
}

export type DragSceneTransactionPhase = 'driving' | 'settling' | 'bouncing' | 'programmatic';

export interface DragSceneTransaction {
  readonly transactionId: symbol;
  readonly targetSceneIndex: number;
  readonly targetInstanceId: symbol;
  readonly targetRevision: number;
  readonly phase: DragSceneTransactionPhase;
  readonly mapping: Readonly<ResolvedDragTimelineConfig>;
  readonly registrySnapshot: FrozenAnimationRegistrySnapshot;
  readonly enterVariantsByAnimateId: ReadonlyMap<string, ParsedAnimationVariant>;
  readonly releaseSeed: Readonly<{
    progressRatio: number;
    elapsedMs: number;
  }>;
}

export interface PreparedSceneInvalidation {
  readonly sceneIndex: number;
  readonly instanceId: symbol;
  readonly revision: number;
}

function clampProgressRatio(progressRatio: number): number {
  return Math.max(0, Math.min(Number.isFinite(progressRatio) ? progressRatio : 0, 1));
}

function createTransactionView(
  snapshot: PreparedSceneSnapshot,
  transactionId: symbol,
  phase: DragSceneTransactionPhase,
  progressRatio: number
): DragSceneTransaction {
  const normalizedProgress = clampProgressRatio(progressRatio);
  const timelineDuration = snapshot.registrySnapshot.timelineDuration;

  return Object.freeze({
    transactionId,
    targetSceneIndex: snapshot.sceneIndex,
    targetInstanceId: snapshot.instanceId,
    targetRevision: snapshot.revision,
    phase,
    mapping: snapshot.mapping,
    registrySnapshot: snapshot.registrySnapshot,
    enterVariantsByAnimateId: snapshot.enterVariantsByAnimateId,
    releaseSeed: Object.freeze({
      progressRatio: normalizedProgress,
      elapsedMs: mapDragPercentToElapsed(
        snapshot.mapping,
        timelineDuration,
        normalizedProgress * 100
      ),
    }),
  });
}

function updateTransactionView(
  transaction: DragSceneTransaction,
  phase: DragSceneTransactionPhase,
  progressRatio: number
): DragSceneTransaction {
  const normalizedProgress = clampProgressRatio(progressRatio);
  return Object.freeze({
    ...transaction,
    phase,
    releaseSeed: Object.freeze({
      progressRatio: normalizedProgress,
      elapsedMs: mapDragPercentToElapsed(
        transaction.mapping,
        transaction.registrySnapshot.timelineDuration,
        normalizedProgress * 100
      ),
    }),
  });
}

export function createPreparedSceneSnapshot(
  snapshot: PreparedSceneSnapshot
): PreparedSceneSnapshot {
  return Object.freeze({
    ...snapshot,
    mapping: Object.freeze({ ...snapshot.mapping }),
    enterVariantsByAnimateId: createImmutableMap(snapshot.enterVariantsByAnimateId),
  });
}

export function createDragSceneTransaction(
  snapshot: PreparedSceneSnapshot,
  phase: DragSceneTransactionPhase,
  progressRatio: number
): DragSceneTransaction {
  return createTransactionView(
    snapshot,
    Symbol(`drag-transaction:${snapshot.sceneIndex}:${snapshot.revision}`),
    phase,
    progressRatio
  );
}

/** CineView-owned prepared-scene and cross-commit transaction store. */
export class DragPreparedSceneStore {
  declare private readonly preparedScenes: Map<number, PreparedSceneSnapshot>;
  declare private readonly activeTransactions: Map<symbol, DragSceneTransaction>;
  declare private readonly transactionIdsByTarget: Map<number, symbol>;

  constructor() {
    this.preparedScenes = new Map();
    this.activeTransactions = new Map();
    this.transactionIdsByTarget = new Map();
  }

  publishPrepared(snapshot: PreparedSceneSnapshot): void {
    const current = this.preparedScenes.get(snapshot.sceneIndex);
    if (
      current &&
      current.instanceId === snapshot.instanceId &&
      current.revision > snapshot.revision
    ) {
      return;
    }
    this.preparedScenes.set(snapshot.sceneIndex, createPreparedSceneSnapshot(snapshot));
  }

  invalidatePrepared(invalidation: PreparedSceneInvalidation): void {
    const current = this.preparedScenes.get(invalidation.sceneIndex);
    if (
      current?.instanceId === invalidation.instanceId &&
      current.revision === invalidation.revision
    ) {
      this.preparedScenes.delete(invalidation.sceneIndex);
    }
  }

  getPrepared(sceneIndex: number): PreparedSceneSnapshot | null {
    return this.preparedScenes.get(sceneIndex) ?? null;
  }

  beginTransaction(
    targetSceneIndex: number,
    phase: DragSceneTransactionPhase,
    progressRatio: number
  ): DragSceneTransaction | null {
    const currentId = this.transactionIdsByTarget.get(targetSceneIndex);
    const current = currentId ? this.activeTransactions.get(currentId) : undefined;
    if (current) {
      const next = updateTransactionView(current, phase, progressRatio);
      this.activeTransactions.set(current.transactionId, next);
      return next;
    }

    const snapshot = this.preparedScenes.get(targetSceneIndex);
    if (!snapshot) return null;

    const next = createDragSceneTransaction(snapshot, phase, progressRatio);
    this.activeTransactions.set(next.transactionId, next);
    this.transactionIdsByTarget.set(targetSceneIndex, next.transactionId);
    return next;
  }

  getTransaction(transactionId: symbol): DragSceneTransaction | null {
    return this.activeTransactions.get(transactionId) ?? null;
  }

  getTransactionForTarget(targetSceneIndex: number): DragSceneTransaction | null {
    const transactionId = this.transactionIdsByTarget.get(targetSceneIndex);
    return transactionId ? (this.activeTransactions.get(transactionId) ?? null) : null;
  }

  releaseTransaction(transactionId: symbol): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;
    this.activeTransactions.delete(transactionId);
    if (this.transactionIdsByTarget.get(transaction.targetSceneIndex) === transactionId) {
      this.transactionIdsByTarget.delete(transaction.targetSceneIndex);
    }
  }

  clear(): void {
    this.preparedScenes.clear();
    this.activeTransactions.clear();
    this.transactionIdsByTarget.clear();
  }
}
