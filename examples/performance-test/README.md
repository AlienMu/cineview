# CineView Performance Test Application

This is a performance testing application for the CineView framework, featuring 25 scenes with complex animations and real-time performance monitoring.

## Features

- **25 Scenes**: Tests framework performance with a large number of scenes
- **Real-time Performance Monitoring**: Displays FPS, frame time, memory usage, and bundle size
- **Various Animations**: Tests all animation types including infinite animations
- **Scene Navigation**: Quick navigation between scenes for testing
- **Performance Mode**: Enabled by default for optimal performance
- **Virtualization**: Only renders current scene and adjacent scenes

## Performance Metrics

The application monitors the following metrics:

- **FPS (Frames Per Second)**: Target is 60 FPS
  - 🟢 Good: ≥55 FPS
  - 🟡 Warning: 30-54 FPS
  - 🔴 Poor: <30 FPS

- **Frame Time**: Target is ≤16.67ms (60 FPS)
  - 🟢 Good: ≤16.67ms
  - 🟡 Warning: 16.67-33.33ms
  - 🔴 Poor: >33.33ms

- **Memory Usage**: Monitored if available
  - 🟢 Good: <50MB
  - 🟡 Warning: 50-100MB
  - 🔴 Poor: >100MB

- **Bundle Size**: Framework bundle size in KB

## Requirements Validated

This performance test validates the following requirements:

- **Requirement 14.10**: Animation frame rate should maintain 60fps
- **Requirement 16.1**: Collect current FPS metrics
- **Requirement 16.2**: Collect average frame time metrics
- **Requirement 16.3**: Collect memory usage metrics

## Getting Started

### Installation

```bash
cd examples/performance-test
pnpm install
```

### Development

```bash
pnpm dev
```

This will start the development server at http://localhost:3000

### Build

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm preview
```

### Run Lighthouse Performance Test

```bash
pnpm lighthouse
```

This will:
1. Build the production version
2. Start the preview server
3. Run Lighthouse performance audit
4. Generate and open the report

## Performance Testing Guidelines

### Manual Testing

1. **Initial Load**: Check FPS and frame time on first scene
2. **Scene Transitions**: Navigate through all scenes and monitor performance
3. **Animation Smoothness**: Observe if animations are smooth (60 FPS)
4. **Memory Usage**: Check if memory usage stays stable over time
5. **Rapid Navigation**: Quickly switch between scenes to test performance under stress

### Automated Testing

Use the Lighthouse script to get automated performance metrics:

```bash
pnpm lighthouse
```

Target Lighthouse scores (Requirement 17.1):
- Performance: ≥95
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1
- INP (Interaction to Next Paint): <200ms

## Scene Configuration

Each scene includes:
- Unique gradient background
- Scene title with fade-in animation
- Description with slide-up animation
- 3-7 animated elements with various animations
- Some scenes include infinite animations (pulse, heartbeat, etc.)
- Different enter/exit animations for variety

## Performance Optimizations Tested

1. **Virtualization**: Only 3 scenes rendered at a time (current + adjacent)
2. **Performance Mode**: Aggressive optimizations enabled
3. **Animation Optimization**: GPU-accelerated transforms and opacity
4. **Event Throttling**: Scroll events throttled to 16ms
5. **Memory Management**: Proper cleanup of event listeners and animations

## Troubleshooting

### Low FPS

If FPS is consistently below 60:
- Check if hardware acceleration is enabled in browser
- Close other tabs and applications
- Try disabling browser extensions
- Check if running on integrated vs dedicated GPU

### High Memory Usage

If memory usage is high:
- Check browser DevTools Memory profiler
- Look for memory leaks in console
- Verify event listeners are being cleaned up

### Build Issues

If build fails:
- Ensure you're in the correct directory
- Run `pnpm install` to install dependencies
- Check that parent CineView package is built

## Notes

- This is a development/testing application, not meant for production use
- Performance metrics are approximate and may vary by device
- Some browsers may not support all Performance API features
- Memory usage metric may not be available in all browsers
