import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Frustum,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  Sphere,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRAME_STRIDE } from '../lib/sim/engine';
import type { Network } from '../lib/sim/network';
import { Router } from '../lib/sim/routing';
import type { CityDoc } from '../lib/city/schema';
import type { SimController } from './SimController';
import { useSim } from './SimController';
import { useSceneCtx, QUALITY } from './context';
import { densityScale } from './themePresets';
import { writeMatrix } from './StaticCity';
import { linkLanePolyline } from './roadGeometry';

const CAP = 3200;

function box(w: number, h: number, d: number, x: number, y: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, 0);
  return g;
}

/** Geometri low-poly per jenis kendaraan (sumbu +x = depan). */
function vehicleGeometries(): BufferGeometry[] {
  const car = mergeGeometries([box(4.4, 0.85, 1.8, 0, 0.25), box(2.3, 0.65, 1.6, -0.25, 1.1)])!;
  const moto = mergeGeometries([box(1.9, 0.6, 0.55, 0, 0.3), box(0.45, 0.85, 0.45, -0.2, 0.9)])!;
  const bus = mergeGeometries([box(11.8, 2.6, 2.5, 0, 0.35)])!;
  const truck = mergeGeometries([box(2.2, 2.2, 2.3, 3.7, 0.35), box(7.4, 2.9, 2.4, -1.1, 0.35)])!;
  return [car, moto, bus, truck];
}

const FAR_DIMS: [number, number, number][] = [
  [4.5, 1.6, 1.8],
  [2.0, 1.3, 0.8],
  [12, 3.0, 2.5],
  [10, 3.2, 2.4],
];

/** Kendaraan: InstancedMesh per jenis + interpolasi antar-tick + LOD (kotak sederhana di kejauhan) + culling frustum. */
export function Vehicles({ c }: { c: SimController }) {
  const { preset, quality, night } = useSceneCtx();
  const geos = useMemo(vehicleGeometries, []);
  const farGeo = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const lightGeo = useMemo(() => new BoxGeometry(0.25, 0.3, 1.4), []);
  const near = useRef<(InstancedMesh | null)[]>([]);
  const far = useRef<InstancedMesh>(null);
  const lights = useRef<InstancedMesh>(null);
  const tmp = useMemo(
    () => ({
      frustum: new Frustum(),
      m: new Matrix4(),
      sphere: new Sphere(new Vector3(), 7),
      col: new Color(),
    }),
    [],
  );
  const palette = useMemo(() => preset.vehicle.map((h) => new Color(h)), [preset]);
  const busCol = useMemo(() => new Color(preset.bus), [preset]);
  const truckCol = useMemo(() => new Color(preset.truck), [preset]);
  const head = useMemo(() => new Color('#fff3c4'), []);
  const tail = useMemo(() => new Color('#ff3b2f'), []);
  const tailDim = useMemo(() => new Color('#7a1610'), []);
  useEffect(() => () => [...geos, farGeo, lightGeo].forEach((g) => g.dispose()), [geos, farGeo, lightGeo]);

  useLayoutEffect(() => {
    for (const m of [...near.current, far.current, lights.current]) {
      if (!m) continue;
      if (!m.instanceColor)
        m.instanceColor = new InstancedBufferAttribute(
          new Float32Array(CAP * 3 * (m === lights.current ? 2 : 1)),
          3,
        );
      m.frustumCulled = false;
      m.count = 0;
    }
  }, []);

  useFrame(({ camera }) => {
    const cur = c.cur;
    if (!cur) return;
    const prev = c.prev;
    const now = performance.now();
    const alpha = Math.min(1, (now - c.curAt) / c.interval);
    const n = cur.length / FRAME_STRIDE;
    if (c.render.length < n * 3) c.render = new Float32Array(Math.max(n * 3, c.render.length * 2));
    c.renderCount = n;
    tmp.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    tmp.frustum.setFromProjectionMatrix(tmp.m);
    const lod = QUALITY[quality].lodDist;
    const lod2 = lod * lod;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const counts = [0, 0, 0, 0];
    let farCount = 0;
    let lightCount = 0;
    const showLights = night.value > 0.25;
    const nearArr = near.current.map((m) => (m ? (m.instanceMatrix.array as Float32Array) : null));
    const nearCol = near.current.map((m) =>
      m?.instanceColor ? (m.instanceColor.array as Float32Array) : null,
    );
    const farArr = far.current ? (far.current.instanceMatrix.array as Float32Array) : null;
    const farCol = far.current?.instanceColor ? (far.current.instanceColor.array as Float32Array) : null;
    const lArr = lights.current ? (lights.current.instanceMatrix.array as Float32Array) : null;
    const lCol = lights.current?.instanceColor ? (lights.current.instanceColor.array as Float32Array) : null;
    for (let i = 0; i < n; i++) {
      const o = i * FRAME_STRIDE;
      const type = cur[o + 1];
      if (type < 0) continue;
      let x = cur[o + 2];
      let y = cur[o + 3];
      let h = cur[o + 4];
      if (prev && o + 5 < prev.length && prev[o] === cur[o] && prev[o + 1] >= 0) {
        const px = prev[o + 2];
        const py = prev[o + 3];
        if (Math.abs(px - x) + Math.abs(py - y) < 60) {
          x = px + (x - px) * alpha;
          y = py + (y - py) * alpha;
          let dh = h - prev[o + 4];
          if (dh > Math.PI) dh -= Math.PI * 2;
          if (dh < -Math.PI) dh += Math.PI * 2;
          h = prev[o + 4] + dh * alpha;
        }
      }
      c.render[i * 3] = x;
      c.render[i * 3 + 1] = y;
      c.render[i * 3 + 2] = h;
      tmp.sphere.center.set(x, 1, -y);
      if (!tmp.frustum.intersectsSphere(tmp.sphere)) continue;
      const dx = x - cx;
      const dz = -y - cz;
      const d2 = dx * dx + dz * dz + cy * cy;
      const id = cur[o];
      const t = type as 0 | 1 | 2 | 3;
      const col = t === 2 ? busCol : t === 3 ? truckCol : palette[id % palette.length];
      if (d2 < lod2 && nearArr[t]) {
        const k = counts[t]++;
        if (k >= CAP) continue;
        writeMatrix(nearArr[t]!, k, x, 0, -y, h, 1, 1, 1);
        const ca = nearCol[t]!;
        ca[k * 3] = col.r;
        ca[k * 3 + 1] = col.g;
        ca[k * 3 + 2] = col.b;
        if (showLights && lArr && lCol && lightCount < CAP * 2 - 2 && d2 < lod2 * 0.6) {
          const len = FAR_DIMS[t][0] / 2;
          const ch = Math.cos(h);
          const sh = Math.sin(h);
          const braking = cur[o + 5] >= 2;
          const hy = t === 1 ? 0.9 : 0.6;
          writeMatrix(
            lArr,
            lightCount,
            x + ch * (len + 0.05),
            hy,
            -(y + sh * (len + 0.05)),
            h,
            1,
            1,
            t === 1 ? 0.35 : 1,
          );
          lCol[lightCount * 3] = head.r * night.value;
          lCol[lightCount * 3 + 1] = head.g * night.value;
          lCol[lightCount * 3 + 2] = head.b * night.value;
          lightCount++;
          writeMatrix(
            lArr,
            lightCount,
            x - ch * (len + 0.05),
            hy,
            -(y - sh * (len + 0.05)),
            h,
            1,
            1,
            t === 1 ? 0.35 : 1,
          );
          const tc = braking ? tail : tailDim;
          lCol[lightCount * 3] = tc.r;
          lCol[lightCount * 3 + 1] = tc.g;
          lCol[lightCount * 3 + 2] = tc.b;
          lightCount++;
        }
      } else if (farArr && farCol && farCount < CAP) {
        const [L, H, W] = FAR_DIMS[t];
        writeMatrix(farArr, farCount, x, 0, -y, h, L, H, W);
        farCol[farCount * 3] = col.r;
        farCol[farCount * 3 + 1] = col.g;
        farCol[farCount * 3 + 2] = col.b;
        farCount++;
      }
    }
    near.current.forEach((m, t) => {
      if (!m) return;
      m.count = Math.min(CAP, counts[t]);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    if (far.current) {
      far.current.count = farCount;
      far.current.instanceMatrix.needsUpdate = true;
      if (far.current.instanceColor) far.current.instanceColor.needsUpdate = true;
    }
    if (lights.current) {
      lights.current.count = lightCount;
      lights.current.instanceMatrix.needsUpdate = true;
      if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {geos.map((g, t) => (
        <instancedMesh
          key={t}
          ref={(m) => {
            near.current[t] = m;
          }}
          args={[g, undefined, CAP]}
          castShadow={quality === 'high'}
        >
          <meshStandardMaterial roughness={0.5} metalness={0.15} />
        </instancedMesh>
      ))}
      <instancedMesh ref={far} args={[farGeo, undefined, CAP]}>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[lightGeo, undefined, CAP * 2]}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Cincin penanda kendaraan terpilih. */
export function SelectionMarker({ c }: { c: SimController }) {
  const { preset } = useSceneCtx();
  const selected = useSim(c, (s) => s.selected?.id ?? null);
  const ref = useRef<Mesh>(null);
  const geo = useMemo(() => new RingGeometry(3.2, 4.2, 32).rotateX(-Math.PI / 2), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const p = selected !== null ? c.positionOf(selected) : null;
    m.visible = !!p;
    if (p) m.position.set(p[0], 0.4, -p[1]);
  });
  return (
    <mesh ref={ref} geometry={geo} visible={false}>
      <meshBasicMaterial color={preset.route} toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}

/** Rute kendaraan terpilih dari link saat ini sampai tujuan. */
export function RouteLine({ c }: { c: SimController }) {
  const { preset } = useSceneCtx();
  const sel = useSim(c, (s) => s.selected);
  const key = sel ? `${sel.id}:${sel.routeIndex}:${sel.route.length}` : '';
  const pts = useMemo(() => {
    const net = c.net;
    if (!sel || !net) return null;
    const out: [number, number, number][] = [];
    const end = sel.route.length;
    for (let k = sel.routeIndex; k < end; k++) {
      const li = sel.route[k];
      if (!net.links[li]) continue;
      for (const [x, y] of linkLanePolyline(net, li)) out.push([x, 0.5, -y]);
    }
    return out.length >= 2 ? out : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, c]);
  if (!pts) return null;
  return <Line points={pts} color={preset.route} lineWidth={4} transparent opacity={0.9} />;
}

/** Kepala lampu lalu lintas per pendekat bersinyal. */
export function Signals({ c, net }: { c: SimController; net: Network }) {
  const ref = useRef<InstancedMesh>(null);
  const poleRef = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const out: { li: number; x: number; y: number; h: number }[] = [];
    for (const l of net.links) {
      if (net.nodes[l.to].control !== 'signal') continue;
      const o = Math.max(...l.laneOffsets) + 2.2;
      out.push({ li: l.index, x: l.x1 + l.nx * o, y: l.y1 + l.ny * o, h: Math.atan2(l.dy, l.dx) });
    }
    return out;
  }, [net]);
  const geo = useMemo(() => new BoxGeometry(0.7, 1.8, 0.7), []);
  const poleGeo = useMemo(() => new CylinderGeometry(0.12, 0.12, 5, 5).translate(0, 2.5, 0), []);
  const cols = useMemo(
    () => [new Color('#e5352b'), new Color('#ffb000'), new Color('#22c55e'), new Color('#555')],
    [],
  );
  useLayoutEffect(() => {
    for (const m of [ref.current, poleRef.current]) {
      if (!m) continue;
      const arr = m.instanceMatrix.array as Float32Array;
      items.forEach((it, i) => writeMatrix(arr, i, it.x, m === ref.current ? 5.6 : 0, -it.y, it.h, 1, 1, 1));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [items]);
  useFrame(() => {
    const m = ref.current;
    if (!m || !c.signals.length) return;
    items.forEach((it, i) => {
      const st = c.signals[it.li];
      m.setColorAt(i, cols[st > 2 ? 3 : st]);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!items.length) return null;
  return (
    <group>
      <instancedMesh key={`s${items.length}`} ref={ref} args={[geo, undefined, items.length]}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh key={`p${items.length}`} ref={poleRef} args={[poleGeo, undefined, items.length]}>
        <meshStandardMaterial color="#3b4048" />
      </instancedMesh>
    </group>
  );
}

/** Pejalan kaki di zebra cross. */
export function Pedestrians({ c }: { c: SimController }) {
  const { preset } = useSceneCtx();
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new CylinderGeometry(0.28, 0.28, 1.7, 6).translate(0, 0.85, 0), []);
  useLayoutEffect(() => {
    if (ref.current) ref.current.frustumCulled = false;
  }, []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const p = c.peds;
    const n = Math.min(600, p.length / 2);
    const arr = m.instanceMatrix.array as Float32Array;
    for (let i = 0; i < n; i++) writeMatrix(arr, i, p[i * 2], 0.2, -p[i * 2 + 1], 0, 1, 1, 1);
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, 600]}>
      <meshStandardMaterial color={preset.ped} />
    </instancedMesh>
  );
}

/** Heatmap kepadatan: lapisan berwarna di atas lajur tiap link. */
export function Heatmap({ c, net, visible }: { c: SimController; net: Network; visible: boolean }) {
  const { theme } = useSceneCtx();
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const scale = useMemo(() => densityScale(theme), [theme]);
  const last = useRef(-1);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const arr = m.instanceMatrix.array as Float32Array;
    for (const l of net.links) {
      const offs = l.laneOffsets;
      const mid = offs.reduce((a, b) => a + b, 0) / offs.length;
      const w = offs.length * 3.3 - 0.4;
      const cx = (l.x0 + l.x1) / 2 + l.nx * mid;
      const cy = (l.y0 + l.y1) / 2 + l.ny * mid;
      writeMatrix(arr, l.index, cx, 0.24, -cy, Math.atan2(l.dy, l.dx), Math.max(1, l.length), 1, w);
      m.setColorAt(l.index, scale(0));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    last.current = -1;
  }, [net, scale]);
  useFrame(() => {
    const m = ref.current;
    if (!m || !visible || last.current === c.densityVersion || c.densities.length !== net.links.length)
      return;
    last.current = c.densityVersion;
    for (let i = 0; i < net.links.length; i++) m.setColorAt(i, scale(c.densities[i]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!net.links.length) return null;
  return (
    <instancedMesh
      key={net.links.length}
      ref={ref}
      args={[geo, undefined, net.links.length]}
      visible={visible}
    >
      <meshBasicMaterial transparent opacity={0.85} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}

/** Jalur angkutan umum statis: rute bus/BRT, halte, jalur layang MRT & stasiun. */
export function TransitStatic({ doc, net }: { doc: CityDoc; net: Network }) {
  const { preset } = useSceneCtx();
  const busPaths = useMemo(() => {
    const router = new Router(net);
    return doc.transit.bus.map((line) => {
      const stops = line.stops
        .map((id) => net.nodeIndexById.get(id))
        .filter((v): v is number => v !== undefined);
      const pts: [number, number, number][] = [];
      for (let k = 1; k < stops.length; k++) {
        const r = router.route(stops[k - 1], stops[k], (li) => net.links[li].freeTime);
        if (!r) continue;
        for (const li of r.links) {
          const l = net.links[li];
          const o = l.laneOffsets[l.laneOffsets.length - 1];
          pts.push([l.x0 + l.nx * o, 0.6, -(l.y0 + l.ny * o)], [l.x1 + l.nx * o, 0.6, -(l.y1 + l.ny * o)]);
        }
      }
      return { pts, stops: stops.map((s) => net.nodes[s]), dedicated: line.dedicated };
    });
  }, [doc, net]);
  const pillarGeo = useMemo(() => new BoxGeometry(1.4, 9, 1.4).translate(0, 4.5, 0), []);
  const beamMat = useMemo(() => new MeshStandardMaterial({ color: preset.rail, roughness: 0.8 }), [preset]);
  const stationMat = useMemo(
    () => new MeshStandardMaterial({ color: preset.train, roughness: 0.6 }),
    [preset],
  );
  const stopMat = useMemo(() => new MeshBasicMaterial({ color: preset.bus, toneMapped: false }), [preset]);
  return (
    <group>
      {busPaths.map((b, i) =>
        b.pts.length >= 2 ? (
          <Line
            key={`b${i}`}
            points={b.pts}
            color={preset.bus}
            lineWidth={b.dedicated ? 5 : 3}
            dashed={!b.dedicated}
            dashSize={6}
            gapSize={4}
          />
        ) : null,
      )}
      {busPaths.flatMap((b, i) =>
        b.stops.map((n, k) => (
          <mesh
            key={`s${i}-${k}`}
            position={[n.x + n.radius * 0.7, 1.6, -(n.y + n.radius * 0.7)]}
            material={stopMat}
          >
            <boxGeometry args={[2.4, 3.2, 0.5]} />
          </mesh>
        )),
      )}
      {doc.transit.mrt.map((line, i) => (
        <group key={`m${i}`}>
          {line.stations.slice(1).map((b, k) => {
            const a = line.stations[k];
            const L = Math.hypot(b.x - a.x, b.y - a.y);
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            const pillars = Math.max(1, Math.floor(L / 35));
            return (
              <group key={k}>
                <mesh
                  position={[(a.x + b.x) / 2, 9.4, -(a.y + b.y) / 2]}
                  rotation={[0, ang, 0]}
                  material={beamMat}
                >
                  <boxGeometry args={[L, 0.8, 5]} />
                </mesh>
                {Array.from({ length: pillars }, (_, j) => {
                  const t = (j + 0.5) / pillars;
                  return (
                    <mesh
                      key={j}
                      geometry={pillarGeo}
                      material={beamMat}
                      position={[a.x + (b.x - a.x) * t, 0, -(a.y + (b.y - a.y) * t)]}
                    />
                  );
                })}
              </group>
            );
          })}
          {line.stations.map((s, k) => (
            <mesh key={`st${k}`} position={[s.x, 10.6, -s.y]} material={stationMat}>
              <boxGeometry args={[14, 2.2, 9]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Kereta MRT bergerak (posisi dari worker). */
export function Trains({ c }: { c: SimController }) {
  const { preset } = useSceneCtx();
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new BoxGeometry(46, 3.2, 3.2).translate(0, 11.4, 0), []);
  useLayoutEffect(() => {
    if (ref.current) ref.current.frustumCulled = false;
  }, []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = c.trains;
    const n = Math.min(64, t.length / 3);
    const arr = m.instanceMatrix.array as Float32Array;
    for (let i = 0; i < n; i++) writeMatrix(arr, i, t[i * 3], 0, -t[i * 3 + 1], t[i * 3 + 2], 1, 1, 1);
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, 64]}>
      <meshStandardMaterial color={preset.train} emissive={preset.train} emissiveIntensity={0.25} />
    </instancedMesh>
  );
}
