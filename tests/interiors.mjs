import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {interiors,getInterior,MAX_INTERIOR_LAYERS,interiorMaterials} from '../src/interiors.js';

for(const model of [...Object.values(interiors),getInterior('mars','basal-melt')]){
  assert.ok(model.layers.length<=MAX_INTERIOR_LAYERS);
  let previous=Infinity;
  for(const layer of model.layers){
    assert.ok(layer.radius>0&&layer.radius<=1&&layer.radius<previous,'Radii must decrease from surface inward');previous=layer.radius;
    assert.ok(layer.material in interiorMaterials);assert.ok(layer.phase&&layer.evidence&&layer.extent);
  }
}
const chrome=process.env.CHROME_PATH||'/opt/google/chrome/chrome';
const browser=await chromium.launch({...(chrome==='playwright'?{}:{executablePath:chrome}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('.test-artifacts/interiors',{recursive:true});
const open=async name=>{
  await page.keyboard.press('Home');await page.waitForTimeout(1400);
  const marker=page.getByRole('button',{name:`Explore ${name}`,exact:true}),bounds=await marker.boundingBox();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.waitForTimeout(50);
  await marker.click();await page.waitForTimeout(1400);
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.waitForTimeout(400);
};
try{
  await page.goto(process.env.BASE_URL||'http://localhost:5173');await page.waitForTimeout(1500);
  // Exercise the actual compiled shader and sample each lunar layer. This
  // catches a missing fifth layer even if its HTML legend looks correct.
  const shader=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {createInteriorCutaway}=await import('/src/InteriorCutaway.js');
    const {interiors}=await import('/src/interiors.js');
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);
    const camera=new THREE.OrthographicCamera(-1.1,1.1,1.1,-1.1,.1,10);camera.position.z=3;
    const scene=new THREE.Scene(),cut=createInteriorCutaway();scene.add(cut.mesh);cut.mesh.visible=true;
    const gl=renderer.getContext(),pixels=new Uint8Array(512*512*4);
    const render=(model,active,time=0)=>{cut.update(model,active,time);renderer.render(scene,camera);gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels.slice();};
    const sample=(data,r)=>{const x=Math.round(256+r/1.1*256),at=(256*512+x)*4;return Array.from(data.slice(at,at+3));};
    const model=interiors.moon,dim=render(model,0);
    const layers=model.layers.map((layer,i)=>{
      const r=(layer.radius+(model.layers[i+1]?.radius||0))/2,bright=render(model,i);
      return {dim:sample(dim,r),bright:sample(bright,r)};
    });
    const first=render(interiors.earth,2,0),later=render(interiors.earth,2,12);
    const staticRadius=.78,fluidRadius=.37;
    const motion={solid:[sample(first,staticRadius),sample(later,staticRadius)],fluid:[sample(first,fluidRadius),sample(later,fluidRadius)]};
    cut.mesh.geometry.dispose();cut.mesh.material.dispose();renderer.dispose();renderer.forceContextLoss();
    return {layers,motion};
  });
  for(let i=1;i<shader.layers.length;i++){
    const {dim,bright}=shader.layers[i];
    assert.ok(bright.reduce((a,b)=>a+b,0)>dim.reduce((a,b)=>a+b,0)*1.12,`Lunar region ${i+1} must actually render and brighten when selected`);
  }
  assert.deepEqual(shader.motion.solid[0],shader.motion.solid[1],'Solid mantle must not have fluid animation');
  assert.notDeepEqual(shader.motion.fluid[0],shader.motion.fluid[1],'Liquid outer core should have symbolic flow');
  console.log('✓ Actual shader renders five lunar layers, selection, static rock and fluid motion');

  const names={sun:'Sun',mercury:'Mercury',venus:'Venus',earth:'Earth',mars:'Mars',jupiter:'Jupiter',saturn:'Saturn',uranus:'Uranus',neptune:'Neptune',pluto:'Pluto',moon:'Moon'};
  for(const [id,name] of Object.entries(names)){
    await open(name);
    const model=interiors[id],buttons=page.getByRole('group',{name:'Interior layers',exact:true}).getByRole('button');
    assert.equal(await buttons.count(),model.layers.length);
    const index=model.layers.length-1;
    await buttons.nth(index).click();
    await page.locator('.interior-callout-label strong').filter({hasText:model.layers[index].name}).waitFor();
    assert.equal(await buttons.nth(index).getAttribute('aria-pressed'),'true');
    assert.ok(await page.locator('.interior-callout-label strong').textContent(),`${name} must label its selected layer`);
    assert.match(await page.locator('.interior-callout-label strong').textContent(),new RegExp(model.layers[index].name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.equal(await page.locator('.interior-sources a').count(),model.sources.length);
    await page.screenshot({path:`.test-artifacts/interiors/${id}.png`});
  }
  console.log('✓ Sun, all eight planets, Pluto and Moon: layers, sources and selected callouts');

  await open('Mars');await page.getByRole('button',{name:'Possible inner core',exact:true}).click();
  await page.getByRole('button',{name:'Basal melt',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Possible inner core',exact:true}).count(),0);
  await page.getByRole('button',{name:'Possible molten silicate layer',exact:true}).click();
  assert.match(await page.locator('.layer-description').textContent(),/2023/);
  await page.screenshot({path:'.test-artifacts/interiors/mars-basal-melt.png'});
  await page.getByRole('button',{name:'Inner core',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Crust',exact:true}).getAttribute('aria-pressed'),'true');
  console.log('✓ Mars interpretations switch independently and reset layer selection');

  await open('Earth');
  // The label's dot lies inside the selected annulus. Click it through the
  // pointer-transparent overlay after choosing a different region.
  await page.getByRole('button',{name:'Liquid outer core',exact:true}).click();await page.waitForTimeout(100);
  const dot=await page.locator('.interior-callout circle').evaluate(el=>({x:+el.getAttribute('cx'),y:+el.getAttribute('cy')}));
  await page.getByRole('button',{name:'Mantle',exact:true}).click();
  await page.mouse.click(dot.x,dot.y);await page.waitForTimeout(100);
  assert.equal(await page.getByRole('button',{name:'Liquid outer core',exact:true}).getAttribute('aria-pressed'),'true','Clicking the cut face must pick its actual layer');
  const before=await page.locator('.interior-callout-label strong').textContent();
  await page.mouse.click(dot.x,dot.y,{button:'right'});
  assert.equal(await page.locator('.interior-callout-label strong').textContent(),before,'Right-click must not pick a layer');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(300);
  const clip={x:Math.floor(dot.x)+8,y:Math.floor(dot.y)+8,width:12,height:12};
  const still=await page.screenshot({clip});await page.waitForTimeout(400);
  assert.deepEqual(await page.screenshot({clip}),still,'Reduced motion must freeze fluid patterns on the cut face');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.mouse.move(1050,350);await page.mouse.down({button:'right'});await page.mouse.move(1090,390,{steps:8});await page.mouse.up({button:'right'});await page.waitForTimeout(300);
  await page.screenshot({path:'.test-artifacts/interiors/earth-orbit.png'});
  console.log('✓ Cut-face picking, right-button separation and orbiting');

  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForTimeout(1400);
  for(const name of ['Moon','Mars','Saturn','Sun']){
    await open(name);
    const group=page.getByRole('group',{name:'Interior layers',exact:true});
    await group.getByRole('button').last().click();await page.waitForTimeout(500);
    const bounds=await page.locator('.planet-card').boundingBox();
    assert.ok(bounds.y>60&&bounds.y+bounds.height<844,'Mobile interior card must fit the viewport');
    const body=await page.locator(`.scene-marker[data-body-id="${name.toLowerCase()}"]`).evaluate(el=>({y:+el.dataset.screenY,r:+el.dataset.screenRadius}));
    assert.ok(body.y-body.r>55&&body.y+body.r<bounds.y-10,'Mobile globe must remain above the card');
    assert.equal(await page.locator('.interior-callout').evaluate(el=>el.hidden),false,'Mobile selected-layer label must remain visible');
    await page.screenshot({path:`.test-artifacts/interiors/${name.toLowerCase()}-mobile.png`});
    if(name==='Mars'){
      await page.getByRole('button',{name:'Basal melt',exact:true}).click();
      await page.getByRole('button',{name:'Possible molten silicate layer',exact:true}).click();
      await page.locator('.interior-callout-label strong').filter({hasText:'Possible molten silicate layer'}).waitFor();
      await page.screenshot({path:'.test-artifacts/interiors/mars-basal-melt-mobile.png'});
    }
  }
  assert.deepEqual(errors,[],'No browser or shader errors');
  console.log('✓ Mobile five-layer Moon, both-model Mars, ringed Saturn and plasma Sun');
}finally{await browser.close();}
