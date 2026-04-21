import type { CSSProperties } from 'react';
import '../styles/PixelHacker.css';

export type SpriteState =
  | 'working'
  | 'idle'
  | 'error'
  | 'walking-right'
  | 'walking-left'
  | 'standing'
  | 'sleeping'
  | 'cooking';

interface PixelHackerProps {
  state: SpriteState;
  role?: string;
}

interface RolePalette {
  primary: string;
  secondary: string;
  highlight: string;
  visor: string;
  aura: string;
}

const ROLE_PALETTES: Record<string, RolePalette> = {
  dev: {
    primary: '#2cbcff',
    secondary: '#0f5c85',
    highlight: '#d4f8ff',
    visor: '#93fffa',
    aura: '#2cbcff55',
  },
  rev: {
    primary: '#ba87ff',
    secondary: '#56398a',
    highlight: '#f4ddff',
    visor: '#ffc992',
    aura: '#ba87ff55',
  },
  res: {
    primary: '#38d095',
    secondary: '#16614b',
    highlight: '#d2ffea',
    visor: '#93ffe7',
    aura: '#38d09555',
  },
  test: {
    primary: '#ffb14f',
    secondary: '#815129',
    highlight: '#ffedbf',
    visor: '#fff39c',
    aura: '#ffb14f55',
  },
};

function getPalette(role?: string): RolePalette {
  return ROLE_PALETTES[role ?? 'dev'] ?? ROLE_PALETTES.dev;
}

function variantForState(state: SpriteState): 'working' | 'idle' | 'error' | 'walking' | 'standing' | 'sleeping' | 'cooking' {
  if (state === 'walking-right' || state === 'walking-left') return 'walking';
  return state;
}

export default function PixelHacker({ state, role }: PixelHackerProps) {
  const palette = getPalette(role);
  const variant = variantForState(state);
  const direction = state === 'walking-left' ? 'left' : 'right';
  const showCooktop = state === 'cooking' || state === 'working';
  const showPod = state === 'sleeping' || state === 'idle';
  const showAlert = state === 'error';
  const style = {
    '--avatar-primary': palette.primary,
    '--avatar-secondary': palette.secondary,
    '--avatar-highlight': palette.highlight,
    '--avatar-visor': palette.visor,
    '--avatar-aura': palette.aura,
  } as CSSProperties;

  return (
    <div className={`hacker-avatar hacker-avatar--${variant}`} data-direction={direction} style={style}>
      <div className="hacker-avatar__glow" aria-hidden="true" />

      {showCooktop ? (
        <div className="hacker-avatar__cooktop" aria-hidden="true">
          <span className="hacker-avatar__cooktop-base" />
          <span className="hacker-avatar__cooktop-ring" />
          <span className="hacker-avatar__cooktop-ring hacker-avatar__cooktop-ring--secondary" />
          <span className="hacker-avatar__pan" />
          <span className="hacker-avatar__pan-handle" />
          <span className="hacker-avatar__flame hacker-avatar__flame--one" />
          <span className="hacker-avatar__flame hacker-avatar__flame--two" />
          <span className="hacker-avatar__flame hacker-avatar__flame--three" />
          <span className="hacker-avatar__steam hacker-avatar__steam--one" />
          <span className="hacker-avatar__steam hacker-avatar__steam--two" />
        </div>
      ) : null}

      {showPod ? (
        <div className="hacker-avatar__pod" aria-hidden="true">
          <span className="hacker-avatar__pod-shell" />
          <span className="hacker-avatar__pod-mattress" />
          <span className="hacker-avatar__pod-pillow" />
          <span className="hacker-avatar__pod-glow" />
        </div>
      ) : null}

      {showAlert ? (
        <>
          <div className="hacker-avatar__alarm-ring" aria-hidden="true" />
          <div className="hacker-avatar__warning" aria-hidden="true">
            <span className="hacker-avatar__warning-bar" />
            <span className="hacker-avatar__warning-dot" />
          </div>
        </>
      ) : null}

      <div className="hacker-avatar__figure" aria-hidden="true">
        <div className="hacker-avatar__silhouette">
          <div className="hacker-avatar__hood" />
          <div className="hacker-avatar__head">
            <div className="hacker-avatar__visor">
              <span className="hacker-avatar__eye hacker-avatar__eye--left" />
              <span className="hacker-avatar__eye hacker-avatar__eye--right" />
            </div>
          </div>
          <div className="hacker-avatar__torso">
            <span className="hacker-avatar__core-light" />
            <span className="hacker-avatar__panel-line" />
          </div>
          <div className="hacker-avatar__arm hacker-avatar__arm--left">
            <span className="hacker-avatar__forearm" />
          </div>
          <div className="hacker-avatar__arm hacker-avatar__arm--right">
            <span className="hacker-avatar__forearm" />
          </div>
          <div className="hacker-avatar__leg hacker-avatar__leg--left">
            <span className="hacker-avatar__calf" />
          </div>
          <div className="hacker-avatar__leg hacker-avatar__leg--right">
            <span className="hacker-avatar__calf" />
          </div>
        </div>
      </div>

      {state === 'sleeping' || state === 'idle' ? (
        <div className="hacker-avatar__zzz-stack" aria-hidden="true">
          <span className="hacker-avatar__zzz hacker-avatar__zzz--one">z</span>
          <span className="hacker-avatar__zzz hacker-avatar__zzz--two">z</span>
          <span className="hacker-avatar__zzz hacker-avatar__zzz--three">z</span>
        </div>
      ) : null}
    </div>
  );
}
