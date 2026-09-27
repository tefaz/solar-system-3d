// A bounded, deterministic arcade driving model; distances are in meters.
export const DRIVE_RADIUS=88;
export function terrainHeight(x,z){
  return .72*Math.sin(x*.062)*Math.cos(z*.048)+.32*Math.sin(z*.12+x*.035)+.14*Math.sin(x*.19-z*.11);
}
export function createDrivingState(){return {x:0,z:0,heading:0,speed:0,distance:0,blocked:false};}
export function updateDriving(state,keys,dt,rocks){
  const throttle=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const steer=Number(keys.has('KeyA'))-Number(keys.has('KeyD'));
  const target=throttle*(throttle>0?5.2:2.7);
  state.speed+=(target-state.speed)*(1-Math.exp(-dt*(throttle?2.2:4)));
  if(Math.abs(state.speed)<.008)state.speed=0;
  state.heading+=steer*state.speed*.22*dt;
  const x=state.x-Math.sin(state.heading)*state.speed*dt,z=state.z-Math.cos(state.heading)*state.speed*dt;
  state.blocked=Math.hypot(x,z)>DRIVE_RADIUS||rocks.some(r=>Math.hypot(x-r.x,z-r.z)<r.radius+1.5);
  if(state.blocked){state.speed=0;return;}
  state.distance+=Math.hypot(x-state.x,z-state.z);state.x=x;state.z=z;
}
