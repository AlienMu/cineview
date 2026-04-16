import {
  checkCircularDependency,
  getDependencyChain,
  validateAnimationDependency,
  calculateActualStartTime,
  buildDependencyGraph,
  getDependents,
  animationExists,
  validateWaitForReference,
} from './dependencyChecker';
import { AnimationRegistry, CineViewError, ErrorCodes } from '../types';

describe('dependencyChecker', () => {
  describe('checkCircularDependency', () => {
    it('should return false when no circular dependency exists', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp2',
        },
      };

      expect(checkCircularDependency(registry, 'comp1')).toBe(false);
      expect(checkCircularDependency(registry, 'comp2')).toBe(false);
      expect(checkCircularDependency(registry, 'comp3')).toBe(false);
    });

    it('should return true when circular dependency exists', () => {
      const registry: AnimationRegistry = {
        comp1: {
          status: 'pending',
          startTime: 1000,
          duration: 1000,
          executionTime: 2000,
          waitFor: 'comp3',
        },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp2',
        },
      };

      expect(checkCircularDependency(registry, 'comp1')).toBe(true);
      expect(checkCircularDependency(registry, 'comp2')).toBe(true);
      expect(checkCircularDependency(registry, 'comp3')).toBe(true);
    });

    it('should return true for self-referencing dependency', () => {
      const registry: AnimationRegistry = {
        comp1: {
          status: 'pending',
          startTime: 1000,
          duration: 1000,
          executionTime: 2000,
          waitFor: 'comp1',
        },
      };

      expect(checkCircularDependency(registry, 'comp1')).toBe(true);
    });

    it('should return false when animation does not exist', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
      };

      expect(checkCircularDependency(registry, 'nonexistent')).toBe(false);
    });

    it('should handle complex dependency chains without cycles', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp1',
        },
        comp4: {
          status: 'pending',
          startTime: 200,
          duration: 600,
          executionTime: 800,
          waitFor: 'comp2',
        },
        comp5: {
          status: 'pending',
          startTime: 100,
          duration: 500,
          executionTime: 600,
          waitFor: 'comp3',
        },
      };

      expect(checkCircularDependency(registry, 'comp4')).toBe(false);
      expect(checkCircularDependency(registry, 'comp5')).toBe(false);
    });
  });

  describe('getDependencyChain', () => {
    it('should return correct dependency chain', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp2',
        },
      };

      expect(getDependencyChain(registry, 'comp3')).toEqual(['comp3', 'comp2', 'comp1']);
      expect(getDependencyChain(registry, 'comp2')).toEqual(['comp2', 'comp1']);
      expect(getDependencyChain(registry, 'comp1')).toEqual(['comp1']);
    });

    it('should detect circular dependency in chain', () => {
      const registry: AnimationRegistry = {
        comp1: {
          status: 'pending',
          startTime: 1000,
          duration: 1000,
          executionTime: 2000,
          waitFor: 'comp3',
        },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp2',
        },
      };

      const chain = getDependencyChain(registry, 'comp1');
      expect(chain).toContain('comp1');
      expect(chain).toContain('comp2');
      expect(chain).toContain('comp3');
      // 循环依赖会导致某个 ID 出现两次
      expect(chain.length).toBeGreaterThan(3);
    });

    it('should return single element for animation without dependencies', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
      };

      expect(getDependencyChain(registry, 'comp1')).toEqual(['comp1']);
    });
  });

  describe('validateAnimationDependency', () => {
    it('should not throw error when no circular dependency exists', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
      };

      expect(() => validateAnimationDependency(registry, 'comp2')).not.toThrow();
    });

    it('should throw CineViewError when circular dependency exists', () => {
      const registry: AnimationRegistry = {
        comp1: {
          status: 'pending',
          startTime: 1000,
          duration: 1000,
          executionTime: 2000,
          waitFor: 'comp2',
        },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
      };

      expect(() => validateAnimationDependency(registry, 'comp1')).toThrow(CineViewError);
      expect(() => validateAnimationDependency(registry, 'comp1')).toThrow(/Circular dependency/);
    });
  });

  describe('calculateActualStartTime', () => {
    it('should return delay when no waitFor dependency', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
      };

      expect(calculateActualStartTime(registry, 'comp1', 1000)).toBe(1000);
    });

    it('should calculate correct start time with waitFor dependency', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
      };

      // comp2 实际开始时间 = 自身 delay (500) + comp1 实际执行时间 (2000)
      expect(calculateActualStartTime(registry, 'comp2', 500)).toBe(2500);
    });

    it('should return delay when waitFor component does not exist', () => {
      const registry: AnimationRegistry = {
        comp1: {
          status: 'pending',
          startTime: 1000,
          duration: 1000,
          executionTime: 2000,
          waitFor: 'nonexistent',
        },
      };

      expect(calculateActualStartTime(registry, 'comp1', 1000)).toBe(1000);
    });

    it('should handle chain of dependencies', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp2',
        },
      };

      // comp3 实际开始时间 = 自身 delay (300) + comp2 实际执行时间 (1500)
      expect(calculateActualStartTime(registry, 'comp3', 300)).toBe(1800);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build correct dependency graph', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp1',
        },
      };

      const graph = buildDependencyGraph(registry);

      expect(graph.get('comp1')).toEqual(['comp2', 'comp3']);
      expect(graph.get('comp2')).toEqual([]);
      expect(graph.get('comp3')).toEqual([]);
    });

    it('should handle empty registry', () => {
      const registry: AnimationRegistry = {};
      const graph = buildDependencyGraph(registry);

      expect(graph.size).toBe(0);
    });

    it('should handle registry with no dependencies', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: { status: 'pending', startTime: 500, duration: 1000, executionTime: 1500 },
      };

      const graph = buildDependencyGraph(registry);

      expect(graph.get('comp1')).toEqual([]);
      expect(graph.get('comp2')).toEqual([]);
    });
  });

  describe('getDependents', () => {
    it('should return all dependents of an animation', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
        comp3: {
          status: 'pending',
          startTime: 300,
          duration: 700,
          executionTime: 1000,
          waitFor: 'comp1',
        },
        comp4: {
          status: 'pending',
          startTime: 200,
          duration: 600,
          executionTime: 800,
          waitFor: 'comp2',
        },
      };

      expect(getDependents(registry, 'comp1')).toEqual(['comp2', 'comp3']);
      expect(getDependents(registry, 'comp2')).toEqual(['comp4']);
      expect(getDependents(registry, 'comp3')).toEqual([]);
    });

    it('should return empty array when no dependents exist', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
      };

      expect(getDependents(registry, 'comp1')).toEqual([]);
    });

    it('should return empty array for nonexistent animation', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
      };

      expect(getDependents(registry, 'nonexistent')).toEqual([]);
    });
  });

  describe('animationExists', () => {
    it('should return true when animation exists', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
      };

      expect(animationExists(registry, 'comp1')).toBe(true);
    });

    it('should return false when animation does not exist', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
      };

      expect(animationExists(registry, 'nonexistent')).toBe(false);
    });

    it('should return false for empty registry', () => {
      const registry: AnimationRegistry = {};

      expect(animationExists(registry, 'comp1')).toBe(false);
    });
  });

  describe('validateWaitForReference', () => {
    it('should not throw error when referenced animation exists', () => {
      const registry: AnimationRegistry = {
        comp1: { status: 'pending', startTime: 1000, duration: 1000, executionTime: 2000 },
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
      };

      expect(() => validateWaitForReference(registry, 'comp2', 'comp1')).not.toThrow();
    });

    it('should throw CineViewError when referenced animation does not exist', () => {
      const registry: AnimationRegistry = {
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
      };

      expect(() => validateWaitForReference(registry, 'comp2', 'comp1')).toThrow(CineViewError);
      expect(() => validateWaitForReference(registry, 'comp2', 'comp1')).toThrow(
        /references non-existent animation/
      );
    });

    it('should throw error with correct error code', () => {
      const registry: AnimationRegistry = {
        comp2: {
          status: 'pending',
          startTime: 500,
          duration: 1000,
          executionTime: 1500,
          waitFor: 'comp1',
        },
      };

      try {
        validateWaitForReference(registry, 'comp2', 'comp1');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CineViewError);
        expect((error as CineViewError).code).toBe(ErrorCodes.INVALID_ANIMATION);
      }
    });
  });
});
