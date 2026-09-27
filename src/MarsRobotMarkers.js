import * as THREE from 'three';
import {marsRobots} from './marsRobots.js';

// Matches SphereGeometry's UVs: the map center is 0° longitude, east is -Z.
export function robotNormal(robot){
  const lat=THREE.MathUtils.degToRad(robot.lat),lon=THREE.MathUtils.degToRad(robot.lon);
  return new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon));
}

export function createMarsRobotMarkers(container,onSelect){
  const root=document.createElement('div');root.className='mars-markers';root.hidden=true;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');root.appendChild(svg);
  const entries=marsRobots.map(robot=>{
    const line=document.createElementNS(svg.namespaceURI,'line');line.style.stroke=robot.color;svg.appendChild(line);
    const dot=document.createElement('span');dot.className='robot-surface-dot';dot.style.setProperty('--robot-color',robot.color);root.appendChild(dot);
    const button=document.createElement('button');button.className='robot-marker';button.textContent=robot.name;button.dataset.robotId=robot.id;button.setAttribute('aria-label',`About ${robot.name}`);button.style.setProperty('--robot-color',robot.color);root.appendChild(button);
    button.addEventListener('pointerdown',e=>e.stopPropagation());
    button.addEventListener('click',()=>onSelect(robot.id));
    return {robot,normal:robotNormal(robot),line,dot,button};
  });
  container.appendChild(root);
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),towardCamera=new THREE.Vector3(),center=new THREE.Vector3();
  return {
    get interacting(){return root.matches(':hover')||root.contains(document.activeElement);},
    update(mesh,camera,visible,activeRobot){
      root.hidden=!visible;if(!visible)return;
      const width=container.clientWidth,height=container.clientHeight;
      mesh.updateWorldMatrix(true,false);camera.updateMatrixWorld();mesh.getWorldPosition(center);
      const card=container.parentElement.querySelector('.robot-popup')||container.parentElement.querySelector('.planet-card');
      const bottom=width<=600&&card?card.offsetTop-12:height-20;
      const candidates=[];
      for(const entry of entries){
        const {robot,button,dot,line}=entry;
        point.copy(entry.normal).multiplyScalar(1.004).applyMatrix4(mesh.matrixWorld);
        normal.copy(point).sub(center).normalize();towardCamera.copy(camera.position).sub(point);
        const facing=normal.dot(towardCamera)>0;
        point.project(camera);
        const x=(point.x+1)*width/2,y=(1-point.y)*height/2;
        const shown=facing&&point.z>-1&&point.z<1&&x>6&&x<width-6&&y>60&&y<bottom;
        button.hidden=dot.hidden=!shown;line.style.display=shown?'':'none';
        button.setAttribute('aria-pressed',String(activeRobot===robot.id));
        button.dataset.surfaceX=x;button.dataset.surfaceY=y;
        if(!shown)continue;
        dot.style.left=`${x}px`;dot.style.top=`${y}px`;
        const w=button.offsetWidth,h=button.offsetHeight;
        candidates.push({...entry,x,y,w,h,left:Math.max(8,Math.min(width-w-8,x+16)),top:Math.max(64,Math.min(bottom-h,y-h/2))});
      }
      // Labels move; geographic dots never do. Resolve close pairs on each frame.
      candidates.sort((a,b)=>a.y-b.y);
      const placed=[];
      for(const c of candidates){
        const overlaps=top=>placed.some(p=>c.left<p.left+p.w+8&&c.left+c.w+8>p.left&&top<p.top+p.h+7&&top+c.h+7>p.top);
        const initial=c.top;
        for(let step=0;step<30&&overlaps(c.top);step++){
          const offset=(Math.floor(step/2)+1)*(c.h+8)*(step%2? -1:1);
          c.top=Math.max(64,Math.min(bottom-c.h,initial+offset));
        }
        c.button.style.left=`${c.left}px`;c.button.style.top=`${c.top}px`;
        c.line.setAttribute('x1',c.x);c.line.setAttribute('y1',c.y);c.line.setAttribute('x2',c.left);c.line.setAttribute('y2',c.top+c.h/2);
        placed.push(c);
      }
    },
  };
}
