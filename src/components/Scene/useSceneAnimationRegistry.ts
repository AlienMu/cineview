import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildAnimationRegistrySnapshot,
  type AnimateRegistrationInfo,
  type AnimationRegistryIssue,
  type AnimationRegistrySnapshot,
} from '../../animations/registry';
import type { CineViewRuntimeContextValue } from '../CineView/runtimeContext';

interface UseSceneAnimationRegistryParams {
  sceneIndex: number;
  baseDuration: number;
  reportError?: CineViewRuntimeContextValue['reportError'];
}

export interface SceneAnimationRegistryPort {
  timelineDuration: number;
  registerAnimate: (id: string, info: AnimateRegistrationInfo) => void;
  unregisterAnimate: (id: string) => void;
  getCalculatedDelay: (animateId: string) => number;
  markAnimateEntered: (id: string, entered: boolean) => void;
  subscribeAnimateEntered: (leaderId: string, cb: () => void) => () => void;
  getTimelineDuration: () => number;
}

function getIssueKey(issue: AnimationRegistryIssue): string {
  switch (issue.type) {
    case 'missing-dependency':
      return `${issue.type}:${issue.animateId}:${issue.waitFor}`;
    case 'circular-dependency':
      return `${issue.type}:${issue.animateId}:${issue.cycle.join('>')}`;
    case 'duplicate-id':
      return `${issue.type}:${issue.animateId}`;
  }
}

export function useSceneAnimationRegistry({
  sceneIndex,
  baseDuration,
  reportError,
}: UseSceneAnimationRegistryParams): SceneAnimationRegistryPort {
  const registrationsRef = useRef<Map<string, AnimateRegistrationInfo>>(new Map());
  const duplicateIdsRef = useRef<Set<string>>(new Set());
  const snapshotRef = useRef<AnimationRegistrySnapshot>(
    buildAnimationRegistrySnapshot({
      baseDuration,
      registrations: registrationsRef.current,
    })
  );
  const reportedIssuesRef = useRef<Set<string>>(new Set());
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enteredIdsRef = useRef<Set<string>>(new Set());
  const enteredSubscriptionsRef = useRef<Map<string, Set<() => void>>>(new Map());
  const reportErrorRef = useRef(reportError);
  reportErrorRef.current = reportError;
  const timelineDurationRef = useRef(baseDuration);
  const [timelineDuration, setTimelineDuration] = useState(baseDuration);

  const reportIssues = useCallback(
    (issues: AnimationRegistryIssue[]): void => {
      const isDev = process.env.NODE_ENV === 'development';

      issues.forEach((issue) => {
        const key = getIssueKey(issue);
        if (reportedIssuesRef.current.has(key)) return;
        reportedIssuesRef.current.add(key);

        let code: string;
        let message: string;
        let devWarning: string;

        if (issue.type === 'missing-dependency') {
          code = 'INVALID_ANIMATION';
          message = `Animate "${issue.animateId}" references non-existent component "${issue.waitFor}" via waitFor in Scene ${sceneIndex}.`;
          devWarning =
            `[CineView Warning] Animation dependency error in Scene ${sceneIndex}.\n\n` +
            `Problem: Animate component "${issue.animateId}" references non-existent component "${issue.waitFor}" via waitFor.\n` +
            `Fix: Ensure the waitFor component ID matches an existing Animate component's animateId prop.\n`;
        } else if (issue.type === 'circular-dependency') {
          code = 'CIRCULAR_DEPENDENCY';
          message = `Animate waitFor chain contains a cycle in Scene ${sceneIndex}: ${issue.cycle.join(' -> ')}.`;
          devWarning =
            `[CineView Warning] Animation dependency cycle in Scene ${sceneIndex}.\n\n` +
            `Problem: Animate waitFor chain contains a cycle: ${issue.cycle.join(' -> ')}.\n` +
            `Fix: Remove the circular waitFor reference so each Animate starts after an earlier independent animation.\n`;
        } else {
          code = 'INVALID_COMPONENT_HIERARCHY';
          message = `More than one Animate component registered animateId "${issue.animateId}" in Scene ${sceneIndex}.`;
          devWarning =
            `[CineView Warning] Duplicate Animate id in Scene ${sceneIndex}.\n\n` +
            `Problem: More than one Animate component registered animateId "${issue.animateId}".\n` +
            `Fix: Give each Animate component in a Scene a unique animateId.\n`;
        }

        reportErrorRef.current?.({ code, message, context: { sceneIndex } });
        if (isDev) console.warn(devWarning);
      });
    },
    [sceneIndex]
  );

  const scheduleValidation = useCallback((): void => {
    if (validationTimerRef.current !== null) {
      clearTimeout(validationTimerRef.current);
    }

    validationTimerRef.current = setTimeout(() => {
      validationTimerRef.current = null;
      const snapshot = buildAnimationRegistrySnapshot({
        baseDuration,
        registrations: registrationsRef.current,
        duplicateIds: duplicateIdsRef.current,
      });
      snapshotRef.current = snapshot;
      reportIssues(snapshot.issues);
    }, 0);
  }, [baseDuration, reportIssues]);

  const rebuildSnapshot = useCallback((): AnimationRegistrySnapshot => {
    const snapshot = buildAnimationRegistrySnapshot({
      baseDuration,
      registrations: registrationsRef.current,
      duplicateIds: duplicateIdsRef.current,
    });
    snapshotRef.current = snapshot;
    timelineDurationRef.current = snapshot.timelineDuration;
    setTimelineDuration((previous) =>
      previous === snapshot.timelineDuration ? previous : snapshot.timelineDuration
    );
    scheduleValidation();
    return snapshot;
  }, [baseDuration, scheduleValidation]);

  const registerAnimate = useCallback(
    (id: string, info: AnimateRegistrationInfo): void => {
      if (registrationsRef.current.has(id)) duplicateIdsRef.current.add(id);
      registrationsRef.current.set(id, info);

      const snapshot = rebuildSnapshot();
      const calculatedDelay = snapshot.calculatedDelays.get(id) ?? info.delay;
      if (
        process.env.NODE_ENV === 'development' &&
        typeof window !== 'undefined' &&
        (window as Window & { __CINEVIEW_DRAG_DEBUG__?: boolean }).__CINEVIEW_DRAG_DEBUG__
      ) {
        console.log(
          `[Scene ${sceneIndex}] Registered ${id}: delay=${info.delay}ms, calculated=${calculatedDelay}ms, duration=${info.duration}ms`
        );
        console.log(`[Scene ${sceneIndex}] Timeline duration: ${timelineDurationRef.current}ms`);
      }

      if (registrationsRef.current.size > 100 && process.env.NODE_ENV === 'development') {
        console.warn(
          `[CineView Warning] Scene ${sceneIndex} has ${registrationsRef.current.size} Animate components.\n\n` +
            `Recommendation: Consider reducing the number of animated elements or splitting into multiple scenes.`
        );
      }
    },
    [rebuildSnapshot, sceneIndex]
  );

  const unregisterAnimate = useCallback(
    (id: string): void => {
      registrationsRef.current.delete(id);
      duplicateIdsRef.current.delete(id);
      rebuildSnapshot();
    },
    [rebuildSnapshot]
  );

  const getCalculatedDelay = useCallback((animateId: string): number => {
    return (
      snapshotRef.current.calculatedDelays.get(animateId) ??
      registrationsRef.current.get(animateId)?.delay ??
      0
    );
  }, []);

  const markAnimateEntered = useCallback((id: string, entered: boolean): void => {
    if (!entered) {
      enteredIdsRef.current.delete(id);
      return;
    }

    enteredIdsRef.current.add(id);
    const subscriptions = enteredSubscriptionsRef.current.get(id);
    if (!subscriptions) return;
    enteredSubscriptionsRef.current.delete(id);
    subscriptions.forEach((callback) => callback());
  }, []);

  const subscribeAnimateEntered = useCallback(
    (leaderId: string, callback: () => void): (() => void) => {
      if (enteredIdsRef.current.has(leaderId)) {
        callback();
        return () => undefined;
      }

      let subscriptions = enteredSubscriptionsRef.current.get(leaderId);
      if (!subscriptions) {
        subscriptions = new Set();
        enteredSubscriptionsRef.current.set(leaderId, subscriptions);
      }
      subscriptions.add(callback);
      return () => subscriptions?.delete(callback);
    },
    []
  );

  const getTimelineDuration = useCallback((): number => timelineDurationRef.current, []);

  useEffect(() => {
    const registrations = registrationsRef.current;
    const duplicateIds = duplicateIdsRef.current;
    const reportedIssues = reportedIssuesRef.current;
    const enteredIds = enteredIdsRef.current;
    const enteredSubscriptions = enteredSubscriptionsRef.current;

    return (): void => {
      if (validationTimerRef.current !== null) {
        clearTimeout(validationTimerRef.current);
        validationTimerRef.current = null;
      }
      registrations.clear();
      duplicateIds.clear();
      reportedIssues.clear();
      enteredIds.clear();
      enteredSubscriptions.clear();
    };
  }, []);

  return {
    timelineDuration,
    registerAnimate,
    unregisterAnimate,
    getCalculatedDelay,
    markAnimateEntered,
    subscribeAnimateEntered,
    getTimelineDuration,
  };
}
