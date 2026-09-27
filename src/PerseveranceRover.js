import * as THREE from 'three';

// A lightweight, stylized Perseverance: six wheels, suspension, instrument
// mast, sampling arm and the rear radioisotope power supply. Forward is -Z.
export function createPerseveranceRover(){
  const rover=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xe3dfd3,roughness:.62});
  const metal=new THREE.MeshStandardMaterial({color:0x787c7c,metalness:.65,roughness:.5});
  const dark=new THREE.MeshStandardMaterial({color:0x282b2e,metalness:.35,roughness:.75});
  const gold=new THREE.MeshStandardMaterial({color:0xb89658,metalness:.55,roughness:.5});
  const lens=new THREE.MeshStandardMaterial({color:0x182c35,metalness:.55,roughness:.2});
  const add=(geometry,material,x,y,z,parent=rover)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const box=(x,y,z,w,h,d,mat=white)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const rod=(from,to,radius=.04,mat=metal,parent=rover)=>{
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),mesh=add(new THREE.CylinderGeometry(radius,radius,a.distanceTo(b),8),mat,0,0,0,parent);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());return mesh;
  };
  box(0,1.03,0,1.75,.65,2.25);box(0,1.4,-.05,1.95,.12,2.4);
  box(0,1.45,.6,1.05,.09,.5,gold);box(-.65,1.48,.25,.34,.11,.65,dark);
  box(.68,1.48,-.45,.38,.12,.4,metal);
  // Rear MMRTG, with visible cooling fins.
  const generator=add(new THREE.CylinderGeometry(.31,.31,.9,12),dark,0,1.45,1.5);generator.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const fin=box(0,1.45,1.5,.07,.94,.84,metal);fin.rotation.z=i*Math.PI/4;}
  rod([-.62,1.25,1],[0,1.35,1.88],.05);rod([.62,1.25,1],[0,1.35,1.88],.05);
  const mastX=.46,mastZ=-.64;
  rod([mastX,1.42,mastZ],[mastX,2.66,mastZ],.07,white);
  box(mastX,2.73,mastZ,.72,.4,.42);box(mastX,2.97,mastZ,.25,.11,.24);
  for(const x of [mastX-.22,mastX+.22]){const eye=add(new THREE.CylinderGeometry(.094,.094,.07,16),lens,x,2.76,mastZ-.25);eye.rotation.x=Math.PI/2;}
  box(mastX,2.58,mastZ-.24,.48,.09,.05,dark);
  rod([-.65,1.44,.55],[-.65,2.17,.55],.018);add(new THREE.SphereGeometry(.13,12,8),white,-.65,2.2,.55);
  const dish=add(new THREE.CylinderGeometry(.24,.18,.08,16),gold,-.5,1.65,-.32);dish.rotation.z=-.25;
  // Folded sampling arm and front-facing instrument turret.
  rod([-.65,.93,-1.1],[-.75,.73,-1.6],.085,white);rod([-.75,.73,-1.6],[.5,.67,-1.58],.07,white);
  box(.62,.68,-1.58,.43,.32,.38,metal);
  for(const x of [-.66,.66])box(x,.91,-1.16,.15,.12,.06,lens);
  const wheels=[];
  for(const side of [-1,1]){
    rod([side*.8,1.03,0],[side*1.15,.82,-1.04],.055);
    rod([side*.8,1.03,0],[side*1.15,.82,1.12],.055);
    rod([side*1.15,.82,1.12],[side*1.26,.5,.06],.05);
    for(const z of [-1.16,0,1.16]){
      rod([side*1.15,.82,z],[side*1.26,.43,z],.045);
      const steering=new THREE.Group();steering.position.set(side*1.3,.43,z);rover.add(steering);
      const wheel=new THREE.Group();steering.add(wheel);
      const tire=add(new THREE.CylinderGeometry(.43,.43,.31,32),dark,0,0,0,wheel);tire.rotation.z=Math.PI/2;
      const hub=add(new THREE.CylinderGeometry(.19,.19,.33,12),metal,0,0,0,wheel);hub.rotation.z=Math.PI/2;
      for(let i=0;i<20;i++){
        const angle=i/20*Math.PI*2;
        const tread=add(new THREE.BoxGeometry(.325,.045,.035),metal,0,Math.cos(angle)*.433,Math.sin(angle)*.433,wheel);tread.rotation.x=angle;
      }
      wheels.push({wheel,steering,z});
    }
  }
  return {rover,wheels};
}
