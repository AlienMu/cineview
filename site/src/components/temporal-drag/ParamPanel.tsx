import { Animate } from 'cineview';
import { useI18n } from '../../i18n';
import { useTemporalMotion } from './TemporalMotion';

const PARAMETERS = [
  { name: 'TITLE', delay: '000ms', duration: '500ms', value: 20 },
  { name: 'SUBTITLE', delay: '240ms', duration: '500ms', value: 40 },
  { name: 'BODY', delay: '480ms', duration: '500ms', value: 60 },
  { name: 'IMAGE', delay: '720ms', duration: '500ms', value: 80 },
  { name: 'CTA', delay: '960ms', duration: '500ms', value: 100 },
] as const;

type ParamPanelProps = {
  activeNodeIndex: number;
};

export function ParamPanel({ activeNodeIndex }: ParamPanelProps): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();
  const active = PARAMETERS[Math.max(0, activeNodeIndex)];

  return (
    <Animate
      animateId="s03-panel"
      enterAnimation="slide-up"
      exitAnimation={{ exit: { opacity: 0, y: 40 } }}
      duration={{ enter: timing.duration(560), exit: timing.duration(360) }}
      timeline={{ waitFor: 'node-cta', delay: timing.delay(200) }}
    >
      <aside className="s03-panel" aria-live="polite" aria-label={t('dragTemporal.s03.panelLabel')}>
        <div className="s03-panel__heading">
          <span>ACTIVE CUE</span>
          <strong>{activeNodeIndex < 0 ? 'ARMED' : active.name}</strong>
        </div>
        <dl className="s03-panel__params">
          <div>
            <dt>WAIT</dt>
            <dd>
              {activeNodeIndex < 0
                ? 'timeline-base'
                : activeNodeIndex === 0
                  ? 'BASE'
                  : PARAMETERS[activeNodeIndex - 1].name}
            </dd>
          </div>
          <div>
            <dt>DELAY</dt>
            <dd className="s03-panel__delay">{activeNodeIndex < 0 ? '000ms' : active.delay}</dd>
          </div>
          <div>
            <dt>DURATION</dt>
            <dd>{active.duration}</dd>
          </div>
        </dl>
        <div className="s03-panel__progress" aria-hidden="true">
          <span style={{ width: `${activeNodeIndex < 0 ? 0 : active.value}%` }} />
        </div>
      </aside>
    </Animate>
  );
}
