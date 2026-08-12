import { useSearchParams } from 'react-router-dom';
import { TemporalDragExperience } from '../components/temporal-drag';

export default function DragPage(): JSX.Element {
  // Homepage scene5 内嵌协议（task-flow 2026-08-02-scene5-cinema-entrance）：
  // ?preload=true → 预热壳；?deferred=true → 暗场壳等待 postMessage 激活。
  // 无参数直接访问 /drag 时两者均为 false，行为与内嵌前完全一致。
  const [searchParams] = useSearchParams();

  return (
    <main className="drag-page" data-page="drag">
      <TemporalDragExperience
        preload={searchParams.get('preload') === 'true'}
        deferred={searchParams.get('deferred') === 'true'}
      />
    </main>
  );
}
