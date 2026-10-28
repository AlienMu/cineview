import { CvPause } from './pause';

beforeAll(() => customElements.define('cv-pause', CvPause));
afterEach(() => document.body.replaceChildren());
function stage(id: string) {
  const el = document.createElement('cv-stage');
  el.id = id;
  document.body.append(el);
  return el;
}
function control(parent: Element, html = '') {
  const el = document.createElement('cv-pause') as CvPause;
  el.innerHTML = html;
  parent.append(el);
  return el;
}

it('exposes button semantics and toggles the nearest stage with click and keyboard', () => {
  const s = stage('story'),
    button = control(s);
  expect(button.stage).toBe(s);
  expect(button.getAttribute('role')).toBe('button');
  expect(button.tabIndex).toBe(0);
  expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(button.shadowRoot!.textContent).toBe('Pause motion');
  button.click();
  expect(s.hasAttribute('paused')).toBe(true);
  s.dispatchEvent(new Event('cv-pause'));
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(button.shadowRoot!.textContent).toBe('Play motion');
  for (const key of ['Enter', ' ']) {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    button.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  expect(s.hasAttribute('paused')).toBe(true);
  const irrelevant = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
  button.dispatchEvent(irrelevant);
  expect(irrelevant.defaultPrevented).toBe(false);
  expect(s.hasAttribute('paused')).toBe(true);
});

it('keeps author labels, role and tabindex, and follows external stage state', () => {
  const s = stage('story');
  const button = document.createElement('cv-pause') as CvPause;
  button.setAttribute('role', 'switch');
  button.tabIndex = 3;
  button.textContent = 'Stop animation';
  s.append(button);
  s.setAttribute('paused', '');
  s.dispatchEvent(new Event('cv-pause'));
  expect(button.textContent).toBe('Stop animation');
  expect(button.getAttribute('role')).toBe('switch');
  expect(button.tabIndex).toBe(3);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  s.removeAttribute('paused');
  s.dispatchEvent(new Event('cv-play'));
  expect(button.getAttribute('aria-pressed')).toBe('false');
});

it('rebinds for= to another stage and stops listening to the former stage', () => {
  const a = stage('a'),
    b = stage('b'),
    button = control(document.body);
  expect(button.stage).toBe(a);
  button.setAttribute('for', 'b');
  button.click();
  expect(b.hasAttribute('paused')).toBe(true);
  expect(a.hasAttribute('paused')).toBe(false);
  b.dispatchEvent(new Event('cv-pause'));
  b.removeAttribute('paused');
  a.setAttribute('paused', '');
  a.dispatchEvent(new Event('cv-pause'));
  // The stale event must not resync from b's changed state.
  expect(button.getAttribute('aria-pressed')).toBe('true');
  b.dispatchEvent(new Event('cv-play'));
  expect(button.getAttribute('aria-pressed')).toBe('false');
});

it('waits for a late stage and re-resolves a replaced stage on use', () => {
  const button = control(document.body);
  button.setAttribute('for', 'later');
  button.click();
  expect(button.stage).toBeNull();
  const wrong = document.createElement('div');
  wrong.id = 'later';
  document.body.append(wrong);
  button.click();
  expect(wrong.hasAttribute('paused')).toBe(false);
  wrong.remove();
  const a = stage('later');
  document.dispatchEvent(new Event('cv-ready'));
  a.setAttribute('paused', '');
  a.dispatchEvent(new Event('cv-pause'));
  expect(button.getAttribute('aria-pressed')).toBe('true');
  a.remove();
  const b = stage('later');
  button.click();
  expect(b.hasAttribute('paused')).toBe(true);
});

it('disconnects document, stage and input listeners and reconnects without duplicate toggles', () => {
  const s = stage('story'),
    button = control(s);
  button.remove();
  button.click();
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  expect(s.hasAttribute('paused')).toBe(false);
  s.setAttribute('paused', '');
  s.dispatchEvent(new Event('cv-pause'));
  document.dispatchEvent(new Event('cv-ready'));
  expect(button.getAttribute('aria-pressed')).toBe('false');
  s.append(button);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  button.click();
  expect(s.hasAttribute('paused')).toBe(false);
});
