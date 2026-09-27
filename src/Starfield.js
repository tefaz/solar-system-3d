import * as THREE from 'three';
import {AU} from './data';

// A screen-space sky keeps stars crisp at every zoom level. Different depth
// responses give navigation parallax without bringing stars into the system.
export function createStarfield(renderer) {
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x000000);
  const camera=new THREE.Camera();
  const layers=[];
  let seed=421;
  const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  const profiles=[
    {count:900,size:[1.0,1.8],light:[.06,.25],depth:.045},
    {count:280,size:[1.8,3.2],light:[.2,.65],depth:.11},
    {count:65,size:[3.4,6.0],light:[.5,1.0],depth:.23},
  ];
  for(const profile of profiles){
    const positions=[],colors=[],sizes=[];
    for(let i=0;i<profile.count;i++){
      positions.push(random(),random(),0);
      const brightness=THREE.MathUtils.lerp(...profile.light,Math.pow(random(),2));
      // Mostly silver-white, with occasional pale blue and warm ivory stars.
      const tint=random();
      const color=new THREE.Color(tint<.18?0xb8ceff:tint>.88?0xffdfb0:0xe5eaf2);
      color.multiplyScalar(brightness);
      colors.push(color.r,color.g,color.b);
      sizes.push(THREE.MathUtils.lerp(...profile.size,Math.pow(random(),3)));
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
    const material=new THREE.ShaderMaterial({
      uniforms:{pixelRatio:{value:renderer.getPixelRatio()},aspect:{value:1},offset:{value:new THREE.Vector2()}},
      transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
      vertexShader:`
        attribute vec3 color;attribute float size;
        uniform float pixelRatio;uniform float aspect;uniform vec2 offset;
        varying vec3 vColor;
        void main(){
          vColor=color;
          // Wrap beyond the viewport, so no star disappears at a visible seam.
          vec2 span=vec2(max(4.0,aspect*2.0+.4),2.4);
          vec2 p=mod(position.xy*span+offset+span*.5,span)-span*.5;
          gl_Position=vec4(p.x/aspect,p.y,0.0,1.0);
          gl_PointSize=size*pixelRatio;
        }`,
      fragmentShader:`
        varying vec3 vColor;
        void main(){
          float r=length(gl_PointCoord-.5)*2.0;
          float core=exp(-r*r*6.0);
          float halo=exp(-r*r*3.0)*.16;
          float alpha=(core+halo)*(1.0-smoothstep(.7,1.0,r));
          gl_FragColor=vec4(vColor,alpha);
          #include <colorspace_fragment>
        }`,
    });
    const points=new THREE.Points(geometry,material);
    points.frustumCulled=false;
    scene.add(points);
    layers.push({geometry,material,depth:profile.depth});
  }
  const pointer=new THREE.Vector2(),smoothedPointer=new THREE.Vector2();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  return {
    scene,camera,
    resize(aspect){
      for(const {material} of layers){
        material.uniforms.aspect.value=aspect;
        material.uniforms.pixelRatio.value=renderer.getPixelRatio();
      }
    },
    pointerMove(x,y){pointer.set(x,y);},
    pointerLeave(){pointer.set(0,0);},
    update(direction,worldPosition,dt){
      if(reducedMotion.matches)smoothedPointer.set(0,0);
      else smoothedPointer.lerp(pointer,1-Math.exp(-dt*4));
      // Bounded, continuous offsets remain smooth through full camera rotations
      // and the origin shifts used when entering or leaving a planet view.
      const travelX=Math.tanh(worldPosition.x/(AU*150))*.22;
      const travelY=Math.tanh(worldPosition.y/(AU*150))*.22;
      for(const {material,depth} of layers){
        material.uniforms.offset.value.set(
          (-direction.x+travelX+smoothedPointer.x*.07)*depth,
          (-direction.y+travelY+smoothedPointer.y*.07)*depth,
        );
      }
    },
    dispose(){for(const {geometry,material} of layers){geometry.dispose();material.dispose();}},
  };
}
