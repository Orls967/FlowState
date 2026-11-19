import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { useFrame } from '@react-three/fiber';
import type { CityDoc } from '../lib/city/schema';
import type { Network } from '../lib/sim/network';
import { BUILDING_STRIDE, type Decor } from '../lib/city/decor';
import { buildRoadGeometry } from './roadGeometry';
import { useSceneCtx } from './context';
import { Rng } from '../lib/sim/rng';

/** Tulis matriks rotasi-Y + skala + translasi langsung ke larik instance (lebih cepat dari Object3D). */
export function writeMatrix(
  arr: Float32Array | number[],
  i: number,
  x: number,
  y: number,
  z: number,
  h: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const c = Math.cos(h);
  const s = Math.sin(h);
  const o = i * 16;
  arr[o] = c * sx;
  arr[o + 1] = 0;
  arr[o + 2] = -s * sx;
  arr[o + 3] = 0;
  arr[o + 4] = 0;
  arr[o + 5] = sy;
  arr[o + 6] = 0;
  arr[o + 7] = 0;
  arr[o + 8] = s * sz;
  arr[o + 9] = 0;
  arr[o + 10] = c * sz;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}

function Roads({ doc, net, decor }: { doc: CityDoc; net: Network; decor: Decor | null }) {
  const { preset, theme } = useSceneCtx();
  const geo = useMemo(() => buildRoadGeometry(doc, net, decor, preset), [doc, net, decor, preset]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} receiveShadow>
      {theme === 'dark' ? (
        // malam: jalan tampil seperti peta bercahaya redup, tidak bergantung pencahayaan
        <meshBasicMaterial vertexColors side={DoubleSide} />
      ) : (
        <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.95} metalness={0} />
      )}
    </mesh>
  );
}

/** Material gedung dengan pola jendela menyala yang dihitung di shader dari posisi dunia. */
function useBuildingMaterial(): MeshStandardMaterial {
  const { night, preset } = useSceneCtx();
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
    const glow = { value: new Color(preset.windowGlow) };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = night;
      shader.uniforms.uGlow = glow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFsPos;\nvarying float vFsNy;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 fsW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fsW = instanceMatrix * fsW;
          #endif
          vFsPos = (modelMatrix * fsW).xyz;
          vFsNy = abs(normal.y);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vFsPos;\nvarying float vFsNy;\nuniform float uNight;\nuniform vec3 uGlow;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          if (vFsNy < 0.5 && vFsPos.y > 2.6) {
            float fy = fract(vFsPos.y / 3.4);
            float fx = fract((vFsPos.x + vFsPos.z) / 2.9);
            float win = step(0.32, fy) * step(fy, 0.78) * step(0.22, fx) * step(fx, 0.78);
            vec2 cell = floor(vec2((vFsPos.x + vFsPos.z) / 2.9, vFsPos.y / 3.4));
            float lit = step(0.66, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.8, win);
            totalEmissiveRadiance += uGlow * win * lit * uNight * 1.1;
          }`,
        );
    };
    return m;
  }, [night, preset]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

function Buildings({ decor, seed }: { decor: Decor; seed: number }) {
  const { preset } = useSceneCtx();
  const ref = useRef<InstancedMesh>(null);
  const mat = useBuildingMaterial();
  const geo = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const count = decor.buildings.length / BUILDING_STRIDE;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const b = decor.buildings;
    const rng = new Rng(seed);
    const col = new Color();
    const arr = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const o = i * BUILDING_STRIDE;
      writeMatrix(arr, i, b[o], 0, -b[o + 1], b[o + 2], b[o + 3], b[o + 5], b[o + 4]);
      const kind = b[o + 6];
      col.set(preset.buildings[(kind + rng.int(3)) % preset.buildings.length]);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [decor, count, preset, seed]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!count) return null;
  return <instancedMesh key={count} ref={ref} args={[geo, mat, count]} castShadow receiveShadow />;
}

function Trees({ decor }: { decor: Decor }) {
  const { preset } = useSceneCtx();
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new ConeGeometry(2.4, 7, 6).translate(0, 4.5, 0), []);
  const count = decor.trees.length / 3;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = decor.trees;
    const arr = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < count; i++)
      writeMatrix(arr, i, t[i * 3], 0, -t[i * 3 + 1], i * 0.7, t[i * 3 + 2], t[i * 3 + 2], t[i * 3 + 2]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [decor, count]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!count) return null;
  return (
    <instancedMesh key={count} ref={ref} args={[geo, undefined, count]} castShadow>
      <meshStandardMaterial color={preset.tree} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Lampu jalan: bola bercahaya + genangan cahaya di aspal (hanya terlihat saat malam). */
function StreetLights({ decor }: { decor: Decor }) {
  const { preset, night } = useSceneCtx();
  const heads = useRef<InstancedMesh>(null);
  const poles = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);
  const count = decor.lights.length / 2;
  const headGeo = useMemo(() => new SphereGeometry(0.45, 8, 6), []);
  const poleGeo = useMemo(() => new CylinderGeometry(0.12, 0.15, 7, 5).translate(0, 3.5, 0), []);
  const poolGeo = useMemo(() => new CylinderGeometry(7, 7, 0.02, 16), []);
  useLayoutEffect(() => {
    const l = decor.lights;
    for (const [ref, y] of [
      [heads, 7.2],
      [poles, 0],
      [pools, 0.21],
    ] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      const arr = mesh.instanceMatrix.array as Float32Array;
      for (let i = 0; i < count; i++) writeMatrix(arr, i, l[i * 2], y, -l[i * 2 + 1], 0, 1, 1, 1);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [decor, count]);
  const headMat = useMemo(
    () => new MeshStandardMaterial({ color: '#222', emissive: preset.streetLight, emissiveIntensity: 0 }),
    [preset],
  );
  const poolMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#000',
        emissive: preset.streetLight,
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [preset],
  );
  useFrame(() => {
    headMat.emissiveIntensity = night.value * 3;
    poolMat.emissiveIntensity = night.value * 0.35;
    poolMat.opacity = night.value * 0.14;
    poolMat.visible = night.value > 0.05;
  });
  if (!count) return null;
  return (
    <group>
      <instancedMesh key={`p${count}`} ref={poles} args={[poleGeo, undefined, count]}>
        <meshStandardMaterial color={preset.streetLight} roughness={0.6} />
      </instancedMesh>
      <instancedMesh key={`h${count}`} ref={heads} args={[headGeo, headMat, count]} />
      <instancedMesh key={`l${count}`} ref={pools} args={[poolGeo, poolMat, count]} />
    </group>
  );
}

export function StaticCity({ doc, net, decor }: { doc: CityDoc; net: Network; decor: Decor | null }) {
  return (
    <group>
      <Roads doc={doc} net={net} decor={decor} />
      {decor && <Buildings decor={decor} seed={doc.seed ?? 1} />}
      {decor && <Trees decor={decor} />}
      {decor && <StreetLights decor={decor} />}
    </group>
  );
}
