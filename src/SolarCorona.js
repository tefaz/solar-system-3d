import * as THREE from 'three';

// Separate soft ribbons appear at fixed angles for each event. Their lifetimes
// are staggered, so the corona never scrolls or rotates as a radial texture.
export function createSolarCorona(time){
  const group=new THREE.Group();
  const haloMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:time},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <logdepthbuf_pars_fragment>
      varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        float r=length((vUv*2.0-1.0)*1.55);
        float outside=max(r-1.0,0.0);
        float halo=(exp(-outside*18.0)*.28+exp(-outside*7.0)*.035)
          *smoothstep(.985,1.025,r)*(1.0-smoothstep(1.35,1.55,r));
        gl_FragColor=vec4(1.25,.025,.010,halo);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(3.1,3.1),haloMaterial);
  halo.raycast=()=>{};group.add(halo);

  const count=192;
  const geometry=new THREE.PlaneGeometry(1,1,1,20);
  geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i+1),1));
  const rayMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:time},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uTime;attribute float aSeed;
      varying vec2 vUv;varying float vOpacity;varying vec3 vColor;
      float hash(float x){return fract(sin(x*127.1)*43758.5453);}
      void main(){
        vUv=uv;
        // Three staggered ribbons share each angular sector. At least two
        // are alive at once, preventing random gaps in the corona.
        float sector=floor((aSeed-1.0)/3.0);
        float sibling=mod(aSeed-1.0,3.0);
        float period=mix(3.0,6.5,hash(sector+17.0));
        float clock=uTime/period+hash(sector+43.0)+sibling/3.0;
        float event=floor(clock);
        float age=fract(clock);
        float seed=aSeed*19.73+event*73.19;
        // Every event has a rest interval. Shape and angle stay still while
        // the ribbon fades in and out; the next event gets a fresh placement.
        float life=age/.88;
        vOpacity=smoothstep(0.0,.10,life)*(1.0-smoothstep(.68,1.0,life))*mix(.32,.68,hash(seed+4.0));
        float angle=(sector+hash(seed)*1.4-.2)/64.0*6.2831853;
        vec2 direction=vec2(cos(angle),sin(angle));
        vec2 tangent=vec2(-direction.y,direction.x);
        float lengthChoice=hash(seed+1.0);
        float reach=mix(.22,1.35,pow(lengthChoice,1.5));
        // Most rays stay near the surface; a smaller population reaches well
        // beyond them, up to 2.4 solar radii out from the limb.
        reach=mix(reach,mix(1.5,2.4,lengthChoice),step(.78,hash(seed+6.0)));
        float width=mix(.035,.105,hash(seed+2.0));
        float bend=sin(uv.y*3.14159)*mix(-.012,.012,hash(seed+3.0));
        float taper=1.0-uv.y*.75;
        vec2 p=direction*(1.005+uv.y*reach)+tangent*((uv.x-.5)*width*taper+bend);
        float warmth=hash(seed+5.0);
        vec3 red=mix(vec3(1.15,.018,.008),vec3(1.65,.065,.018),warmth);
        vec3 golden=mix(vec3(1.65,.30,.035),vec3(2.0,.72,.08),hash(seed+7.0));
        vColor=mix(red,golden,step(.68,warmth));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,0.0,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <logdepthbuf_pars_fragment>
      varying vec2 vUv;varying float vOpacity;varying vec3 vColor;
      void main(){
        #include <logdepthbuf_fragment>
        float across=(vUv.x-.5)*2.0;
        float fuzzy=exp(-across*across*5.5)*(1.0-smoothstep(.65,1.0,abs(across)));
        float along=smoothstep(0.0,.04,vUv.y)*pow(1.0-vUv.y,1.15);
        gl_FragColor=vec4(vColor,fuzzy*along*vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const rays=new THREE.InstancedMesh(geometry,rayMaterial,count);
  // Placement happens in the shader; its bounds extend past the base quad.
  rays.frustumCulled=false;rays.raycast=()=>{};
  group.add(rays);
  return group;
}
