/**
 * `replay`: whether an entrance plays again. Omitted (null): the source's own rule. `replay` or
 * `replay="true"`: plays each time it comes back. `replay="false"`: after one complete entrance,
 * later entrances show its final state. Anything else is reported and read as omitted.
 */
export type ReplayPolicy = 'default' | 'on' | 'once';

export function parseReplay(value: string | null): ReplayPolicy | null {
  if (value === null) return 'default';
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'true' || v === 'replay') return 'on';
  if (v === 'false') return 'once';
  return null;
}

/**
 * Elements that finished one complete entrance, for replay="false". The value is the entrance
 * definition it finished with: a rebuild keeps the record while that stays the same; disconnecting
 * the element clears it.
 */
const done = new WeakMap<Element, string>();
const DEFINITION = [
  'fx',
  'from',
  'to',
  'duration',
  'delay',
  'after',
  'at',
  'stagger',
  'split',
  'on',
  'ease',
  'target',
];

export function entranceDefinition(el: Element, sceneKey: string): string {
  return DEFINITION.map((n) => el.getAttribute(n) ?? '').join('|') + '|' + sceneKey;
}
export const isDone = (el: Element, key: string): boolean => done.get(el) === key;
export const markDone = (el: Element, key: string): void => void done.set(el, key);
export const forgetDone = (el: Element): void => void done.delete(el);
