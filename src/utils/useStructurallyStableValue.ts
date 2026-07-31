import { useRef } from 'react';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function areStructurallyEqual(
  left: unknown,
  right: unknown,
  leftToRight: WeakMap<object, object>,
  rightToLeft: WeakMap<object, object>
): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
  } else if (!isPlainRecord(left) || !isPlainRecord(right)) {
    return false;
  }

  const leftObject = left as object;
  const rightObject = right as object;
  const mappedRight = leftToRight.get(leftObject);
  const mappedLeft = rightToLeft.get(rightObject);
  if (mappedRight || mappedLeft) {
    return mappedRight === rightObject && mappedLeft === leftObject;
  }

  leftToRight.set(leftObject, rightObject);
  rightToLeft.set(rightObject, leftObject);

  try {
    if (Array.isArray(left) && Array.isArray(right)) {
      return left.every((value, index) =>
        areStructurallyEqual(value, right[index], leftToRight, rightToLeft)
      );
    }

    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    if (leftKeys.length !== rightKeys.length) return false;

    for (let index = 0; index < leftKeys.length; index += 1) {
      const key = leftKeys[index];
      if (
        key !== rightKeys[index] ||
        !areStructurallyEqual(leftRecord[key], rightRecord[key], leftToRight, rightToLeft)
      ) {
        return false;
      }
    }

    return true;
  } finally {
    leftToRight.delete(leftObject);
    rightToLeft.delete(rightObject);
  }
}

/**
 * Keeps JSON-like authoring objects stable across renders when only their object
 * identity changed. Functions and non-plain objects remain identity-sensitive.
 */
export function useStructurallyStableValue<T>(value: T): T {
  const stableRef = useRef(value);
  if (
    !areStructurallyEqual(
      stableRef.current,
      value,
      new WeakMap<object, object>(),
      new WeakMap<object, object>()
    )
  ) {
    stableRef.current = value;
  }
  return stableRef.current;
}
