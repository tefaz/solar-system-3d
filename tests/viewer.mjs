import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const chrome=process.env.CHROME_PATH||'/opt/google/chrome/chrome';
const browser=await chromium.launch({...(chrome==='playwright'?{}:{executablePath:chrome}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('.test-artifacts',{recursive:true});
const returnToSystem=async()=>{await page.keyboard.press('Home');await page.waitForTimeout(1400);assert.equal(await page.locator('.planet-card').count(),0);};
let entryProjection=null;
const overviewProjection=async()=>page.locator('.scene-marker').evaluateAll(els=>els.map(el=>({id:el.dataset.bodyId,x:Number(el.dataset.screenX),y:Number(el.dataset.screenY)})));
const assertOverviewRestored=async expected=>{const actual=await overviewProjection();for(let i=0;i<expected.length;i++){const a=actual[i],b=expected[i];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.5+Math.hypot(b.x,b.y)*1e-7,`${b.id} must return to the same overview framing: expected ${b.x},${b.y}, actual ${a.x},${a.y}`);}};
const waitForCameraToSettle=async()=>page.evaluate(()=>new Promise((resolve,reject)=>{
  let previous=null,stable=0,frames=0;
  const check=()=>{
    const points=[...document.querySelectorAll('.scene-marker')].flatMap(el=>[Number(el.dataset.screenX),Number(el.dataset.screenY)]);
    const change=previous?Math.max(...points.map((p,i)=>Math.abs(p-previous[i]))):Infinity;
    stable=change<.005?stable+1:0;previous=points;
    if(stable>=5)return resolve();
    if(++frames>600)return reject(new Error('Camera did not settle'));
    requestAnimationFrame(check);
  };requestAnimationFrame(check);
}));
const focus=async name=>{await waitForCameraToSettle();const marker=page.getByRole('button',{name:`Explore ${name}`,exact:true});const bounds=await marker.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.waitForTimeout(50);entryProjection=await overviewProjection();await marker.click();await page.waitForTimeout(1400);assert.equal(await page.locator('.planet-card h1').textContent(),name);};
const projected=async id=>page.locator(`[data-body-id="${id}"]`).evaluate(el=>({x:Number(el.dataset.screenX),y:Number(el.dataset.screenY)}));
const assertMarkerAlignment=async()=>{
  assert.equal(await page.locator('.marker-leaders').count(),0,'Overview must not draw connector lines');
  const dots=await page.locator('.scene-marker:visible .marker-dot').evaluateAll(els=>els.map(dot=>{
    const marker=dot.parentElement,rect=dot.getBoundingClientRect();
    return {id:marker.dataset.bodyId,error:Math.hypot(rect.x+rect.width/2-Number(marker.dataset.screenX),rect.y+rect.height/2-Number(marker.dataset.screenY))};
  }));
  for(const dot of dots)assert.ok(dot.error<.1,`${dot.id} dot must stay at its real projected position`);
};
const scrollOutToSystem=async()=>{
  const viewport=page.viewportSize();
  await page.mouse.move(viewport.width/2,viewport.height/2);
  for(let i=0;i<14&&(await page.locator('.planet-card').count());i++){await page.mouse.wheel(0,240);await page.waitForTimeout(100);}
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('.planet-card').count(),0,'Zooming out must return to the system without pressing Back');
  assert.ok(await page.locator('.scene-marker:visible').count()>0);
  if(entryProjection)await assertOverviewRestored(entryProjection);
  await assertMarkerAlignment();
};
try {
  await page.goto(process.env.BASE_URL||'http://localhost:5173');await page.waitForTimeout(1400);
  assert.equal(await page.locator('canvas').count(),1);
  assert.equal(await page.locator('.planet-card').count(),0);
  assert.equal(await page.locator('.scene-marker:visible').count(),12);
  assert.equal(await page.locator('.app > button').count(),1,'Overview should have only the discreet settings button');
  assert.equal(await page.locator('header,footer,.intro,.explorer-dock,.time-control,.simulation-date,.zoom-controls').count(),0);
  assert.equal(await page.evaluate(()=>!!document.querySelector('canvas').getContext('webgl2')),true);
  const positions=await page.locator('.scene-marker[data-body-id]:not(.belt-marker)').evaluateAll(els=>els.map(el=>[el.dataset.screenX,el.dataset.screenY]));
  await page.waitForTimeout(1200);
  assert.deepEqual(await page.locator('.scene-marker[data-body-id]:not(.belt-marker)').evaluateAll(els=>els.map(el=>[el.dataset.screenX,el.dataset.screenY])),positions,'Orbital positions must stay fixed');
  await assertMarkerAlignment();
  const assertMoonVisible=async()=>{
    const [earth,moon]=await page.locator('[data-body-id="earth"],[data-body-id="moon"]').evaluateAll(els=>els.map(el=>({x:Number(el.dataset.screenX),y:Number(el.dataset.screenY),r:Number(el.dataset.screenRadius)})));
    assert.ok(Math.hypot(earth.x-moon.x,earth.y-moon.y)>earth.r+moon.r+8,'Moon must be separated from the enlarged Earth globe');
    assert.ok(moon.r>=2,'Moon must retain a readable overview radius');
  };
  await assertMoonVisible();
  await focus('Moon');await scrollOutToSystem();
  await page.screenshot({path:'.test-artifacts/startup.png'});
  console.log('✓ Minimal overview, fixed orbital positions and no simulation controls');

  // Empty-space zoom must shift the Sun rather than keep it at the center.
  const before=await projected('sun');await page.mouse.move(1100,240);await page.mouse.wheel(0,-240);await page.waitForTimeout(180);
  await assertMarkerAlignment();
  const after=await projected('sun');assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>20,'Off-center zoom must follow the cursor instead of the Sun');
  assert.equal(await page.locator('.planet-card').count(),0,'One distant zoom must not snap prematurely');
  // Change both zoom and orientation, then ensure a visit returns to that pose.
  await page.mouse.move(1050,620);await page.mouse.down({button:'right'});await page.mouse.move(990,600,{steps:8});await page.mouse.up({button:'right'});await page.waitForTimeout(1800);
  await focus('Saturn');await scrollOutToSystem();
  console.log('✓ Zoomed and rotated overview framing restored after a planet visit');
  entryProjection=null;
  await returnToSystem();
  // Observe every rendered frame across the automatic arrival, not only its
  // final pose: a clamped camera can finish correctly after hiding the globe.
  await page.evaluate(()=>{
    window.approachFrames=[];window.recordApproach=true;
    const record=()=>{
      const marker=document.querySelector('[data-body-id="earth"]');
      if(document.querySelector('.planet-card h1')?.textContent==='Earth')window.approachFrames.push({
        x:Number(marker.dataset.screenX),y:Number(marker.dataset.screenY),radius:Number(marker.dataset.screenRadius)
      });
      if(window.recordApproach)requestAnimationFrame(record);
    };requestAnimationFrame(record);
  });
  const earth=page.locator('[data-body-id="earth"]'),bounds=await earth.boundingBox();
  const cursor={x:Math.round(bounds.x+bounds.width/2),y:Math.round(bounds.y+bounds.height/2)};
  await page.mouse.move(cursor.x,cursor.y);
  await page.mouse.wheel(0,-240);await page.waitForTimeout(180);
  const anchored=await projected('earth');assert.ok(Math.hypot(anchored.x-cursor.x,anchored.y-cursor.y)<2,'Earth should remain under the cursor during approach');
  assert.equal(await page.locator('.planet-card').count(),0,'The approach must zoom naturally before snapping');
  let previousRadius=Number(await earth.getAttribute('data-screen-radius'));
  for(let i=0;i<55&&!(await page.locator('.planet-card').count());i++){
    await page.mouse.wheel(0,-240);await page.waitForTimeout(85);
    if(!(await page.locator('.planet-card').count())){
      const radius=Number(await earth.getAttribute('data-screen-radius'));
      assert.ok(radius>previousRadius*1.15,'Each inward scroll must visibly enlarge the approached planet');
      previousRadius=radius;
      await assertMarkerAlignment();const point=await projected('earth');assert.ok(Math.hypot(point.x-cursor.x,point.y-cursor.y)<3,'Cursor anchor should remain stable throughout the approach');}
  }
  assert.equal(await page.locator('.planet-card h1').textContent(),'Earth','Approaching Earth must snap into Earth, not the Sun');
  // Remaining trackpad momentum must not interrupt the fitted arrival.
  for(let i=0;i<3;i++){await page.mouse.wheel(0,-240);await page.waitForTimeout(25);}
  await page.waitForTimeout(1400);await page.screenshot({path:'.test-artifacts/earth.png'});
  const arrivalFrames=await page.evaluate(()=>{window.recordApproach=false;return window.approachFrames;});
  assert.ok(arrivalFrames.length>=8,'Arrival must be checked across multiple rendered frames');
  for(const frame of arrivalFrames){
    assert.ok(frame.x>0&&frame.x<1440&&frame.y>0&&frame.y<900,'Earth must remain on screen throughout arrival');
    assert.ok(frame.radius>45&&frame.radius<405,'Earth must retain a readable size without the camera entering its surface');
  }
  console.log('✓ Cursor-directed zoom, proximity snap and continuously visible planetary arrival');

  const rotationBefore=await page.locator('canvas').screenshot();await page.waitForTimeout(1000);const rotationAfter=await page.locator('canvas').screenshot();
  assert.notDeepEqual(rotationBefore,rotationAfter,'The planet should continue spinning');
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.waitForTimeout(200);
  assert.equal(await page.getByRole('button',{name:'Interior',exact:true}).getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.layer-key').textContent(),/Crust.*Mantle.*Liquid outer core.*Solid inner core/);
  await page.getByRole('button',{name:'Solid inner core',exact:true}).click();
  assert.match(await page.locator('.layer-description').textContent(),/1,221 km/);
  assert.equal(await page.getByRole('link',{name:'USGS · Earth structure'}).getAttribute('href'),'https://pubs.usgs.gov/gip/interior/');
  const cutFace=await page.locator('canvas').screenshot();
  await page.mouse.move(800,350);await page.mouse.down({button:'right'});await page.mouse.move(990,420,{steps:12});await page.mouse.up({button:'right'});await page.waitForTimeout(400);
  assert.notDeepEqual(await page.locator('canvas').screenshot(),cutFace,'Cutaway must remain a 3D object that can be inspected by orbiting');
  await page.screenshot({path:'.test-artifacts/interior.png'});
  await page.getByRole('button',{name:'Visit the Moon'}).click();await page.waitForTimeout(1400);
  assert.equal(await page.locator('.planet-card h1').textContent(),'Moon');
  await scrollOutToSystem();
  console.log('✓ Continuous spin, core layers, Moon navigation and scroll-out return');
  // Return now restores the overview before the approach. Zoom toward Earth
  // again until its limb is large enough to test the off-center capture margin.
  const edgeCenter=await projected('earth');
  await page.mouse.move(edgeCenter.x,edgeCenter.y);
  for(let i=0;i<20&&Number(await earth.getAttribute('data-screen-radius'))<120;i++){
    await page.mouse.wheel(0,-240);await page.waitForTimeout(180);
    assert.equal(await page.locator('.planet-card').count(),0,'Earth must enlarge before the capture threshold');
  }
  const closeCenter=await projected('earth'),edgeSign=closeCenter.x<720?1:-1;
  const closeRadius=Number(await earth.getAttribute('data-screen-radius'));
  await page.mouse.move(closeCenter.x+edgeSign*(closeRadius*3.5),closeCenter.y);
  await page.mouse.wheel(0,-240);await page.waitForTimeout(180);
  assert.equal(await page.locator('.planet-card').count(),0,'Distant empty space must remain freely zoomable');
  await page.mouse.wheel(0,240);await page.waitForTimeout(180);
  const limb=await projected('earth');
  await page.mouse.move(limb.x+edgeSign*(closeRadius*1.12+20),limb.y);
  await page.screenshot({path:'.test-artifacts/edge-approach.png'});
  await page.mouse.wheel(0,-240);await page.waitForTimeout(180);
  assert.equal(await page.locator('.planet-card h1').textContent(),'Earth','An approach near the limb must not require aiming at the core');
  await page.waitForTimeout(1400);
  await page.screenshot({path:'.test-artifacts/edge-focus.png'});
  await scrollOutToSystem();
  console.log('✓ Surface-edge capture margin and unrestricted distant-space zoom');
  await page.keyboard.press('r');await page.waitForTimeout(1400);

  for(const name of ['Sun','Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune']){
    await returnToSystem();await focus(name);
    assert.equal(await page.getByRole('button',{name:'Surface',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.layer-key').count(),0);
    await page.getByRole('button',{name:'Interior',exact:true}).click();await page.waitForTimeout(150);
    assert.ok(await page.locator('.layer-key button').count()>=3);
    if(name==='Venus')assert.equal(await page.getByRole('button',{name:/inner core/i}).count(),0);
    if(name==='Jupiter')assert.match(await page.locator('.interior-note').textContent(),/diffuse core/);
    await page.getByRole('button',{name:'Surface',exact:true}).click();await page.waitForTimeout(150);
    assert.equal(await page.locator('.layer-key').count(),0,'Surface must close the interior');
    const field=page.getByRole('switch',{name:'Magnetic field',exact:true});
    assert.equal(await field.getAttribute('aria-checked'),'false','A new visit starts with the field hidden');
    await field.click();await page.waitForTimeout(650);
    assert.equal(await field.getAttribute('aria-checked'),'true');
    assert.equal(await page.locator('.magnetic-info').count(),1);
    if(name==='Mars')assert.match(await page.locator('.magnetic-info').textContent(),/no global internal field/);
    if(name==='Venus')assert.match(await page.locator('.field-kind').textContent(),/Induced/);
    if(name==='Earth'||name==='Uranus'||name==='Venus')await page.screenshot({path:`.test-artifacts/field-${name.toLowerCase()}.png`});
    await field.click();await page.waitForTimeout(650);
    assert.equal(await page.locator('.magnetic-info').count(),0);
    assert.equal(await page.locator('[role="alert"]').count(),0);
    if(name==='Earth'||name==='Sun'||name==='Saturn')await scrollOutToSystem();
  }
  await returnToSystem();await page.getByRole('button',{name:'Explore asteroid belt',exact:true}).click();await page.waitForTimeout(1400);
  assert.equal(await page.locator('.planet-card h1').textContent(),'Asteroid belt');
  assert.equal(await page.getByRole('button',{name:'Interior',exact:true}).count(),0);
  assert.equal(await page.getByRole('switch',{name:'Magnetic field',exact:true}).count(),0);
  await returnToSystem();
  await page.getByRole('button',{name:'Viewer settings'}).click();
  await page.getByLabel('Planet names',{exact:true}).check();
  await page.getByLabel('Orbital paths',{exact:true}).uncheck();
  await page.keyboard.press('Escape');assert.equal(await page.locator('.settings-panel').count(),0);
  console.log('✓ Every planet, asteroid belt and settings');

  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForTimeout(1400);
  assert.equal(await page.locator('.planet-card').count(),0);
  assert.equal(await page.locator('.scene-marker:visible').count(),12);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await assertMoonVisible();
  await focus('Moon');await scrollOutToSystem();
  await page.screenshot({path:'.test-artifacts/mobile-startup.png'});
  await focus('Saturn');
  const toggle=await page.getByRole('button',{name:'Interior',exact:true}).boundingBox();assert.ok(toggle.y>0&&toggle.y+toggle.height<844,'Mobile cutaway control must fit the viewport');
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.waitForTimeout(700);
  const card=await page.locator('.planet-card').boundingBox();assert.ok(card.y>60&&card.y+card.height<844,'Expanded mobile interior must fit the viewport');
  const saturnProjection=await page.locator('[data-body-id="saturn"]').evaluate(el=>({y:Number(el.dataset.screenY),radius:Number(el.dataset.screenRadius)}));
  assert.ok(saturnProjection.y+saturnProjection.radius<card.y-12,'Mobile globe must sit above the expanded interior card');
  await page.getByRole('button',{name:'Diffuse heavy-element core',exact:true}).click();
  assert.match(await page.locator('.layer-description').textContent(),/extended core/);
  await page.screenshot({path:'.test-artifacts/mobile-interior.png'});
  await page.getByRole('switch',{name:'Magnetic field',exact:true}).click();await page.waitForTimeout(900);
  assert.equal(await page.getByRole('button',{name:'Interior',exact:true}).getAttribute('aria-pressed'),'true','Field and cutaway must work independently');
  const fieldToggle=await page.getByRole('switch',{name:'Magnetic field',exact:true}).boundingBox();
  assert.ok(fieldToggle.y>60&&fieldToggle.y+fieldToggle.height<844,'Mobile field toggle must remain accessible');
  await page.screenshot({path:'.test-artifacts/mobile-field.png'});
  const mobileCenter=await projected('saturn');
  await page.mouse.move(mobileCenter.x,mobileCenter.y);
  for(let i=0;i<14&&(await page.locator('.planet-card').count());i++){await page.mouse.wheel(0,240);await page.waitForTimeout(100);}
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('.planet-card').count(),0);
  await assertMarkerAlignment();
  await assertOverviewRestored(entryProjection);
  assert.equal(await page.locator('.scene-marker:visible').count(),12);
  assert.deepEqual(errors,[],'No browser or shader errors');
  console.log('✓ Mobile overview, planetary controls and return navigation');
  console.log('All viewer checks passed. Screenshots: .test-artifacts/');
}finally{await browser.close();}
