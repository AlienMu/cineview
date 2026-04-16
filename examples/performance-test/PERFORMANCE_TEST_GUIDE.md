# CineView Performance Test Guide

## Overview

This guide provides detailed instructions for running and interpreting the CineView performance test application. The test validates that the framework meets its performance requirements with 20+ scenes.

## Test Specifications

### Requirements Validated

- **Requirement 14.10**: Animation frame rate maintains 60fps
- **Requirement 16.1**: Collect current FPS metrics
- **Requirement 16.2**: Collect average frame time metrics
- **Requirement 16.3**: Collect memory usage metrics
- **Requirement 16.6**: Use Performance API to monitor key metrics

### Test Configuration

- **Total Scenes**: 25 scenes
- **Elements per Scene**: 3-7 animated elements
- **Animation Types**: All 40+ preset animations tested
- **Infinite Animations**: Included in select scenes
- **Performance Mode**: Enabled
- **Virtualization**: Active (renders current + adjacent scenes only)

## Running the Tests

### 1. Setup

```bash
cd examples/performance-test
pnpm install
```

### 2. Development Mode Test

```bash
pnpm dev
```

**What to observe:**
- Initial load time
- FPS during scene transitions
- Memory usage over time
- Animation smoothness

### 3. Production Build Test

```bash
pnpm build
pnpm preview
```

**What to observe:**
- Optimized bundle size
- Improved FPS compared to dev mode
- Reduced memory footprint

### 4. Automated Lighthouse Test

```bash
pnpm lighthouse
```

**Expected Results:**
- Performance Score: ≥95
- LCP: <2.5s
- FID: <100ms
- CLS: <0.1
- INP: <200ms

## Performance Metrics Interpretation

### FPS (Frames Per Second)

**Target: 60 FPS**

| Range | Status | Meaning |
|-------|--------|---------|
| ≥55 FPS | 🟢 Good | Smooth animations, optimal performance |
| 30-54 FPS | 🟡 Warning | Noticeable lag, investigate bottlenecks |
| <30 FPS | 🔴 Poor | Severe performance issues, optimization needed |

**Common causes of low FPS:**
- Too many DOM elements rendered
- Heavy JavaScript execution
- Inefficient CSS animations
- Browser not using GPU acceleration

### Frame Time

**Target: ≤16.67ms (60 FPS)**

| Range | Status | Meaning |
|-------|--------|---------|
| ≤16.67ms | 🟢 Good | Meeting 60 FPS target |
| 16.67-33.33ms | 🟡 Warning | 30-60 FPS range |
| >33.33ms | 🔴 Poor | Below 30 FPS |

**Frame time formula:**
```
Frame Time (ms) = 1000ms / FPS
60 FPS = 16.67ms per frame
30 FPS = 33.33ms per frame
```

### Memory Usage

**Target: Stable, <100MB**

| Range | Status | Meaning |
|-------|--------|---------|
| <50MB | 🟢 Good | Efficient memory usage |
| 50-100MB | 🟡 Warning | Acceptable but monitor for leaks |
| >100MB | 🔴 Poor | High memory usage, check for leaks |

**Memory leak indicators:**
- Memory usage continuously increases
- Memory doesn't decrease after scene changes
- Browser becomes sluggish over time

### Bundle Size

**Target: <50KB (gzipped)**

The performance monitor displays the framework's bundle size. This should remain constant and meet the target.

## Test Scenarios

### Scenario 1: Initial Load Performance

**Steps:**
1. Open the application
2. Observe load progress indicator
3. Note FPS when first scene appears

**Expected:**
- Load progress reaches 100%
- First scene renders smoothly
- FPS stabilizes at ~60

### Scenario 2: Sequential Scene Navigation

**Steps:**
1. Navigate through all 25 scenes sequentially
2. Monitor FPS during transitions
3. Check memory usage trend

**Expected:**
- FPS remains ≥55 during transitions
- Memory usage stays stable
- No visual stuttering

### Scenario 3: Rapid Scene Switching

**Steps:**
1. Quickly switch between scenes using navigation buttons
2. Jump to first/last scenes repeatedly
3. Monitor performance metrics

**Expected:**
- Framework handles rapid changes gracefully
- FPS may dip briefly but recovers quickly
- No crashes or errors

### Scenario 4: Long-Running Session

**Steps:**
1. Leave application running for 5+ minutes
2. Navigate through scenes periodically
3. Monitor memory usage over time

**Expected:**
- Memory usage remains stable (no leaks)
- FPS doesn't degrade over time
- Application remains responsive

### Scenario 5: Infinite Animation Performance

**Steps:**
1. Navigate to scenes with infinite animations (every 3rd scene)
2. Let animations run for 1+ minute
3. Monitor FPS and memory

**Expected:**
- Infinite animations don't cause memory leaks
- FPS remains stable
- Animations continue smoothly

## Browser Testing

Test in multiple browsers to ensure cross-platform performance:

### Chrome/Edge (Chromium)
- Best Performance API support
- Full memory metrics available
- Expected FPS: 60

### Firefox
- Good Performance API support
- Memory metrics may be limited
- Expected FPS: 55-60

### Safari
- Limited Performance API support
- Memory metrics may not be available
- Expected FPS: 55-60

## Performance Optimization Checklist

If performance is below target, verify:

- [ ] Hardware acceleration enabled in browser
- [ ] Running on dedicated GPU (if available)
- [ ] No other heavy applications running
- [ ] Browser extensions disabled
- [ ] Latest browser version
- [ ] Sufficient system RAM available
- [ ] Performance mode enabled in CineView
- [ ] Virtualization working (only 3 scenes rendered)

## Debugging Performance Issues

### Using Browser DevTools

**Chrome DevTools Performance Tab:**
1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Navigate through scenes
5. Stop recording
6. Analyze flame graph for bottlenecks

**Key things to look for:**
- Long tasks (>50ms)
- Excessive layout/paint operations
- JavaScript execution time
- Animation frame drops

**Chrome DevTools Memory Tab:**
1. Open DevTools (F12)
2. Go to Memory tab
3. Take heap snapshot
4. Navigate through scenes
5. Take another snapshot
6. Compare snapshots for leaks

**Key things to look for:**
- Detached DOM nodes
- Event listeners not cleaned up
- Growing object counts

### Performance Profiling

Add custom performance marks:

```typescript
performance.mark('scene-transition-start');
// ... scene transition code ...
performance.mark('scene-transition-end');
performance.measure('scene-transition', 'scene-transition-start', 'scene-transition-end');
```

View measurements in DevTools Performance tab.

## Reporting Issues

When reporting performance issues, include:

1. **Environment:**
   - Browser and version
   - Operating system
   - Device specs (CPU, RAM, GPU)

2. **Metrics:**
   - FPS values
   - Frame time
   - Memory usage
   - Bundle size

3. **Scenario:**
   - Steps to reproduce
   - Which scenes affected
   - Duration of test

4. **Screenshots:**
   - Performance monitor overlay
   - DevTools Performance tab
   - DevTools Memory tab

5. **Lighthouse Report:**
   - Attach lighthouse-report.html
   - Include all Core Web Vitals

## Expected Performance Baseline

Based on testing on modern hardware (2020+):

| Metric | Development | Production |
|--------|-------------|------------|
| FPS | 55-60 | 58-60 |
| Frame Time | 16-18ms | 16-17ms |
| Memory | 40-60MB | 30-50MB |
| Bundle Size | N/A | <50KB (gzipped) |
| LCP | <3s | <2.5s |
| FID | <100ms | <50ms |
| CLS | <0.1 | <0.05 |
| INP | <200ms | <150ms |

## Continuous Performance Monitoring

For production applications:

1. **Integrate Real User Monitoring (RUM)**
   - Use services like Sentry, DataDog, or New Relic
   - Track Core Web Vitals in production

2. **Set Performance Budgets**
   - Bundle size: <50KB
   - FPS: ≥55
   - Memory: <100MB

3. **Automated Testing**
   - Run Lighthouse in CI/CD
   - Fail builds if performance degrades

4. **Regular Audits**
   - Monthly performance reviews
   - Update baselines as framework evolves

## Conclusion

This performance test validates that CineView meets its performance requirements even with 25 complex scenes. Regular testing ensures the framework maintains high performance standards as new features are added.

For questions or issues, refer to the main CineView documentation or open an issue in the repository.
