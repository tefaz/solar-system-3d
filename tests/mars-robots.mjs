import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {marsRobots} from '../src/marsRobots.js';
import {robotNormal} from '../src/MarsRobotMarkers.js';

// Check the longitude convention against the map's SphereGeometry UVs.
assert.ok(robotNormal({lat:0,lon:0}).distanceTo({x:1,y:0,z:0})<1e-10);
assert.ok(robotNormal({lat:0,lon:90}).distanceTo({x:0,y:0,z:-1})<1e-10);
assert.ok(robotNormal({lat:90,lon:0}).distanceTo({x:0,y:1,z:0})<1e-10);
const chrome=process.env.CHROME_PATH||'/opt/google/chrome/chrome';
const browser=await chromium.launch({...(chrome==='playwright'?{}:{executablePath:chrome}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await mkdir('.test-artifacts',{recursive:true});
try{
  await page.goto(process.env.BASE_URL||'http://localhost:5173');await page.waitForTimeout(1600);
  assert.equal(await page.locator('.robot-marker:visible').count(),0);
  await page.getByRole('button',{name:'Explore Mars',exact:true}).click();await page.waitForTimeout(1700);
  assert.equal(await page.getByRole('group',{name:'Mars robots',exact:true}).getByRole('button').count(),7);
  assert.ok(await page.locator('.robot-marker:visible').count()>=5);
  const bounds=await page.locator('.robot-marker:visible').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.robotId,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
    const a=bounds[i],b=bounds[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${a.id} overlaps ${b.id}`);
  }
  await page.screenshot({path:'.test-artifacts/mars-robots-desktop.png'});
  await page.getByRole('button',{name:'About Ingenuity',exact:true}).click();
  await page.getByRole('dialog').waitFor();assert.equal(await page.locator('#robot-title').textContent(),'Ingenuity');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.planet-card h1').textContent(),'Mars');
  for(const robot of marsRobots){
    await page.getByRole('button',{name:`Find ${robot.name}`,exact:true}).click();
    await page.getByRole('dialog').waitFor();assert.equal(await page.locator('#robot-title').textContent(),robot.name);
    assert.equal(await page.getByRole('link',{name:'Mission details',exact:true}).getAttribute('href'),robot.source);
    const image=page.getByRole('dialog').getByRole('img',{name:robot.imageAlt,exact:true});
    await image.evaluate(img=>img.decode());
    assert.ok(await image.evaluate(img=>img.naturalWidth>0&&img.getBoundingClientRect().top>document.querySelector('#robot-title').getBoundingClientRect().bottom),'Robot image should load below its title');
    assert.equal(await image.getAttribute('src'),robot.image);
    assert.equal(await page.locator('.robot-photo a').getAttribute('href'),robot.imageSource);
    await page.waitForTimeout(1200);
    assert.equal(await page.getByRole('button',{name:`About ${robot.name}`,exact:true}).isVisible(),true,`${robot.name} must rotate onto the visible hemisphere`);
    await page.getByRole('button',{name:'Close robot information'}).click();
  }
  await page.getByRole('button',{name:'Interior',exact:true}).click();
  await page.waitForTimeout(100);assert.equal(await page.locator('.robot-marker:visible').count(),0);
  await page.getByRole('button',{name:'Find Perseverance',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Surface',exact:true}).getAttribute('aria-pressed'),'true');
  await page.waitForTimeout(1300);await page.screenshot({path:'.test-artifacts/mars-robot-popup.png'});
  await page.keyboard.press('Home');await page.waitForTimeout(1500);
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.robot-marker:visible').count(),0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Explore Mars',exact:true}).click();await page.waitForTimeout(1800);
  await page.screenshot({path:'.test-artifacts/mars-robots-mobile.png'});
  assert.ok(await page.locator('.robot-marker:visible').count()>=4);
  await page.getByRole('button',{name:'Find Opportunity',exact:true}).click();await page.waitForTimeout(1400);
  const popup=await page.getByRole('dialog').boundingBox();assert.ok(popup.x>=0&&popup.x+popup.width<=390&&popup.y>60&&popup.y+popup.height<=844);
  assert.equal(await page.locator('.planet-card').isVisible(),false);
  await page.screenshot({path:'.test-artifacts/mars-robot-popup-mobile.png'});
  await page.getByRole('button',{name:'About Opportunity',exact:true}).click();
  await page.getByRole('button',{name:'Close robot information'}).click();assert.equal(await page.locator('.planet-card').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('Mars robot markers, all seven pop-ups, geographic conventions, far-side selection, interior behavior and mobile layout passed.');
}finally{await browser.close();}
