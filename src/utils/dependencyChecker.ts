import { AnimationRegistry, CineViewError, ErrorCodes } from '../types';

/**
 * 检查动画依赖是否存在循环依赖
 * @param registry - 动画注册表
 * @param startId - 起始动画 ID
 * @returns 是否存在循环依赖
 */
export function checkCircularDependency(registry: AnimationRegistry, startId: string): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(id: string): boolean {
    if (!registry[id]) {
      return false;
    }

    if (recursionStack.has(id)) {
      return true; // 发现循环
    }

    if (visited.has(id)) {
      return false; // 已经访问过且无循环
    }

    visited.add(id);
    recursionStack.add(id);

    const { waitFor } = registry[id];
    if (waitFor && dfs(waitFor)) {
      return true;
    }

    recursionStack.delete(id);
    return false;
  }

  return dfs(startId);
}

/**
 * 获取依赖链路
 * @param registry - 动画注册表
 * @param startId - 起始动画 ID
 * @returns 依赖链路数组
 */
export function getDependencyChain(registry: AnimationRegistry, startId: string): string[] {
  const chain: string[] = [];
  let currentId: string | undefined = startId;

  while (currentId && registry[currentId]) {
    if (chain.includes(currentId)) {
      // 发现循环，添加当前 ID 并停止
      chain.push(currentId);
      break;
    }

    chain.push(currentId);
    currentId = registry[currentId].waitFor;
  }

  return chain;
}

/**
 * 验证动画依赖并抛出错误（如果存在循环依赖）
 * @param registry - 动画注册表
 * @param animateId - 动画 ID
 * @throws {CineViewError} 如果存在循环依赖
 */
export function validateAnimationDependency(registry: AnimationRegistry, animateId: string): void {
  if (checkCircularDependency(registry, animateId)) {
    const chain = getDependencyChain(registry, animateId);
    throw new CineViewError(
      `Circular dependency detected in animation chain: ${chain.join(' -> ')}`,
      ErrorCodes.CIRCULAR_DEPENDENCY
    );
  }
}

/**
 * 计算动画的实际开始时间
 * @param registry - 动画注册表
 * @param animateId - 动画 ID
 * @param delay - 自身延迟时间
 * @returns 实际开始时间
 */
export function calculateActualStartTime(
  registry: AnimationRegistry,
  animateId: string,
  delay: number
): number {
  const item = registry[animateId];
  if (!item || !item.waitFor) {
    return delay;
  }

  const waitForItem = registry[item.waitFor];
  if (!waitForItem) {
    return delay;
  }

  // 实际开始时间 = 自身延迟 + 关联组件的实际执行时间
  // 实际执行时间 = 实际开始时间 + 动画时长
  return delay + waitForItem.executionTime;
}

/**
 * 构建依赖图
 * @param registry - 动画注册表
 * @returns 依赖图（邻接表）
 */
export function buildDependencyGraph(registry: AnimationRegistry): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  // 初始化所有节点
  Object.keys(registry).forEach((id) => {
    if (!graph.has(id)) {
      graph.set(id, []);
    }
  });

  // 构建边（反向依赖）
  Object.entries(registry).forEach(([id, item]) => {
    if (item.waitFor) {
      const dependents = graph.get(item.waitFor) || [];
      dependents.push(id);
      graph.set(item.waitFor, dependents);
    }
  });

  return graph;
}

/**
 * 获取所有依赖于指定动画的动画 ID
 * @param registry - 动画注册表
 * @param animateId - 动画 ID
 * @returns 依赖于该动画的所有动画 ID 数组
 */
export function getDependents(registry: AnimationRegistry, animateId: string): string[] {
  const dependents: string[] = [];

  Object.entries(registry).forEach(([id, item]) => {
    if (item.waitFor === animateId) {
      dependents.push(id);
    }
  });

  return dependents;
}

/**
 * 检查动画 ID 是否存在
 * @param registry - 动画注册表
 * @param animateId - 动画 ID
 * @returns 是否存在
 */
export function animationExists(registry: AnimationRegistry, animateId: string): boolean {
  return animateId in registry;
}

/**
 * 验证 waitFor 引用的动画是否存在
 * @param registry - 动画注册表
 * @param animateId - 动画 ID
 * @param waitFor - 关联的动画 ID
 * @throws {CineViewError} 如果引用的动画不存在
 */
export function validateWaitForReference(
  registry: AnimationRegistry,
  animateId: string,
  waitFor: string
): void {
  if (!animationExists(registry, waitFor)) {
    throw new CineViewError(
      `Animation "${animateId}" references non-existent animation "${waitFor}" in waitFor`,
      ErrorCodes.INVALID_ANIMATION
    );
  }
}
