import * as THREE from 'three';

// A single selected-layer label avoids a forest of overlapping leader lines.
export function createInteriorCallout(container){
  const overlay=document.createElement('div');overlay.className='interior-callout';overlay.hidden=true;overlay.setAttribute('aria-hidden','true');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const line=document.createElementNS(svg.namespaceURI,'polyline'),dot=document.createElementNS(svg.namespaceURI,'circle');
  dot.setAttribute('r','3');svg.append(line,dot);
  const label=document.createElement('div');label.className='interior-callout-label';
  const title=document.createElement('strong'),detail=document.createElement('span');label.append(title,detail);overlay.append(svg,label);container.append(overlay);
  const anchor=new THREE.Vector3(),center=new THREE.Vector3(),normal=new THREE.Vector3(),view=new THREE.Vector3();
  let previous=null;
  return {
    update(model,index,mesh,camera,pixelRadius,visible){
      normal.set(0,0,1).applyQuaternion(mesh.quaternion);view.copy(camera.position).sub(mesh.position).normalize();
      if(!visible||!model||normal.dot(view)<.12){overlay.hidden=true;return;}
      const layer=model.layers[index];if(!layer){overlay.hidden=true;return;}
      const w=container.clientWidth,h=container.clientHeight;
      mesh.updateMatrixWorld();camera.updateMatrixWorld();
      const inner=model.layers[index+1]?.radius||0;
      const radius=index===model.layers.length-1?layer.radius*.35:(layer.radius+inner)/2;
      anchor.set(radius*.65,radius*.76,0).applyMatrix4(mesh.matrixWorld).project(camera);
      center.copy(mesh.position).project(camera);
      const x=(anchor.x+1)*w/2,y=(1-anchor.y)*h/2,cx=(center.x+1)*w/2,cy=(1-center.y)*h/2;
      if(anchor.z<-1||anchor.z>1||x<0||x>w||y<65||y>h-20){overlay.hidden=true;return;}
      const mobile=w<=600,labelWidth=mobile?190:220;
      const lx=mobile?Math.max(12,Math.min(w-labelWidth-12,cx-labelWidth/2)):Math.max(12,Math.min(w-labelWidth-24,cx+pixelRadius+35));
      const ly=mobile?cy-pixelRadius-63:Math.max(80,Math.min(h-85,y-25));
      const card=container.parentElement.querySelector('.planet-card');
      if(ly<65||(mobile&&card&&ly+55>card.offsetTop-12)){overlay.hidden=true;return;}
      overlay.hidden=false;
      if(previous!==layer){
        previous=layer;title.textContent=`${index+1} · ${layer.name}`;
        detail.textContent=`${layer.phase} · ${layer.evidence}`;overlay.style.setProperty('--layer-color',layer.color);
      }
      label.style.width=`${labelWidth}px`;label.style.left=`${lx}px`;label.style.top=`${ly}px`;
      const endX=mobile?lx+labelWidth/2:lx,endY=mobile?ly+48:ly+24;
      line.setAttribute('points',`${x},${y} ${mobile?endX:endX-18},${endY} ${endX},${endY}`);
      dot.setAttribute('cx',x);dot.setAttribute('cy',y);
      dot.dataset.layerIndex=index;
    },
  };
}
