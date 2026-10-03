import * as THREE from 'three';
import {MAX_INTERIOR_LAYERS,interiorMaterials} from './interiors';

// One sealed face preserves true radial proportions without overlapping discs.
// Texture, flow and illumination are explanatory symbols, not reconstructions.
export function createInteriorCutaway(){
  const size=MAX_INTERIOR_LAYERS;
  const uniforms={
    uLayerCount:{value:0},uRadii:{value:Array(size).fill(0)},
    uBlends:{value:Array(size).fill(0)},uMaterials:{value:Array(size).fill(0)},
    uPossible:{value:Array(size).fill(0)},
    uColors:{value:Array.from({length:size},()=>new THREE.Color())},
    uActive:{value:0},uTime:{value:0},
  };
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,toneMapped:false});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 vCutPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCutPosition=position.xy;');
    shader.fragmentShader=`
      varying vec2 vCutPosition;
      uniform int uLayerCount;
      uniform float uRadii[${size}],uBlends[${size}],uMaterials[${size}],uPossible[${size}];
      uniform vec3 uColors[${size}];
      uniform int uActive;
      uniform float uTime;
      float cutHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float cutNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(cutHash(i),cutHash(i+vec2(1,0)),f.x),mix(cutHash(i+vec2(0,1)),cutHash(i+vec2(1,1)),f.x),f.y);
      }
      float cutTexture(vec2 p,float kind){
        float fine=cutNoise(p*140.0),coarse=cutNoise(p*19.0);
        float r=length(p),a=atan(p.y,p.x);
        if(kind<.5)return .83+coarse*.17+fine*.10; // solid rock
        if(kind<1.5)return .91+fine*.08+sin(p.x*65.0+p.y*23.0)*.025; // solid metal
        if(kind<2.5){ // symbolic fluid motion; never applied to solid mantle
          float flow=sin(r*65.0+a*4.0+cutNoise(p*6.0)*7.0-uTime*.35);
          return .86+coarse*.10+flow*.065;
        }
        if(kind<3.5)return .86+coarse*.10+(1.0-r)*.13; // dense envelope
        if(kind<4.5)return .92+cutNoise(p*27.0+uTime*.012)*.09+(1.0-r)*.06; // plasma
        if(kind<5.5)return .89+fine*.07+coarse*.09; // solid ice
        return .86+cutNoise(p*12.0)*.17+fine*.025; // mixed composition
      }
      vec3 cutColor(int i,vec2 p){
        float hatch=.5+.5*sin((p.x+p.y)*165.0);
        float marking=1.0-uPossible[i]*.13*smoothstep(.68,.86,hatch);
        return uColors[i]*cutTexture(p,uMaterials[i])*marking;
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float radius=length(vCutPosition),angle=atan(vCutPosition.y,vCutPosition.x);
      float aa=max(fwidth(radius),.0001);
      vec3 layerColor=cutColor(0,vCutPosition);
      float edge=0.0,activeMask=uActive==0?1.0:0.0,highlight=0.0;
      for(int i=1;i<${size};i++){
        if(i<uLayerCount){
          float width=max(aa,uBlends[i]);
          float inside=1.0-smoothstep(uRadii[i]-width,uRadii[i]+width,radius);
          layerColor=mix(layerColor,cutColor(i,vCutPosition),inside);
          activeMask=mix(activeMask,uActive==i?1.0:0.0,inside);
          if(uBlends[i]==0.0){
            float line=1.0-smoothstep(aa,aa*2.0,abs(radius-uRadii[i]));
            float dash=mix(1.0,smoothstep(-.1,.2,sin(angle*36.0)),uPossible[i]);
            edge=max(edge,line*dash);
            if(uActive==i||uActive==i-1)highlight=max(highlight,line*dash);
          }
        }
      }
      float rim=1.0-smoothstep(aa,aa*2.0,abs(radius-1.0));
      if(uActive==0)highlight=max(highlight,rim);
      float relief=.94+vCutPosition.y*.035-vCutPosition.x*.02;
      vec3 color=layerColor*relief*(.65+activeMask*.40);
      color*=1.0-edge*.16;
      color=mix(color,layerColor*1.20,highlight*.65);
      diffuseColor.rgb=color;
    `);
  };
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,256),material);
  mesh.visible=false;
  const localHit=new THREE.Vector3(),faceNormal=new THREE.Vector3(),towardCamera=new THREE.Vector3();
  let current=null;
  return {
    mesh,
    update(model,activeLayer,seconds=0){
      if(current!==model){
        current=model;
        uniforms.uLayerCount.value=model.layers.length;
        model.layers.forEach((layer,i)=>{
          uniforms.uRadii.value[i]=layer.radius;uniforms.uBlends.value[i]=layer.blend;
          uniforms.uColors.value[i].set(layer.color);uniforms.uMaterials.value[i]=interiorMaterials[layer.material];
          uniforms.uPossible.value[i]=layer.evidence==='Possible'?1:0;
        });
      }
      uniforms.uActive.value=activeLayer;uniforms.uTime.value=seconds;
    },
    pick(raycaster,camera){
      if(!mesh.visible||!current)return null;
      faceNormal.set(0,0,1).applyQuaternion(mesh.quaternion);
      towardCamera.copy(camera.position).sub(mesh.position);
      if(faceNormal.dot(towardCamera)<=0)return null;
      mesh.updateMatrixWorld();
      const hit=raycaster.intersectObject(mesh,false)[0];
      if(!hit)return null;
      const radius=mesh.worldToLocal(localHit.copy(hit.point)).length();
      for(let i=current.layers.length-1;i>=0;i--)if(radius<=current.layers[i].radius)return i;
      return null;
    },
  };
}
