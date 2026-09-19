import { Scene, Mesh, VertexData, type Material } from '@babylonjs/core';
import type { V3 } from '../core/types';

export class Geometry {
  positions: number[] = [];
  indices: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];

  quad(a: V3, b: V3, c: V3, d: V3, color?: number[]) {
    const n = this.positions.length / 3;
    for (const p of [a, b, c, d]) {
      this.positions.push(p.x, p.y, p.z);
      this.uvs.push(p.x / 12, p.z / 12);
      if (color) this.colors.push(...color);
    }
    this.indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  }

  box(x: number, y: number, z: number, w: number, h: number, l: number, yaw = 0) {
    const n = this.positions.length / 3, cos = Math.cos(yaw), sin = Math.sin(yaw);
    for (const [dx, dy, dz] of [[-w / 2, 0, -l / 2], [w / 2, 0, -l / 2], [-w / 2, h, -l / 2], [w / 2, h, -l / 2], [-w / 2, 0, l / 2], [w / 2, 0, l / 2], [-w / 2, h, l / 2], [w / 2, h, l / 2]]) {
      this.positions.push(x + dx * cos + dz * sin, y + dy, z - dx * sin + dz * cos);
      this.uvs.push(dx / 5, dy / 5);
    }
    for (const face of [[0, 1, 2, 1, 3, 2], [4, 6, 5, 5, 6, 7], [0, 2, 4, 4, 2, 6], [1, 5, 3, 3, 5, 7], [2, 3, 6, 3, 7, 6], [0, 4, 1, 1, 4, 5]]) {
      for (const i of face) this.indices.push(n + i);
    }
  }

  mesh(name: string, scene: Scene, material: Material) {
    if (!this.positions.length) return null;
    const mesh = new Mesh(name, scene), data = new VertexData(), normals: number[] = [];
    VertexData.ComputeNormals(this.positions, this.indices, normals);
    data.positions = this.positions;
    data.indices = this.indices;
    data.normals = normals;
    data.uvs = this.uvs;
    if (this.colors.length) data.colors = this.colors;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    return mesh;
  }
}
