import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const chrome=process.env.CHROME_PATH||'/opt/google/chrome/chrome';
const browser=await chromium.launch({...(chrome==='playwright'?{}:{executablePath:chrome}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const projection=()=>page.locator('.scene-marker').evaluateAll(els=>els.map(e=>({id:e.dataset.bodyId,x:+e.dataset.screenX,y:+e.dataset.screenY,r:+e.dataset.screenRadius})));
const assertRestored=async expected=>{
  const actual=await projection();
  assert.equal(await page.locator('.scene-marker:visible').count(),12,'Return should show the complete overview, not an empty or edge-on scene');
  for(let i=0;i<expected.length;i++)assert.ok(Math.hypot(expected[i].x-actual[i].x,expected[i].y-actual[i].y)<1,`${expected[i].id} should return to its overview position`);
};
const scrollOut=async()=>{
  await page.mouse.move(page.viewportSize().width/2,100);
  for(let i=0;i<20&&await page.locator('.planet-card').count();i++){await page.mouse.wheel(0,240);await page.waitForTimeout(100);}
  await page.waitForTimeout(1500);assert.equal(await page.locator('.planet-card').count(),0);
};
try{
  await page.goto(process.env.BASE_URL||'http://localhost:5173');await page.waitForTimeout(1400);
  const initial=await projection(),earth=initial.find(p=>p.id==='earth');await page.mouse.move(earth.x,earth.y);
  for(let i=0;i<4;i++){await page.mouse.wheel(0,-240);await page.waitForTimeout(85);}
  await page.mouse.wheel(0,240);await page.waitForTimeout(85);
  for(let i=0;i<45&&!(await page.locator('.planet-card').count());i++){await page.mouse.wheel(0,-240);await page.waitForTimeout(85);}
  assert.equal(await page.locator('.planet-card h1').textContent(),'Earth');await page.waitForTimeout(1400);
  await page.mouse.move(720,320);await page.mouse.down({button:'right'});await page.mouse.move(880,500,{steps:12});await page.mouse.up({button:'right'});await page.waitForTimeout(350);
  await scrollOut();await assertRestored(initial);
  console.log('✓ Natural cursor zoom returns to the overview before the approach');
  await page.getByRole('button',{name:'Explore Mars',exact:true}).click();await page.waitForTimeout(1400);
  await page.getByRole('button',{name:'Find Perseverance',exact:true}).click();await page.getByRole('button',{name:/Play as Perseverance/}).click();await page.waitForTimeout(300);
  await page.getByRole('button',{name:'Back to Mars',exact:true}).click();await page.waitForTimeout(1500);
  await scrollOut();await assertRestored(initial);
  console.log('✓ Return from the rover demo preserves a valid system overview');
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForTimeout(1400);
  const mobile=await projection(),mars=mobile.find(p=>p.id==='mars');await page.mouse.move(mars.x,mars.y);
  for(let i=0;i<45&&!(await page.locator('.planet-card').count());i++){await page.mouse.wheel(0,-240);await page.waitForTimeout(85);}
  assert.equal(await page.locator('.planet-card h1').textContent(),'Mars');await page.waitForTimeout(1400);
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.getByRole('switch',{name:'Magnetic field',exact:true}).click();await page.waitForTimeout(800);
  await scrollOut();await assertRestored(mobile);
  assert.deepEqual(errors,[]);console.log('✓ Mobile zoom return with cutaway and magnetic field restores all bodies');
}finally{await browser.close();}
