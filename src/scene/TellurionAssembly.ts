import * as THREE from 'three';
import { createCalendarDialTexture } from './textures';
import { createSolarBeamMaterial } from './shaders';

export interface TellurionParts {
  baseGroup: THREE.Group;
  armHardwareGroup: THREE.Group;
  lightBeamCone: THREE.Mesh;
  moonOrbitRingGroup: THREE.Group;
  brassMat: THREE.MeshStandardMaterial;
}

/**
 * Pro Observatory Holographic Astrolabe Tellurion Assembly (v3.0):
 * - Sleek translucent obsidian-gold holographic ecliptic astrolabe dial (no bulky pie-chart block)
 * - Ultra-thin brushed brass outer & inner orbital bezel rings
 * - Precision glowing golden ecliptic pointer line + reticle ring at rim
 * - Fresnel-faded volumetric solar light beam toward Earth
 * - 5.145° inclined Lunar orbit ring with ascending/descending node reticles
 */
export function buildTellurionHardware(): TellurionParts {
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe2b866,
    roughness: 0.22,
    metalness: 0.9,
  });

  const goldGlowMat = new THREE.MeshBasicMaterial({
    color: 0xf5d08a,
    transparent: true,
    opacity: 0.85,
  });

  // 1. Sleek Floating Holographic Astrolabe Dial
  const baseGroup = new THREE.Group();

  const dialPlane = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 96),
    new THREE.MeshBasicMaterial({
      map: createCalendarDialTexture(),
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  dialPlane.rotation.x = -Math.PI / 2;
  dialPlane.position.y = -3.45;
  baseGroup.add(dialPlane);

  // Delicate brushed-brass outer & inner astrolabe bezels
  const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(7.22, 0.024, 12, 120), brassMat);
  outerHalo.rotation.x = Math.PI / 2;
  outerHalo.position.y = -3.45;
  baseGroup.add(outerHalo);

  const innerHalo = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.014, 10, 96), brassMat);
  innerHalo.rotation.x = Math.PI / 2;
  innerHalo.position.y = -3.45;
  baseGroup.add(innerHalo);

  // 2. Precision Ecliptic Pointer & Volumetric Fresnel Solar Beam
  const armHardwareGroup = new THREE.Group();

  // Slim glowing golden date pointer resting just above the astrolabe
  const needlePts = [new THREE.Vector3(3.9, -3.42, 0), new THREE.Vector3(7.22, -3.42, 0)];
  const needleLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(needlePts),
    new THREE.LineBasicMaterial({ color: 0xf5d08a, transparent: true, opacity: 0.92 })
  );
  armHardwareGroup.add(needleLine);

  // Subtle glowing reticle ring at the ecliptic rim
  const reticleTip = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.16, 24), goldGlowMat);
  reticleTip.rotation.x = -Math.PI / 2;
  reticleTip.position.set(7.22, -3.41, 0);
  armHardwareGroup.add(reticleTip);

  // Faint radial ecliptic alignment hairline from Sun to Earth
  const radialPts = [new THREE.Vector3(3.8, 1.2, 0), new THREE.Vector3(14.5, 1.2, 0)];
  const radialLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(radialPts),
    new THREE.LineBasicMaterial({ color: 0xe2b866, transparent: true, opacity: 0.16 })
  );
  armHardwareGroup.add(radialLine);

  // Fresnel-faded soft volumetric solar beam toward Earth
  const coneGeo = new THREE.ConeGeometry(1.75, 10.8, 48, 1, true);
  coneGeo.rotateZ(Math.PI / 2);
  const lightBeamCone = new THREE.Mesh(coneGeo, createSolarBeamMaterial());
  lightBeamCone.position.set(9.1, 1.2, 0);
  armHardwareGroup.add(lightBeamCone);

  // 3. 5.145° Inclined Lunar Orbit Ring + Ascending/Descending Node Markers
  const moonOrbitRingGroup = new THREE.Group();
  moonOrbitRingGroup.position.y = 1.2;

  const moonRingPivot = new THREE.Group();
  moonRingPivot.rotation.x = THREE.MathUtils.degToRad(5.145);
  moonOrbitRingGroup.add(moonRingPivot);

  const moonR = 3.6;
  const ringPts: THREE.Vector3[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a) * moonR, 0, -Math.sin(a) * moonR));
  }
  const moonOrbitLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 })
  );
  moonRingPivot.add(moonOrbitLine);

  // Subtle ecliptic reference ring around Earth (0° plane) so the 5.145° tilt is visible
  const eclipticRefLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.14 })
  );
  moonOrbitRingGroup.add(eclipticRefLine);

  // Ascending & Descending lunar node reticle markers
  const nodeGeo = new THREE.RingGeometry(0.055, 0.095, 16);
  nodeGeo.rotateX(-Math.PI / 2);
  const nodeMat = new THREE.MeshBasicMaterial({
    color: 0xe8b85a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const ascNode = new THREE.Mesh(nodeGeo, nodeMat);
  ascNode.position.set(moonR, 0, 0);
  const descNode = new THREE.Mesh(nodeGeo, nodeMat);
  descNode.position.set(-moonR, 0, 0);
  moonOrbitRingGroup.add(ascNode, descNode);

  return {
    baseGroup,
    armHardwareGroup,
    lightBeamCone,
    moonOrbitRingGroup,
    brassMat,
  };
}
