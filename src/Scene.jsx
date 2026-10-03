import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {AU, bodies, getBody} from './data';
import {createStarfield} from './Starfield';
import {createInteriorCutaway} from './InteriorCutaway';
import {createInteriorCallout} from './InteriorCallout';
import {getInterior} from './interiors';
import {createSolarCorona} from './SolarCorona';
import {createMagneticField} from './MagneticField';
import {createMarsRobotMarkers} from './MarsRobotMarkers';
import {getMarsRobot} from './marsRobots';
import {OVERVIEW_DISTANCE,orbitRadius,orbitalPosition} from './orbits';

export default function Scene({selected, onSelect, activeRobot, onSelectRobot, cutaway, activeLayer, onSelectLayer, interiorModel, magnetic, orbits, labels, resetToken, onError}) {
  const host=useRef(null), engine=useRef(null);
  const state=useRef({selected,activeRobot,cutaway,activeLayer,interiorModel,magnetic,orbits,labels});
  state.current={selected,activeRobot,cutaway,activeLayer,interiorModel,magnetic,orbits,labels};
  const callbacks=useRef({onSelect,onSelectRobot,onSelectLayer,onError}); callbacks.current={onSelect,onSelectRobot,onSelectLayer,onError};
  useEffect(()=>{
    const container=host.current;
    let renderer;
    try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,logarithmicDepthBuffer:true});}
    catch {callbacks.current.onError('Your browser could not start WebGL. Please enable hardware acceleration to explore the 3D scene.');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.localClippingEnabled=true;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(38,1,.01,AU*130);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true; controls.dampingFactor=.065; controls.enableZoom=false; controls.enablePan=true;
    controls.rotateSpeed=.5;
    controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};
    const starfield=createStarfield(renderer);
    let seed=731; const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
    scene.add(new THREE.AmbientLight(0xb1c2d5, .7));
    const light=new THREE.DirectionalLight(0xffedda,3.1); light.position.set(-250,180,300);scene.add(light);
    light.castShadow=true; light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.00015;
    const loader=new THREE.TextureLoader(), textures={};
    const tex=id=>{
      if(!textures[id]) {textures[id]=loader.load(`/textures/${id==='rings'?'rings.png':id+'.jpg'}`,undefined,undefined,()=>callbacks.current.onError(`The ${id} texture could not load. Please reload to try again.`)); textures[id].colorSpace=THREE.SRGBColorSpace; textures[id].anisotropy=renderer.capabilities.getMaxAnisotropy();}
      return textures[id];
    };
    // Compress orbital spacing only for navigation; close-up radii stay physical.
    const overviewRadii={sun:18,mercury:6,venus:8,earth:9,mars:7,jupiter:16,saturn:12,uranus:11,neptune:11,pluto:7,moon:3.2};
    const meshes=new Map(), orbitGroup=new THREE.Group(), markers=new Map();
    scene.add(orbitGroup);
    const sphere=new THREE.SphereGeometry(1,80,48);
    const clipping=new THREE.Plane(new THREE.Vector3(0,0,-1),1e20);
    const interior=createInteriorCutaway(); scene.add(interior.mesh);
    const interiorCallout=createInteriorCallout(container);
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const magneticField=createMagneticField();scene.add(magneticField.group);
    let cutawayBody=null,viewShift=0,fieldZoom=1;
    const solarNoise=`
      float solarHash(vec3 p) {
        p=fract(p*.3183099+vec3(.17,.31,.53));
        p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
      }
      float solarNoise(vec3 p) {
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(solarHash(i),solarHash(i+vec3(1,0,0)),f.x),
          mix(solarHash(i+vec3(0,1,0)),solarHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(solarHash(i+vec3(0,0,1)),solarHash(i+vec3(1,0,1)),f.x),
          mix(solarHash(i+vec3(0,1,1)),solarHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float solarFbm(vec3 p) {
        return solarNoise(p)*.55+solarNoise(p*2.03)*.28+solarNoise(p*4.07)*.14;
      }
    `;
    const solarTime={value:0};
    const sunMat=new THREE.MeshBasicMaterial({map:tex('sun'),color:0xffffff,clippingPlanes:[clipping]});
    sunMat.onBeforeCompile=shader=>{
      shader.uniforms.uTime=solarTime;
      shader.vertexShader='varying vec3 vSolarPosition;\nvarying vec3 vSolarNormal;\nvarying vec3 vSolarView;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSolarPosition=normalize(position);\nvSolarNormal=normalize(normalMatrix*normal);\nvSolarView=normalize(-(modelViewMatrix*vec4(position,1.0)).xyz);');
      shader.fragmentShader='uniform float uTime;\nvarying vec3 vSolarPosition;\nvarying vec3 vSolarNormal;\nvarying vec3 vSolarView;\n'+solarNoise+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
        vec3 flow=vSolarPosition*7.0+vec3(uTime*.22,-uTime*.3,uTime*.16);
        vec3 warp=vec3(solarFbm(flow),solarFbm(flow+11.0),solarFbm(flow+23.0))-.5;
        vec2 solarUV=vMapUv+warp.xy*.04+vec2(uTime*.003,0.0);
        vec3 surface=texture2D(map,solarUV).rgb;
        float cells=solarFbm(vSolarPosition*24.0+warp*4.0+vec3(-uTime*.65,uTime*.42,uTime*.3));
        float grain=solarNoise(vSolarPosition*100.0+warp*6.0+vec3(uTime*.85));
        float brightness=dot(surface,vec3(.3,.6,.1));
        float hot=smoothstep(.23,.76,brightness*.35+cells*.65+grain*.22);
        float granules=smoothstep(.28,.72,grain)*.28;
        vec3 plasma=mix(vec3(.85,.065,.006),vec3(2.65,.72,.065),hot);
        plasma+=vec3(1.4,.52,.075)*granules;
        float facing=clamp(dot(normalize(vSolarNormal),normalize(vSolarView)),0.0,1.0);
        float limb=pow(1.0-facing,3.0);
        // Limb darkening preserves the spherical form; a narrow incandescent
        // edge joins the photosphere to the corona without flattening texture.
        plasma*=.68+.32*pow(facing,.35);
        plasma+=vec3(2.2,.82,.13)*pow(limb,3.0);
        diffuseColor.rgb*=plasma*(.65+brightness*.35+cells*.35);
        #endif`);
    };
    let corona;
    bodies.filter(p=>p.id!=='belt').forEach(body=>{
      const r=body.radius/1000,group=new THREE.Group();
      const material=body.id==='sun'?sunMat:new THREE.MeshStandardMaterial({map:tex(body.id),roughness:1,clippingPlanes:[clipping]});
      const mesh=new THREE.Mesh(sphere,material);mesh.scale.setScalar(r);mesh.castShadow=body.id!=='sun';mesh.receiveShadow=true;group.add(mesh);
      if(body.id==='pluto'){
        mesh.rotation.y=-Math.PI/2;
        // Preserve the NASA mosaic. Black map gaps are shown as a neutral
        // untextured surface rather than as observed dark terrain.
        material.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            if(max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))<.008)diffuseColor.rgb=vec3(.24,.23,.22);
          `);
        };
      }
      if(body.id==='saturn') {
        const ringGeo=new THREE.RingGeometry(r*1.24,r*2.32,160,8);const pos=ringGeo.attributes.position,uv=ringGeo.attributes.uv;
        for(let i=0;i<pos.count;i++) {const length=Math.hypot(pos.getX(i),pos.getY(i));uv.setXY(i,(length-r*1.24)/(r*1.08),.5);}
        const ring=new THREE.Mesh(ringGeo,new THREE.MeshStandardMaterial({map:tex('rings'),transparent:true,side:THREE.DoubleSide,roughness:1,alphaTest:.04,opacity:.95}));
        ring.rotation.x=-Math.PI/2;ring.receiveShadow=true;ring.castShadow=true;group.add(ring);group.rotation.z=-.35;
      }
      if(body.id==='sun') {corona=createSolarCorona(solarTime);corona.scale.setScalar(r);group.add(corona);}
      if(body.id==='earth') {const cloud=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({map:tex('clouds'),transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false,clippingPlanes:[clipping]}));cloud.scale.setScalar(r*1.008);group.add(cloud);}
      group.userData={body,mesh,r};meshes.set(body.id,group);scene.add(group);
      const marker=document.createElement('button');marker.className='scene-marker';marker.setAttribute('aria-label',`Explore ${body.name}`);marker.dataset.bodyId=body.id;marker.innerHTML=`<span class="marker-dot" style="--planet-color:${body.color}"></span><span>${body.name}</span>`;
      marker.addEventListener('click',e=>callbacks.current.onSelect(e.detail?pickMarker(e.clientX,e.clientY)?.dataset.bodyId||body.id:body.id));marker.addEventListener('mouseenter',()=>hovered=body.id);marker.addEventListener('mouseleave',()=>hovered=null);
      container.appendChild(marker);markers.set(body.id,marker);
      if(body.au && body.id!=='moon') {
        const points=[];for(let i=0;i<1024;i++)points.push(orbitalPosition(body,body.angle+i/1024*Math.PI*2));
        orbitGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:body.id==='pluto'?0xa4937d:0x53666b,transparent:true,opacity:body.id==='pluto'?.38:.26})));
      }
    });
    // Charon stays attached to Pluto through overview/focus scale transitions.
    // Relative radii are physical; separation is compressed for this diagram.
    const plutoGroup=meshes.get('pluto'),charonOrbit=new THREE.Group();
    charonOrbit.rotation.x=.45;
    plutoGroup.add(charonOrbit);
    const charon=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({color:0xa8a5a2,roughness:1}));
    charon.scale.setScalar(.606);charon.castShadow=true;charon.receiveShadow=true;
    charonOrbit.add(charon);
    const charonDistance=plutoGroup.userData.r*3;
    const charonPoints=Array.from({length:192},(_,i)=>new THREE.Vector3(Math.cos(i/192*Math.PI*2)*charonDistance,0,Math.sin(i/192*Math.PI*2)*charonDistance));
    const charonPath=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(charonPoints),new THREE.LineBasicMaterial({color:0xb6aca1,transparent:true,opacity:.35}));
    charonOrbit.add(charonPath);
    const charonLabel=document.createElement('span');
    charonLabel.className='satellite-label';charonLabel.textContent='Charon';charonLabel.style.display='none';container.appendChild(charonLabel);
    let charonAngle=.3;
    const charonWorld=new THREE.Vector3();
    const robotMarkers=createMarsRobotMarkers(container,id=>callbacks.current.onSelectRobot(id));
    let turningToRobot=null,robotYaw=null;
    const beltGeo=new THREE.BufferGeometry(),beltPositions=[];
    for(let i=0;i<6500;i++){const a=random()*Math.PI*2,r=orbitRadius(2.2+random()*1.1);beltPositions.push(Math.cos(a)*r,(random()-.5)*AU*.04,Math.sin(a)*r);}
    beltGeo.setAttribute('position',new THREE.Float32BufferAttribute(beltPositions,3));
    const belt=new THREE.Points(beltGeo,new THREE.PointsMaterial({color:0xb2a491,size:1.1,sizeAttenuation:false,transparent:true,opacity:.4}));scene.add(belt);
    const beltMarker=document.createElement('button');beltMarker.className='scene-marker belt-marker';beltMarker.dataset.bodyId='belt';beltMarker.setAttribute('aria-label','Explore asteroid belt');beltMarker.innerHTML='<span class="marker-dot"></span><span>Asteroid belt</span>';
    beltMarker.addEventListener('click',e=>callbacks.current.onSelect(e.detail?pickMarker(e.clientX,e.clientY)?.dataset.bodyId||'belt':'belt'));beltMarker.addEventListener('mouseenter',()=>hovered='belt');beltMarker.addEventListener('mouseleave',()=>hovered=null);container.appendChild(beltMarker);markers.set('belt',beltMarker);
    let hovered=null,current=null,frame,transition=null,last=performance.now(),zoomMarker=null,zoomCursor=null,exitDistance=Infinity,overviewPose=null,approachPose=null,pendingOverviewPose=null;
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    // Overlapping hit areas must select the closest actual dot, rather than
    // whichever button happened to be added to the DOM last.
    function pickMarker(clientX,clientY){
      const rect=container.getBoundingClientRect();let nearest=null,distance=Infinity;
      for(const marker of markers.values()){
        if(marker.style.display==='none'||marker.style.visibility==='hidden')continue;
        const d=Math.hypot(Number(marker.dataset.screenX)-(clientX-rect.left),Number(marker.dataset.screenY)-(clientY-rect.top));
        if(d<=Number(marker.dataset.hitRadius||12)&&d<distance-.5){nearest=marker;distance=d;}
      }
      return nearest;
    }
    let raisedMarker=null;
    const emphasizeNearest=e=>{
      const nearest=pickMarker(e.clientX,e.clientY);
      if(nearest===raisedMarker)return;
      if(raisedMarker)raisedMarker.style.zIndex='';
      raisedMarker=nearest;
      if(raisedMarker)raisedMarker.style.zIndex='4';
    };
    container.addEventListener('pointermove',emphasizeNearest,true);
    const syncControls=(position,target)=>{
      // Drain drag damping without rendering its effect, then synchronize the
      // controls to the exact animation endpoint. This also prevents stale
      // overview momentum from nudging the fitted view on its first frame.
      const damping=controls.enableDamping;
      controls.enableDamping=false;controls.update();
      camera.position.copy(position);controls.target.copy(target);
      controls.enableDamping=damping;controls.enabled=true;controls.update();
    };
    const captureOverview=()=>({position:camera.position.clone(),target:controls.target.clone(),near:camera.near,far:camera.far});
    const setView=(id,immediate=false)=>{
      zoomMarker=null;zoomCursor=null;
      const previous=current;
      if(previous===null&&id!==null){
        overviewPose=pendingOverviewPose||captureOverview();
      }
      approachPose=null;pendingOverviewPose=null;
      const previousOrigin=previous&&previous!=='belt'?bodyPosition(getBody(previous),new THREE.Vector3()):new THREE.Vector3();
      const nextOrigin=id&&id!=='belt'?bodyPosition(getBody(id),new THREE.Vector3()):new THREE.Vector3();
      const fromTarget=controls.target.clone().add(previousOrigin).sub(nextOrigin);
      const from=camera.position.clone();
      if(previous&&previous!=='belt')from.add(bodyPosition(getBody(previous),new THREE.Vector3()));
      if(id&&id!=='belt')from.sub(bodyPosition(getBody(id),new THREE.Vector3()));
      current=id; const body=getBody(id);
      if(id==='mars'&&previous!=='mars'){meshes.get('mars').userData.mesh.rotation.y=THREE.MathUtils.degToRad(160);turningToRobot=null;robotYaw=null;}
      const r=body?.radius/1000;
      const fit=container.clientWidth<=800?Math.max(1,container.clientHeight/container.clientWidth*1.18):1;
      fieldZoom=id&&state.current.magnetic?1.55:1;
      const distance=id==='belt'?AU*20*fit:id?r*(id==='saturn'?7.4:id==='pluto'?12:5.2)*fit*fieldZoom:OVERVIEW_DISTANCE*fit;
      controls.minDistance=id&&id!=='belt'?r*1.8:.001;
      controls.maxDistance=id&&id!=='belt'?r*30:AU*150*fit;
      const end=new THREE.Vector3(0,distance*.24,distance);
      if(!id || id==='belt') end.set(distance*.25,distance*.78,distance*.65);
      const restoring=id===null&&previous!==null&&overviewPose;
      const endTarget=restoring?overviewPose.target.clone():new THREE.Vector3();
      if(restoring)end.copy(overviewPose.position);
      exitDistance=id?end.length()*2.2:Infinity;
      if(id&&id!=='belt'&&overviewPose){
        const entryDistance=overviewPose.position.distanceTo(nextOrigin);
        exitDistance=Math.min(exitDistance,Math.max(end.length()*1.15,entryDistance));
      }
      if(id&&id!=='belt')controls.maxDistance=Math.max(r*30,end.length()*3);
      const scales=new Map([...meshes].map(([key,group])=>[key,{from:group.scale.x,to:id&&id!=='belt'?1:group.userData.overviewScale||1}]));
      transition={from,end,fromTarget,endTarget,scales,start:performance.now(),duration:immediate?0:1250};
      controls.enabled=immediate;
      if(immediate){syncControls(end,endTarget);transition=null;}
      else controls.target.copy(fromTarget);
      const shadowR=id && id!=='belt'?r*3:AU*35;
      light.position.set(-shadowR*2,shadowR*2,shadowR*3);
      Object.assign(light.shadow.camera,{left:-shadowR,right:shadowR,top:shadowR,bottom:-shadowR,near:shadowR*.01,far:shadowR*10});light.shadow.camera.updateProjectionMatrix();
      light.castShadow=!!id&&id!=='belt';
      camera.near=restoring?overviewPose.near:id&&id!=='belt'?r*.002:10;
      camera.far=restoring?overviewPose.far:Math.max(AU*130,distance*4);camera.updateProjectionMatrix();
    };
    const resize=()=>{
      const w=container.clientWidth,h=container.clientHeight;
      renderer.setSize(w,h);camera.aspect=w/h;starfield.resize(w/h);
      camera.clearViewOffset();camera.updateProjectionMatrix();
      // Calibrate readable world-space sizes once for the full overview.
      // Keep those sizes fixed while zooming so every scroll magnifies a body.
      const fit=w<=800?Math.max(1,h/w*1.18):1,distance=OVERVIEW_DISTANCE*fit;
      const reference=new THREE.Vector3(distance*.25,distance*.78,distance*.65);
      const forward=reference.clone().normalize().negate();
      const mobileScale=Math.min(1,Math.max(.65,w/900));
      meshes.forEach((group,id)=>{
        const depth=bodyPosition(group.userData.body,new THREE.Vector3()).sub(reference).dot(forward);
        const unitsPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/h;
        group.userData.overviewScale=Math.max(1,unitsPerPixel*overviewRadii[id]*mobileScale/group.userData.r);
      });
    };
    const observer=new ResizeObserver(()=>{resize();setView(state.current.selected,true);});observer.observe(container);
    // Seed a real overview before a focused scene is mounted (e.g. when
    // returning from the driving demo). A new camera starts at the origin.
    setView(null,true);resize();
    if(state.current.selected)setView(state.current.selected,true);
    const position=new THREE.Vector3(),origin=new THREE.Vector3(),projected=new THREE.Vector3(),viewNormal=new THREE.Vector3();
    function bodyPosition(body,target){
      const angle=body.angle;
      orbitalPosition(body,angle,target);
      if(body.id==='moon'){
        const earth=getBody('earth'),earthGroup=meshes.get('earth');
        // Match lunar spacing to the enlarged overview Earth. Keeping this
        // diagram position fixed also lets clicks, cursor zoom and focus
        // transitions all aim at the visible Moon. Close-up radii stay real.
        const separation=Math.max(384.4,earth.radius/1000*(earthGroup?.userData.overviewScale||1)*3.8);
        target.set(Math.cos(earth.angle)*orbitRadius(1)+separation*.94,separation*.342,Math.sin(earth.angle)*orbitRadius(1));
      }
      return target;
    };
    const animate=now=>{
      frame=requestAnimationFrame(animate);
      const dt=Math.min((now-last)/1000,.08);last=now;
      const s=state.current;
      if(current!==s.selected)setView(s.selected);
      origin.set(0,0,0);if(s.selected&&s.selected!=='belt')bodyPosition(getBody(s.selected),origin);
      orbitGroup.position.copy(origin).negate();orbitGroup.visible=s.orbits && (!s.selected||s.selected==='belt');belt.position.copy(origin).negate();belt.visible=!s.selected||s.selected==='belt';
      meshes.forEach((group,id)=>{
        const {body,mesh}=group.userData;
        bodyPosition(body,position);group.position.copy(position).sub(origin);
        group.visible=!s.selected||id===s.selected;
        if(id==='mars'&&s.selected==='mars'){
          if(s.activeRobot!==turningToRobot&&!transition){
            turningToRobot=s.activeRobot;
            const robot=getMarsRobot(s.activeRobot);
            robotYaw=robot?Math.atan2(-camera.position.z,camera.position.x)-THREE.MathUtils.degToRad(robot.lon):null;
          }
          if(robotYaw!==null&&!transition){
            const delta=Math.atan2(Math.sin(robotYaw-mesh.rotation.y),Math.cos(robotYaw-mesh.rotation.y));
            mesh.rotation.y+=delta*(1-Math.exp(-dt*6));
          }else if(!s.activeRobot&&!robotMarkers.interacting)mesh.rotation.y+=dt*.045;
        }else mesh.rotation.y+=dt*.045;
      });
      if(transition){
        const t=transition.duration?Math.min((now-transition.start)/transition.duration,1):1,eased=1-Math.pow(1-t,4);
        const fromOffset=transition.from.clone().sub(transition.fromTarget),endOffset=transition.end.clone().sub(transition.endTarget);
        const fromD=Math.max(fromOffset.length(),.001),endD=Math.max(endOffset.length(),.001);
        const direction=fromOffset.normalize().lerp(endOffset.normalize(),eased);
        if(direction.lengthSq()<1e-12)direction.copy(endOffset);
        direction.normalize();
        const radius=Math.exp(Math.log(fromD)+(Math.log(endD)-Math.log(fromD))*eased);
        const targetProgress=Math.abs(endD-fromD)>1e-6?THREE.MathUtils.clamp((radius-fromD)/(endD-fromD),0,1):eased;
        controls.target.lerpVectors(transition.fromTarget,transition.endTarget,targetProgress);
        camera.position.copy(controls.target).add(direction.multiplyScalar(radius));
        camera.lookAt(controls.target);
        meshes.forEach((group,id)=>{
          const scale=transition.scales.get(id);
          group.scale.setScalar(Math.exp(Math.log(scale.from)+(Math.log(scale.to)-Math.log(scale.from))*eased));
        });
        if(t===1){syncControls(transition.end,transition.endTarget);transition=null;}
      }
      if(!transition&&s.selected&&s.selected!=='belt'){
        const next=THREE.MathUtils.lerp(fieldZoom,s.magnetic?1.55:1,Math.min(1,dt*8));
        const ratio=next/fieldZoom;
        camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
        exitDistance*=ratio;controls.maxDistance*=ratio;fieldZoom=next;
      }
      // Keep the cut face above the expanded card on narrow screens. Shift
      // the projection rather than the orbit target, preserving rotation and
      // zoom around the actual center of the body.
      const card=container.parentElement.querySelector('.robot-popup')||container.parentElement.querySelector('.planet-card');
      const desiredShift=(s.cutaway||s.magnetic||s.selected==='mars')&&container.clientWidth<=600&&card
        ?Math.max(0,container.clientHeight/2-(70+card.offsetTop)/2):0;
      viewShift=THREE.MathUtils.lerp(viewShift,desiredShift,Math.min(1,dt*12));
      if(Math.abs(viewShift-desiredShift)<.1)viewShift=desiredShift;
      if(viewShift>0)camera.setViewOffset(container.clientWidth,container.clientHeight,0,viewShift,container.clientWidth,container.clientHeight);
      else if(camera.view?.enabled)camera.clearViewOffset();
      // OrbitControls clamps every update, even when disabled. During a flight
      // the camera can still be at overview distance, so do not run it until
      // both the camera and planet scale have reached their fitted endpoints.
      if(!transition)controls.update();
      // Overview sizes stay fixed in world space. Camera and body scales blend
      // together during focus/return, preserving smooth apparent magnification.
      const forward=camera.getWorldDirection(new THREE.Vector3());
      meshes.forEach((group,id)=>{
        const depth=Math.max(0,group.position.clone().sub(camera.position).dot(forward));
        const unitsPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/container.clientHeight;
        if(!transition)group.scale.setScalar(s.selected&&s.selected!=='belt'?1:group.userData.overviewScale);
        const pixelRadius=unitsPerPixel>0?group.userData.r*group.scale.x/unitsPerPixel:0;
        const hitRadius=Math.max(12,Math.min(120,pixelRadius*(id==='saturn'?2.32:1)+4));
        const marker=markers.get(id);marker.dataset.hitRadius=hitRadius;marker.dataset.screenRadius=pixelRadius;
        marker.style.width=marker.style.height=`${hitRadius*2}px`;
        marker.lastElementChild.style.left=`${hitRadius+5}px`;
      });
      // Project markers after camera movement. Their dots always stay at
      // the body's actual position; only the hover label sits beside the dot.
      container.classList.toggle('show-labels',s.labels);
      const projectMarker=(marker,center)=>{
        marker.style.display=!s.selected?'flex':'none';
        projected.copy(center).project(camera);
        const x=(projected.x+1)*container.clientWidth/2,y=(1-projected.y)*container.clientHeight/2;
        marker.dataset.screenX=x;marker.dataset.screenY=y;
        marker.style.left=`${x}px`;marker.style.top=`${y}px`;
        marker.style.visibility=projected.z>-1&&projected.z<1&&x>=0&&x<=container.clientWidth&&y>=0&&y<=container.clientHeight?'visible':'hidden';
      };
      meshes.forEach((group,id)=>projectMarker(markers.get(id),group.position));
      projectMarker(beltMarker,new THREE.Vector3(orbitRadius(2.7),0,0));
      const body=getBody(s.selected),r=body?.radius/1000;
      interior.mesh.visible=!!body&&body.layers.length>0&&s.cutaway;
      if(interior.mesh.visible){
        if(cutawayBody!==body.id){
          cutawayBody=body.id;
          // Tilt the center cut relative to the entry camera so both the
          // textured hemisphere and the interior face are visible together.
          const cameraRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
          viewNormal.copy(camera.position).sub(meshes.get(body.id).position).normalize().addScaledVector(cameraRight,.85).normalize();
          clipping.normal.copy(viewNormal).negate();clipping.constant=0;
          interior.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),viewNormal);
        }
        // The cap follows the globe's scale during arrival/return transitions.
        interior.mesh.scale.setScalar(r*meshes.get(body.id).scale.x);
        interior.mesh.position.copy(meshes.get(body.id).position);
        interior.update(getInterior(body.id,s.interiorModel),s.activeLayer,reducedMotion.matches?0:now/1000);
      }else {clipping.constant=1e20;cutawayBody=null;}
      interiorCallout.update(getInterior(s.selected,s.interiorModel),s.activeLayer,interior.mesh,camera,Number(markers.get(s.selected)?.dataset.screenRadius)||0,interior.mesh.visible&&!transition);
      charonAngle+=dt*.16;
      charon.position.set(Math.cos(charonAngle)*charonDistance,0,Math.sin(charonAngle)*charonDistance);
      charon.rotation.y=-charonAngle;
      charonOrbit.visible=s.selected==='pluto';
      charonPath.visible=s.orbits;
      charonLabel.style.display='none';
      if(charonOrbit.visible&&!transition){
        charon.getWorldPosition(charonWorld);projected.copy(charonWorld).project(camera);
        const x=(projected.x+1)*container.clientWidth/2,y=(1-projected.y)*container.clientHeight/2;
        charonLabel.dataset.screenX=x;charonLabel.dataset.screenY=y;
        if(projected.z>-1&&projected.z<1&&x>=0&&x<=container.clientWidth&&y>=0&&y<=container.clientHeight){
          charonLabel.style.display='block';charonLabel.style.left=`${x}px`;charonLabel.style.top=`${y}px`;
        }
      }
      robotMarkers.update(meshes.get('mars').userData.mesh,camera,s.selected==='mars'&&!s.cutaway&&!transition,s.activeRobot);
      magneticField.update(body,s.magnetic,now/1000,dt,body?meshes.get(body.id)?.scale.x||1:1);
      solarTime.value=now/1000;
      corona.quaternion.copy(camera.quaternion);
      const sunGroup=meshes.get('sun');
      corona.userData.update(camera.position.distanceTo(sunGroup.position)/(sunGroup.userData.r*sunGroup.scale.x));
      corona.visible=!(s.selected==='sun'&&s.cutaway>0);
      starfield.update(forward,position.copy(camera.position).add(origin),dt);
      renderer.autoClear=true;renderer.render(starfield.scene,starfield.camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);
    };
    frame=requestAnimationFrame(animate);
    const skyPointerMove=e=>{
      if(e.pointerType==='touch')return;
      const rect=container.getBoundingClientRect();
      starfield.pointerMove((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
    };
    const skyPointerLeave=()=>starfield.pointerLeave();
    container.addEventListener('pointermove',skyPointerMove);
    container.addEventListener('pointerleave',skyPointerLeave);
    const move=e=>{
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects([...meshes.values()].filter(g=>g.visible),true);hovered=hits.length?hits[0].object.parent.userData.body?.id||null:null;
      if(!hovered&&belt.visible){raycaster.params.Points.threshold=AU*.04;if(raycaster.intersectObject(belt).length)hovered='belt';}
      renderer.domElement.style.cursor=hovered||interior.pick(raycaster,camera)!==null?'pointer':'default';
    };
    let downPoint=null;
    const down=e=>{zoomMarker=null;zoomCursor=null;approachPose=null;if(transition||e.button!==0){downPoint=null;return;}downPoint=[e.clientX,e.clientY];};
    const up=e=>{
      if(e.button===0&&!(e.pointerType==='touch'&&touches.size>1)&&downPoint&&Math.hypot(e.clientX-downPoint[0],e.clientY-downPoint[1])<5){
        const rect=renderer.domElement.getBoundingClientRect();
        pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
        const layer=interior.pick(raycaster,camera);
        if(layer!==null)callbacks.current.onSelectLayer(layer);
        else if(hovered&&hovered!==state.current.selected)callbacks.current.onSelect(hovered);
      }
      downPoint=null;
    };
    const orbitPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const zoomAt=(clientX,clientY,factor,markerId=null)=>{
      // Finish automatic framing before accepting leftover scroll momentum.
      if(transition||current!==state.current.selected)return;
      transition=null;
      if(state.current.selected){
        const offset=camera.position.clone().sub(controls.target),d=offset.length();
        const next=THREE.MathUtils.clamp(d*factor,controls.minDistance,controls.maxDistance);
        camera.position.copy(controls.target).add(offset.multiplyScalar(next/d));
        controls.update();
        if(factor>1&&next>=exitDistance)callbacks.current.onSelect(null);
        return;
      }
      // Keep the overview before a scroll/pinch approach, rather than the
      // last frame beside the greatly enlarged planet. Click visits still
      // save their exact current overview framing. Orbit/pan or zooming back
      // to the starting distance ends the approach. Small scroll corrections
      // must not replace a useful overview with a tight planet approach.
      if(factor<1&&!approachPose)approachPose=captureOverview();
      else if(factor>1&&approachPose&&camera.position.distanceTo(controls.target)*factor>=approachPose.position.distanceTo(approachPose.target))approachPose=null;
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
      camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
      const anchor=new THREE.Vector3();
      if(!raycaster.ray.intersectPlane(orbitPlane,anchor)){
        const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),controls.target);
        if(!raycaster.ray.intersectPlane(plane,anchor))return;
      }
      if(zoomCursor&&Math.hypot(clientX-zoomCursor[0],clientY-zoomCursor[1])<12)markerId=zoomMarker;
      else zoomMarker=markerId;
      zoomCursor=[clientX,clientY];
      let candidate=markerId&&markerId!=='belt'?getBody(markerId):null;
      if(!candidate){
        let closest=28;
        meshes.forEach(group=>{
          const point=group.position.clone().project(camera);
          const pixelDistance=Math.hypot((point.x-pointer.x)*rect.width/2,(point.y-pointer.y)*rect.height/2);
          if(point.z<1&&point.z>-1&&pixelDistance<closest){closest=pixelDistance;candidate=group.userData.body;}
        });
      }
      // Zooming a marker aims at the body it represents.
      if(candidate&&markerId){
        const center=bodyPosition(candidate,new THREE.Vector3());
        const correction=center.clone().sub(anchor);
        camera.position.add(correction);controls.target.add(correction);anchor.copy(center);
      }
      const beforeZoom=camera.position.clone(),beforeTarget=controls.target.clone();
      const d=camera.position.distanceTo(controls.target);
      const scale=THREE.MathUtils.clamp(d*factor,controls.minDistance,controls.maxDistance)/d;
      camera.position.sub(anchor).multiplyScalar(scale).add(anchor);
      controls.target.sub(anchor).multiplyScalar(scale).add(anchor);
      camera.near=THREE.MathUtils.clamp(d*scale*1e-7,.001,10);camera.updateProjectionMatrix();controls.update();
      if(factor<1){
        camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
        const movement=new THREE.Line3(beforeZoom,camera.position),closestOnPath=new THREE.Vector3();
        let nearest=null,ratio=Infinity,restoreSafePosition=false;
        meshes.forEach(group=>{
          const radius=group.userData.r*group.scale.x,center=group.position;
          const distance=camera.position.distanceTo(center),normalizedDistance=distance/radius;
          const fit=container.clientWidth<=800?Math.max(1,container.clientHeight/container.clientWidth*1.18):1;
          const threshold=(group.userData.body.id==='saturn'?7.4:group.userData.body.id==='pluto'?12:5.2)*fit*1.4;
          const depth=center.clone().sub(camera.position).dot(raycaster.ray.direction);
          // Capture the visible globe plus a small halo, rather than requiring
          // the cursor to be near the core. The pixel margin adapts to distance.
          const pixelMargin=Math.max(0,depth)*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*32/rect.height;
          const visibleRadius=group.userData.body.id==='saturn'?radius*2.32:radius;
          const nearSurface=depth>0&&raycaster.ray.distanceToPoint(center)<=visibleRadius*1.35+pixelMargin;
          // Check the whole zoom step so a fast wheel/pinch cannot carry the
          // camera through a planet before the proximity test gets another frame.
          movement.closestPointToPoint(center,true,closestOnPath);
          const crossesSurface=closestOnPath.distanceTo(center)<=radius*1.12;
          if(((normalizedDistance<threshold&&nearSurface)||crossesSurface)&&normalizedDistance<ratio){
            nearest=group.userData.body.id;ratio=normalizedDistance;restoreSafePosition=crossesSurface;
          }
        });
        if(nearest){
          if(restoreSafePosition){camera.position.copy(beforeZoom);controls.target.copy(beforeTarget);controls.update();}
          pendingOverviewPose=approachPose||captureOverview();
          callbacks.current.onSelect(nearest);
        }
      }
    };
    const wheel=e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const marker=pickMarker(e.clientX,e.clientY);
      zoomAt(e.clientX,e.clientY,Math.exp(Math.max(-.35,Math.min(.35,e.deltaY*.0015))),marker?.dataset.bodyId);
    };
    const touches=new Map();let previousPinch=null;
    const touchDown=e=>{if(e.pointerType!=='touch')return;touches.set(e.pointerId,[e.clientX,e.clientY]);previousPinch=null;};
    const touchMove=e=>{
      if(e.pointerType!=='touch'||!touches.has(e.pointerId))return;
      touches.set(e.pointerId,[e.clientX,e.clientY]);
      if(touches.size!==2)return;
      const [a,b]=[...touches.values()],span=Math.hypot(a[0]-b[0],a[1]-b[1]);
      if(previousPinch&&span>0)zoomAt((a[0]+b[0])/2,(a[1]+b[1])/2,previousPinch/span);
      previousPinch=span;
    };
    const touchUp=e=>{touches.delete(e.pointerId);previousPinch=null;};
    renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
    renderer.domElement.addEventListener('pointerdown',touchDown);renderer.domElement.addEventListener('pointermove',touchMove);renderer.domElement.addEventListener('pointerup',touchUp);renderer.domElement.addEventListener('pointercancel',touchUp);
    container.addEventListener('wheel',wheel,{passive:false,capture:true});
    engine.current={reset:()=>setView(state.current.selected)};
    return ()=>{cancelAnimationFrame(frame);container.removeEventListener('wheel',wheel,true);container.removeEventListener('pointermove',emphasizeNearest,true);container.removeEventListener('pointermove',skyPointerMove);container.removeEventListener('pointerleave',skyPointerLeave);observer.disconnect();controls.dispose();renderer.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});starfield.dispose();magneticField.dispose();Object.values(textures).forEach(t=>t.dispose());container.replaceChildren();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.reset();},[resetToken]);
  return <div className="scene-host" ref={host} aria-label="Interactive 3D solar system viewer"/>;
}
