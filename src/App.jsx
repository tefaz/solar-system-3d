import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowUpRight, X, RotateCcw, Maximize, SlidersHorizontal, Layers3, Magnet, Info, ExternalLink, Gamepad2} from 'lucide-react';
import Scene from './Scene';
import RoverDemo from './RoverDemo';
import {getBody} from './data';
import {getInterior} from './interiors';
import {magneticFields} from './magneticFields';
import {marsRobots, getMarsRobot, robotCoordinates} from './marsRobots';

export default function App() {
  const [selected,setSelected]=useState(null);
  const [cutaway,setCutaway]=useState(false);
  const [activeLayer,setActiveLayer]=useState(0);
  const [interiorModel,setInteriorModel]=useState('inner-core');
  const [magnetic,setMagnetic]=useState(false);
  const [orbits,setOrbits]=useState(true);
  const [labels,setLabels]=useState(false);
  const [resetToken,setResetToken]=useState(0);
  const [settings,setSettings]=useState(false);
  const [error,setError]=useState(null);
  const [details,setDetails]=useState(false);
  const [robotId,setRobotId]=useState(null);
  const [playing,setPlaying]=useState(false);
  const exitDriving=()=>{setPlaying(false);requestAnimationFrame(()=>document.querySelector('.play-rover-button')?.focus());};
  const robot=getMarsRobot(robotId);
  const popupClose=useRef(null),robotTrigger=useRef(null);
  const openRobot=id=>{robotTrigger.current=document.activeElement;setCutaway(false);setRobotId(id);};
  const closeRobot=()=>{setRobotId(null);requestAnimationFrame(()=>{if(robotTrigger.current?.isConnected)robotTrigger.current.focus();});};
  useEffect(()=>{if(robotId)popupClose.current?.focus({preventScroll:true});},[robotId]);
  const main=useRef(null);
  const body=getBody(selected);
  const interior=getInterior(selected,interiorModel);
  const selectedLayer=interior?.layers[activeLayer];
  const select=id=>{setSelected(id);setRobotId(null);setCutaway(false);setMagnetic(false);setActiveLayer(0);setInteriorModel('inner-core');setDetails(false);setSettings(false);};

  useEffect(()=>{
    const key=e=>{
      if(playing){if(e.key==='Escape'||e.key==='Home'){e.preventDefault();exitDriving();}return;}
      if(e.key==='Escape'){if(robotId)closeRobot();else if(settings)setSettings(false);else select(null);return;}
      if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
      if(e.key==='Home')select(null);
      if(e.key.toLowerCase()==='r')setResetToken(t=>t+1);
    };
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[settings,robotId,playing]);
  const fullScreen=async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await main.current.requestFullscreen();}
    catch{setError('Full screen is unavailable in this browser window.');}
  };

  if(playing)return <main ref={main} className="app driving"><RoverDemo onExit={exitDriving}/></main>;

  return <main ref={main} className={`app ${selected?'focused':'overview'} ${robot?'robot-open':''}`}>
    <Scene selected={selected} onSelect={select} activeRobot={robotId} onSelectRobot={openRobot} cutaway={cutaway} activeLayer={activeLayer} onSelectLayer={setActiveLayer} interiorModel={interiorModel} magnetic={magnetic} orbits={orbits} labels={labels} resetToken={resetToken} onError={setError}/>
    {body&&<>
      <button className="back-button" aria-label="System view" onClick={()=>select(null)}><ArrowLeft size={16}/> Solar system</button>
      <section className="planet-card" key={selected} aria-label={`${body.name} information`}>
        <div className="planet-heading"><div><span className="planet-kind">{body.kind}</span><h1>{body.name}</h1></div><button className="icon-button" aria-label="Planet details" aria-expanded={details} onClick={()=>setDetails(!details)}><Info size={17}/></button></div>
        {details&&<div className="planet-details"><p>{body.description}</p>{body.orbitNote&&<p className="surface-note">{body.orbitNote}</p>}{body.surfaceNote&&<p className="surface-note">{body.surfaceNote} <a href={body.source} target="_blank" rel="noreferrer">About Pluto <ExternalLink size={10}/></a></p>}<div className="planet-facts"><span>{selected==='belt'?'Orbital region':'Diameter'}<strong>{selected==='belt'?'2.2–3.3 AU':`${Math.round(body.radius*2).toLocaleString()} km`}</strong></span><span>From the Sun<strong>{body.au.toFixed(2)} AU</strong></span></div></div>}
        {body.layers.length>0&&<div className="interior-panel">
          <div className="interior-heading"><span><Layers3 size={15}/> Explore inside</span><span className="cutaway-label">{cutaway?'Half cutaway':'Full globe'}</span></div>
          <div className="view-switch" role="group" aria-label="Planet view">
            <button aria-pressed={!cutaway} onClick={()=>setCutaway(false)}>Surface</button>
            <button aria-pressed={cutaway} onClick={()=>{setRobotId(null);setCutaway(true);}}>Interior</button>
          </div>
          {cutaway&&<div className="interior-content">
            <p className="cutaway-hint">Right-drag or swipe to turn · select a layer</p>
            {selected==='mars'&&<div className="interior-model-picker" role="group" aria-label="Mars interior interpretation">
              <span>Compare proposed models</span>
              <div>{[['inner-core','Inner core'],['basal-melt','Basal melt']].map(([value,label])=><button key={value} aria-pressed={interiorModel===value} onClick={()=>{setInteriorModel(value);setActiveLayer(0);}}>{label}</button>)}</div>
            </div>}
            <div className="interior-summary"><span>{interior.summary}</span><span>Surface → center</span></div>
            <div className="layer-key" role="group" aria-label="Interior layers">{interior.layers.map((layer,i)=><button key={layer.name} aria-label={layer.name} aria-pressed={activeLayer===i} onClick={()=>setActiveLayer(i)} style={{'--layer-color':layer.color}}>
              <i className={layer.evidence==='Possible'?'possible':''}>{i+1}</i><span>{layer.name}<small>{layer.phase}</small></span>
            </button>)}</div>
            <div className="layer-detail" aria-live="polite">
              <div className="layer-evidence"><span className={selectedLayer.evidence==='Possible'?'possible':''}>{selectedLayer.evidence}</span><span>{selectedLayer.extent}</span></div>
              <p className="layer-description">{selectedLayer.description}</p>
            </div>
            <p className="interior-note">{interior.note}</p>
            <p className="interior-visual-key"><span>Hatching = possible region</span><span>Soft edges = gradual transition</span><span>Radii to model scale · colors & flow illustrative</span></p>
            <div className="interior-sources">{interior.sources.map(s=><a className="interior-source" key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label} <ExternalLink size={10}/></a>)}</div>
          </div>}
        </div>}
        {magneticFields[selected]&&<div className="magnetic-panel">
          <button className="magnetic-toggle" role="switch" aria-label="Magnetic field" aria-checked={magnetic} onClick={()=>setMagnetic(!magnetic)}><span><Magnet size={15}/> Magnetic field</span><span className="toggle-track"><i/></span></button>
          {magnetic&&<div className="magnetic-info"><span className="field-kind">{magneticFields[selected].title}</span><p>{magneticFields[selected].description}</p><div className="field-caption"><i/> Illustrative geometry & colors · extent compressed</div><a className="interior-source" href={magneticFields[selected].source} target="_blank" rel="noreferrer">About this field <ExternalLink size={10}/></a></div>}
        </div>}
        {selected==='mars'&&<div className="mars-robot-list"><span className="robot-list-title">Robots on Mars <span>7 missions</span></span><p>Select a marker or turn to a mission below.</p><div role="group" aria-label="Mars robots">{marsRobots.map(r=><button key={r.id} style={{'--robot-color':r.color}} aria-label={`Find ${r.name}`} aria-pressed={robotId===r.id} onClick={()=>openRobot(r.id)}><i/>{r.name}</button>)}</div><p className="robot-location-note">Approximate mission areas · not live tracking</p></div>}
        {selected==='earth'&&<button className="moon-link" onClick={()=>select('moon')}>Visit the Moon <ArrowUpRight size={13}/></button>}
      </section>
    </>}
    {robot&&<section className="robot-popup" role="dialog" aria-labelledby="robot-title" aria-describedby="robot-description">
      <div className="robot-popup-heading"><div><span className="planet-kind">{robot.agency} · {robot.type}</span><h2 id="robot-title"><i style={{background:robot.color}}/>{robot.name}</h2></div><button ref={popupClose} className="icon-button" aria-label="Close robot information" onClick={closeRobot}><X size={18}/></button></div>
      <figure className="robot-photo" key={robot.id}><img src={robot.image} alt={robot.imageAlt} width="900" height="600"/><figcaption><a href={robot.imageSource} target="_blank" rel="noreferrer">Image: {robot.imageCredit} <ExternalLink size={9}/></a></figcaption></figure>
      {robot.id==='perseverance'&&<button className="play-rover-button" onClick={()=>{setSettings(false);setPlaying(true);}}><Gamepad2 size={17}/><span>Play as Perseverance<small>Drive on Mars · WASD</small></span><ArrowUpRight size={16}/></button>}
      <span className="robot-status">{robot.status}</span>
      <p id="robot-description">{robot.description}</p><p className="robot-achievement">{robot.achievement}</p>
      <dl className="robot-facts"><div><dt>Arrived on Mars</dt><dd>{robot.landed}</dd></div><div><dt>Mission area</dt><dd>{robot.site}</dd></div><div><dt>Approximate coordinates</dt><dd>{robotCoordinates(robot)}</dd></div></dl>
      <p className="robot-location-note">Markers show rounded mission areas. Rovers move within these regions; these positions are not live telemetry.</p>
      <div className="robot-sources"><a href={robot.source} target="_blank" rel="noreferrer">Mission details <ExternalLink size={11}/></a><a href={robot.locationSource} target="_blank" rel="noreferrer">Location reference <ExternalLink size={11}/></a></div>
    </section>}
    <button className={`settings-button icon-button ${settings?'active':''}`} aria-label="Viewer settings" title="Viewer settings" onClick={()=>setSettings(!settings)}><SlidersHorizontal size={17}/></button>
    {settings&&<aside className="settings-panel"><div className="panel-title"><span>Viewer</span><button className="icon-button" aria-label="Close settings" onClick={()=>setSettings(false)}><X size={16}/></button></div><label><span>Orbital paths</span><input type="checkbox" checked={orbits} onChange={e=>setOrbits(e.target.checked)}/></label><label><span>Planet names</span><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/></label><div className="settings-actions"><button onClick={()=>{setResetToken(t=>t+1);setSettings(false);}}><RotateCcw size={15}/> Reset view</button><button onClick={fullScreen}><Maximize size={15}/> Full screen</button></div></aside>}
    {error&&<div className="error-toast" role="alert"><Info size={17}/><span>{error}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setError(null)}><X size={15}/></button></div>}
  </main>;
}
