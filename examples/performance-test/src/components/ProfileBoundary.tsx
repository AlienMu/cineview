import { Profiler, type ReactNode } from 'react';

interface ProfileBoundaryProps {
  children: ReactNode;
  id: string;
}

export function ProfileBoundary({
  children,
  id,
}: ProfileBoundaryProps): import('react').JSX.Element {
  if (!window.__CINEVIEW_PROFILE__) {
    return <>{children}</>;
  }

  return (
    <Profiler
      id={id}
      onRender={(profileId) => {
        const probe = window.__CINEVIEW_PROBE__;
        if (!probe) {
          return;
        }

        probe.reactCommitsByBoundary ??= {};
        probe.reactCommitsByBoundary[profileId] =
          (probe.reactCommitsByBoundary[profileId] ?? 0) + 1;
      }}
    >
      {children}
    </Profiler>
  );
}
