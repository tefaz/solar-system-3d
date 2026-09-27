import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const chrome=process.env.CHROME_PATH||'/opt/google/chrome/chrome';
const browser=await chromium.launch({...(chrome==='playwright'?{}:{executablePath:chrome}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('.test-artifacts',{recursive:true});
const projection=()=>page.locator('.scene-marker').evaluateAll(els=>els.map(e=>({id:e.dataset.bodyId,x:+e.dataset.screenX,y:+e.dataset.screenY})));
const returnAndCheck=async before=>{
  await page.mouse.move(page.viewportSize().width/2,100);
  for(let i=0;i<16&&await page.locator('.planet-card').count();i++){await page.mouse.wheel(0,240);await page.waitForTimeout(100);}
  await page.waitForTimeout(1500);assert.equal(await page.locator('.planet-card').count(),0);assert.equal(await page.locator('.scene-marker:visible').count(),12);
  const after=await projection();for(let i=0;i<before.length;i++)assert.ok(Math.hypot(after[i].x-before[i].x,after[i].y-before[i].y)<1,`${before[i].id} overview should be restored`);
};
try{
  await page.goto(process.env.BASE_URL||'http://localhost:5173');await page.waitForTimeout(1600);
  const orbit=await page.evaluate(async()=>{
    const {orbitalPosition,orbitRadius}=await import('/src/orbits.js');const {getBody}=await import('/src/data.js');
    const body=getBody('pluto'),neptune=getBody('neptune'),a=orbitRadius(body.au),points=Array.from({length:256},(_,i)=>orbitalPosition(body,i/256*Math.PI*2));
    const expected=points.map((_,i)=>{
      const angle=i/256*Math.PI*2;
      return orbitRadius(body.au*(1-body.eccentricity*Math.cos(angle)));
    });
    const peri=orbitalPosition(body,0).length(),apo=orbitalPosition(body,Math.PI).length();
    const normal=points[0].clone().cross(points[64]).normalize();
    return {peri:peri/a,apo:apo/a,periToNeptune:peri/orbitRadius(neptune.au),apoToNeptune:apo/orbitRadius(neptune.au),maxError:Math.max(...points.map((p,i)=>Math.abs(p.length()-expected[i]))),inclination:Math.acos(Math.abs(normal.y))*180/Math.PI};
  });
  assert.ok(Math.abs(orbit.peri-Math.sqrt(.7512))<1e-5&&Math.abs(orbit.apo-Math.sqrt(1.2488))<1e-5,'Apply radial compression after computing eccentric orbital distances');
  assert.ok(orbit.maxError<1e-6,'Every orbit point must use the shared radial distance scale');
  assert.ok(orbit.periToNeptune>.99&&orbit.periToNeptune<1,'Pluto should dip only slightly inside Neptune in radial distance');
  assert.ok(orbit.apoToNeptune>1.27&&orbit.apoToNeptune<1.29,'Pluto should extend well beyond Neptune at aphelion');
  assert.ok(Math.abs(orbit.inclination-17.16)<1e-6,'The orbital plane should retain Pluto’s approximately 17° inclination');
  await page.screenshot({path:'.test-artifacts/pluto-overview.png'});
  assert.equal(await page.locator('.scene-marker:visible').count(),12);
  const before=await projection();await page.getByRole('button',{name:'Viewer settings'}).click();await page.getByLabel('Planet names',{exact:true}).check();await page.keyboard.press('Escape');
  await page.screenshot({path:'.test-artifacts/pluto-overview.png'});
  await page.getByRole('button',{name:'Explore Pluto',exact:true}).click();await page.waitForTimeout(1500);
  assert.equal(await page.locator('.planet-card h1').textContent(),'Pluto');assert.equal(await page.locator('.planet-kind').textContent(),'Dwarf planet');
  await page.getByRole('button',{name:'Planet details'}).click();assert.match(await page.locator('.planet-details').textContent(),/2,376 km.*39.48 AU/);assert.equal(await page.getByRole('switch',{name:'Magnetic field',exact:true}).count(),0);
  await page.screenshot({path:'.test-artifacts/pluto-closeup.png'});
  await page.getByRole('button',{name:'Interior',exact:true}).click();assert.match(await page.locator('.layer-key').textContent(),/Water-ice shell.*Possible subsurface ocean.*Rocky core/);
  await page.getByRole('button',{name:'Rocky core',exact:true}).click();await page.screenshot({path:'.test-artifacts/pluto-interior.png'});
  await returnAndCheck(before);
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForTimeout(1500);assert.equal(await page.locator('.scene-marker:visible').count(),12);
  const mobile=await projection();await page.getByRole('button',{name:'Explore Pluto',exact:true}).click();await page.waitForTimeout(1500);await page.screenshot({path:'.test-artifacts/pluto-mobile.png'});
  await returnAndCheck(mobile);assert.deepEqual(errors,[]);console.log('Pluto texture, tilted eccentric orbit, details, conceptual interior, mobile visibility and overview return passed.');
}finally{await browser.close();}
