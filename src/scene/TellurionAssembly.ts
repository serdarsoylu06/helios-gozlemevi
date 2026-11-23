import * as THREE from 'three';
import { createCalendarDialTexture, createMoonPhaseDialTexture } from './textures';

/**
 * Generates an authentic extruded toothed gear wheel using THREE.Shape + ExtrudeGeometry.
 */
export function createExtrudedGear(
  teeth: number,
  outerRadius: number,
  toothDepth: number,
  thickness: number,
  material: THREE.Material
): THREE.Mesh {
  const shape = new THREE.Shape();
  const innerRadius = outerRadius - toothDepth;
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.48;
    const a3 = a0 + step * 0.7;

    const p0x = Math.cos(a0) * innerRadius;
    const p0y = Math.sin(a0) * innerRadius;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * outerRadius, Math.sin(a1) * outerRadius);
    shape.lineTo(Math.cos(a2) * outerRadius, Math.sin(a2) * outerRadius);
    shape.lineTo(Math.cos(a3) * innerRadius, Math.sin(a3) * innerRadius);
  }
  shape.closePath();

  // Center axle hole
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius * 0.26, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, thickness / 2, 0);

  return new THREE.Mesh(geo, material);
}

export interface TellurionParts {
  baseGroup: THREE.Group;
  armHardwareGroup: THREE.Group;
  moonDialMesh: THREE.Mesh;
  lightBeamCone: THREE.Mesh;
  sunLensHousing: THREE.Mesh;
  gears: THREE.Mesh[];
  moonWireHoriz: THREE.Mesh;
  moonWireVert: THREE.Mesh;
  brassMat: THREE.MeshStandardMaterial;
}

export function buildTellurionHardware(): TellurionParts {
  const anodizedMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.34,
    metalness: 0.72,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a656,
    roughness: 0.24,
    metalness: 0.9,
  });
  const darkBrassMat = new THREE.MeshStandardMaterial({
    color: 0xa17a36,
    roughness: 0.32,
    metalness: 0.85,
  });
  const rubyMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.35,
    roughness: 0.22,
    metalness: 0.35,
  });

  // 1. Stationary Observatory Pedestal + Calendar Dial
  const baseGroup = new THREE.Group();

  const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 6.45, 2.0, 64), anodizedMat);
  baseMesh.position.y = -5.7;
  baseGroup.add(baseMesh);

  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.09, 16, 72), brassMat);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = -6.62;
  baseGroup.add(baseRim);

  const calGeo = new THREE.CylinderGeometry(6.8, 6.9, 0.35, 72);
  const calDisc = new THREE.Mesh(calGeo, [
    brassMat,
    new THREE.MeshBasicMaterial({ map: createCalendarDialTexture() }),
    anodizedMat,
  ]);
  calDisc.position.y = -4.2;
  baseGroup.add(calDisc);

  const centerPost = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 4.2, 32), brassMat);
  centerPost.position.y = -2.1;
  baseGroup.add(centerPost);

  // 2. Rotating Tellurion Mechanical Arm + Interlocking Extruded Gears
  const armHardwareGroup = new THREE.Group();

  const lensGeo = new THREE.CylinderGeometry(0.38, 0.46, 0.36, 24);
  lensGeo.rotateZ(Math.PI / 2);
  const sunLensHousing = new THREE.Mesh(
    lensGeo,
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.95 })
  );
  sunLensHousing.position.set(3.42, 1.2, 0);
  armHardwareGroup.add(sunLensHousing);

  const coneGeo = new THREE.ConeGeometry(1.9, 11.1, 36, 1, true);
  coneGeo.rotateZ(Math.PI / 2);
  const lightBeamCone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  lightBeamCone.position.set(8.95, 1.2, 0);
  armHardwareGroup.add(lightBeamCone);

  const pointerArm = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.13, 0.18), rubyMat);
  pointerArm.position.set(3.4, -3.94, 0);
  armHardwareGroup.add(pointerArm);

  const handleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 20), rubyMat);
  handleMesh.position.set(6.8, -3.55, 0);
  armHardwareGroup.add(handleMesh);

  const gearBar = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.4, 1.65), anodizedMat);
  gearBar.position.set(7.25, -3.5, 0);
  armHardwareGroup.add(gearBar);

  // 3 interlocking toothed brass gears along the Tellurion bridge
  const gearSpecs: [number, number, number, THREE.Material][] = [
    [4.4, 20, 1.85, darkBrassMat],
    [7.8, 16, 1.55, brassMat],
    [11.0, 20, 1.85, darkBrassMat],
  ];
  const gears: THREE.Mesh[] = [];
  gearSpecs.forEach(([xPos, teeth, radius, mat]) => {
    const gear = createExtrudedGear(teeth, radius, 0.22, 0.34, mat);
    gear.position.set(xPos, -3.1, 0);
    armHardwareGroup.add(gear);
    gears.push(gear);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 20), anodizedMat);
    hub.position.set(xPos, -3.1, 0);
    armHardwareGroup.add(hub);
  });

  // 3. Moon phase dial (placed under Earth)
  const moonDialMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.25, 0.26, 56), [
    brassMat,
    new THREE.MeshBasicMaterial({ map: createMoonPhaseDialTexture() }),
    anodizedMat,
  ]);
  moonDialMesh.position.y = -2.8;

  // 4. Moon carrier brass wire
  const moonWireHoriz = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 12), brassMat);
  moonWireHoriz.rotation.z = Math.PI / 2;
  moonWireHoriz.position.set(1.8, 0.2, 0);

  const moonWireVert = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.5, 12), brassMat);
  moonWireVert.position.set(3.6, 1.95, 0);

  return {
    baseGroup,
    armHardwareGroup,
    moonDialMesh,
    lightBeamCone,
    sunLensHousing,
    gears,
    moonWireHoriz,
    moonWireVert,
    brassMat,
  };
}
