import { useLayoutEffect, useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { Color, CylinderGeometry, InstancedMesh, RingGeometry, DoubleSide } from 'three';
import type { CityDoc } from '../lib/city/schema';
import { useSceneCtx } from './context';
import { writeMatrix } from './StaticCity';

export type Selection = { kind: 'node'; id: number } | { kind: 'road'; id: number } | null;

/** Penanda simpang (warna = zona, tepi = jenis kontrol), sorotan pilihan, dan garis draf saat menggambar. */
export function EditorOverlay({
  doc,
  selection,
  draft,
}: {
  doc: CityDoc;
  selection: Selection;
  draft: { from: [number, number]; to: [number, number] } | null;
}) {
  const { preset } = useSceneCtx();
  const ref = useRef<InstancedMesh>(null);
  const ringRef = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new CylinderGeometry(3.4, 3.4, 0.6, 18), []);
  const ringGeo = useMemo(() => new RingGeometry(4.2, 5.4, 24).rotateX(-Math.PI / 2), []);
  const count = doc.nodes.length;
  useLayoutEffect(() => {
    const m = ref.current;
    const rm = ringRef.current;
    if (!m || !rm) return;
    const col = new Color();
    const arr = m.instanceMatrix.array as Float32Array;
    const rarr = rm.instanceMatrix.array as Float32Array;
    doc.nodes.forEach((n, i) => {
      writeMatrix(arr, i, n.x, 0.6, -n.y, 0, 1, 1, 1);
      writeMatrix(rarr, i, n.x, 0.5, -n.y, 0, 1, 1, 1);
      m.setColorAt(i, col.set(preset.zones[n.zone]));
      const ctl = n.control;
      rm.setColorAt(
        i,
        col.set(
          ctl === 'signal'
            ? '#22c55e'
            : ctl === 'roundabout'
              ? preset.highlight
              : ctl === 'auto'
                ? preset.grid
                : preset.zones.none,
        ),
      );
    });
    m.instanceMatrix.needsUpdate = true;
    rm.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    rm.computeBoundingSphere();
  }, [doc, preset]);

  const selLine = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'road') {
      const r = doc.roads.find((x) => x.id === selection.id);
      if (!r) return null;
      const a = doc.nodes.find((n) => n.id === r.a);
      const b = doc.nodes.find((n) => n.id === r.b);
      if (!a || !b) return null;
      return [
        [a.x, 1, -a.y],
        [b.x, 1, -b.y],
      ] as [number, number, number][];
    }
    return null;
  }, [selection, doc]);
  const selNode = selection?.kind === 'node' ? doc.nodes.find((n) => n.id === selection.id) : undefined;

  return (
    <group>
      {count > 0 && (
        <>
          <instancedMesh key={`n${count}`} ref={ref} args={[geo, undefined, count]}>
            <meshBasicMaterial toneMapped={false} />
          </instancedMesh>
          <instancedMesh key={`r${count}`} ref={ringRef} args={[ringGeo, undefined, count]}>
            <meshBasicMaterial toneMapped={false} side={DoubleSide} />
          </instancedMesh>
        </>
      )}
      {selLine && <Line points={selLine} color={preset.highlight} lineWidth={6} />}
      {selNode && (
        <mesh position={[selNode.x, 1.2, -selNode.y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6.5, 8.5, 32]} />
          <meshBasicMaterial color={preset.highlight} toneMapped={false} side={DoubleSide} />
        </mesh>
      )}
      {draft && (
        <Line
          points={[
            [draft.from[0], 1.2, -draft.from[1]],
            [draft.to[0], 1.2, -draft.to[1]],
          ]}
          color={preset.highlight}
          lineWidth={3}
          dashed
          dashSize={4}
          gapSize={3}
        />
      )}
    </group>
  );
}
