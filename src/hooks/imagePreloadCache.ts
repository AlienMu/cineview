const preloadedImageUrls = new Set<string>();
const preloadedImageListeners = new Set<(url: string) => void>();

export function markImageAsPreloaded(url: string): void {
  if (!url) {
    return;
  }

  const hadUrl = preloadedImageUrls.has(url);
  preloadedImageUrls.add(url);
  if (!hadUrl) {
    preloadedImageListeners.forEach((listener) => listener(url));
  }
}

export function isImagePreloaded(url: string): boolean {
  return url.length > 0 && preloadedImageUrls.has(url);
}

export function subscribeToPreloadedImages(listener: (url: string) => void): () => void {
  preloadedImageListeners.add(listener);
  return () => {
    preloadedImageListeners.delete(listener);
  };
}

export function resetPreloadedImageCache(): void {
  preloadedImageUrls.clear();
  preloadedImageListeners.clear();
}
