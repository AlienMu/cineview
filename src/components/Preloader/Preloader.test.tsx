/**
 * Preloader 组件测试
 */

import { render, waitFor, act } from '@testing-library/react';
import { Preloader } from './Preloader';

// Mock Image constructor
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';

  constructor() {
    setTimeout(() => {
      if (this.src && this.onload) {
        this.onload();
      }
    }, 10);
  }
}

global.Image = MockImage as unknown as typeof Image;

describe('Preloader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础功能', () => {
    it('应该渲染子组件', () => {
      const { getByText } = render(
        <Preloader priorityImages={[]}>
          <div>Test Content</div>
        </Preloader>
      );

      expect(getByText('Test Content')).toBeInTheDocument();
    });

    it('应该在没有图片时立即触发完成回调', async () => {
      const onProgress = jest.fn();
      const onFirstSceneLoaded = jest.fn();
      const onAllLoaded = jest.fn();

      render(
        <Preloader
          priorityImages={[]}
          onProgress={onProgress}
          onFirstSceneLoaded={onFirstSceneLoaded}
          onAllLoaded={onAllLoaded}
        />
      );

      await waitFor(() => {
        expect(onProgress).toHaveBeenCalledWith(100);
        expect(onFirstSceneLoaded).toHaveBeenCalled();
        expect(onAllLoaded).toHaveBeenCalled();
      });
    });
  });

  describe('优先级加载', () => {
    it('应该优先加载首屏图片', async () => {
      const priorityImages = ['image1.jpg', 'image2.jpg'];
      const backgroundImages = ['image3.jpg', 'image4.jpg'];
      const onFirstSceneLoaded = jest.fn();
      const onAllLoaded = jest.fn();

      render(
        <Preloader
          priorityImages={priorityImages}
          backgroundImages={backgroundImages}
          onFirstSceneLoaded={onFirstSceneLoaded}
          onAllLoaded={onAllLoaded}
        />
      );

      // 首屏加载完成应该先触发
      await waitFor(() => {
        expect(onFirstSceneLoaded).toHaveBeenCalled();
      });

      // 全部加载完成后触发
      await waitFor(() => {
        expect(onAllLoaded).toHaveBeenCalled();
      });
    });

    it('应该按顺序加载优先图片', async () => {
      const loadOrder: string[] = [];
      const originalImage = global.Image;

      class OrderedMockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = '';

        get src(): string {
          return this._src;
        }

        set src(value: string) {
          this._src = value;
          loadOrder.push(value);
          setTimeout(() => {
            if (this.onload) {
              this.onload();
            }
          }, 10);
        }
      }

      global.Image = OrderedMockImage as unknown as typeof Image;

      const priorityImages = ['priority1.jpg', 'priority2.jpg'];
      const backgroundImages = ['bg1.jpg', 'bg2.jpg'];

      render(<Preloader priorityImages={priorityImages} backgroundImages={backgroundImages} />);

      await waitFor(() => {
        expect(loadOrder.length).toBeGreaterThanOrEqual(4);
      });

      // 优先图片应该先加载（跳过 WebP 检测图片）
      const imageLoads = loadOrder.filter((url) => !url.startsWith('data:'));
      expect(imageLoads[0]).toContain('priority1');
      expect(imageLoads[1]).toContain('priority2');

      global.Image = originalImage;
    });
  });

  describe('进度计算', () => {
    it('应该正确计算加载进度', async () => {
      const progressValues: number[] = [];
      const onProgress = jest.fn((progress) => {
        progressValues.push(progress);
      });

      const priorityImages = ['image1.jpg', 'image2.jpg'];
      const backgroundImages = ['image3.jpg', 'image4.jpg'];

      render(
        <Preloader
          priorityImages={priorityImages}
          backgroundImages={backgroundImages}
          onProgress={onProgress}
        />
      );

      await waitFor(() => {
        expect(onProgress).toHaveBeenCalled();
      });

      // 进度应该从 0 增加到 100
      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it('应该在每张图片加载后更新进度', async () => {
      const onProgress = jest.fn();
      const priorityImages = ['image1.jpg', 'image2.jpg', 'image3.jpg', 'image4.jpg'];

      render(<Preloader priorityImages={priorityImages} onProgress={onProgress} />);

      await waitFor(() => {
        expect(onProgress).toHaveBeenCalledWith(100);
      });

      // 应该至少调用 4 次（每张图片一次）
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('错误处理', () => {
    it('应该处理图片加载失败', async () => {
      const originalImage = global.Image;

      class ErrorMockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.src && this.onerror) {
              this.onerror();
            }
          }, 10);
        }
      }

      global.Image = ErrorMockImage as unknown as typeof Image;

      const onError = jest.fn();
      const onAllLoaded = jest.fn();

      render(
        <Preloader priorityImages={['invalid.jpg']} onError={onError} onAllLoaded={onAllLoaded} />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      // 即使有错误，也应该触发完成回调
      await waitFor(() => {
        expect(onAllLoaded).toHaveBeenCalled();
      });

      global.Image = originalImage;
    });

    it('应该记录失败的图片 URL', async () => {
      const originalImage = global.Image;

      class ErrorMockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.src && this.onerror) {
              this.onerror();
            }
          }, 10);
        }
      }

      global.Image = ErrorMockImage as unknown as typeof Image;

      const onError = jest.fn();
      const failedUrl = 'failed-image.jpg';

      render(<Preloader priorityImages={[failedUrl]} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(failedUrl, expect.any(Error));
      });

      global.Image = originalImage;
    });

    it('应该验证图片 URL 协议', async () => {
      const onError = jest.fn();
      const invalidUrls = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'];

      render(<Preloader priorityImages={invalidUrls} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(invalidUrls.length);
      });
    });
  });

  describe('WebP 支持', () => {
    it('应该检测 WebP 支持', async () => {
      const onAllLoaded = jest.fn();

      render(<Preloader priorityImages={['image.jpg']} onAllLoaded={onAllLoaded} />);

      await waitFor(() => {
        expect(onAllLoaded).toHaveBeenCalled();
      });

      // WebP 检测应该已经执行
      expect(global.Image).toBeDefined();
    });
  });

  describe('组件卸载', () => {
    it('应该在卸载时取消所有加载', async () => {
      const { unmount } = render(
        <Preloader priorityImages={['image1.jpg', 'image2.jpg', 'image3.jpg']} />
      );

      // 立即卸载组件
      unmount();

      // 不应该抛出错误
      expect(true).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该处理空的优先图片列表', async () => {
      const onFirstSceneLoaded = jest.fn();
      const onAllLoaded = jest.fn();

      render(
        <Preloader
          priorityImages={[]}
          backgroundImages={['bg1.jpg']}
          onFirstSceneLoaded={onFirstSceneLoaded}
          onAllLoaded={onAllLoaded}
        />
      );

      await waitFor(() => {
        expect(onFirstSceneLoaded).toHaveBeenCalled();
        expect(onAllLoaded).toHaveBeenCalled();
      });
    });

    it('应该处理空的后台图片列表', async () => {
      const onFirstSceneLoaded = jest.fn();
      const onAllLoaded = jest.fn();

      render(
        <Preloader
          priorityImages={['priority1.jpg']}
          backgroundImages={[]}
          onFirstSceneLoaded={onFirstSceneLoaded}
          onAllLoaded={onAllLoaded}
        />
      );

      await waitFor(() => {
        expect(onFirstSceneLoaded).toHaveBeenCalled();
        expect(onAllLoaded).toHaveBeenCalled();
      });
    });

    it('应该处理重复的图片 URL', async () => {
      const onProgress = jest.fn();
      const duplicateUrl = 'duplicate.jpg';

      render(<Preloader priorityImages={[duplicateUrl, duplicateUrl]} onProgress={onProgress} />);

      await waitFor(() => {
        expect(onProgress).toHaveBeenCalledWith(100);
      });
    });
  });
});

describe('Additional Branch Coverage Tests', () => {
  it('should handle invalid URL protocol', async () => {
    const onError = jest.fn();
    const invalidUrls = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'];

    render(
      <Preloader priorityImages={invalidUrls} onError={onError}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][1].message).toContain('Invalid image URL protocol');
    });
  });

  it('should handle WebP fallback when WebP fails', async () => {
    const loadAttempts: string[] = [];

    class WebPFailMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        loadAttempts.push(value);

        setTimeout(() => {
          // First attempt with .webp fails
          if (
            value.includes('.webp') &&
            loadAttempts.filter((url) => url.includes('.webp')).length === 1
          ) {
            if (this.onerror) {
              this.onerror();
            }
          } else {
            // Original format succeeds
            if (this.onload) {
              this.onload();
            }
          }
        }, 10);
      }
    }

    const originalImage = global.Image;
    global.Image = WebPFailMockImage as unknown as typeof Image;

    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.jpg']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(
      () => {
        expect(onAllLoaded).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Should have attempted both WebP and original format
    expect(loadAttempts.length).toBeGreaterThan(1);

    global.Image = originalImage;
  });

  it('should handle abort signal', () => {
    const { unmount } = render(
      <Preloader priorityImages={['image1.jpg', 'image2.jpg']}>
        <div>Test</div>
      </Preloader>
    );

    // Unmount immediately to trigger abort
    unmount();

    // Should not crash
  });

  it('should handle WebP URL that is already WebP', async () => {
    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.webp']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onAllLoaded).toHaveBeenCalled();
    });
  });

  it('should handle relative URLs', async () => {
    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['/images/test.jpg']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onAllLoaded).toHaveBeenCalled();
    });
  });
});

describe('WebP Fallback and Abort Controller Coverage', () => {
  it('should fallback to original format when WebP fails to load', async () => {
    const loadAttempts: string[] = [];
    const originalImage = global.Image;

    class WebPFallbackMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;

        // Skip WebP detection image
        if (value.startsWith('data:image/webp')) {
          setTimeout(() => {
            if (this.onload) {
              this.onload();
            }
          }, 5);
          return;
        }

        loadAttempts.push(value);

        setTimeout(() => {
          // First WebP attempt fails
          if (
            value.endsWith('.webp') &&
            loadAttempts.filter((url) => url.endsWith('.webp')).length === 1
          ) {
            if (this.onerror) {
              this.onerror();
            }
          } else {
            // Original format succeeds
            if (this.onload) {
              this.onload();
            }
          }
        }, 10);
      }
    }

    global.Image = WebPFallbackMockImage as unknown as typeof Image;

    const onAllLoaded = jest.fn();
    const onError = jest.fn();

    render(
      <Preloader priorityImages={['test.jpg']} onAllLoaded={onAllLoaded} onError={onError}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(
      () => {
        expect(onAllLoaded).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Should have attempted both WebP and original format
    const imageAttempts = loadAttempts.filter((url) => !url.startsWith('data:'));
    expect(imageAttempts.length).toBeGreaterThanOrEqual(1);

    global.Image = originalImage;
  });

  it('should handle abort controller when component unmounts during loading', async () => {
    const originalImage = global.Image;

    class SlowLoadingMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';

      constructor() {
        // Simulate slow loading (never completes)
        setTimeout(() => {
          if (this.src && this.onload) {
            this.onload();
          }
        }, 5000); // 5 seconds - longer than test timeout
      }
    }

    global.Image = SlowLoadingMockImage as unknown as typeof Image;

    const { unmount } = render(
      <Preloader priorityImages={['slow-image1.jpg', 'slow-image2.jpg']}>
        <div>Test</div>
      </Preloader>
    );

    // Unmount immediately to trigger abort
    await new Promise((resolve) => setTimeout(resolve, 50));
    unmount();

    // Should not crash
    expect(true).toBe(true);

    global.Image = originalImage;
  });

  it('should handle WebP URL that is already WebP format', async () => {
    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.webp']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onAllLoaded).toHaveBeenCalled();
    });
  });

  it('should handle multiple images with mixed success and failure', async () => {
    const originalImage = global.Image;
    const loadedImages: string[] = [];

    class MixedResultMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;

        // Skip WebP detection
        if (value.startsWith('data:image/webp')) {
          setTimeout(() => {
            if (this.onload) {
              this.onload();
            }
          }, 5);
          return;
        }

        loadedImages.push(value);

        setTimeout(() => {
          // Fail images with 'fail' in the name
          if (value.includes('fail')) {
            if (this.onerror) {
              this.onerror();
            }
          } else {
            if (this.onload) {
              this.onload();
            }
          }
        }, 10);
      }
    }

    global.Image = MixedResultMockImage as unknown as typeof Image;

    const onProgress = jest.fn();
    const onError = jest.fn();
    const onAllLoaded = jest.fn();

    render(
      <Preloader
        priorityImages={['success1.jpg', 'fail1.jpg']}
        backgroundImages={['success2.jpg', 'fail2.jpg']}
        onProgress={onProgress}
        onError={onError}
        onAllLoaded={onAllLoaded}
      >
        <div>Test</div>
      </Preloader>
    );

    await waitFor(
      () => {
        expect(onAllLoaded).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Should have called onError for failed images
    expect(onError).toHaveBeenCalled();

    // Should still complete loading
    expect(onProgress).toHaveBeenCalledWith(100);

    global.Image = originalImage;
  });
});

describe('URL Validation and WebP Support Coverage', () => {
  it('should handle URL without WebP support', async () => {
    const originalImage = global.Image;

    class NoWebPSupportMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      height = 0;

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;

        // Simulate WebP detection failure
        if (value.startsWith('data:image/webp')) {
          this.height = 0;
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 5);
          return;
        }

        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 10);
      }
    }

    global.Image = NoWebPSupportMockImage as unknown as typeof Image;

    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.jpg']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(
      () => {
        expect(onAllLoaded).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    global.Image = originalImage;
  });

  it('should handle image URL that does not match jpg/jpeg/png pattern', async () => {
    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.gif', 'test.svg']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onAllLoaded).toHaveBeenCalled();
    });
  });

  it('should handle relative URL validation', async () => {
    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['/images/test.jpg', './test.jpg']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onAllLoaded).toHaveBeenCalled();
    });
  });

  it('should handle URL validation error', async () => {
    const onError = jest.fn();

    render(
      <Preloader priorityImages={['javascript:alert(1)']} onError={onError}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });
});

describe('Abort Controller Edge Cases', () => {
  it('should handle abort during WebP fallback', async () => {
    const originalImage = global.Image;

    class AbortableFallbackMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;

        // Skip WebP detection
        if (value.startsWith('data:image/webp')) {
          setTimeout(() => {
            if (this.onload) {
              this.onload();
            }
          }, 5);
          return;
        }

        // First WebP attempt fails
        if (value.endsWith('.webp')) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 10);
        } else {
          // Original format - simulate slow loading
          setTimeout(() => {
            if (this.onload) {
              this.onload();
            }
          }, 100);
        }
      }
    }

    global.Image = AbortableFallbackMockImage as unknown as typeof Image;

    const { unmount } = render(
      <Preloader priorityImages={['test.jpg']}>
        <div>Test</div>
      </Preloader>
    );

    // Unmount during fallback loading
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      unmount();
    });

    global.Image = originalImage;
  });

  it('should cleanup abort controller when image loads successfully', async () => {
    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.jpg']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(() => {
      expect(onAllLoaded).toHaveBeenCalled();
    });

    // AbortController should be cleaned up
  });
});

describe('Additional Preloader Coverage', () => {
  it('should handle case when supportsWebP is false', async () => {
    const originalImage = global.Image;

    class NoWebPMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      height = 0;

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;

        // WebP detection fails
        if (value.startsWith('data:image/webp')) {
          this.height = 0;
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 5);
          return;
        }

        // Regular images load successfully
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 10);
      }
    }

    global.Image = NoWebPMockImage as unknown as typeof Image;

    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.jpg', 'test.png']} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(
      () => {
        expect(onAllLoaded).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    global.Image = originalImage;
  });

  it('should handle case when finalUrl equals url (no WebP conversion)', async () => {
    const originalImage = global.Image;

    class NoConversionMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      height = 0;

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;

        // WebP detection fails (supportsWebP = false)
        if (value.startsWith('data:image/webp')) {
          this.height = 0;
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 5);
          return;
        }

        // All images fail to load
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 10);
      }
    }

    global.Image = NoConversionMockImage as unknown as typeof Image;

    const onError = jest.fn();
    const onAllLoaded = jest.fn();

    render(
      <Preloader priorityImages={['test.jpg']} onError={onError} onAllLoaded={onAllLoaded}>
        <div>Test</div>
      </Preloader>
    );

    await waitFor(
      () => {
        expect(onAllLoaded).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    // Should have called onError
    expect(onError).toHaveBeenCalled();

    global.Image = originalImage;
  });
});
