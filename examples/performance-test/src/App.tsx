import { useHashRoute } from './hooks/useHashRoute';
import AcceptanceDragPage from './pages/AcceptanceDragPage';
import AcceptanceScrollPage from './pages/AcceptanceScrollPage';
import DragModePage from './pages/DragModePage';
import { ExperienceHub } from './pages/ExperienceHub';
import ScrollModePage from './pages/ScrollModePage';

export default function App(): JSX.Element {
  const route = useHashRoute();

  if (route === 'drag') {
    return <DragModePage />;
  }
  if (route === 'scroll') {
    return <ScrollModePage />;
  }
  if (route === 'acceptance-drag') {
    return <AcceptanceDragPage />;
  }
  if (route === 'acceptance-scroll') {
    return <AcceptanceScrollPage />;
  }

  return <ExperienceHub />;
}
