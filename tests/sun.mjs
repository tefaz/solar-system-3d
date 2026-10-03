import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const chrome=process.env.CHROME_PATH||'/opt/google/chrome/chrome';
const browser=await chromium.launch({...(chrome==='playwright'?{}:{executablePath:chrome}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('.test-artifacts',{recursive:true});
const focusSun=async()=>{
  await page.getByRole('button',{name:'Explore Sun',exact:true}).click();
  await page.waitForTimeout(1600);
  assert.equal(await page.locator('.planet-card h1').textContent(),'Sun');
};
// Sample actual rendered pixels, rather than shader constants. Use arcs above
// the information card to measure the corona's brightness and soft falloff.
const radiance=async()=>{
  const image=(await page.locator('.scene-host canvas').screenshot()).toString('base64');
  const center=await page.locator('[data-body-id="sun"]').evaluate(e=>({x:+e.dataset.screenX,y:+e.dataset.screenY,r:+e.dataset.screenRadius}));
  return page.evaluate(async({image,center})=>{
    const img=new Image();img.src=`data:image/png;base64,${image}`;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const {data}=ctx.getImageData(0,0,img.width,img.height);
    const band=radius=>{
      const samples=[];
      for(let i=0;i<100;i++){
        const angle=-Math.PI+i/99*Math.PI,x=Math.round(center.x+Math.cos(angle)*center.r*radius),y=Math.round(center.y+Math.sin(angle)*center.r*radius);
        if(x<1||y<65||x>=img.width-1||y>=img.height-1)continue;
        const at=(y*img.width+x)*4;samples.push([data[at],data[at+1],data[at+2]]);
      }
      return samples.reduce((a,c)=>a.map((n,i)=>n+c[i]/samples.length),[0,0,0]);
    };
    return {near:band(1.12),middle:band(1.45),far:band(1.9),surface:band(.65)};
  },{image,center});
};
try{
  await page.goto(process.env.BASE_URL||'http://localhost:5173');await page.waitForTimeout(1500);
  // Render the actual corona at fixed times. Sample outside the surface so
  // surface rotation or a uniform brightness pulse cannot satisfy this check.
  const activity=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {createSolarCorona}=await import('/src/SolarCorona.js');
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(320,320);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.2,3.2,3.2,-3.2,.1,20);
    camera.position.z=5;
    const time={value:0},corona=createSolarCorona(time);scene.add(corona);
    const gl=renderer.getContext(),pixels=new Uint8Array(320*320*4),profiles=[];
    try{
      for(const seconds of [0,4,8,12]){
        time.value=seconds;renderer.render(scene,camera);gl.readPixels(0,0,320,320,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        profiles.push(Array.from({length:180},(_,i)=>{
          const angle=i/180*Math.PI*2,x=Math.round(160+Math.cos(angle)*90),y=Math.round(160+Math.sin(angle)*90);
          let sum=0;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)sum+=pixels[((y+dy)*320+x+dx)*4];
          return sum/9;
        }));
      }
      const [first,,later]=profiles;
      const mean=p=>p.reduce((a,b)=>a+b,0)/p.length;
      const a=first.map(v=>v/mean(first)),b=later.map(v=>v/mean(later));
      return {
        patternChange:a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length,
        fading:first.filter((v,i)=>v>55&&later[i]<v*.45).length,
        emerging:later.filter((v,i)=>v>55&&first[i]<v*.45).length,
      };
    }finally{
      corona.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});renderer.dispose();renderer.forceContextLoss();
    }
  });
  // The stable diffuse halo contributes more as the distant streamers fade.
  assert.ok(activity.patternChange>.3,'The outer corona must change its angular pattern, independently of overall brightness');
  assert.ok(activity.fading>=5&&activity.emerging>=5,'Long streamers must fade away and emerge in different locations');
  await page.screenshot({path:'.test-artifacts/sun-overview.png'});
  await focusSun();
  const glow=await radiance();
  assert.ok(glow.near[0]>130,'Sun should have a luminous corona outside its surface');
  assert.ok(glow.near[0]>glow.middle[0]&&glow.middle[0]>glow.far[0],'Corona should fade smoothly into space');
  assert.ok(glow.middle[0]>glow.middle[1]*1.3&&glow.middle[1]>glow.middle[2]*1.5,'Corona should have a warm amber color');
  const first=await page.locator('canvas').screenshot();await page.waitForTimeout(1100);
  assert.notDeepEqual(await page.locator('canvas').screenshot(),first,'Solar plasma and corona should animate');
  await page.screenshot({path:'.test-artifacts/sun-closeup.png'});
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.waitForTimeout(400);
  const interior=await radiance();assert.ok(interior.near[0]<glow.near[0]*.25,'Corona must be hidden when inspecting the interior');
  await page.screenshot({path:'.test-artifacts/sun-interior.png'});
  await page.getByRole('button',{name:'Surface',exact:true}).click();await page.waitForTimeout(250);
  await page.mouse.move(900,350);await page.mouse.wheel(0,-180);await page.waitForTimeout(400);
  assert.ok((await radiance()).near[0]>100,'Glow should stay attached and visible when zooming closer');
  await page.mouse.move(900,350);await page.mouse.down({button:'right'});await page.mouse.move(1100,440,{steps:10});await page.mouse.up({button:'right'});await page.waitForTimeout(400);
  await page.screenshot({path:'.test-artifacts/sun-orbited.png'});
  await page.keyboard.press('Home');await page.waitForTimeout(1500);
  assert.equal(await page.locator('.scene-marker:visible').count(),12);
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForTimeout(1500);await focusSun();
  assert.ok((await radiance()).near[0]>100,'Mobile should retain the luminous corona');
  await page.screenshot({path:'.test-artifacts/sun-mobile.png'});
  await page.getByRole('button',{name:'Interior',exact:true}).click();await page.waitForTimeout(600);
  await page.screenshot({path:'.test-artifacts/sun-mobile-interior.png'});
  await page.keyboard.press('Home');await page.waitForTimeout(1500);
  assert.equal(await page.locator('.scene-marker:visible').count(),12);
  assert.equal(await page.locator('[role="alert"]').count(),0);
  assert.deepEqual(errors,[],'No browser or shader errors');
  console.log('Sun brightness, amber falloff, animation, zoom/orbit, interior visibility and mobile rendering passed.',{glow,activity});
}finally{await browser.close();}
