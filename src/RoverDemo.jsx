import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,RotateCcw,Pause,Play} from 'lucide-react';
import * as THREE from 'three';
import {createPerseveranceRover} from './PerseveranceRover';
import {createDrivingState,updateDriving,terrainHeight,DRIVE_RADIUS} from './marsDriving';

export default function RoverDemo({onExit}){
  const host=useRef(null),engine=useRef(null),keys=useRef(new Set()),pausedRef=useRef(false);
  const [paused,setPaused]=useState(false),[error,setError]=useState(null),[hud,setHud]=useState({speed:0,distance:0,blocked:false});
  const pause=value=>{keys.current.clear();pausedRef.current=value;setPaused(value);};
  const reset=()=>{engine.current?.reset();pause(false);host.current?.focus();};
  useEffect(()=>{
    const container=host.current;
    let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}
    catch{setError('The driving demo could not start WebGL. Return to Mars and try again.');return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    container.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xc9a58a);scene.fog=new THREE.FogExp2(0xc9a58a,.006);
    const camera=new THREE.PerspectiveCamera(55,1,.1,600);
    scene.add(new THREE.HemisphereLight(0xefc9a6,0x755344,2.1));
    const sun=new THREE.DirectionalLight(0xffe3bc,3.2);sun.position.set(-45,65,-35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-32;sun.shadow.camera.right=sun.shadow.camera.top=32;sun.shadow.camera.near=1;sun.shadow.camera.far=150;sun.shadow.bias=-.0005;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
    let seed=711;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    const sandCanvas=document.createElement('canvas');sandCanvas.width=sandCanvas.height=256;
    const sandContext=sandCanvas.getContext('2d'),pixels=sandContext.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const i=(y*256+x)*4,value=225+random()*25+4*Math.sin(y*.4+Math.sin(x*.04)*2);
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;
    }
    sandContext.putImageData(pixels,0,0);const sandMap=new THREE.CanvasTexture(sandCanvas);sandMap.wrapS=sandMap.wrapT=THREE.RepeatWrapping;sandMap.repeat.set(90,90);sandMap.anisotropy=renderer.capabilities.getMaxAnisotropy();
    const groundGeometry=new THREE.PlaneGeometry(250,250,180,180);groundGeometry.rotateX(-Math.PI/2);
    const vertices=groundGeometry.attributes.position,colors=[];
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),z=vertices.getZ(i);vertices.setY(i,terrainHeight(x,z));
      const grain=.88+random()*.16+.035*Math.sin(x*.75+z*.24),color=new THREE.Color(0xaa7051).multiplyScalar(grain);colors.push(color.r,color.g,color.b);
    }
    groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeometry.computeVertexNormals();
    const ground=new THREE.Mesh(groundGeometry,new THREE.MeshStandardMaterial({vertexColors:true,map:sandMap,roughness:1}));ground.receiveShadow=true;scene.add(ground);
    const rockMaterial=new THREE.MeshStandardMaterial({color:0x765747,roughness:1,flatShading:true});
    const rockGeometry=new THREE.IcosahedronGeometry(1,0),rocks=[];
    // A few large obstacles and many small pebbles, with an open starting lane.
    for(let i=0;i<165;i++){
      const x=(random()-.5)*210,z=(random()-.5)*210;
      if(Math.hypot(x,z)<10||Math.abs(x)<4&&z<4&&z>-35)continue;
      const radius=i<52?.65+random()*1.25:.12+random()*.35;
      const rock=new THREE.Mesh(rockGeometry,rockMaterial);rock.position.set(x,terrainHeight(x,z)+radius*.34,z);rock.rotation.set(random(),random()*6,random());rock.scale.set(radius,radius*(.5+random()*.6),radius*(.8+random()*.4));rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
      if(radius>.6&&Math.hypot(x,z)<DRIVE_RADIUS)rocks.push({x,z,radius:radius*1.05});
    }
    // Layered buttes and ridges form a distant horizon beyond the driving patch.
    const ridgeMaterial=new THREE.MeshStandardMaterial({color:0x9a6953,roughness:1,flatShading:true});
    for(let i=0;i<42;i++){
      const angle=i/42*Math.PI*2,distance=145+random()*65,height=9+random()*24;
      const ridge=new THREE.Mesh(new THREE.CylinderGeometry(5+random()*9,14+random()*20,height,12,4),ridgeMaterial);
      const ridgeVertices=ridge.geometry.attributes.position;
      for(let v=0;v<ridgeVertices.count;v++){
        const x=ridgeVertices.getX(v),y=ridgeVertices.getY(v),z=ridgeVertices.getZ(v),angle=Math.atan2(z,x);
        const uneven=1+.12*Math.sin(angle*3+i)+.07*Math.cos(angle*5+y*.15);
        ridgeVertices.setXYZ(v,x*uneven,y+.8*Math.sin(angle*4+i),z*uneven);
      }ridge.geometry.computeVertexNormals();
      ridge.position.set(Math.sin(angle)*distance,height/2-3,Math.cos(angle)*distance);ridge.rotation.y=random()*6;scene.add(ridge);
    }
    const {rover,wheels}=createPerseveranceRover();scene.add(rover);
    let driving=createDrivingState(),frame,last=performance.now(),hudTime=0,trackTime=0;
    const trackGeometry=new THREE.PlaneGeometry(.28,.55);trackGeometry.rotateX(-Math.PI/2);
    const trackMaterial=new THREE.MeshBasicMaterial({color:0x614332,transparent:true,opacity:.29,depthWrite:false});
    const tracks=new THREE.InstancedMesh(trackGeometry,trackMaterial,640);tracks.count=0;tracks.frustumCulled=false;scene.add(tracks);
    const dummy=new THREE.Object3D();let trackIndex=0;
    // Recycled dust particles keep driving lively without creating objects per frame.
    const dustGeometry=new THREE.BufferGeometry(),dustPositions=new Float32Array(90*3),dustLife=new Float32Array(90);dustPositions.fill(-1000);
    dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
    const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=32;
    const dustContext=dustCanvas.getContext('2d'),gradient=dustContext.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.4,'#ffffff80');gradient.addColorStop(1,'#ffffff00');dustContext.fillStyle=gradient;dustContext.fillRect(0,0,32,32);
    const dustMap=new THREE.CanvasTexture(dustCanvas);
    const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({map:dustMap,color:0xd9af88,size:.32,transparent:true,opacity:.3,depthWrite:false}));dust.frustumCulled=false;scene.add(dust);let dustIndex=0;
    const target=new THREE.Vector3(),cameraGoal=new THREE.Vector3(),look=new THREE.Vector3(),offset=new THREE.Vector3();
    const pose=()=>{
      rover.position.set(driving.x,terrainHeight(driving.x,driving.z),driving.z);rover.rotation.set(0,driving.heading,0);
      const forwardX=-Math.sin(driving.heading),forwardZ=-Math.cos(driving.heading),rightX=Math.cos(driving.heading),rightZ=-Math.sin(driving.heading);
      const front=terrainHeight(driving.x+forwardX,driving.z+forwardZ),back=terrainHeight(driving.x-forwardX,driving.z-forwardZ);
      const left=terrainHeight(driving.x-rightX,driving.z-rightZ),right=terrainHeight(driving.x+rightX,driving.z+rightZ);
      rover.rotateX(Math.atan2(front-back,2));rover.rotateZ(Math.atan2(right-left,2));
      target.copy(rover.position).add(new THREE.Vector3(0,1.25,0));
      offset.set(0,3.5,8.5).applyAxisAngle(new THREE.Vector3(0,1,0),driving.heading);cameraGoal.copy(rover.position).add(offset);
      cameraGoal.y=Math.max(cameraGoal.y,terrainHeight(cameraGoal.x,cameraGoal.z)+2);
    };
    const syncHud=()=>{
      container.dataset.x=driving.x.toFixed(4);container.dataset.z=driving.z.toFixed(4);container.dataset.heading=driving.heading.toFixed(4);container.dataset.speed=driving.speed.toFixed(3);container.dataset.blocked=String(driving.blocked);
      setHud({speed:Math.abs(driving.speed),distance:driving.distance,blocked:driving.blocked});
    };
    const resetDriving=()=>{keys.current.clear();driving=createDrivingState();pose();camera.position.copy(cameraGoal);look.copy(target);tracks.count=0;trackIndex=0;dustLife.fill(0);dustPositions.fill(-1000);syncHud();};
    resetDriving();
    const resize=()=>{renderer.setSize(container.clientWidth,container.clientHeight);camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const keyDown=e=>{
      if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();if(!pausedRef.current)keys.current.add(e.code);}
      if(e.code==='KeyR'&&!e.repeat)resetDriving();
    };
    const keyUp=e=>keys.current.delete(e.code);
    const blur=()=>keys.current.clear();
    const visibility=()=>{if(document.hidden){blur();pause(true);}};
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
    const animate=now=>{
      frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.1);last=now;
      if(!pausedRef.current){
        // Short physics steps preserve collision checks when rendering slows.
        const steps=Math.max(1,Math.ceil(dt/.02));
        for(let i=0;i<steps;i++)updateDriving(driving,keys.current,dt/steps,rocks);
      }else driving.speed=0;
      pose();
      for(const {wheel,steering,z} of wheels){wheel.rotation.x-=driving.speed*dt/.43;steering.rotation.y=z===0?0:(Number(keys.current.has('KeyA'))-Number(keys.current.has('KeyD')))*.24*(z<0?1:-1);}
      camera.position.lerp(cameraGoal,1-Math.exp(-dt*5));look.lerp(target,1-Math.exp(-dt*8));camera.lookAt(look);
      sun.position.set(driving.x-45,65,driving.z-35);sun.target.position.copy(rover.position);
      trackTime+=dt;
      if(Math.abs(driving.speed)>.15&&trackTime>.11){
        trackTime=0;
        for(const side of [-1,1]){
          offset.set(side*1.3,0,1.16).applyAxisAngle(new THREE.Vector3(0,1,0),driving.heading).add(rover.position);
          dummy.position.set(offset.x,terrainHeight(offset.x,offset.z)+.012,offset.z);dummy.rotation.set(0,driving.heading,0);dummy.updateMatrix();tracks.setMatrixAt(trackIndex,dummy.matrix);trackIndex=(trackIndex+1)%640;tracks.count=Math.min(640,tracks.count+1);
          const p=dustIndex++%90;dustLife[p]=1;dustPositions[p*3]=offset.x;dustPositions[p*3+1]=offset.y+.2;dustPositions[p*3+2]=offset.z;
        }tracks.instanceMatrix.needsUpdate=true;
      }
      for(let i=0;i<90;i++){if(dustLife[i]>0){if(!pausedRef.current){dustLife[i]-=dt*.7;dustPositions[i*3]+=.2*dt;dustPositions[i*3+1]+=.22*dt;}if(dustLife[i]<=0)dustPositions[i*3+1]=-1000;}}
      dustGeometry.attributes.position.needsUpdate=true;
      if(now-hudTime>100){hudTime=now;syncHud();}
      renderer.render(scene,camera);
    };
    engine.current={reset:resetDriving};container.focus();frame=requestAnimationFrame(animate);
    return()=>{
      cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);keys.current.clear();
      const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());sandMap.dispose();dustMap.dispose();renderer.dispose();container.replaceChildren();engine.current=null;
    };
  },[]);
  const hold=(event,code)=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);if(!pausedRef.current)keys.current.add(code);};
  return <section className="rover-demo" aria-label="Perseverance driving demo">
    <div className="rover-canvas" ref={host} tabIndex={0} aria-label="Mars landscape. Use W and S to drive, A and D to steer, R to reset, and Escape to return."/>
    <button className="back-button" onClick={onExit}><ArrowLeft size={16}/> Back to Mars</button>
    <div className="rover-actions"><button className="icon-button" aria-label={paused?'Resume driving':'Pause driving'} onClick={()=>pause(!paused)}>{paused?<Play size={17}/>:<Pause size={17}/>}</button><button className="icon-button" aria-label="Reset rover" title="Reset rover (R)" onClick={reset}><RotateCcw size={17}/></button></div>
    <div className="rover-hud"><span className="planet-kind">MARS · SURFACE EXPLORER</span><h1>Perseverance</h1><p>A small journey across the red planet.</p><div className="rover-readouts"><span>Speed <strong>{hud.speed.toFixed(1)} m/s</strong></span><span>Travelled <strong>{Math.floor(hud.distance)} m</strong></span></div><span className="rover-footnote">Illustrative landscape · arcade driving</span></div>
    <div className="rover-controls"><div className="drive-key-grid">{[['KeyW','W','Drive forward'],['KeyA','A','Steer left'],['KeyS','S','Reverse'],['KeyD','D','Steer right']].map(([code,key,label])=><button key={code} aria-label={label} onPointerDown={e=>hold(e,code)} onPointerUp={()=>keys.current.delete(code)} onPointerCancel={()=>keys.current.delete(code)} onLostPointerCapture={()=>keys.current.delete(code)}>{key}</button>)}</div><p>W / S drive · A / D steer</p><span>R reset · Esc return</span></div>
    {hud.blocked&&!paused&&<div className="drive-notice" role="status">{Math.hypot(Number(host.current?.dataset.x),Number(host.current?.dataset.z))>86?'Edge of the demo · reverse to turn back':'Rock ahead · reverse and steer around it'}</div>}
    {paused&&<div className="drive-pause"><span>Drive paused</span><button onClick={()=>{pause(false);host.current?.focus();}}><Play size={15}/> Continue exploring</button></div>}
    {error&&<div className="drive-pause" role="alert"><p>{error}</p><button onClick={onExit}>Back to Mars</button></div>}
  </section>;
}
