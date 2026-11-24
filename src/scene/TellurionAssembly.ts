import * as THREE from 'three';
import { createCalendarDialTexture } from './textures';

export interface TellurionParts {
  baseGroup: THREE.Group;
  armHardwareGroup: THREE.Group;
  lightBeamCone: THREE.Mesh;
  moonOrbitRingGroup: THREE.Group;
  brassMat: THREE.MeshStandardMaterial;
}

/**
 * Clean Observatory Tellurion Assembly:
 * - Floating thin ecliptic calendar & season dial (no bulky pedestal or gears)
 * - Slender ruby/brass date needle gliding over the calendar dial
 * - Subtle additive solar light cone toward Earth
 * - 5.145° inclined Lunar orbit ring with ascending/descending node markers
 */
export function buildTellurionHardware(): TellurionParts {
  const anodizedMat = new THREE.MeshStandardMaterial({
    color: 0x0b1120,
    roughness: 0.35,
    metalness: 0.65,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a656,
    roughness: 0.24,
    metalness: 0.88,
  });
  const rubyMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xbe123c,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.3,
  });

  // 1. Sleek Floating Ecliptic Calendar Disc (no heavy base block)
  const baseGroup = new THREE.Group();

  const calGeo = new THREE.CylinderGeometry(6.8, 6.85, 0.14, 72);
  const calDisc = new THREE.Mesh(calGeo, [
    brassMat,
    new THREE.MeshBasicMaterial({ map: createCalendarDialTexture() }),
    anodizedMat,
  ]);
  calDisc.position.y = -3.5;
  baseGroup.add(calDisc);

  // Subtle brass outer halo ring around the calendar dial
  const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(6.95, 0.035, 12, 96), brassMat);
  outerHalo.rotation.x = Math.PI / 2;
  outerHalo.position.y = -3.5;
  baseGroup.add(outerHalo);

  // 2. Minimal Date Needle & Solar Beam (no gears, no heavy bridge)
  const armHardwareGroup = new THREE.Group();

  // Slender date pointer needle resting just above the calendar disc
  const needle = new THREE.Mesh(new THREE.BoxGeometry(6.75, 0.05, 0.09), rubyMat);
  needle.position.set(3.375, -3.39, 0);
  armHardwareGroup.add(needle);

  const needleTip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), rubyMat);
  needleTip.position.set(6.78, -3.39, 0);
  armHardwareGroup.add(needleTip);

  // Faint radial ecliptic alignment line from Sun to Earth
  const radialPts = [new THREE.Vector3(3.6, 1.2, 0), new THREE.Vector3(14.5, 1.2, 0)];
  const radialLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(radialPts),
    new THREE.LineBasicMaterial({ color: 0xd4a656, transparent: true, opacity: 0.22 })
  );
  armHardwareGroup.add(radialLine);

  // Soft translucent solar light cone toward Earth
  const coneGeo = new THREE.ConeGeometry(1.75, 11.0, 36, 1, true);
  coneGeo.rotateZ(Math.PI / 2);
  const lightBeamCone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  lightBeamCone.position.set(9.0, 1.2, 0);
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
    new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 })
  );
  moonRingPivot.add(moonOrbitLine);

  // Subtle ecliptic reference ring around Earth (0° plane) so the 5.145° tilt is visible
  const eclipticRefLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16 })
  );
  moonOrbitRingGroup.add(eclipticRefLine);

  // Ascending & Descending lunar node markers (where eclipses can occur)
  const nodeGeo = new THREE.SphereGeometry(0.065, 10, 10);
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
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
