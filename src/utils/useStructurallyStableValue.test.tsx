import { renderHook } from '@testing-library/react';
import { useStructurallyStableValue } from './useStructurallyStableValue';

function renderStableValue<T>(initialValue: T) {
  return renderHook(({ value }: { value: T }) => useStructurallyStableValue(value), {
    initialProps: { value: initialValue },
  });
}

describe('useStructurallyStableValue', () => {
  it('keeps the first reference for structurally equal JSON-like values', () => {
    const initial = {
      animate: { opacity: 1, transition: { duration: 0.4 } },
      initial: { opacity: 0, offsets: [0, 0.5, 1] },
    };
    const { result, rerender } = renderStableValue(initial);

    rerender({
      value: {
        initial: { offsets: [0, 0.5, 1], opacity: 0 },
        animate: { transition: { duration: 0.4 }, opacity: 1 },
      },
    });

    expect(result.current).toBe(initial);
  });

  it('publishes a new reference when a nested value changes', () => {
    const initial = { animate: { opacity: 1 }, offsets: [0, 1] };
    const changed = { animate: { opacity: 0.8 }, offsets: [0, 1] };
    const { result, rerender } = renderStableValue(initial);

    rerender({ value: changed });
    expect(result.current).toBe(changed);

    rerender({ value: { animate: { opacity: 0.8 }, offsets: [0, 1] } });
    expect(result.current).toBe(changed);
  });

  it('treats shared and duplicated equal children symmetrically', () => {
    const sharedTransition = { ease: [0.2, 0, 0, 1], duration: 0.5 };
    const shared = {
      initial: { transition: sharedTransition },
      animate: { transition: sharedTransition },
    };
    const duplicated = {
      initial: { transition: { ease: [0.2, 0, 0, 1], duration: 0.5 } },
      animate: { transition: { ease: [0.2, 0, 0, 1], duration: 0.5 } },
    };

    const sharedFirst = renderStableValue(shared);
    sharedFirst.rerender({ value: duplicated });
    expect(sharedFirst.result.current).toBe(shared);
    sharedFirst.unmount();

    const duplicatedFirst = renderStableValue(duplicated);
    duplicatedFirst.rerender({ value: shared });
    expect(duplicatedFirst.result.current).toBe(duplicated);
  });

  it('handles equivalent cycles without recursing forever', () => {
    interface CyclicValue {
      label: string;
      self?: CyclicValue;
    }

    const initial: CyclicValue = { label: 'loop' };
    initial.self = initial;
    const equivalent: CyclicValue = { label: 'loop' };
    equivalent.self = equivalent;
    const { result, rerender } = renderStableValue(initial);

    rerender({ value: equivalent });
    expect(result.current).toBe(initial);

    const changed: CyclicValue = { label: 'changed' };
    changed.self = changed;
    rerender({ value: changed });
    expect(result.current).toBe(changed);
  });

  it('keeps functions and non-plain objects identity-sensitive', () => {
    const firstFunction = () => 'first';
    const firstDate = new Date(0);
    const initial = { callback: firstFunction, value: firstDate };
    const { result, rerender } = renderStableValue(initial);

    rerender({ value: { callback: firstFunction, value: firstDate } });
    expect(result.current).toBe(initial);

    const equivalentButDistinct = { callback: () => 'first', value: new Date(0) };
    rerender({ value: equivalentButDistinct });
    expect(result.current).toBe(equivalentButDistinct);
  });

  it('supports null-prototype authoring records', () => {
    const initial = Object.assign(Object.create(null) as Record<string, unknown>, {
      opacity: 1,
      nested: { x: 0 },
    });
    const equivalent = { nested: { x: 0 }, opacity: 1 };
    const { result, rerender } = renderStableValue<Record<string, unknown>>(initial);

    rerender({ value: equivalent });
    expect(result.current).toBe(initial);
  });

  it('distinguishes array shape, object shape, and array length', () => {
    const initial: unknown = [0, 1];
    const { result, rerender } = renderStableValue(initial);

    const longer = [0, 1, 2];
    rerender({ value: longer });
    expect(result.current).toBe(longer);

    const record = { 0: 0, 1: 1, 2: 2 };
    rerender({ value: record });
    expect(result.current).toBe(record);
  });

  it('uses Object.is semantics for special primitive values', () => {
    const nan = renderStableValue(Number.NaN);
    nan.rerender({ value: Number.NaN });
    expect(Number.isNaN(nan.result.current)).toBe(true);
    nan.unmount();

    const signedZero = renderStableValue(0);
    signedZero.rerender({ value: -0 });
    expect(Object.is(signedZero.result.current, -0)).toBe(true);
  });
});
