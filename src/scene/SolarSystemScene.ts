import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import {
  BodyId,
  CameraPreset,
  CITIES,
  MOON_INCLINATION_DEG,
  PLANET_DATA,
  SimMode,
  SOLAR_PLANET_KEYS,
} from '../astronomy/constants';
import {
  computeLunarState,
  computePlanetPosition,
  getEquinoxDayOfYear,
} from '../astronomy/ephemeris';
import { AppState, store } from '../state/store';
import {
  createEarthAtmosphereMaterial,
  createEarthDayNightMaterial,
  createSunPlasmaMaterial,
} from './shaders';
import {
  createCoronaGlowTexture,
  createDetailedPlanetTexture,
  createEarthFallbackTexture,
  createEarthNightLightsTexture,
  createSaturnRingTexture,
  TEXTURE_URLS,
} from './textures';
import { buildTellurionHardware, TellurionParts } from './TellurionAssembly';
import { ObservatoryAudio } from './audio';

interface PlanetRig {
  key: BodyId;
  rootGroup: THREE.Group;
  tiltGroup: THREE.Group;
  mesh: THREE.Mesh;
  orbitLine: THREE.LineLoop;
}

interface LabelEntry {
  element: HTMLDivElement;
  target: THREE.Object3D;
  yOffset: number;
  visibleIn: SimMode[];
}

export class SolarSystemScene {
  private container: HTMLElement;
  private labelsContainer: HTMLElement;
  private audio: ObservatoryAudio;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private controls!: OrbitControls;
  private clock = new THREE.Clock();

  private sunMesh!: THREE.Mesh;
  private sunPlasmaMat!: THREE.ShaderMaterial;
  private sunCoronaSprite!: THREE.Sprite;
  private tellurion!: TellurionParts;

  private mainArmGroup!: THREE.Group;
  private earthSystemGroup!: THREE.Group;
  private earthTiltGroup!: THREE.Group;
  private earthMesh!: THREE.Mesh;
  private earthShaderMat!: THREE.ShaderMaterial;
  private earthCloudsMesh!: THREE.Mesh;
  private earthAtmoMesh!: THREE.Mesh;
  private tropicsGroup!: THREE.Group;
  private cityPinGroup!: THREE.Group;

  private moonOrbitGroup!: THREE.Group;
  private moonMesh!: THREE.Mesh;
  private moonMaterial!: THREE.MeshStandardMaterial;

  private solarSystemGroup!: THREE.Group;
  private earthOrbitLine!: THREE.LineLoop;
  private asteroidBelt!: THREE.InstancedMesh;
  private comparisonGroup!: THREE.Group;
  private comparisonEarthMat: THREE.MeshStandardMaterial | null = null;

  private planetRigs = new Map<BodyId, PlanetRig>();
  private labels = new Map<string, LabelEntry>();
  private clickableMeshes: THREE.Mesh[] = [];

  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };
  private tempVec = new THREE.Vector3();
  private tempMoonWorld = new THREE.Vector3();

  // Smooth camera transition state
  private desiredTarget = new THREE.Vector3(4.5, 0.2, 0);
  private desiredCamPos: THREE.Vector3 | null = null;
  private camLerpAlpha = 0.08;
  private tellurionDropProgress = 0; // 0 = visible, 1 = lowered/hidden
  private lastTickDay = 0;
  private animFrameId = 0;
  private isHidden = false;

  constructor(container: HTMLElement, labelsContainer: HTMLElement, audio: ObservatoryAudio) {
    this.container = container;
    this.labelsContainer = labelsContainer;
    this.audio = audio;

    this.initRendererAndScene();
    this.createDeepSpaceStarfield();
    this.buildSun();
    this.buildTellurionAndEarth();
    this.buildSolarSystemAndAsteroids();
    this.buildComparisonLineup();
    this.loadSatelliteTextures();
    this.setupEvents();

    // Subscribe to state changes
    store.subscribe((state, changed) => this.onStateChange(state, changed));
    this.applyMode(store.get().mode, true);
    this.updatePositions(store.get());
    this.animate();
  }

  private initRendererAndScene(): void {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      44,
      window.innerWidth / window.innerHeight,
      0.08,
      1800
    );
    this.camera.position.set(19, 13, 19);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // Subtle metallic studio environment for brass & anodized hardware
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.28;
    pmrem.dispose();

    // Post-processing selective bloom
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.38,
      0.55,
      0.82
    );
    this.composer.addPass(this.bloomPass);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.minDistance = 2.1;
    this.controls.maxDistance = 160;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.target.copy(this.desiredTarget);
    this.controls.addEventListener('start', () => {
      this.desiredCamPos = null;
    });

    // Lighting
    this.scene.add(new THREE.AmbientLight(0x94a3b8, 0.14));
    const sunLight = new THREE.PointLight(0xfff7ed, 3.2, 320, 0.75);
    sunLight.position.set(0, 1.2, 0);
    this.scene.add(sunLight);

    const fillDir = new THREE.DirectionalLight(0x64748b, 0.14);
    fillDir.position.set(0, 50, 30);
    this.scene.add(fillDir);
  }

  private createDeepSpaceStarfield(): void {
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#bfdbfe'),
      new THREE.Color('#f8fafc'),
      new THREE.Color('#fef3c7'),
      new THREE.Color('#fed7aa'),
    ];

    for (let i = 0; i < count; i++) {
      // 35% concentrated along a tilted Milky Way galactic band
      const inBand = i < count * 0.35;
      const r = 160 + Math.random() * 420;
      const theta = Math.random() * Math.PI * 2;
      let phi: number;
      if (inBand) {
        const bandSpread = (Math.random() - 0.5) * 0.28;
        phi = Math.PI / 2 + bandSpread;
      } else {
        phi = Math.acos(2 * Math.random() - 1);
      }

      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.cos(phi);
      let z = r * Math.sin(phi) * Math.sin(theta);

      // Tilt Milky Way band by ~60°
      if (inBand) {
        const tilt = 1.05;
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
        const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
        y = y2;
        z = z2;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = palette[i % palette.length];
      const b = inBand ? 0.35 + Math.random() * 0.45 : 0.55 + Math.random() * 0.45;
      colors[i * 3] = c.r * b;
      colors[i * 3 + 1] = c.g * b;
      colors[i * 3 + 2] = c.b * b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.72,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  private buildSun(): void {
    this.sunPlasmaMat = createSunPlasmaMaterial();
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_DATA.sun.modelRadius, 64, 64),
      this.sunPlasmaMat
    );
    this.sunMesh.position.y = 1.2;
    this.sunMesh.userData.bodyId = 'sun';
    this.scene.add(this.sunMesh);
    this.clickableMeshes.push(this.sunMesh);

    const coronaMat = new THREE.SpriteMaterial({
      map: createCoronaGlowTexture(),
      color: 0xfdba74,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sunCoronaSprite = new THREE.Sprite(coronaMat);
    this.sunCoronaSprite.scale.set(13.8, 13.8, 1);
    this.sunCoronaSprite.position.set(0, 1.2, 0);
    this.scene.add(this.sunCoronaSprite);

    this.createLabel('sun', 'Güneş · 3.5x', this.sunMesh, 4.1, '#f59e0b', ['tellurion', 'solar']);
  }

  private buildTellurionAndEarth(): void {
    this.tellurion = buildTellurionHardware();
    this.scene.add(this.tellurion.baseGroup);

    this.mainArmGroup = new THREE.Group();
    this.scene.add(this.mainArmGroup);
    this.mainArmGroup.add(this.tellurion.armHardwareGroup);

    // Earth & Moon inertial-aligned group
    this.earthSystemGroup = new THREE.Group();
    this.earthSystemGroup.position.set(PLANET_DATA.earth.modelDistance, 0, 0);
    this.mainArmGroup.add(this.earthSystemGroup);
    this.earthSystemGroup.add(this.tellurion.moonOrbitRingGroup);

    // Earth 23.44° axial tilt group (June 21 tilts North Pole toward +Z Sun)
    this.earthTiltGroup = new THREE.Group();
    this.earthTiltGroup.position.y = 1.2;
    this.earthTiltGroup.rotation.x = THREE.MathUtils.degToRad(PLANET_DATA.earth.tiltDeg);
    this.earthSystemGroup.add(this.earthTiltGroup);

    const axisRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, PLANET_DATA.earth.modelRadius * 2.85, 16),
      this.tellurion.brassMat
    );
    this.earthTiltGroup.add(axisRod);

    // Earth with custom Day/Night + City Lights + Eclipse Shadow GLSL shader
    const fallbackDay = createEarthFallbackTexture();
    const nightTex = createEarthNightLightsTexture();
    this.earthShaderMat = createEarthDayNightMaterial(fallbackDay, nightTex, fallbackDay);

    this.earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_DATA.earth.modelRadius, 64, 64),
      this.earthShaderMat
    );
    this.earthMesh.userData.bodyId = 'earth';
    this.earthTiltGroup.add(this.earthMesh);
    this.clickableMeshes.push(this.earthMesh);

    // Cloud layer
    this.earthCloudsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_DATA.earth.modelRadius * 1.016, 48, 48),
      new THREE.MeshLambertMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      })
    );
    this.earthCloudsMesh.visible = false;
    this.earthTiltGroup.add(this.earthCloudsMesh);

    // Rayleigh Atmospheric Glow
    this.earthAtmoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_DATA.earth.modelRadius * 1.072, 48, 48),
      createEarthAtmosphereMaterial()
    );
    this.earthTiltGroup.add(this.earthAtmoMesh);

    // Equator, Tropics & Polar Circles overlay
    this.tropicsGroup = this.buildTropicsOverlay(PLANET_DATA.earth.modelRadius * 1.025);
    this.tropicsGroup.visible = store.get().showTropics;
    this.earthTiltGroup.add(this.tropicsGroup);

    // Interactive City Pin on Earth's surface
    this.cityPinGroup = new THREE.Group();
    const pinStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.006, 0.16, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    pinStem.position.y = 0.08;
    const pinHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    pinHead.position.y = 0.17;
    this.cityPinGroup.add(pinStem, pinHead);
    this.earthMesh.add(this.cityPinGroup);
    this.updateCityPinPosition(store.get().selectedCityId);

    this.createLabel('earth', 'Dünya · 1.0x', this.earthTiltGroup, 1.85, '#38bdf8', [
      'tellurion',
      'solar',
    ]);

    // Moon orbit group (centered directly in Earth's ecliptic plane y = 1.2)
    this.moonOrbitGroup = new THREE.Group();
    this.moonOrbitGroup.position.y = 1.2;
    this.earthSystemGroup.add(this.moonOrbitGroup);

    this.moonMaterial = new THREE.MeshStandardMaterial({
      map: createDetailedPlanetTexture('moon'),
      roughness: 0.88,
      metalness: 0.02,
    });
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_DATA.moon.modelRadius, 36, 36),
      this.moonMaterial
    );
    this.moonMesh.position.set(3.6, 0, 0);
    this.moonMesh.userData.bodyId = 'moon';
    this.moonOrbitGroup.add(this.moonMesh);
    this.clickableMeshes.push(this.moonMesh);

    this.createLabel('moon', 'Ay · 0.27x', this.moonMesh, 0.72, '#cbd5e1', ['tellurion', 'solar']);
  }

  private buildTropicsOverlay(radius: number): THREE.Group {
    const group = new THREE.Group();
    const latitudes: [number, number, number][] = [
      [0, 0xfde047, 0.85],       // Ekvator
      [23.44, 0xf59e0b, 0.7],    // Yengeç Dönencesi
      [-23.44, 0xf59e0b, 0.7],   // Oğlak Dönencesi
      [66.56, 0x38bdf8, 0.65],   // Kuzey Kutup Dairesi
      [-66.56, 0x38bdf8, 0.65],  // Güney Kutup Dairesi
    ];

    latitudes.forEach(([latDeg, colorHex, opacity]) => {
      const latRad = THREE.MathUtils.degToRad(latDeg);
      const r = radius * Math.cos(latRad);
      const y = radius * Math.sin(latRad);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity });
      group.add(new THREE.Line(geo, mat));
    });
    return group;
  }

  private updateCityPinPosition(cityId: string): void {
    const custom = store.get().customPin;
    const city = CITIES.find((c) => c.id === cityId) || CITIES[0];
    this.setPinLatLon(custom ? custom.lat : city.lat, custom ? custom.lon : city.lon);
  }

  private setPinLatLon(lat: number, lon: number): void {
    const latRad = THREE.MathUtils.degToRad(lat);
    const lonRad = THREE.MathUtils.degToRad(lon);
    const r = PLANET_DATA.earth.modelRadius;

    // Three.js SphereGeometry equirectangular UV mapping
    const phi = Math.PI / 2 - latRad;
    const theta = lonRad + Math.PI;
    const x = -r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    this.cityPinGroup.position.set(x, y, z);
    const normal = new THREE.Vector3(x, y, z).normalize();
    this.cityPinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }

  private buildKeplerOrbitLine(bodyId: BodyId, colorHex: string, opacity: number): THREE.LineLoop {
    const p = PLANET_DATA[bodyId];
    const pts: THREE.Vector3[] = [];
    const segments = 160;
    const baseJD = 2461000;
    for (let i = 0; i < segments; i++) {
      const jd = baseJD + (i / segments) * p.orbitalPeriodDays;
      const pos = computePlanetPosition(bodyId, jd, 1.0);
      pts.push(new THREE.Vector3(pos.x, pos.y + 1.2, pos.z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity });
    return new THREE.LineLoop(geo, mat);
  }

  private buildSolarSystemAndAsteroids(): void {
    this.solarSystemGroup = new THREE.Group();
    this.solarSystemGroup.visible = false;
    this.scene.add(this.solarSystemGroup);

    this.earthOrbitLine = this.buildKeplerOrbitLine('earth', '#38bdf8', 0.28);
    this.scene.add(this.earthOrbitLine);

    SOLAR_PLANET_KEYS.forEach((key) => {
      const p = PLANET_DATA[key];
      const orbitLine = this.buildKeplerOrbitLine(key, p.color, 0.22);
      this.solarSystemGroup.add(orbitLine);

      const rootGroup = new THREE.Group();
      this.solarSystemGroup.add(rootGroup);

      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.x = THREE.MathUtils.degToRad(p.tiltDeg);
      rootGroup.add(tiltGroup);

      const axisRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, p.modelRadius * 2.7, 8),
        new THREE.MeshBasicMaterial({ color: 0xd4a656, transparent: true, opacity: 0.45 })
      );
      tiltGroup.add(axisRod);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.modelRadius, 40, 40),
        new THREE.MeshStandardMaterial({
          map: createDetailedPlanetTexture(key),
          roughness: 0.65,
          metalness: 0.04,
        })
      );
      mesh.userData.bodyId = key;
      tiltGroup.add(mesh);
      this.clickableMeshes.push(mesh);

      if (p.hasRings) {
        const innerR = p.modelRadius * 1.32;
        const outerR = p.modelRadius * 2.38;
        const ringGeo = new THREE.RingGeometry(innerR, outerR, 72);
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getY(i));
          uv.setXY(i, (r - innerR) / (outerR - innerR), 0.5);
        }
        ringGeo.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(
          ringGeo,
          new THREE.MeshStandardMaterial({
            map: createSaturnRingTexture(),
            side: THREE.DoubleSide,
            transparent: true,
            roughness: 0.72,
            depthWrite: false,
          })
        );
        mesh.add(ringMesh);
      }

      this.planetRigs.set(key, { key, rootGroup, tiltGroup, mesh, orbitLine });
      this.createLabel(key, `${p.name} · ${p.badge.split(' ')[0]}`, rootGroup, p.modelRadius + 0.9, p.color, ['solar']);
    });

    // InstancedMesh Main Asteroid Belt between Mars (19.2) and Jupiter (26.5)
    const asteroidCount = 1200;
    const astGeo = new THREE.DodecahedronGeometry(0.09, 0);
    const astMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.92,
      metalness: 0.08,
    });
    this.asteroidBelt = new THREE.InstancedMesh(astGeo, astMat, asteroidCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < asteroidCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 21.4 + Math.random() * 2.8;
      const y = 1.2 + (Math.random() - 0.5) * 1.2;
      dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const s = 0.45 + Math.random() * 1.35;
      dummy.scale.set(s, s * 0.78, s * 1.12);
      dummy.updateMatrix();
      this.asteroidBelt.setMatrixAt(i, dummy.matrix);
    }
    this.asteroidBelt.instanceMatrix.needsUpdate = true;
    this.solarSystemGroup.add(this.asteroidBelt);
  }

  /**
   * True-Size Comparison Lineup Mode (1 unit = 1 Earth radius; Sun limb curves behind!)
   */
  private buildComparisonLineup(): void {
    this.comparisonGroup = new THREE.Group();
    this.comparisonGroup.visible = false;
    this.scene.add(this.comparisonGroup);

    // Massive Sun limb (radius = 109.1 Earth radii) positioned behind-left
    const hugeSun = new THREE.Mesh(
      new THREE.SphereGeometry(109.1, 64, 64),
      this.sunPlasmaMat
    );
    hugeSun.position.set(-118, 0, -14);
    this.comparisonGroup.add(hugeSun);

    const lineupLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    lineupLight.position.set(-40, 12, 22);
    this.comparisonGroup.add(lineupLight);

    const order: BodyId[] = [
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ];
    let cursorX = -6;

    order.forEach((key) => {
      const p = PLANET_DATA[key];
      const r = p.realRadiusEarth * 0.42; // Scaled uniformly so Jupiter ~4.7, Earth ~0.42, Mercury ~0.16
      cursorX += r + 1.45;
      if (key === 'saturn') cursorX += 2.2;

      let mat: THREE.MeshStandardMaterial;
      if (key === 'earth') {
        this.comparisonEarthMat = new THREE.MeshStandardMaterial({
          map: createEarthFallbackTexture(),
          roughness: 0.55,
        });
        mat = this.comparisonEarthMat;
      } else {
        mat = new THREE.MeshStandardMaterial({
          map: createDetailedPlanetTexture(key),
          roughness: 0.65,
        });
      }

      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 40), mat);
      mesh.position.set(cursorX, 0, 0);
      mesh.rotation.x = THREE.MathUtils.degToRad(p.tiltDeg);
      mesh.userData.bodyId = key;
      this.comparisonGroup.add(mesh);

      if (p.hasRings) {
        const innerR = r * 1.32;
        const outerR = r * 2.35;
        const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const dist = Math.hypot(pos.getX(i), pos.getY(i));
          uv.setXY(i, (dist - innerR) / (outerR - innerR), 0.5);
        }
        ringGeo.rotateX(Math.PI / 2);
        mesh.add(
          new THREE.Mesh(
            ringGeo,
            new THREE.MeshStandardMaterial({
              map: createSaturnRingTexture(),
              side: THREE.DoubleSide,
              transparent: true,
              depthWrite: false,
            })
          )
        );
      }

      this.createLabel(
        `cmp-${key}`,
        `${p.name} (${p.realScaleText.split(' ')[0]})`,
        mesh,
        r + 0.65,
        p.color,
        ['comparison']
      );

      cursorX += r + (key === 'saturn' ? 2.8 : 0.6);
    });
  }

  private loadSatelliteTextures(): void {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      TEXTURE_URLS.earthDay,
      (dayTex) => {
        dayTex.colorSpace = THREE.SRGBColorSpace;
        dayTex.anisotropy = 8;
        this.earthShaderMat.uniforms.uDayMap.value = dayTex;
        if (this.comparisonEarthMat) {
          this.comparisonEarthMat.map = dayTex;
          this.comparisonEarthMat.needsUpdate = true;
        }
        store.set({ textureQuality: 'nasa-2k' });
      },
      undefined,
      () => store.set({ textureQuality: 'procedural' })
    );

    loader.load(TEXTURE_URLS.earthSpecular, (specTex) => {
      this.earthShaderMat.uniforms.uSpecMap.value = specTex;
      this.earthShaderMat.uniforms.uUseSpecMap.value = 1.0;
    });

    loader.load(TEXTURE_URLS.earthClouds, (cloudTex) => {
      cloudTex.colorSpace = THREE.SRGBColorSpace;
      const mat = this.earthCloudsMesh.material as THREE.MeshLambertMaterial;
      mat.map = cloudTex;
      mat.opacity = 0.78;
      mat.needsUpdate = true;
      this.earthCloudsMesh.visible = store.get().showClouds;
    });

    loader.load(TEXTURE_URLS.moon, (moonTex) => {
      moonTex.colorSpace = THREE.SRGBColorSpace;
      moonTex.anisotropy = 4;
      this.moonMaterial.map = moonTex;
      this.moonMaterial.bumpMap = moonTex;
      this.moonMaterial.bumpScale = 0.025;
      this.moonMaterial.needsUpdate = true;
    });
  }

  private createLabel(
    id: string,
    text: string,
    target: THREE.Object3D,
    yOffset: number,
    dotColor: string,
    visibleIn: SimMode[]
  ): void {
    const div = document.createElement('div');
    div.className =
      'planet-label px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-100 shadow-lg whitespace-nowrap flex items-center gap-1.5';
    div.innerHTML = `<span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${dotColor}"></span><span>${text}</span>`;
    div.onclick = (e) => {
      e.stopPropagation();
      const bodyId = id.replace('cmp-', '') as BodyId;
      const mode = store.get().mode;
      if (mode === 'solar') {
        const preset: CameraPreset =
          bodyId === 'sun' ? 'sun' : bodyId === 'earth' ? 'earth' : 'body';
        store.set({ selectedBody: bodyId, cameraPreset: preset });
        this.focusCamera(preset, bodyId);
      } else {
        store.set({ selectedBody: bodyId });
      }
    };
    this.labelsContainer.appendChild(div);
    this.labels.set(id, { element: div, target, yOffset, visibleIn });
  }

  private onStateChange(state: AppState, changed: Set<keyof AppState>): void {
    if (changed.has('mode')) {
      this.applyMode(state.mode, false);
    }
    if (changed.has('planetScale')) {
      this.earthMesh.scale.setScalar(state.planetScale);
      this.earthCloudsMesh.scale.setScalar(state.planetScale);
      this.earthAtmoMesh.scale.setScalar(state.planetScale);
      this.tropicsGroup.scale.setScalar(state.planetScale);
      this.moonMesh.scale.setScalar(state.planetScale);
      this.planetRigs.forEach((rig) => rig.mesh.scale.setScalar(state.planetScale));
    }
    if (changed.has('showLightBeam')) {
      this.tellurion.lightBeamCone.visible = state.showLightBeam && state.mode === 'tellurion';
    }
    if (changed.has('showClouds')) {
      const mat = this.earthCloudsMesh.material as THREE.MeshLambertMaterial;
      this.earthCloudsMesh.visible = state.showClouds && Boolean(mat.map);
      this.earthAtmoMesh.visible = state.showClouds;
    }
    if (changed.has('showTropics')) {
      this.tropicsGroup.visible = state.showTropics;
    }
    if (changed.has('selectedCityId') || changed.has('customPin')) {
      this.updateCityPinPosition(state.selectedCityId);
    }
    if (changed.has('selectedBody')) {
      this.labels.forEach((entry, id) => {
        const cleanId = id.replace('cmp-', '');
        entry.element.classList.toggle('is-selected', cleanId === state.selectedBody);
      });
    }
    if (changed.has('cameraPreset')) {
      this.focusCamera(state.cameraPreset, state.selectedBody);
    }
    if (changed.has('useSound')) {
      this.audio.setEnabled(state.useSound);
    }
    if (changed.has('jd') && !state.isPlaying) {
      this.updatePositions(state);
    }
  }

  private applyMode(mode: SimMode, instant: boolean): void {
    const isComparison = mode === 'comparison';
    const isSolar = mode === 'solar';
    const isTellurion = mode === 'tellurion';

    this.comparisonGroup.visible = isComparison;
    this.sunMesh.visible = !isComparison;
    this.sunCoronaSprite.visible = !isComparison;
    this.mainArmGroup.visible = !isComparison;
    this.earthOrbitLine.visible = !isComparison;
    this.solarSystemGroup.visible = isSolar;

    this.tellurion.lightBeamCone.visible = isTellurion && store.get().showLightBeam;
    this.tellurion.moonOrbitRingGroup.visible = !isComparison;

    if (instant) {
      this.tellurionDropProgress = isTellurion ? 0 : 1;
      this.syncTellurionDrop();
    }

    if (isComparison) {
      this.desiredTarget.set(14, 0, 0);
      this.desiredCamPos = new THREE.Vector3(14, 5.5, 36);
    } else if (isSolar) {
      this.desiredTarget.set(0, 1.2, 0);
      this.desiredCamPos = new THREE.Vector3(0, 42, 68);
    } else {
      this.desiredTarget.set(4.5, 0.2, 0);
      this.desiredCamPos = new THREE.Vector3(19, 13, 19);
    }
  }

  private syncTellurionDrop(): void {
    const t = this.tellurionDropProgress;
    const visible = t < 0.98 && store.get().mode !== 'comparison';
    this.tellurion.baseGroup.visible = visible;
    this.tellurion.armHardwareGroup.visible = visible;
    this.tellurion.baseGroup.position.y = -t * 14;
    this.tellurion.armHardwareGroup.position.y = -t * 14;
  }

  private getBodyWorldPosition(bodyId: BodyId, out: THREE.Vector3): boolean {
    if (bodyId === 'sun') {
      this.sunMesh.getWorldPosition(out);
      return true;
    }
    if (bodyId === 'earth') {
      this.earthTiltGroup.getWorldPosition(out);
      return true;
    }
    if (bodyId === 'moon') {
      this.moonMesh.getWorldPosition(out);
      return true;
    }
    const rig = this.planetRigs.get(bodyId);
    if (rig) {
      rig.rootGroup.getWorldPosition(out);
      return true;
    }
    return false;
  }

  private computeLitCameraOffset(bodyId: BodyId, bodyPos: THREE.Vector3): THREE.Vector3 {
    const scale = store.get().planetScale;
    const baseR = PLANET_DATA[bodyId].modelRadius * scale;
    const ringBoost = PLANET_DATA[bodyId].hasRings ? 1.55 : 1.0;
    const dist = Math.max(3.6, baseR * 4.4 * ringBoost);

    const sunPos = new THREE.Vector3(0, 1.2, 0);
    const toSun = sunPos.sub(bodyPos);
    if (toSun.lengthSq() < 0.01) {
      return new THREE.Vector3(dist * 0.7, dist * 0.4, dist * 0.7);
    }
    toSun.normalize();
    const side = new THREE.Vector3(-toSun.z, 0, toSun.x).normalize();

    // Illuminated 3/4 view angle: shows sunlit hemisphere + crisp terminator without looking into the Sun
    return new THREE.Vector3()
      .addScaledVector(side, dist * 0.74)
      .addScaledVector(toSun, dist * 0.52)
      .add(new THREE.Vector3(0, dist * 0.34, 0));
  }

  public focusCamera(preset: CameraPreset, bodyId: BodyId = store.get().selectedBody): void {
    const state = store.get();
    if (state.mode === 'comparison') {
      this.desiredTarget.set(14, 0, 0);
      this.desiredCamPos = new THREE.Vector3(14, 5.5, 36);
      return;
    }

    if (preset === 'sun') {
      this.desiredTarget.set(0, 1.2, 0);
      this.desiredCamPos = state.mode === 'solar'
        ? new THREE.Vector3(0, 32, 54)
        : new THREE.Vector3(16, 11, 18);
    } else if (preset === 'earth') {
      const earthPos = new THREE.Vector3();
      this.earthTiltGroup.getWorldPosition(earthPos);
      this.desiredTarget.copy(earthPos);
      this.desiredCamPos = earthPos.clone().add(this.computeLitCameraOffset('earth', earthPos));
    } else if (preset === 'surface') {
      // "Yüzeyden Bakış": Close orbital vantage right above the selected City Pin looking toward the Sun
      const pinWorld = new THREE.Vector3();
      const earthPos = new THREE.Vector3();
      this.cityPinGroup.getWorldPosition(pinWorld);
      this.earthTiltGroup.getWorldPosition(earthPos);
      const upNormal = pinWorld.clone().sub(earthPos).normalize();
      this.desiredCamPos = pinWorld.clone().addScaledVector(upNormal, 1.35);
      this.desiredTarget.copy(earthPos).lerp(new THREE.Vector3(0, 1.2, 0), 0.25);
    } else if (preset === 'top') {
      this.desiredTarget.set(0, 1.2, 0);
      this.desiredCamPos = state.mode === 'solar'
        ? new THREE.Vector3(0, 92, 6)
        : new THREE.Vector3(0, 36, 4);
    } else if (preset === 'body') {
      const pos = new THREE.Vector3();
      if (this.getBodyWorldPosition(bodyId, pos)) {
        this.desiredTarget.copy(pos);
        this.desiredCamPos = pos.clone().add(this.computeLitCameraOffset(bodyId, pos));
      }
    } else {
      this.desiredTarget.set(4.5, 0.2, 0);
      this.desiredCamPos = new THREE.Vector3(19, 13, 19);
    }
  }

  private updatePositions(state: AppState): void {
    const jd = state.jd;
    const eqDay = getEquinoxDayOfYear(jd);
    const earthPos = computePlanetPosition('earth', jd, 1.0);
    const orbitAngle = earthPos.orbitAngleRad;

    // Tellurion mode keeps Earth at clean reference radius; Solar System mode uses true Kepler elliptical radius.
    this.mainArmGroup.rotation.y = orbitAngle;
    const earthRadius =
      state.mode === 'tellurion' ? PLANET_DATA.earth.modelDistance : earthPos.modelRadius;
    this.earthSystemGroup.position.set(earthRadius, 0, 0);
    this.earthSystemGroup.rotation.y = -orbitAngle;

    // Earth spin
    const spinDay = jd - 2451545.0;
    this.earthMesh.rotation.y = state.useRealSpin ? spinDay * Math.PI * 2 : spinDay * 0.85;
    this.earthCloudsMesh.rotation.y = this.earthMesh.rotation.y * 1.12;

    // Moon Kepler/Synodic + 5.145° orbital inclination (glides smoothly on visible tilted ring)
    const lunar = computeLunarState(jd);
    const lunarSynodicAngle = lunar.synodicAge * Math.PI * 2;
    const moonLongitude = orbitAngle + Math.PI + lunarSynodicAngle;
    this.moonOrbitGroup.rotation.y = moonLongitude;

    // Orient the visible 5.145° tilted lunar orbit ring along the line of nodes
    this.tellurion.moonOrbitRingGroup.rotation.y = moonLongitude - lunar.draconicAngleRad;

    const moonYOffset =
      Math.sin(lunar.draconicAngleRad) * 3.6 * Math.sin(THREE.MathUtils.degToRad(MOON_INCLINATION_DEG));
    this.moonMesh.position.y = moonYOffset;

    // Update Earth GLSL shader with Moon world position for real-time Solar Eclipse shadow
    this.moonMesh.getWorldPosition(this.tempMoonWorld);
    this.earthShaderMat.uniforms.uMoonPosition.value.copy(this.tempMoonWorld);
    this.earthShaderMat.uniforms.uMoonRadius.value = PLANET_DATA.moon.modelRadius * state.planetScale;

    // Blood Moon tint during Lunar Eclipse!
    if (lunar.eclipseType === 'lunar') {
      const intensity = Math.min(1, lunar.eclipseIntensity * 1.4);
      this.moonMaterial.color.setRGB(1.0, 1.0 - 0.62 * intensity, 1.0 - 0.72 * intensity);
      this.moonMaterial.emissive.setRGB(0.28 * intensity, 0.04 * intensity, 0.01 * intensity);
    } else {
      this.moonMaterial.color.setRGB(1, 1, 1);
      this.moonMaterial.emissive.setRGB(0, 0, 0);
    }

    // Other solar system planets (true Kepler elliptical 3D positions + fixed inertial axial tilt)
    this.planetRigs.forEach((rig, key) => {
      const pos = computePlanetPosition(key, jd, 1.0);
      rig.rootGroup.position.set(pos.x, pos.y + 1.2, pos.z);
      rig.mesh.rotation.y = spinDay * 0.1 * PLANET_DATA[key].rotSpeed;
    });

    // Subtle mechanical escapement tick in Tellurion mode
    if (state.mode === 'tellurion' && Math.abs(eqDay - this.lastTickDay) >= 2.0) {
      this.lastTickDay = eqDay;
      this.audio.playMechanicalTick();
    }
  }

  private updateLabels(): void {
    const state = store.get();
    const wHalf = window.innerWidth / 2;
    const hHalf = window.innerHeight / 2;

    this.labels.forEach((entry) => {
      if (!state.showLabels || !entry.visibleIn.includes(state.mode)) {
        entry.element.style.display = 'none';
        return;
      }

      entry.target.getWorldPosition(this.tempVec);
      this.tempVec.y += entry.yOffset * (state.mode === 'comparison' ? 1 : state.planetScale);
      this.tempVec.project(this.camera);

      if (this.tempVec.z > 1) {
        entry.element.style.display = 'none';
      } else {
        entry.element.style.display = 'flex';
        entry.element.style.left = `${this.tempVec.x * wHalf + wHalf}px`;
        entry.element.style.top = `${-this.tempVec.y * hHalf + hHalf}px`;
      }
    });
  }

  private setupEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist >= 6) return;

      const rect = dom.getBoundingClientRect();
      this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);

      const mode = store.get().mode;
      const candidates =
        mode === 'solar'
          ? this.clickableMeshes
          : this.clickableMeshes.filter((m) => !SOLAR_PLANET_KEYS.includes(m.userData.bodyId));

      const hits = this.raycaster.intersectObjects(candidates, false);
      if (hits.length > 0 && hits[0].object.userData.bodyId) {
        const bodyId = hits[0].object.userData.bodyId as BodyId;
        if (bodyId === 'earth' && store.get().selectedBody === 'earth') {
          // Clicking directly on Earth drops a custom latitude/longitude pin!
          const localPt = this.earthMesh.worldToLocal(hits[0].point.clone()).normalize();
          const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(localPt.y, -1, 1)));
          const lon = THREE.MathUtils.radToDeg(Math.atan2(-localPt.z, localPt.x));
          const latDir = lat >= 0 ? 'K' : 'G';
          const lonDir = lon >= 0 ? 'D' : 'B';
          store.set({
            customPin: {
              lat,
              lon,
              label: `Özel Pin (${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir})`,
            },
          });
        } else {
          store.set({ selectedBody: bodyId });
        }
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('visibilitychange', () => {
      this.isHidden = document.visibilityState === 'hidden';
      if (!this.isHidden) this.clock.getDelta();
    });
  }

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    if (this.isHidden) return;

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;
    const state = store.get();

    // Advance simulation clock
    if (state.isPlaying && state.mode !== 'comparison') {
      const nextJD = state.jd + delta * 10.8 * state.simSpeed;
      store.set({ jd: nextJD });
      this.updatePositions(store.get());
    }

    // Animated solar plasma & corona pulse
    this.sunPlasmaMat.uniforms.uTime.value = elapsed;
    const pulse = 13.6 + Math.sin(elapsed * 1.5) * 0.35;
    this.sunCoronaSprite.scale.set(pulse, pulse, 1);

    // Smooth Tellurion hardware drop transition when switching to Solar System
    const targetDrop = state.mode === 'tellurion' ? 0 : 1;
    if (Math.abs(this.tellurionDropProgress - targetDrop) > 0.005) {
      this.tellurionDropProgress += (targetDrop - this.tellurionDropProgress) * Math.min(1, delta * 5.5);
      this.syncTellurionDrop();
    }

    // Slowly rotate asteroid belt
    if (this.asteroidBelt && this.solarSystemGroup.visible) {
      this.asteroidBelt.rotation.y = elapsed * 0.012;
    }

    // Orbit-lock tracking for Earth, Surface view, or any focused Solar System planet
    if (
      state.mode !== 'comparison' &&
      (state.cameraPreset === 'earth' ||
        state.cameraPreset === 'surface' ||
        state.cameraPreset === 'body')
    ) {
      if (state.cameraPreset === 'surface') {
        const earthPos = new THREE.Vector3();
        const pinWorld = new THREE.Vector3();
        this.earthTiltGroup.getWorldPosition(earthPos);
        this.cityPinGroup.getWorldPosition(pinWorld);
        const upNormal = pinWorld.clone().sub(earthPos).normalize();
        this.desiredCamPos = pinWorld.clone().addScaledVector(upNormal, 1.35);
        this.desiredTarget.copy(earthPos).lerp(new THREE.Vector3(0, 1.2, 0), 0.22);
      } else {
        const trackId: BodyId = state.cameraPreset === 'earth' ? 'earth' : state.selectedBody;
        const bodyPos = new THREE.Vector3();
        if (this.getBodyWorldPosition(trackId, bodyPos)) {
          if (!this.desiredCamPos) {
            const deltaMove = bodyPos.clone().sub(this.controls.target);
            this.camera.position.add(deltaMove);
            this.controls.target.copy(bodyPos);
          } else {
            // Keep desired camera position moving in lockstep with the orbiting planet during fly-in
            const deltaTarget = bodyPos.clone().sub(this.desiredTarget);
            this.desiredTarget.copy(bodyPos);
            this.desiredCamPos.add(deltaTarget);
          }
        }
      }
    }

    // Smooth camera lerp
    if (this.desiredCamPos) {
      this.camera.position.lerp(this.desiredCamPos, this.camLerpAlpha);
      this.controls.target.lerp(this.desiredTarget, this.camLerpAlpha);
      if (
        this.camera.position.distanceTo(this.desiredCamPos) < 0.06 &&
        state.cameraPreset !== 'surface'
      ) {
        this.desiredCamPos = null;
      }
    }

    this.controls.update();
    this.updateLabels();
    this.composer.render();
  };

  public dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
  }
}
