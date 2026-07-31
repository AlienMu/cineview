import type {
  CineViewErrorCode,
  DragBlockedDetail,
  DragCommitDetail,
  DragStartDetail,
  DragTimelineUnit,
  SceneDragConfig,
} from './index';
import {
  DEFAULT_DRAG_TIMELINE_SCALE,
  DEFAULT_DRAG_TIMELINE_UNIT,
} from '../utils/dragTimelineMapping';

describe('drag public types', () => {
  it('keeps the public mapping defaults explicit and aligned', () => {
    expect(DEFAULT_DRAG_TIMELINE_UNIT).toBe('time');
    expect(DEFAULT_DRAG_TIMELINE_SCALE).toEqual({ time: 10, percent: 1 });
  });

  it('exports the new public error codes', () => {
    const codes: CineViewErrorCode[] = ['INVALID_DRAG_CONFIG', 'ANIMATION_ASSET_LOAD_FAILED'];

    expect(codes).toEqual(['INVALID_DRAG_CONFIG', 'ANIMATION_ASSET_LOAD_FAILED']);
  });

  it('expresses the new mapping and callback details', () => {
    const unit: DragTimelineUnit = 'percent';
    const config: SceneDragConfig = { enabled: true, unit, scale: 0.5 };
    const start: DragStartDetail = { sceneIndex: 0, progress: 0, direction: 'forward' };
    const blocked: DragBlockedDetail = {
      fromIndex: 0,
      targetSceneIndex: 1,
      direction: 'forward',
    };
    const commit: DragCommitDetail = {
      sceneIndex: 0,
      targetSceneIndex: 1,
      progress: 0.5,
      direction: 'forward',
      elapsedMs: 100,
      timelineDurationMs: 200,
    };

    expect({ config, start, blocked, commit }).toBeDefined();
  });
});
