import type { V3 } from '../core/types';

export interface MeshData {positions:Float32Array;indices:Uint32Array;uvs:Float32Array;normals:Float32Array;colors?:Float32Array}
/** Pure geometry builder, shared by worker generation and synchronous validation rigs. */
export class MeshDataBuilder {
  positions:number[]=[];indices:number[]=[];uvs:number[]=[];
  polygon(points:V3[]){const first=this.positions.length/3;for(const p of points){this.positions.push(p.x,p.y,p.z);this.uvs.push(p.x/12,p.z/12);}for(let i=1;i<points.length-1;i++)this.indices.push(first,first+i,first+i+1);}
  quad(a:V3,b:V3,c:V3,d:V3){const n=this.positions.length/3;for(const p of [a,b,c,d]){this.positions.push(p.x,p.y,p.z);this.uvs.push(p.x/12,p.z/12);}this.indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  box(x:number,y:number,z:number,w:number,h:number,l:number,yaw=0){
    const cos=Math.cos(yaw),sin=Math.sin(yaw),corners=[[-w/2,0,-l/2],[w/2,0,-l/2],[-w/2,h,-l/2],[w/2,h,-l/2],[-w/2,0,l/2],[w/2,0,l/2],[-w/2,h,l/2],[w/2,h,l/2]];
    // Separate faces retain architectural hard edges and sensible wall UVs.
    const faces=[[0,1,2,3],[4,6,5,7],[0,2,4,6],[1,5,3,7],[2,3,6,7],[0,4,1,5]];
    for(let f=0;f<faces.length;f++){const n=this.positions.length/3;for(const i of faces[f]){const [dx,dy,dz]=corners[i];this.positions.push(x+dx*cos+dz*sin,y+dy,z-dx*sin+dz*cos);this.uvs.push((f===2||f===3?dz:dx)/4,(f>3?dz:dy)/4);}this.indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  finish():MeshData{
    const positions=new Float32Array(this.positions),indices=new Uint32Array(this.indices),normals=new Float32Array(positions.length);
    for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];let x=uz*vy-uy*vz,y=ux*vz-uz*vx,z=uy*vx-ux*vy;const length=Math.hypot(x,y,z)||1;x/=length;y/=length;z/=length;for(const index of [a,b,c]){normals[index]+=x;normals[index+1]+=y;normals[index+2]+=z;}}
    for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;normals[i]/=length;normals[i+1]/=length;normals[i+2]/=length;}
    return {positions,indices,uvs:new Float32Array(this.uvs),normals};
  }
}
export function meshBytes(data:MeshData){return data.positions.byteLength+data.indices.byteLength+data.uvs.byteLength+data.normals.byteLength+(data.colors?.byteLength??0);}
