import * as THREE from 'three';

// A single sealed cut face avoids stacked-disc depth artifacts. The surviving
// hemisphere supplies the curved exterior; this face stays fixed while orbiting.
export function createInteriorCutaway(){
  const uniforms={
    uLayerCount:{value:0},
    uRadii:{value:Array(4).fill(0)},
    uBlends:{value:Array(4).fill(0)},
    uColors:{value:Array.from({length:4},()=>new THREE.Color())},
    uActive:{value:0},
  };
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,toneMapped:false});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 vCutPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCutPosition=position.xy;');
    shader.fragmentShader=`
      varying vec2 vCutPosition;
      uniform int uLayerCount;
      uniform float uRadii[4];
      uniform float uBlends[4];
      uniform vec3 uColors[4];
      uniform int uActive;
      float cutHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float cutNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(cutHash(i),cutHash(i+vec2(1,0)),f.x),mix(cutHash(i+vec2(0,1)),cutHash(i+vec2(1,1)),f.x),f.y);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float radius=length(vCutPosition);
      float aa=max(fwidth(radius),.0001);
      vec3 layerColor=uColors[0];
      float edge=0.0;
      float activeMask=uActive==0?1.0:0.0;
      for(int i=1;i<4;i++){
        if(i<uLayerCount){
          float width=max(aa,uBlends[i]);
          float inside=1.0-smoothstep(uRadii[i]-width,uRadii[i]+width,radius);
          layerColor=mix(layerColor,uColors[i],inside);
          activeMask=mix(activeMask,uActive==i?1.0:0.0,inside);
          if(uBlends[i]==0.0)edge=max(edge,1.0-smoothstep(aa,aa*2.5,abs(radius-uRadii[i])));
        }
      }
      float grain=cutNoise(vCutPosition*160.0)*.55+cutNoise(vCutPosition*43.0)*.30+cutNoise(vCutPosition*12.0)*.15;
      float strata=sin(radius*210.0+cutNoise(vCutPosition*16.0)*5.0);
      float shading=.86+grain*.17+strata*.018;
      shading*=1.0-edge*.14;
      shading*=1.0-smoothstep(.97,1.0,radius)*.14;
      diffuseColor.rgb=layerColor*shading*(.96+activeMask*.10);
    `);
  };
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,192),material);
  mesh.visible=false;
  mesh.raycast=()=>{};
  let current=null;
  return {
    mesh,
    update(body,activeLayer){
      if(current!==body.id){
        current=body.id;
        uniforms.uLayerCount.value=body.layers.length;
        body.layers.forEach((layer,i)=>{
          uniforms.uRadii.value[i]=layer.radius;
          uniforms.uBlends.value[i]=layer.blend;
          uniforms.uColors.value[i].set(layer.color);
        });
      }
      uniforms.uActive.value=activeLayer;
    },
  };
}
