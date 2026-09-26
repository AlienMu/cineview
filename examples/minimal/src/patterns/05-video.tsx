/** Video progress follows a 2000px scroll zone. Supply a seekable local video URL. */
import { AnimateVideo, Cineview, Scene } from 'cineview';

export function VideoScrubbing({ src = '/video.mp4' }: { src?: string }) {
  return (
    <Cineview mode="scroll">
      <Scene layout={{ height: '100vh' }}>
        <h2>Scroll down to control the video</h2>
      </Scene>
      <Scene
        layout={{ height: '100vh' }}
        scroll={{ zoneId: 'video-scrub' }}
        assets={{ preloadImages: [src] }}
      >
        <AnimateVideo
          src={src}
          aria-label="Scroll-controlled video"
          duration={{ enter: 2000 }}
          width="100%"
          height="100vh"
          style={{ objectFit: 'contain', background: '#000' }}
        />
      </Scene>
      <Scene layout={{ height: '100vh' }}>
        <h2>Scroll up to replay</h2>
      </Scene>
    </Cineview>
  );
}
