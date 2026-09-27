import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {magneticFields} from './magneticFields';

function fieldCurves(model){
  const curves=[];
  const dipole=model.type==='dipole';
  if(dipole){
    for(const reach of [1.35,1.9,2.55])for(let spoke=0;spoke<12;spoke++){
      const phi=spoke/12*Math.PI*2,points=[];
      const start=Math.asin(Math.sqrt(1.025/reach));
      for(let i=0;i<=96;i++){
        const theta=start+(Math.PI-2*start)*i/96,r=reach*Math.sin(theta)**2;
        points.push(new THREE.Vector3(r*Math.sin(theta)*Math.cos(phi),r*Math.cos(theta)+(model.offset||0),r*Math.sin(theta)*Math.sin(phi)));
      }
      curves.push(new THREE.CatmullRomCurve3(points));
    }
  }else if(model.type==='induced'){
    // Open draped strands wrap around the upstream atmosphere and trail away.
    for(let spoke=0;spoke<18;spoke++)for(const radius of [1.18,1.55]){
      const phi=spoke/18*Math.PI*2,points=[];
      for(let i=0;i<=80;i++){
        const angle=-Math.PI*.76+i/80*Math.PI*1.52;
        const tail=Math.max(0,Math.abs(angle)-Math.PI*.45);
        points.push(new THREE.Vector3(-radius*Math.cos(angle)+tail*.9,radius*Math.sin(angle)*Math.cos(phi),radius*Math.sin(angle)*Math.sin(phi)));
      }
      curves.push(new THREE.CatmullRomCurve3(points));
    }
  }else{
    // Local loops connect nearby surface patches, rather than invented poles.
    const solar=model.type==='solar';
    for(let patch=0;patch<(solar?16:9);patch++){
      const phi=patch*2.39996,latitude=solar?Math.sin(patch*1.7)*.65:-.25-Math.abs(Math.sin(patch*1.7))*.6;
      const center=new THREE.Vector3(Math.cos(phi)*Math.sqrt(1-latitude**2),latitude,Math.sin(phi)*Math.sqrt(1-latitude**2));
      const tangent=new THREE.Vector3(-Math.sin(phi),0,Math.cos(phi));
      const height=solar?.4+(patch%4)*.18:.16+(patch%3)*.09;
      for(let strand=0;strand<3;strand++){
        const points=[];
        for(let i=0;i<=64;i++){
          const t=i/64,side=(t-.5)*(.4+strand*.055);
          points.push(center.clone().multiplyScalar(1.025+Math.sin(t*Math.PI)*height).addScaledVector(tangent,side));
        }
        curves.push(new THREE.CatmullRomCurve3(points));
      }
    }
  }
  return curves;
}

function strandMaterial(uniforms,opacity){
  const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.uniforms.uOpacity={value:opacity};
    shader.vertexShader='varying vec2 vFieldUv;varying vec3 vFieldNormal;varying vec3 vFieldView;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vFieldUv=uv;vFieldNormal=normalize(normalMatrix*normal);
      vFieldView=normalize(-(modelViewMatrix*vec4(position,1.0)).xyz);`);
    shader.fragmentShader=`uniform float uTime;uniform float uFade;uniform float uOpacity;
      varying vec2 vFieldUv;varying vec3 vFieldNormal;varying vec3 vFieldView;
      float fieldHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float fieldNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fieldHash(i),fieldHash(i+vec2(1,0)),f.x),mix(fieldHash(i+vec2(0,1)),fieldHash(i+vec2(1,1)),f.x),f.y);}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float flow=vFieldUv.x*9.0-uTime*.20;
      float mist=fieldNoise(vec2(flow,vFieldUv.y*9.0));
      float pulse=.65+.35*sin(flow*6.28318+mist*3.0);
      float hue=.5+.5*sin(vFieldUv.x*6.28318+uTime*.10);
      vec3 violet=vec3(.47,.08,1.0),cyan=vec3(.06,.85,1.0),rose=vec3(1.0,.12,.48);
      vec3 color=mix(violet,cyan,smoothstep(.1,.8,hue));
      color=mix(color,rose,pow(1.0-hue,3.0)*.75);
      float edge=pow(abs(dot(normalize(vFieldNormal),normalize(vFieldView))),.8);
      float ends=smoothstep(0.0,.045,vFieldUv.x)*(1.0-smoothstep(.955,1.0,vFieldUv.x));
      diffuseColor.rgb=color;
      diffuseColor.a=uFade*uOpacity*edge*ends*(.5+mist*.5)*pulse;
    `);
  };
  return material;
}

export function createMagneticField(){
  const group=new THREE.Group();group.visible=false;
  const uniforms={uTime:{value:0},uFade:{value:0}};
  const glowMaterial=strandMaterial(uniforms,.13);
  const lineMaterial=strandMaterial(uniforms,.65);
  let current=null;
  const rebuild=id=>{
    for(const mesh of [...group.children]){mesh.geometry.dispose();group.remove(mesh);}
    const model=magneticFields[id],curves=fieldCurves(model);
    for(const [width,material] of [[.075,glowMaterial],[.008,lineMaterial]]){
      const parts=curves.map(curve=>new THREE.TubeGeometry(curve,96,width,6,false));
      const mesh=new THREE.Mesh(mergeGeometries(parts),material);
      parts.forEach(part=>part.dispose());mesh.raycast=()=>{};group.add(mesh);
    }
    group.rotation.set(0,0,-THREE.MathUtils.degToRad(model.tilt));
    if(id==='saturn')group.rotation.z=-.35;
  };
  return {group,
    update(body,enabled,time,dt,scale){
      if(enabled&&body&&magneticFields[body.id]){
        if(current!==body.id){current=body.id;rebuild(current);uniforms.uFade.value=0;}
        uniforms.uFade.value=THREE.MathUtils.lerp(uniforms.uFade.value,1,Math.min(1,dt*5));
        group.scale.setScalar(body.radius/1000*scale);
        uniforms.uTime.value=time;
        group.visible=true;
      }else{
        uniforms.uFade.value=0;group.visible=false;
      }
    },
    dispose(){glowMaterial.dispose();lineMaterial.dispose();},
  };
}
