import * as THREE from 'three';
import {AU} from './data';

export const OVERVIEW_DISTANCE=85*AU;
export const orbitRadius=au=>Math.sqrt(au/30.07)*30.07*AU;
// Diagram coordinates, not a dated ephemeris. Pluto retains its approximate
// eccentricity and inclination before the shared radial compression.
export function orbitalPosition(body,angle=body.angle,target=new THREE.Vector3()){
  const a=body.au*AU,e=body.eccentricity||0;
  target.set(a*(Math.cos(angle)-e),0,a*Math.sqrt(1-e*e)*Math.sin(angle));
  // Apply the same distance mapping to every point, after building the real
  // ellipse. Compressing only its semi-major axis exaggerates perihelion
  // crossings relative to the circular orbits (especially Neptune's).
  const distance=target.length();
  if(distance>0)target.multiplyScalar(orbitRadius(distance/AU)/distance);
  if(body.inclination)target.applyAxisAngle(new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(body.inclination));
  if(body.orbitOrientation)target.applyAxisAngle(new THREE.Vector3(0,1,0),body.orbitOrientation);
  return target;
}
