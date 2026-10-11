/**
 * Authoring errors (plan v3 §3.6). Production builds report them too, as a bubbling `cv-error`
 * on the offending element with a stable `code`; craft warnings are development-only (dev/).
 */
import type { TimeErrorCode } from './time';

export type ErrorCode =
  /** An attribute value that cannot be read (fx items, from/to, ease, on, loop, range, units). */
  | 'invalid-attribute'
  /** A preset or loop name that is not defined. */
  | 'unknown-effect'
  /** `keyframes(name)` names no @keyframes rule in the stylesheets the page lets it read. */
  | 'unknown-keyframes'
  /** Timing: two elements of a scene share a `name`, `after` names nothing, a cycle, unsolvable `at`. */
  | TimeErrorCode
  /** Stage or scene `unit`/`scale` (drag). */
  | 'invalid-drag-config'
  /** A preloaded image or video, or a <cv-video> source, failed to load. */
  | 'asset-failed'
  /** A stage without scenes once the document has parsed. */
  | 'empty-stage';

export interface CvErrorDetail {
  code: ErrorCode;
  message: string;
  element: Element;
}

/** Parsers report and carry on; the caller attaches the element. Default code: invalid-attribute. */
export type Report = (message: string, code?: ErrorCode) => void;
