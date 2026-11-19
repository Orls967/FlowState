import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Color, DirectionalLight, HemisphereLight, type Fog } from 'three';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { useSettings } from '../store/settings';
import { PRESETS, nightFactor, sunDirection } from './themePresets';
import { SceneContext, QUALITY, useSceneCtx, type SceneCtx } from './context';
import type { SimController } from './SimController';
import type { Network } from '../lib/sim/network';

export interface CityCanvasProps {
  bounds: Network['bounds'];
  /** controller simulasi (opsional — editor tanpa simulasi tidak punya) */
  controller?: SimController | null;
  /** jam tetap bila tidak ada simulasi */
  hour?: number;
  onGroundClick?: (x: number, y: number, e: ThreeEvent<MouseEvent>) => void;
  onGroundMove?: (x: number, y: number) => void;
  children?: ReactNode;
  /** kamera tampak atas (editor) */
  topDown?: boolean;
  className?: string;
  testId?: string;
}

function Ground({
  bounds,
  onClick,
  onMove,
}: {
  bounds: Network['bounds'];
  onClick?: CityCanvasProps['onGroundClick'];
  onMove?: CityCanvasProps['onGroundMove'];
}) {
  const { preset } = useSceneCtx();
  const w = bounds.maxX - bounds.minX + 1600;
  const h = bounds.maxY - bounds.minY + 1600;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const gridSize = Math.ceil(Math.max(w, h) / 50) * 50;
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, -0.05, -cy]}
        receiveShadow
        onClick={(e) => {
          if (!onClick || e.delta > 6) return;
          e.stopPropagation();
          onClick(e.point.x, -e.point.z, e);
        }}
        onPointerMove={onMove ? (e) => onMove(e.point.x, -e.point.z) : undefined}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={preset.ground} roughness={1} />
      </mesh>
      <gridHelper args={[gridSize, gridSize / 25, preset.grid, preset.grid]} position={[cx, -0.02, -cy]} />
    </group>
  );
}

/** Siang–malam: arah & intensitas matahari, langit, kabut, dan uniform malam bersama. */
function DayNight({ controller, hour }: { controller?: SimController | null; hour?: number }) {
  const { preset, night, quality } = useSceneCtx();
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const { scene } = useThree();
  const bgDay = useMemo(() => new Color(preset.background), [preset]);
  const bgNight = useMemo(() => new Color(preset.background).lerp(new Color('#050810'), 0.55), [preset]);
  const tmp = useMemo(() => new Color(), []);
  useFrame(() => {
    const h = controller ? controller.hour() : (hour ?? 12);
    const nf = nightFactor(h);
    const n = preset.nightFloor + (preset.nightCeil - preset.nightFloor) * nf;
    night.value = n;
    const [x, y, z] = sunDirection(h);
    if (sun.current) {
      sun.current.position.set(x, y, z);
      sun.current.intensity = preset.sun * (1 - n * 0.8);
    }
    if (hemi.current) hemi.current.intensity = preset.ambient * (1 - n * 0.55);
    tmp.copy(bgDay).lerp(bgNight, n * (preset.nightFloor > 0 ? 0.3 : 0.6));
    if (scene.background instanceof Color) scene.background.copy(tmp);
    if (scene.fog) (scene.fog as Fog).color.copy(tmp);
  });
  const shadows = QUALITY[quality].shadows;
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', preset.ground, preset.ambient]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        intensity={preset.sun}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-900}
        shadow-camera-right={900}
        shadow-camera-top={900}
        shadow-camera-bottom={-900}
        shadow-camera-far={2000}
        shadow-bias={-0.0005}
      />
    </>
  );
}

/** Kamera: MapControls (sentuh: 1 jari geser, cubit zoom, 2 jari putar) + mode mengikuti kendaraan. */
function CameraRig({
  bounds,
  controller,
  topDown,
}: {
  bounds: Network['bounds'];
  controller?: SimController | null;
  topDown?: boolean;
}) {
  const controls = useRef<MapControlsImpl>(null);
  const { camera } = useThree();
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const span = Math.max(200, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const key = `${Math.round(cx)}:${Math.round(cy)}:${Math.round(span)}:${topDown ? 1 : 0}`;
  useEffect(() => {
    const dist = span * (topDown ? 1.45 : 0.42);
    if (topDown) camera.position.set(cx, dist, -cy + 0.01);
    else camera.position.set(cx + dist * 0.35, dist * 0.62, -cy + dist * 0.7);
    camera.far = Math.max(4000, span * 6);
    camera.updateProjectionMatrix();
    controls.current?.target.set(cx, 0, -cy);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useFrame((_, dt) => {
    const c = controller;
    const ctl = controls.current;
    if (!c || !ctl) return;
    const id = c.store.getState().followId;
    if (id === null) return;
    const p = c.positionOf(id);
    if (!p) return;
    const k = 1 - Math.exp(-dt * 4);
    const tx = p[0];
    const tz = -p[1];
    const dx = (tx - ctl.target.x) * k;
    const dz = (tz - ctl.target.z) * k;
    ctl.target.x += dx;
    ctl.target.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
    ctl.update();
  });
  return (
    <MapControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      maxPolarAngle={topDown ? 0.9 : 1.32}
      minDistance={25}
      maxDistance={span * 2.5}
      screenSpacePanning={false}
    />
  );
}

/** Pemantau FPS: turunkan kualitas otomatis bila perangkat kewalahan. */
function QualityMonitor() {
  const setAuto = useSettings((s) => s.setAutoQuality);
  const quality = useSettings((s) => s.quality);
  const acc = useRef({ t: 0, frames: 0, slow: 0, fast: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt;
    a.frames++;
    if (a.t < 2) return;
    const fps = a.frames / a.t;
    a.t = 0;
    a.frames = 0;
    if (document.hidden) return;
    if (fps < 30) a.slow++;
    else a.slow = 0;
    if (fps > 58) a.fast++;
    else a.fast = 0;
    if (a.slow >= 2) {
      a.slow = 0;
      if (quality === 'high') setAuto('medium');
      else if (quality === 'medium') setAuto('low');
    }
    if (a.fast >= 8 && quality === 'low') {
      a.fast = 0;
      setAuto('medium');
    }
  });
  return null;
}

export function CityCanvas({
  bounds,
  controller,
  hour,
  onGroundClick,
  onGroundMove,
  children,
  topDown,
  className,
  testId,
}: CityCanvasProps) {
  const theme = useSettings((s) => s.theme);
  const quality = useSettings((s) => s.quality);
  const preset = PRESETS[theme];
  const night = useMemo(() => ({ value: preset.nightFloor }), [preset]);
  const ctx: SceneCtx = useMemo(() => ({ preset, theme, quality, night }), [preset, theme, quality, night]);
  const q = QUALITY[quality];
  const span = Math.max(300, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  return (
    <div className={className ?? 'absolute inset-0'} data-testid={testId ?? 'city-canvas'}>
      <Canvas
        dpr={[1, q.dpr]}
        shadows={q.shadows}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
        camera={{ fov: 45, near: 2, far: 6000, position: [0, 600, 600] }}
        onCreated={({ gl }) => {
          gl.domElement.setAttribute('aria-label', '3D');
        }}
      >
        <SceneContext.Provider value={ctx}>
          <color attach="background" args={[preset.background]} />
          <fog attach="fog" args={[preset.fog, span * 1.2, span * 3.2]} />
          <DayNight controller={controller} hour={hour} />
          <Ground bounds={bounds} onClick={onGroundClick} onMove={onGroundMove} />
          <CameraRig bounds={bounds} controller={controller} topDown={topDown} />
          <QualityMonitor />
          {children}
          {q.bloom && theme === 'dark' && (
            <EffectComposer multisampling={0}>
              <Bloom intensity={0.6} luminanceThreshold={0.62} luminanceSmoothing={0.2} mipmapBlur />
            </EffectComposer>
          )}
        </SceneContext.Provider>
      </Canvas>
    </div>
  );
}
