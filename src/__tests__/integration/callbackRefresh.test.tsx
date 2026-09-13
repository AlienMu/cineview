import { act, render, waitFor } from '@testing-library/react';
import { Animate, Cineview, Scene } from '../../index';

it('preserves an embedded document when a scroll root receives a new callback', async () => {
  const onError = jest.fn();
  const page = (label: string) => (
    <Cineview mode="scroll" callbacks={{ onError }}>
      <Scene key="phone" sceneId="phone">
        <Animate key="breathe" animateId="phone-breathe" loopAnimation={{ animate: { opacity: [1, 0.9, 1] } }}>
          <iframe key="iframe" title={label} />
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
  const sceneBefore = view.container.querySelector('[data-cineview-scene-id="phone"]');
  console.log('Scene DOM node before:', sceneBefore);
  console.log('iframe DOM node before:', iframe);

  await act(async () => view.rerender(page('Experience translated')));

  const sceneAfter = view.container.querySelector('[data-cineview-scene-id="phone"]');
  const iframeAfter = view.container.querySelector('iframe');
  console.log('Scene DOM node after:', sceneAfter);
  console.log('iframe DOM node after:', iframeAfter);
  console.log('Scene preserved?', sceneBefore === sceneAfter);
  console.log('iframe preserved?', iframe === iframeAfter);

  // The iframe should be the same DOM node with an updated title attribute
  expect(iframe.getAttribute('title')).toBe('Experience translated');
  expect(view.container.querySelector('iframe')).toBe(iframe);
});
