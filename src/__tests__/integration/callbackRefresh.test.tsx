import { act, render, waitFor } from '@testing-library/react';
import { Animate, Cineview, Scene } from '../../index';

it('preserves an embedded document when a scroll root receives a new callback', async () => {
  const page = (label: string) => (
    <Cineview mode="scroll" callbacks={{ onError: jest.fn() }}>
      <Scene sceneId="phone">
        <Animate animateId="phone-breathe" loopAnimation={{ animate: { opacity: [1, 0.9, 1] } }}>
          <iframe title={label} />
        </Animate>
      </Scene>
    </Cineview>
  );
  const view = render(page('Drag experience'));
  await waitFor(() =>
    expect(
      view.container.querySelector('[data-cineview-animate-id="phone-breathe"] > div')
    ).not.toBeNull()
  );
  const iframe = view.getByTitle('Drag experience');
  await act(async () => view.rerender(page('Experience translated')));
  expect(view.getByTitle('Experience translated')).toBe(iframe);
});
