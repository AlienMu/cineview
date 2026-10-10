import { TextSplit } from './split';

/** jsdom has no layout: what can be checked here is the shadow structure and the refusals. */
function host(html: string): { el: HTMLElement; slot: HTMLSlotElement; container: HTMLElement } {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  const root = el.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  const slot = document.createElement('slot');
  container.append(slot);
  root.append(container);
  return { el, slot, container };
}

describe('TextSplit', () => {
  afterEach(() => (document.body.textContent = ''));

  it('wraps the slot and adds a hidden-from-readers copy beside it', () => {
    const { el, slot, container } = host('Hello there');
    const split = new TextSplit(el, slot, 'words', null);
    const source = container.querySelector('[part=split-source]');
    const copy = container.querySelector('[part=split]');
    expect(source?.firstElementChild).toBe(slot);
    expect(copy?.getAttribute('aria-hidden')).toBe('true');
    expect(container.style.position).toBe('relative');
    split.destroy();
  });

  it('refuses content that is more than text', () => {
    const { el, slot } = host('Look <img alt="">');
    expect(new TextSplit(el, slot, 'words', null).mount()).toMatch(/more than text/);
  });

  it('refuses text with no box', () => {
    const { el, slot } = host('Hello');
    expect(new TextSplit(el, slot, 'lines', null).mount()).toMatch(/no text/);
  });

  it('shows the copy until a time source has entered, unless the end state moves the text', () => {
    const { el, slot, container } = host('Hello');
    const split = new TextSplit(el, slot, 'lines', null);
    const source = container.querySelector<HTMLElement>('[part=split-source]')!;
    split.show(true);
    expect(source.style.opacity).toBe('0');
    split.phase('entered');
    expect(source.style.opacity).toBe('');
    split.phase('entering');
    expect(source.style.opacity).toBe('0');
    split.atRest = false;
    split.phase('entered');
    expect(source.style.opacity).toBe('0');
    split.atRest = true;
    split.progress(0.99);
    expect(source.style.opacity).toBe('0');
    split.progress(1);
    expect(source.style.opacity).toBe('');
  });
});
