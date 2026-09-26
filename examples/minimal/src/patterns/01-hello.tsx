/**
 * Pattern 01: Absolute Minimum
 *
 * The smallest possible Cineview setup — one container, one scene, zero animations.
 * Use this when you just need to understand the scene container concept.
 *
 * Key concepts:
 * - designWidth: Your design mockup's width (scales automatically to viewport)
 * - Scene: A single scrollable/draggable unit (like a slide or chapter)
 */

import { Cineview, Scene } from 'cineview';

export function HelloCineview() {
  return (
    <Cineview designWidth={750}>
      <Scene>
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <h1>Hello Cineview</h1>
        </div>
      </Scene>
    </Cineview>
  );
}

// Numeric Cineview layout props use designWidth. Ordinary CSS keeps its CSS units.
