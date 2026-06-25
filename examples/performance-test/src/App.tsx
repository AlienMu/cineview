import { useHashRoute } from './hooks/useHashRoute';
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

  return <ExperienceHub />;
}
