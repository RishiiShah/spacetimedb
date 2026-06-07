// Carves three repainted part GLBs out of the lowpoly F1 donor so the base
// CircuitCar can wear them with working liveries. Run: `node scripts/extract-car-parts.mjs`
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import {
  dedup, weld, prune, quantize, transformPrimitive,
} from '@gltf-transform/functions';

const SRC = 'public/assets/cars/lowpoly-f1.glb';
const OUT_DIR = 'public/assets/cars';

// Material names the livery recolor paints (must match driving.ts).
const BODY = 'car_color';
const ACCENT = 'car_color.001';

// For each output: which top-level donor nodes to keep, and which mesh gets
// which livery material. Mesh names come from `lowpoly-f1.glb`.
const PARTS = [
  {
    out: 'aero-rear-wing.glb',
    keepNodes: ['Spoiler', 'Spoiler_2'],
    bodyMeshes: ['Cube.004', 'Cube.008'],   // wing planes
    // everything else (Cube.001, Cube.005 = endplates/structure) -> accent
  },
  {
    out: 'aero-front-splitter.glb',
    keepNodes: ['Front_Wing3', 'Front_Wing2.001', 'Front_Spoiler'],
    bodyMeshes: ['Plane.010'],               // splitter plane
    // Cube.006, Cube.003 (wing/endplates) -> accent
  },
  {
    out: 'aero-rear-diffuser.glb',
    keepNodes: ['Wheel_Holder_rear'],
    bodyMeshes: [],                          // all accent (black diffuser)
  },
];

// --- column-major mat4 helpers ---
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++)
    o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; };
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; };
const translate = (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
const trs = (n) => {
  const t = n.getTranslation(), q = n.getRotation(), s = n.getScale();
  const [x,y,z,w] = q, x2=x+x,y2=y+y,z2=z+z;
  const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  const [sx,sy,sz] = s;
  return [(1-(yy+zz))*sx,(xy+wz)*sx,(xz-wy)*sx,0,
          (xy-wz)*sy,(1-(xx+zz))*sy,(yz+wx)*sy,0,
          (xz+wy)*sz,(yz-wx)*sz,(1-(xx+yy))*sz,0,
          t[0],t[1],t[2],1];
};

// Upright + nose+Z, no mirror: rotY(180) * rotX(-90). Z-up,+Y-front -> Y-up, nose +Z.
const G = mul(rotY(Math.PI), rotX(-Math.PI / 2));

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);

async function build(part) {
  const doc = await io.read(SRC);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];

  // The donor wraps all parts under a single transform-less `RootNode`; the
  // part nodes named in PARTS are its children. Unwrap it so "top-level"
  // refers to the actual part nodes.
  let topParent = scene;
  const sceneChildren = scene.listChildren();
  if (sceneChildren.length === 1 && sceneChildren[0].getName() === 'RootNode') {
    topParent = sceneChildren[0];
  }

  // Detach (dispose) every top-level node we are not keeping.
  for (const node of [...topParent.listChildren()]) {
    if (!part.keepNodes.includes(node.getName())) node.dispose();
  }

  // Bake G * worldMatrix into each surviving mesh's vertices, then zero each
  // node's transform so the baked coords are used as-is. Children receive the
  // world matrix by parameter (not by re-reading the parent), so zeroing inline
  // is safe.
  const baked = new Set();
  const walk = (node, parentWorld) => {
    const world = mul(parentWorld, trs(node));
    const mesh = node.getMesh();
    if (mesh) {
      const m = mul(G, world);
      for (const prim of mesh.listPrimitives()) {
        if (baked.has(prim)) continue;       // guard against shared accessors
        transformPrimitive(prim, m);
        baked.add(prim);
      }
    }
    for (const child of node.listChildren()) walk(child, world);
    node.setTranslation([0,0,0]); node.setRotation([0,0,0,1]); node.setScale([1,1,1]);
  };
  const topWorld = topParent === scene ? trs2identity() : trs(topParent);
  for (const node of topParent.listChildren()) walk(node, topWorld);

  // Prune first so the disposed nodes' orphaned meshes don't pollute the bbox
  // / repaint passes below.
  await doc.transform(prune());

  // Recenter to the part's own origin (XYZ centroid of the bbox).
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    for (let i = 0; i < pos.getCount(); i++) {
      const v = pos.getElement(i, []);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
    }
  }
  const center = min.map((v, k) => (v + max[k]) / 2);
  const recenter = translate(-center[0], -center[1], -center[2]);
  const re = new Set();
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    if (re.has(prim)) continue; transformPrimitive(prim, recenter); re.add(prim);
  }

  // Repaint: new flat livery materials, assigned per mesh name.
  const bodyMat = doc.createMaterial(BODY).setBaseColorFactor([1,1,1,1])
    .setMetallicFactor(0.3).setRoughnessFactor(0.45);
  const accentMat = doc.createMaterial(ACCENT).setBaseColorFactor([0.05,0.05,0.06,1])
    .setMetallicFactor(0.3).setRoughnessFactor(0.5);
  for (const mesh of root.listMeshes()) {
    const useBody = part.bodyMeshes.includes(mesh.getName());
    for (const prim of mesh.listPrimitives()) prim.setMaterial(useBody ? bodyMat : accentMat);
  }

  await doc.transform(dedup(), weld(), prune(), quantize());
  await io.write(`${OUT_DIR}/${part.out}`, doc);
  console.log('wrote', part.out);
}

function trs2identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }

for (const part of PARTS) await build(part);
