import { act, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { Cineview, Scene, type CineviewRef } from '../../index';

describe('public root updates', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(['drag', 'scroll'] as const)('rejects non-integer indices in %s before callbacks', async (mode) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ref = createRef<CineviewRef>();
    const onSceneEnter = jest.fn();
    const view = render(<Cineview ref={ref} mode={mode} callbacks={{ onSceneEnter }}>
      <Scene><p>A</p></Scene><Scene><p>B</p></Scene>
    </Cineview>);
    await act(async () => {});
    for (const index of [NaN, 0.5, Infinity, -Infinity, -1, 2]) {
      act(() => ref.current!.goToScene(index, false));
      expect(ref.current!.getCurrentIndex()).toBe(0);
    }
    expect(onSceneEnter).not.toHaveBeenCalled();
    if (mode === 'drag') expect(view.getByRole('status')).toHaveTextContent('1 / 2');
    expect(warn).toHaveBeenCalled();
  });

  it('keeps saved scroll methods and the onReady API current after appending scenes', async () => {
    const ref = createRef<CineviewRef>();
    const onReady = jest.fn();
    const page = (count: number) => <Cineview ref={ref} mode="scroll" callbacks={{ onReady }}>
      {Array.from({length:count}, (_,i) => <Scene key={i}><p>Scene {i}</p></Scene>)}
    </Cineview>;
    const view = render(page(1));
    await act(async () => {});
    const ready = onReady.mock.calls[0][0] as CineviewRef;
    const goToScene = ready.goToScene;
    view.rerender(page(2));
    const root = view.container.querySelector('[data-cineview-container]') as HTMLDivElement;
    root.scrollTo = jest.fn();
    act(() => goToScene(1, false));
    expect(root.scrollTo).toHaveBeenCalled();
    expect(ref.current).toBe(ready);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it.each(['key', 'sceneId'] as const)('preserves active scene content when reordered by %s', async (identity) => {
    const ref = createRef<CineviewRef>();
    const page = (ids: string[]) => <Cineview ref={ref}>
      {ids.map(id => <Scene key={identity === 'key' ? id : undefined} sceneId={id}>
        <input aria-label={id} defaultValue={id} />
      </Scene>)}
    </Cineview>;
    const warn = identity === 'sceneId' ? jest.spyOn(console, 'error').mockImplementation(() => undefined) : null;
    const view = render(page(['a','b','c','d']));
    await act(async () => {});
    const input = view.getByRole('textbox', {name:'a'});
    fireEvent.change(input, {target:{value:'typed text'}});
    await act(async () => view.rerender(page(['b','c','d','a'])));
    expect(view.getByRole('textbox', {name:'a'})).toBe(input);
    expect(input).toHaveValue('typed text');
    expect(ref.current!.getCurrentIndex()).toBe(3);
    warn?.mockRestore();
  });

  it('completes navigation once despite continuing parent renders', async () => {
    jest.useFakeTimers();
    const ref = createRef<CineviewRef>();
    const onSceneLeave = jest.fn();
    const page = (tick: number) => <Cineview ref={ref} transitionDuration={200} callbacks={{onSceneLeave}}>
      <Scene sceneId="a"><p>A {tick}</p></Scene>
      <Scene sceneId="b"><p>B {tick}</p></Scene>
    </Cineview>;
    const view = render(page(0));
    await act(async () => {});
    act(() => ref.current!.goToScene(1, true));
    for(let tick=1;tick<=10;tick++) {
      act(() => jest.advanceTimersByTime(100));
      await act(async () => view.rerender(page(tick)));
    }
    expect(onSceneLeave).toHaveBeenCalledTimes(1);
    expect(onSceneLeave).toHaveBeenCalledWith({fromIndex:0,toIndex:1,direction:'forward'});
  });
});
