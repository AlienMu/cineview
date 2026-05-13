// 测试智能阈值算法
function calculateThreshold(velocity) {
  const MIN_VELOCITY = 0;
  const MAX_VELOCITY = 1000;
  const MIN_THRESHOLD = 0.15;  // 快速滑动阈值
  const MAX_THRESHOLD = 0.3;   // 慢速滑动阈值
  
  // 限制速度范围
  const clampedVelocity = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity));
  
  // 线性插值：速度越快，阈值越低
  const threshold = MAX_THRESHOLD - 
    (clampedVelocity / MAX_VELOCITY) * (MAX_THRESHOLD - MIN_THRESHOLD);
  
  return threshold;
}

console.log('智能阈值测试：');
console.log('================');
console.log(`速度 0 px/s (极慢): ${(calculateThreshold(0) * 100).toFixed(1)}%`);
console.log(`速度 200 px/s (慢): ${(calculateThreshold(200) * 100).toFixed(1)}%`);
console.log(`速度 400 px/s (中慢): ${(calculateThreshold(400) * 100).toFixed(1)}%`);
console.log(`速度 600 px/s (中快): ${(calculateThreshold(600) * 100).toFixed(1)}%`);
console.log(`速度 800 px/s (快): ${(calculateThreshold(800) * 100).toFixed(1)}%`);
console.log(`速度 1000 px/s (极快): ${(calculateThreshold(1000) * 100).toFixed(1)}%`);
console.log(`速度 1500 px/s (超快): ${(calculateThreshold(1500) * 100).toFixed(1)}%`);
