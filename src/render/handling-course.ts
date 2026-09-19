import { Mesh, MeshBuilder, Scene, StandardMaterial, DynamicTexture, type Material } from '@babylonjs/core';
import { HANDLING, HANDLING_FEATURES, HANDLING_LABELS, featureHeight, insideBounds, type Bounds } from '../content/handling-course';
import { Geometry } from './geometry';

export function createHandlingCell(scene: Scene, cell: Bounds, materials: { road: Material; white: Material; red: Material; dark: Material }, attach: (mesh: Mesh | null, collision?: boolean) => void) {
  const [x0, z0, x1, z1] = HANDLING.bounds;
  if (cell[2] <= x0 || cell[0] >= x1 || cell[3] <= z0 || cell[1] >= z1) return;
  const key = `${cell[0]},${cell[1]}`, base = HANDLING.height;
  const surface = new Geometry(), paint = new Geometry(), red = new Geometry(), barriers = new Geometry();
  const patch = (g: Geometry, bounds: Bounds, height: (x: number, z: number) => number, step = 32, skipFlat = false) => {
    const left = Math.max(bounds[0], cell[0]), right = Math.min(bounds[2], cell[2]);
    const bottom = Math.max(bounds[1], cell[1]), top = Math.min(bounds[3], cell[3]);
    for (let x = left; x < right - 1e-6; x += step) for (let z = bottom; z < top - 1e-6; z += step) {
      const xx = Math.min(x + step, right), zz = Math.min(z + step, top);
      if (skipFlat && Math.max(height(x,z),height(xx,z),height(x,zz),height(xx,zz)) <= base + 1e-6) continue;
      g.quad({ x, y: height(x, z), z }, { x: xx, y: height(xx, z), z }, { x, y: height(x, zz), z: zz }, { x: xx, y: height(xx, zz), z: zz });
    }
  };
  patch(surface, HANDLING.bounds, () => base);
  attach(surface.mesh(`handling-pad-${key}`, scene, materials.road), true);
  for (const feature of HANDLING_FEATURES) {
    const geometry = new Geometry(), walls = new Geometry();
    patch(geometry, feature.bounds, (x, z) => base + featureHeight(feature, x, z), feature.step, true);
    const [left, bottom, right, top] = feature.bounds;
    const edge = (ax: number, az: number, bx: number, bz: number) => {
      const count = Math.ceil(Math.hypot(bx-ax,bz-az) / feature.step);
      for (let i=0;i<count;i++) {
        const x=ax+(bx-ax)*i/count,z=az+(bz-az)*i/count,xx=ax+(bx-ax)*(i+1)/count,zz=az+(bz-az)*(i+1)/count;
        if (!insideBounds((x+xx)/2,(z+zz)/2,cell)) continue;
        const h=featureHeight(feature,x,z),hh=featureHeight(feature,xx,zz);
        if (Math.max(h,hh)<1e-6) continue;
        walls.quad({x,y:base,z},{x:xx,y:base,z:zz},{x,y:base+h,z},{x:xx,y:base+hh,z:zz});
      }
    };
    edge(left,bottom,right,bottom);edge(right,bottom,right,top);edge(right,top,left,top);edge(left,top,left,bottom);
    attach(geometry.mesh(`handling-${feature.id}-${key}`, scene, feature.id === 'curb' ? materials.red : materials.road), true);
    attach(walls.mesh(`handling-${feature.id}-walls-${key}`,scene,materials.dark),true);
    if (feature.id === 'bumps') for (const x of [-1860, -1800, -1740]) {
      patch(red, [x - .3, 1785, x + .3, 1795], (xx, zz) => base + featureHeight(feature, xx, zz) + .012, .3);
    }
    if (feature.id === 'bank' || feature.id === 'slope') for (const side of [feature.bounds[1] + .12, feature.bounds[3] - .25]) {
      patch(paint, [feature.bounds[0], side, feature.bounds[2], side + .13], (x, z) => base + featureHeight(feature, x, z) + .014, 2);
    }
  }
  const line = (bounds: Bounds) => patch(paint, bounds, () => base + .012);
  for (const z of [1933, 1947, 1870, 1886, 1783, 1797]) line([-1950, z, -1270, z + .13]);
  for (let x = -1900; x < -1290; x += 50) {
    line([x, 1933, x + .18, 1947]);
    line([x, 1948.5, x + .18, 1951.5]);
  }
  for (const radius of [35, 55, 70]) for (let i = 0; i < 192; i++) {
    const a = i / 192 * Math.PI * 2, b = (i + 1) / 192 * Math.PI * 2;
    const point = (angle: number, r: number) => ({ x: HANDLING.skidpad.x + Math.sin(angle) * r, y: base + .012, z: HANDLING.skidpad.z + Math.cos(angle) * r });
    const center = point((a + b) / 2, radius);
    if (!insideBounds(center.x, center.z, cell)) continue;
    paint.quad(point(a, radius + .07), point(a, radius - .07), point(b, radius + .07), point(b, radius - .07));
  }
  // Lightweight, non-solid cones are slalom targets, not immovable crash obstacles.
  const cones: Mesh[] = [];
  for (let i = 0; i < HANDLING.slalom.count; i++) {
    const x = HANDLING.slalom.x + i * HANDLING.slalom.spacing, z = HANDLING.slalom.z;
    if (!insideBounds(x, z, cell)) continue;
    const cone = MeshBuilder.CreateCylinder('slalom-cone', { diameterTop: .035, diameterBottom: .36, height: .65, tessellation: 8 }, scene);
    cone.position.set(x, base + .325, z);cones.push(cone);
  }
  if (cones.length) { const mesh = Mesh.MergeMeshes(cones, true, true)!; mesh.material = materials.red; attach(mesh); }
  const wall = HANDLING.barrier;
  if (insideBounds(wall.x, wall.z, cell)) {
    barriers.box(wall.x, base, wall.z, wall.width, wall.height, wall.depth);
    for (let z = wall.z - 8; z < wall.z + 8; z += 2) red.box(wall.x - .61, base + .3, z, .02, .5, .9);
  }
  attach(barriers.mesh(`handling-collision-wall-${key}`, scene, materials.dark), true);
  attach(paint.mesh(`handling-markings-${key}`, scene, materials.white));
  attach(red.mesh(`handling-warning-${key}`, scene, materials.red));
  for (const label of HANDLING_LABELS) {
    if (!insideBounds(label.x, label.z, cell)) continue;
    const texture = new DynamicTexture(`handling-sign-${label.name}`, { width: 1024, height: 128 }, scene, false);
    texture.drawText(label.name, null, 77, 'bold 32px sans-serif', '#dceaf1', '#1d343f', true);
    const material = new StandardMaterial(`handling-sign-material-${label.name}`, scene);
    material.diffuseTexture = texture;material.emissiveColor.set(.2, .2, .2);material.backFaceCulling = false;
    const sign = MeshBuilder.CreatePlane(`handling-sign-${label.name}`, { width: 9, height: 1.125, sideOrientation: Mesh.DOUBLESIDE }, scene);
    sign.position.set(label.x, base + 2.6, label.z);sign.rotation.y = -Math.PI / 2;sign.material = material;sign.metadata = { ownedMaterial: true };attach(sign);
    const posts = new Geometry();posts.box(label.x, base, label.z - 3, .12, 2.8, .12);posts.box(label.x, base, label.z + 3, .12, 2.8, .12);
    attach(posts.mesh(`handling-sign-posts-${label.name}`, scene, materials.dark));
  }
}
