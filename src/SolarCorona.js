import * as THREE from 'three';

const vertexShader=`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uLimb;
  varying vec2 vUv;
  void main(){
    vUv=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position.xy*uLimb,position.z,1.0);
    #include <logdepthbuf_vertex>
  }
`;

const noise=`
  float hash(vec2 p){
    p=fract(p*vec2(123.34,456.21));
    p+=dot(p,p+45.32);
    return fract(p.x*p.y);
  }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
      mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=.5;
    for(int i=0;i<4;i++){
      v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+17.1;a*=.5;
    }
    return v;
  }
`;

// A continuous radiance field keeps the corona soft at every zoom level.
// The broad optical halo and turbulent plasma share the exact projected limb.
export function createSolarCorona(time){
  const group=new THREE.Group();
  const limb={value:1};
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:time,uLimb:limb},transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,vertexShader,
    fragmentShader:`
      #include <logdepthbuf_pars_fragment>
      uniform float uTime,uLimb;
      varying vec2 vUv;
      ${noise}
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p=(vUv*2.0-1.0)*4.5;
        float r=length(p);
        if(r<.965||r>4.45)discard;
        float h=max(0.0,r-1.0);
        vec2 direction=p/max(r,.001);
        float t=uTime*.35;
        // The near-surface turbulence evolves continuously, but stays short.
        // Long plumes have independent lifetimes and fresh locations per event.
        float shape=fbm(direction*4.5+vec2(.45,-.32)*t);
        float fine=fbm(direction*21.0+vec2(h*2.7-t,t*.3));
        float strands=pow(fine,2.4);
        float turbulence=fbm(direction*11.0+vec2(h*5.0-t*1.8,t*.4));
        float rays=exp(-h/(.16+shape*.22))*(.3+strands*2.5);
        float streamers=0.0;
        for(int i=0;i<12;i++){
          float slot=float(i);
          float period=mix(5.5,10.5,hash(vec2(slot,19.0)));
          float clock=uTime/period+hash(vec2(slot,7.0));
          float age=fract(clock),event=floor(clock);
          vec2 seed=vec2(slot+3.0,event+11.0);
          float life=smoothstep(0.0,.14,age)*(1.0-smoothstep(.55,1.0,age));
          // Change direction only while invisible between episodes. Within
          // an episode, plasma expands outward and the plume gently bends.
          float angle=hash(seed)*6.2831853;
          angle+=sin(h*1.7-age*2.0+slot)*h*.045;
          vec2 axis=vec2(cos(angle),sin(angle));
          float width=mix(.065,.19,hash(seed+13.0))*(1.0+h*.22);
          float angular=exp(-2.0*(1.0-dot(direction,axis))/(width*width));
          float reach=mix(.9,3.1,hash(seed+31.0))*(.15+.85*smoothstep(0.0,.85,age));
          float front=1.0-smoothstep(reach*.55,reach,h);
          float outflow=.65+.35*sin(h*11.0-uTime*2.8+slot);
          // Keep the base luminous, then soften the plume rapidly with distance.
          float distanceFade=exp(-h*1.65-h*h*.35);
          streamers+=angular*life*front*distanceFade*outflow;
        }
        streamers*=.45+strands*3.5;
        float filaments=exp(-h*3.4)*smoothstep(.36,.74,turbulence);
        float breath=1.0+.055*sin(uTime*.65)+.025*sin(uTime*1.17);
        // Short, intense bloom at the photosphere grades into amber and
        // copper. The faint, wider falloff supplies an optical glow.
        vec3 radiance=vec3(1.0,.68,.27)*exp(-h*24.0)*1.35;
        radiance+=vec3(1.0,.31,.055)*exp(-h*7.0)*.48;
        radiance+=vec3(1.0,.24,.035)*rays*.75;
        radiance+=vec3(1.0,.42,.10)*streamers*.85;
        radiance+=vec3(1.0,.13,.018)*filaments*.25;
        radiance+=vec3(1.0,.28,.055)*exp(-h*1.8)*.075;
        radiance+=vec3(1.0,.11,.025)*exp(-h*.85)*.018;
        float edge=smoothstep(.965,.995,r)*(1.0-smoothstep(3.6,4.45,r));
        gl_FragColor=vec4(radiance*breath,edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(9,9),material);
  halo.frustumCulled=false;halo.raycast=()=>{};group.add(halo);

  // Arched ribbons trace prominences instead of straight radial spikes.
  // A warm outer sheath and a finer gold core share the same geometry.
  const count=16;
  const geometry=new THREE.PlaneGeometry(1,1,6,72);
  geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i+1),1));
  const prominenceMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:time,uLimb:limb},transparent:true,depthWrite:false,
    side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uTime,uLimb;
      attribute float aSeed;
      varying vec2 vUv;
      varying float vLife;
      float hash(float n){return fract(sin(n*127.1)*43758.5453);}
      void main(){
        vUv=uv;
        float period=mix(7.0,13.0,hash(aSeed+1.0));
        float clock=uTime/period+hash(aSeed*3.7);
        float age=fract(clock),event=floor(clock);
        float seed=aSeed+event*31.0;
        vLife=smoothstep(.0,.16,age)*(1.0-smoothstep(.62,1.0,age));
        float angle=hash(seed*7.13)*6.2831853;
        vec2 radial=vec2(cos(angle),sin(angle)),tangent=vec2(-radial.y,radial.x);
        float span=mix(.07,.25,hash(seed+4.0));
        float height=mix(.09,.52,pow(hash(seed+8.0),1.6))*(.65+.35*vLife);
        float phase=uv.y*3.14159265;
        // Both feet meet the spherical limb. A little irregularity makes
        // the arch look like flowing plasma rather than a perfect ellipse.
        float x=-cos(phase)*span;
        float base=sqrt(max(0.0,1.0-x*x));
        float y=base+sin(phase)*height;
        y+=sin(phase)*sin(phase*7.0+uTime*.8+aSeed)*.016;
        x+=sin(phase)*sin(phase*4.0-uTime*.25+aSeed)*.025;
        vec2 derivative=vec2(sin(phase)*span,cos(phase)*height);
        vec2 normal=normalize(vec2(-derivative.y,derivative.x));
        float width=mix(.035,.075,hash(seed+12.0))*(.7+.3*sin(phase));
        vec2 local=vec2(x,y)+normal*(uv.x-.5)*width;
        vec2 p=(tangent*local.x+radial*local.y)*uLimb;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,0.0,1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader:`
      #include <logdepthbuf_pars_fragment>
      uniform float uTime;
      varying vec2 vUv;
      varying float vLife;
      void main(){
        #include <logdepthbuf_fragment>
        float x=(vUv.x-.5)*2.0;
        x+=sin(vUv.y*37.0-uTime*.7)*.12;
        float sheath=exp(-x*x*4.0)*(1.0-smoothstep(.65,1.0,abs(x)));
        float core=exp(-x*x*45.0);
        float thread=exp(-pow((x-.28)*10.0,2.0))*.3;
        float flow=.75+.25*sin(vUv.y*48.0-uTime*2.4);
        float ends=smoothstep(0.0,.05,vUv.y)*(1.0-smoothstep(.95,1.0,vUv.y));
        vec3 color=vec3(1.0,.09,.009)*sheath*.65+vec3(1.0,.38,.065)*(core+thread)*.55;
        gl_FragColor=vec4(color,sheath*vLife*ends*flow*.7);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const prominences=new THREE.InstancedMesh(geometry,prominenceMaterial,count);
  prominences.frustumCulled=false;prominences.raycast=()=>{};group.add(prominences);
  group.userData.update=(distanceInSolarRadii)=>{
    // The silhouette of a sphere projects larger than its equatorial plane
    // nearby. Compensate so the glowing limb never detaches while zooming.
    const d=Math.max(1.05,distanceInSolarRadii);
    limb.value=d/Math.sqrt(d*d-1);
  };
  return group;
}
