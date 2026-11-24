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
  formatTurkishDate,
  getEquinoxDayOfYear,
  julianDateToDate,
} from '../astronomy/ephemeris';
import { CONSTELLATIONS, raDecToEclipticVec3 } from '../astronomy/constellations';
import { AppState, store } from '../state/store';
import {
  createAuroraMaterial,
  createEarthAtmosphereMaterial,
  createEarthDayNightMaterial,
  createPlanetAtmosphereMaterial,
  createSaturnRingShadowMaterial,
  createSunPlasmaMaterial,
  createTwinklingStarsMaterial,
} from './shaders';
import {
  createCoronaGlowTexture,
  createDetailedPlanetTexture,
  createEarthFallbackTexture,
  createEarthNightLightsTexture,
  createLensFlareTexture,
  createMilkyWaySkyboxTexture,
  createPlanetBumpTexture,
  createSaturnRingTexture,
  createUranusRingTexture,
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
  trailLine: THREE.Line;
}

interface GalileanMoon {
  pivot: THREE.Group;
  speed: number;
  phase: number;
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
  private sunLensFlareSprite!: THREE.Sprite;
  private sunProminencesGroup!: THREE.Group;
  private starsMat!: THREE.ShaderMaterial;
  private constellationsGroup!: THREE.Group;
  private tellurion!: TellurionParts;

  private mainArmGroup!: THREE.Group;
  private earthSystemGroup!: THREE.Group;
  private earthTiltGroup!: THREE.Group;
  private earthMesh!: THREE.Mesh;
  private earthShaderMat!: THREE.ShaderMaterial;
  private earthCloudsMesh!: THREE.Mesh;
  private earthAtmoMesh!: THREE.Mesh;
  private auroraGroup!: THREE.Group;
  private auroraMat!: THREE.ShaderMaterial;
  private tropicsGroup!: THREE.Group;
  private subsolarMarker!: THREE.Mesh;
  private solarRaysGroup!: THREE.Group;
  private eclipseConeGroup!: THREE.Group;
  private eclipseUmbraMat!: THREE.MeshBasicMaterial;
  private eclipsePenumbraMat!: THREE.MeshBasicMaterial;
  private cityPinGroup!: THREE.Group;

  private moonOrbitGroup!: THREE.Group;
  private moonMesh!: THREE.Mesh;
  private moonMaterial!: THREE.MeshStandardMaterial;

  private issOrbitGroup!: THREE.Group;
  private issCraftGroup!: THREE.Group;
  private halleyGroup!: THREE.Group;
  private halleyIonTail!: THREE.Mesh;
  private halleyDustTail!: THREE.Mesh;

  private solarSystemGroup!: THREE.Group;
  private earthOrbitLine!: THREE.LineLoop;
  private earthTrailLine!: THREE.Line;
  private saturnRingMat: THREE.ShaderMaterial | null = null;
  private galileanMoons: GalileanMoon[] = [];
  private asteroidBelt!: THREE.InstancedMesh;
  private comparisonGroup!: THREE.Group;
  private comparisonEarthMat: THREE.MeshStandardMaterial | null = null;
  private comparisonMats = new Map<BodyId, THREE.MeshStandardMaterial>();
  private comparisonClickables: THREE.Mesh[] = [];

  private planetRigs = new Map<BodyId, PlanetRig>();
  private labels = new Map<string, LabelEntry>();
  private clickableMeshes: THREE.Mesh[] = [];

  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };
  private tempVec = new THREE.Vector3();
  private tempMoonWorld = new THREE.Vector3();

  // Smooth cubic ease-in-out camera flight state
  private desiredTarget = new THREE.Vector3(4.5, 0.2, 0);
  private desiredCamPos: THREE.Vector3 | null = null;
  private flyStartPos = new THREE.Vector3();
  private flyStartTarget = new THREE.Vector3();
  private flyProgress = 1;
  private flyDuration = 1.05;
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
    this.buildConstellations();
    this.buildSun();
    this.buildTellurionAndEarth();
    this.buildSolarSystemAndAsteroids();
    this.buildComparisonLineup();
    this.loadSatelliteTextures();
    this.setupEvents();

    // Sync initial selected reticle label
    const initSelected = store.get().selectedBody;
    this.labels.forEach((entry, id) => {
      entry.element.classList.toggle('is-selected', id.replace('cmp-', '') === initSelected);
    });

    // Subscribe to state changes
    store.subscribe((state, changed) => this.onStateChange(state, changed));
    this.applyMode(store.get().mode, true);
    this.updatePositions(store.get());
    this.animate();
  }

  private initRendererAndScene(): void {
    this.scene = new THREE.Scene();

    const aspect = window.innerWidth / window.innerHeight;
    const isPortrait = aspect < 0.85;
    this.camera = new THREE.PerspectiveCamera(
      isPortrait ? 54 : 44,
      aspect,
      0.08,
      1800
    );
    if (isPortrait) {
      this.camera.position.set(30, 24, 36);
    } else {
      this.camera.position.set(19, 13, 19);
    }

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
      if (store.get().cameraPreset === 'surface') {
        store.set({ cameraPreset: 'earth' });
      }
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
    // 1. Subtle Deep-Space Milky Way Nebula Skybox Sphere
    const skySphere = new THREE.Mesh(
      new THREE.SphereGeometry(950, 48, 32),
      new THREE.MeshBasicMaterial({
        map: createMilkyWaySkyboxTexture(),
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    this.scene.add(skySphere);

    // 2. Twinkling Spectral Starfield
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const palette = [
      new THREE.Color('#bfdbfe'),
      new THREE.Color('#f8fafc'),
      new THREE.Color('#fef3c7'),
      new THREE.Color('#fed7aa'),
    ];

    for (let i = 0; i < count; i++) {
      const inBand = i < count * 0.35;
      const r = 160 + Math.random() * 440;
      const theta = Math.random() * Math.PI * 2;
      const phi = inBand
        ? Math.PI / 2 + (Math.random() - 0.5) * 0.28
        : Math.acos(2 * Math.random() - 1);

      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.cos(phi);
      let z = r * Math.sin(phi) * Math.sin(theta);

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
      const b = inBand ? 0.38 + Math.random() * 0.45 : 0.55 + Math.random() * 0.45;
      colors[i * 3] = c.r * b;
      colors[i * 3 + 1] = c.g * b;
      colors[i * 3 + 2] = c.b * b;
      sizes[i] = inBand ? 1.1 + Math.random() * 1.4 : 1.4 + Math.random() * 2.2;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.starsMat = createTwinklingStarsMaterial();
    this.scene.add(new THREE.Points(geo, this.starsMat));
  }

  private buildConstellations(): void {
    this.constellationsGroup = new THREE.Group();
    const skyR = 760;
    const linePts: THREE.Vector3[] = [];
    const starPts: THREE.Vector3[] = [];

    const makeConstellationLabel = (text: string, pos: THREE.Vector3): THREE.Sprite => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 48;
      const ctx = c.getContext('2d')!;
      ctx.font = '600 18px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(186, 214, 255, 0.42)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 24);
      const tex = new THREE.CanvasTexture(c);
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      sp.position.copy(pos);
      sp.scale.set(95, 18, 1);
      return sp;
    };

    CONSTELLATIONS.forEach((con) => {
      con.segments.forEach(([a, b]) => {
        const va = raDecToEclipticVec3(a[0], a[1], skyR);
        const vb = raDecToEclipticVec3(b[0], b[1], skyR);
        linePts.push(va, vb);
        starPts.push(va, vb);
      });
      const centerPos = raDecToEclipticVec3(con.center[0], con.center[1], skyR * 0.98);
      this.constellationsGroup.add(makeConstellationLabel(`${con.name.toUpperCase()} · ${con.latin}`, centerPos));
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.19,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.constellationsGroup.add(new THREE.LineSegments(lineGeo, lineMat));

    const starGeo = new THREE.BufferGeometry().setFromPoints(starPts);
    const starMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 4.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.constellationsGroup.add(new THREE.Points(starGeo, starMat));
    this.constellationsGroup.visible = store.get().showConstellations;
    this.scene.add(this.constellationsGroup);
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

    // Solar Prominences (delicate glowing plasma arches along the Sun's limb)
    this.sunProminencesGroup = new THREE.Group();
    this.sunProminencesGroup.position.y = 1.2;
    const promMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sunR = PLANET_DATA.sun.modelRadius;
    const promConfigs = [
      { lon: 0.3, lat: 0.25, arch: 0.55, span: 0.26 },
      { lon: 1.8, lat: -0.32, arch: 0.65, span: 0.3 },
      { lon: 3.1, lat: 0.45, arch: 0.48, span: 0.22 },
      { lon: 4.5, lat: -0.18, arch: 0.6, span: 0.28 },
      { lon: 5.4, lat: 0.12, arch: 0.52, span: 0.24 },
    ];
    promConfigs.forEach(({ lon, lat, arch, span }) => {
      const p0 = new THREE.Vector3().setFromSphericalCoords(sunR * 0.98, Math.PI / 2 - lat, lon - span / 2);
      const p2 = new THREE.Vector3().setFromSphericalCoords(sunR * 0.98, Math.PI / 2 - lat - 0.08, lon + span / 2);
      const p1 = new THREE.Vector3().setFromSphericalCoords(sunR + arch, Math.PI / 2 - lat - 0.04, lon);
      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.055, 8, false), promMat);
      this.sunProminencesGroup.add(tube);
    });
    this.scene.add(this.sunProminencesGroup);

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

    // Subtle Anamorphic Starburst Lens Flare
    this.sunLensFlareSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createLensFlareTexture(),
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sunLensFlareSprite.scale.set(17.5, 17.5, 1);
    this.sunLensFlareSprite.position.set(0, 1.2, 0);
    this.scene.add(this.sunLensFlareSprite);

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

    // Earth with custom Day/Night + Normal Relief + Cloud Shadows + Black Marble + Eclipse Shadow GLSL shader
    const fallbackDay = createEarthFallbackTexture();
    const nightTex = createEarthNightLightsTexture();
    this.earthShaderMat = createEarthDayNightMaterial(
      fallbackDay,
      nightTex,
      fallbackDay,
      fallbackDay,
      fallbackDay
    );

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

    // Aurora Borealis & Australis (Glowing green-violet geomagnetic curtains near poles)
    this.auroraMat = createAuroraMaterial();
    this.auroraGroup = new THREE.Group();
    const er = PLANET_DATA.earth.modelRadius;
    const northAurora = new THREE.Mesh(
      new THREE.CylinderGeometry(er * 0.34, er * 0.44, er * 0.16, 48, 1, true),
      this.auroraMat
    );
    northAurora.position.y = er * 0.94;
    const southAurora = new THREE.Mesh(
      new THREE.CylinderGeometry(er * 0.44, er * 0.34, er * 0.16, 48, 1, true),
      this.auroraMat
    );
    southAurora.position.y = -er * 0.94;
    this.auroraGroup.add(northAurora, southAurora);
    this.auroraGroup.visible = store.get().showClouds;
    this.earthTiltGroup.add(this.auroraGroup);

    // Equator, Tropics, Polar Circles, K/G Pole Badges & 90° Subsolar Point Marker
    this.tropicsGroup = this.buildTropicsOverlay(PLANET_DATA.earth.modelRadius * 1.025);
    this.tropicsGroup.visible = store.get().showTropics;
    this.earthTiltGroup.add(this.tropicsGroup);

    this.subsolarMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.095, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      })
    );
    this.subsolarMarker.visible = store.get().showTropics;
    this.scene.add(this.subsolarMarker);

    // Educational Parallel Solar Ray Arrows (visibly proves oblique vs 90° incidence on tilted Earth)
    this.solarRaysGroup = new THREE.Group();
    this.solarRaysGroup.position.set(PLANET_DATA.earth.modelDistance, 1.2, 0);
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.85 });
    const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.45, 8);
    shaftGeo.rotateZ(Math.PI / 2);
    const headGeo = new THREE.ConeGeometry(0.055, 0.18, 12);
    headGeo.rotateZ(-Math.PI / 2);
    [-0.78, -0.39, 0, 0.39, 0.78].forEach((yOff) => {
      const arrow = new THREE.Group();
      const shaft = new THREE.Mesh(shaftGeo, rayMat);
      shaft.position.set(-2.05, yOff, 0);
      const head = new THREE.Mesh(headGeo, rayMat);
      head.position.set(-1.26, yOff, 0);
      arrow.add(shaft, head);
      this.solarRaysGroup.add(arrow);
    });
    this.solarRaysGroup.visible = store.get().showTropics;
    this.mainArmGroup.add(this.solarRaysGroup);

    // 3D Eclipse Umbra & Penumbra Shadow Cones (appears automatically during Solar/Lunar Eclipses)
    this.eclipseConeGroup = new THREE.Group();
    this.eclipseUmbraMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.eclipsePenumbraMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const umbraGeo = new THREE.ConeGeometry(0.32, 1.0, 28, 1, true);
    umbraGeo.translate(0, -0.5, 0);
    umbraGeo.rotateX(-Math.PI / 2); // Base at z=0, tip extends toward +Z
    const penumbraGeo = new THREE.ConeGeometry(0.68, 1.0, 28, 1, true);
    penumbraGeo.translate(0, -0.5, 0);
    penumbraGeo.rotateX(Math.PI / 2); // Widens outward toward +Z
    this.eclipseConeGroup.add(
      new THREE.Mesh(umbraGeo, this.eclipseUmbraMat),
      new THREE.Mesh(penumbraGeo, this.eclipsePenumbraMat)
    );
    this.eclipseConeGroup.visible = false;
    this.scene.add(this.eclipseConeGroup);

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

    // International Space Station (ISS) in 51.6° inclined Low Earth Orbit
    const issInclinedPivot = new THREE.Group();
    issInclinedPivot.position.y = 1.2;
    issInclinedPivot.rotation.z = THREE.MathUtils.degToRad(51.64);
    this.earthSystemGroup.add(issInclinedPivot);

    const issOrbitR = PLANET_DATA.iss.modelDistance;
    const issRingPts: THREE.Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      issRingPts.push(new THREE.Vector3(Math.cos(a) * issOrbitR, 0, Math.sin(a) * issOrbitR));
    }
    issInclinedPivot.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(issRingPts),
        new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.2 })
      )
    );

    this.issOrbitGroup = new THREE.Group();
    issInclinedPivot.add(this.issOrbitGroup);

    this.issCraftGroup = new THREE.Group();
    this.issCraftGroup.position.set(issOrbitR, 0, 0);
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.25,
    });
    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
      metalness: 0.75,
      roughness: 0.22,
    });
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.018), trussMat);
    const coreMod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 10), trussMat);
    coreMod.rotation.x = Math.PI / 2;
    this.issCraftGroup.add(truss, coreMod);

    [-0.068, -0.044, 0.044, 0.068].forEach((xOff) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, 0.11), solarPanelMat);
      wing.position.set(xOff, 0, 0);
      this.issCraftGroup.add(wing);
    });

    // Invisible click hitbox so ISS is easy to click
    const issHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    issHit.userData.bodyId = 'iss';
    this.issCraftGroup.add(issHit);
    this.clickableMeshes.push(issHit);
    this.issOrbitGroup.add(this.issCraftGroup);

    this.createLabel('iss', 'ISS · 408 km', this.issCraftGroup, 0.26, '#e2e8f0', ['tellurion']);
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

    // North (K) & South (G) Pole educational markers on the axis tips
    const makePoleSprite = (text: string, color: string, yPos: number): THREE.Sprite => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = 'rgba(7, 11, 22, 0.85)';
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 28px Space Grotesk, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 33);
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })
      );
      sp.position.set(0, yPos, 0);
      sp.scale.set(0.32, 0.32, 1);
      return sp;
    };
    group.add(makePoleSprite('K', '#38bdf8', radius * 1.52));
    group.add(makePoleSprite('G', '#f59e0b', -radius * 1.52));

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

  private buildFadingTrailLine(colorHex: string): THREE.Line {
    const segments = 48;
    const positions = new Float32Array(segments * 3);
    const colors = new Float32Array(segments * 3);
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < segments; i++) {
      const fade = Math.pow(i / (segments - 1), 1.8);
      colors[i * 3] = c.r * fade;
      colors[i * 3 + 1] = c.g * fade;
      colors[i * 3 + 2] = c.b * fade;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }

  private updateTrailGeometry(line: THREE.Line, bodyId: BodyId, jd: number): void {
    const p = PLANET_DATA[bodyId];
    const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
    const segments = posAttr.count;
    const trailSpanDays = p.orbitalPeriodDays * 0.14; // Last ~50° of orbit
    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1);
      const sampleJD = jd - (1 - t) * trailSpanDays;
      const pos = computePlanetPosition(bodyId, sampleJD, 1.0);
      posAttr.setXYZ(i, pos.x, pos.y + 1.2, pos.z);
    }
    posAttr.needsUpdate = true;
  }

  private buildSolarSystemAndAsteroids(): void {
    this.solarSystemGroup = new THREE.Group();
    this.solarSystemGroup.visible = false;
    this.scene.add(this.solarSystemGroup);

    this.earthOrbitLine = this.buildKeplerOrbitLine('earth', '#38bdf8', 0.25);
    this.scene.add(this.earthOrbitLine);

    this.earthTrailLine = this.buildFadingTrailLine('#38bdf8');
    this.solarSystemGroup.add(this.earthTrailLine);

    const atmoColors: Partial<Record<BodyId, [string, number]>> = {
      venus: ['#fbbf24', 0.58],
      mars: ['#f97316', 0.42],
      jupiter: ['#fde68a', 0.3],
      uranus: ['#22d3ee', 0.5],
      neptune: ['#3b82f6', 0.62],
    };

    SOLAR_PLANET_KEYS.forEach((key) => {
      const p = PLANET_DATA[key];
      const orbitLine = this.buildKeplerOrbitLine(key, p.color, 0.2);
      this.solarSystemGroup.add(orbitLine);

      const trailLine = this.buildFadingTrailLine(p.color);
      this.solarSystemGroup.add(trailLine);

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

      const hasBump = key === 'mercury' || key === 'mars';
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.modelRadius, 48, 48),
        new THREE.MeshStandardMaterial({
          map: createDetailedPlanetTexture(key),
          bumpMap: hasBump ? createPlanetBumpTexture(key) : undefined,
          bumpScale: hasBump ? 0.035 : 0,
          roughness: hasBump ? 0.82 : 0.62,
          metalness: 0.04,
        })
      );
      mesh.userData.bodyId = key;
      tiltGroup.add(mesh);
      this.clickableMeshes.push(mesh);

      // Subtle Fresnel atmospheric rim halos
      const atmoSpec = atmoColors[key];
      if (atmoSpec) {
        const atmoMesh = new THREE.Mesh(
          new THREE.SphereGeometry(p.modelRadius * 1.06, 36, 36),
          createPlanetAtmosphereMaterial(atmoSpec[0], atmoSpec[1])
        );
        tiltGroup.add(atmoMesh);
      }

      // Saturn rings with custom GLSL planetary shadow shader!
      if (key === 'saturn') {
        const innerR = p.modelRadius * 1.32;
        const outerR = p.modelRadius * 2.42;
        const ringGeo = new THREE.RingGeometry(innerR, outerR, 84);
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getY(i));
          uv.setXY(i, (r - innerR) / (outerR - innerR), 0.5);
        }
        ringGeo.rotateX(Math.PI / 2);
        this.saturnRingMat = createSaturnRingShadowMaterial(createSaturnRingTexture());
        mesh.add(new THREE.Mesh(ringGeo, this.saturnRingMat));
      }

      // Uranus delicate vertical icy rings (tilted 97.8° with Uranus!)
      if (key === 'uranus') {
        const innerR = p.modelRadius * 1.42;
        const outerR = p.modelRadius * 1.92;
        const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getY(i));
          uv.setXY(i, (r - innerR) / (outerR - innerR), 0.5);
        }
        ringGeo.rotateX(Math.PI / 2);
        mesh.add(
          new THREE.Mesh(
            ringGeo,
            new THREE.MeshBasicMaterial({
              map: createUranusRingTexture(),
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.72,
              depthWrite: false,
            })
          )
        );
      }

      // Jupiter's 4 Galilean Moons (Io, Europa, Ganymede, Callisto) in Laplace resonance!
      if (key === 'jupiter') {
        const jMoons = [
          { r: 0.11, dist: 3.1, color: '#facc15', speed: 4.0, phase: 0.2 },   // Io (volcanic yellow)
          { r: 0.095, dist: 3.7, color: '#e2e8f0', speed: 2.0, phase: 1.9 },  // Europa (icy white)
          { r: 0.145, dist: 4.4, color: '#a8a29e', speed: 1.0, phase: 3.6 },  // Ganymede
          { r: 0.125, dist: 5.2, color: '#78716c', speed: 0.43, phase: 5.1 }, // Callisto
        ];
        jMoons.forEach((jm) => {
          // Thin orbit ring
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i < 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * jm.dist, 0, Math.sin(a) * jm.dist));
          }
          rootGroup.add(
            new THREE.LineLoop(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({ color: jm.color, transparent: true, opacity: 0.18 })
            )
          );

          const pivot = new THREE.Group();
          const mMesh = new THREE.Mesh(
            new THREE.SphereGeometry(jm.r, 16, 16),
            new THREE.MeshStandardMaterial({ color: jm.color, roughness: 0.75 })
          );
          mMesh.position.set(jm.dist, 0, 0);
          pivot.add(mMesh);
          rootGroup.add(pivot);
          this.galileanMoons.push({ pivot, speed: jm.speed, phase: jm.phase });
        });
      }

      this.planetRigs.set(key, { key, rootGroup, tiltGroup, mesh, orbitLine, trailLine });
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

    // Halley's Comet: high-eccentricity inclined Kepler orbit + sun-opposed cyan ion & golden dust tails
    const halleyOrbitLine = this.buildKeplerOrbitLine('halley', '#67e8f9', 0.22);
    this.solarSystemGroup.add(halleyOrbitLine);

    this.halleyGroup = new THREE.Group();
    const nucleus = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.18, 1),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.9,
        roughness: 0.6,
      })
    );
    nucleus.userData.bodyId = 'halley';
    this.halleyGroup.add(nucleus);
    this.clickableMeshes.push(nucleus);

    // Glowing cyan coma halo
    const coma = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createCoronaGlowTexture(),
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    coma.scale.set(1.5, 1.5, 1);
    this.halleyGroup.add(coma);

    // Straight blue ion tail (points directly along +Z away from Sun when oriented via lookAt)
    const ionGeo = new THREE.ConeGeometry(0.45, 5.2, 20, 1, true);
    ionGeo.translate(0, -2.6, 0);
    ionGeo.rotateX(-Math.PI / 2);
    this.halleyIonTail = new THREE.Mesh(
      ionGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.halleyGroup.add(this.halleyIonTail);

    // Slightly angled wider warm dust tail
    const dustGeo = new THREE.ConeGeometry(0.72, 3.8, 20, 1, true);
    dustGeo.translate(0, -1.9, 0);
    dustGeo.rotateX(-Math.PI / 2);
    this.halleyDustTail = new THREE.Mesh(
      dustGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.halleyDustTail.rotation.y = 0.16;
    this.halleyGroup.add(this.halleyDustTail);

    this.solarSystemGroup.add(this.halleyGroup);
    this.createLabel('halley', 'Halley · 75y', this.halleyGroup, 0.9, '#67e8f9', ['solar']);
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
      this.comparisonMats.set(key, mat);

      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 40), mat);
      mesh.position.set(cursorX, 0, 0);
      mesh.rotation.x = THREE.MathUtils.degToRad(p.tiltDeg);
      mesh.userData.bodyId = key;
      this.comparisonGroup.add(mesh);
      this.comparisonClickables.push(mesh);

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

    // Failsafe timer so intro overlay always lifts smoothly even on slow/offline connections
    const introTimer = window.setTimeout(() => {
      if (!store.get().introReady) store.set({ introReady: true });
    }, 1100);

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
        window.clearTimeout(introTimer);
        store.set({ textureQuality: 'nasa-2k', introReady: true });
      },
      undefined,
      () => {
        window.clearTimeout(introTimer);
        store.set({ textureQuality: 'procedural', introReady: true });
      }
    );

    loader.load(TEXTURE_URLS.earthNormal, (normTex) => {
      normTex.anisotropy = 4;
      this.earthShaderMat.uniforms.uNormalMap.value = normTex;
      this.earthShaderMat.uniforms.uUseNormalMap.value = 1.0;
    });

    loader.load(TEXTURE_URLS.earthSpecular, (specTex) => {
      this.earthShaderMat.uniforms.uSpecMap.value = specTex;
      this.earthShaderMat.uniforms.uUseSpecMap.value = 1.0;
    });

    loader.load(TEXTURE_URLS.earthLights, (lightsTex) => {
      lightsTex.colorSpace = THREE.SRGBColorSpace;
      lightsTex.anisotropy = 4;
      this.earthShaderMat.uniforms.uNightMap.value = lightsTex;
    });

    loader.load(TEXTURE_URLS.earthClouds, (cloudTex) => {
      cloudTex.colorSpace = THREE.SRGBColorSpace;
      const mat = this.earthCloudsMesh.material as THREE.MeshLambertMaterial;
      mat.map = cloudTex;
      mat.opacity = 0.78;
      mat.needsUpdate = true;
      this.earthShaderMat.uniforms.uCloudMap.value = cloudTex;
      this.earthShaderMat.uniforms.uUseCloudShadow.value = store.get().showClouds ? 1.0 : 0.0;
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

    // Load 2K textures for all 7 Solar System planets (keeps procedural fallback on error)
    const planetTexMap: Partial<Record<BodyId, string>> = {
      mercury: TEXTURE_URLS.mercury,
      venus: TEXTURE_URLS.venus,
      mars: TEXTURE_URLS.mars,
      jupiter: TEXTURE_URLS.jupiter,
      saturn: TEXTURE_URLS.saturn,
      uranus: TEXTURE_URLS.uranus,
      neptune: TEXTURE_URLS.neptune,
    };

    (Object.keys(planetTexMap) as BodyId[]).forEach((key) => {
      const url = planetTexMap[key];
      if (!url) return;
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const rig = this.planetRigs.get(key);
        if (rig) {
          const mat = rig.mesh.material as THREE.MeshStandardMaterial;
          mat.map = tex;
          mat.needsUpdate = true;
        }
        const cmpMat = this.comparisonMats.get(key);
        if (cmpMat) {
          cmpMat.map = tex;
          cmpMat.needsUpdate = true;
        }
      });
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
    div.className = 'planet-label';
    const [primary, meta] = text.split(' · ');
    div.innerHTML = `
      <span class="planet-reticle" style="--dot:${dotColor}"></span>
      <span class="planet-stem"></span>
      <span class="planet-tag">
        <span class="planet-name">${primary}</span>
        ${meta ? `<span class="planet-meta">${meta}</span>` : ''}
      </span>
    `;
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
      this.earthTiltGroup.scale.setScalar(state.planetScale);
      this.moonMesh.scale.setScalar(state.planetScale);
      this.planetRigs.forEach((rig) => rig.tiltGroup.scale.setScalar(state.planetScale));
    }
    if (changed.has('showLightBeam')) {
      this.tellurion.lightBeamCone.visible = state.showLightBeam && state.mode === 'tellurion';
    }
    if (changed.has('showConstellations')) {
      if (this.constellationsGroup) {
        this.constellationsGroup.visible = state.showConstellations;
      }
    }
    if (changed.has('showClouds')) {
      const mat = this.earthCloudsMesh.material as THREE.MeshLambertMaterial;
      this.earthCloudsMesh.visible = state.showClouds && Boolean(mat.map);
      this.earthAtmoMesh.visible = state.showClouds;
      this.auroraGroup.visible = state.showClouds;
      this.earthShaderMat.uniforms.uUseCloudShadow.value =
        state.showClouds && Boolean(mat.map) ? 1.0 : 0.0;
    }
    if (changed.has('showTropics')) {
      this.tropicsGroup.visible = state.showTropics;
      this.subsolarMarker.visible = state.showTropics && state.mode !== 'comparison';
      this.solarRaysGroup.visible = state.showTropics && state.mode !== 'comparison';
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
    this.sunLensFlareSprite.visible = !isComparison;
    this.sunProminencesGroup.visible = !isComparison;
    this.mainArmGroup.visible = !isComparison;
    this.earthOrbitLine.visible = !isComparison;
    this.solarSystemGroup.visible = isSolar;

    this.tellurion.lightBeamCone.visible = isTellurion && store.get().showLightBeam;
    this.tellurion.moonOrbitRingGroup.visible = !isComparison;
    this.subsolarMarker.visible = !isComparison && store.get().showTropics;
    this.solarRaysGroup.visible = !isComparison && store.get().showTropics;
    if (isComparison) this.eclipseConeGroup.visible = false;

    if (instant) {
      this.tellurionDropProgress = isTellurion ? 0 : 1;
      this.syncTellurionDrop();
    }

    const isPortrait = window.innerWidth / window.innerHeight < 0.85;
    if (isComparison) {
      this.startCameraFlight(
        isPortrait ? new THREE.Vector3(14, 9, 54) : new THREE.Vector3(14, 5.5, 36),
        new THREE.Vector3(14, 0, 0),
        instant ? 0.01 : 0.95
      );
    } else if (isSolar) {
      this.startCameraFlight(
        isPortrait ? new THREE.Vector3(0, 62, 92) : new THREE.Vector3(0, 42, 68),
        new THREE.Vector3(0, 1.2, 0),
        instant ? 0.01 : 1.1
      );
    } else {
      this.startCameraFlight(
        isPortrait ? new THREE.Vector3(30, 24, 36) : new THREE.Vector3(19, 13, 19),
        isPortrait ? new THREE.Vector3(7.2, 0.2, 0) : new THREE.Vector3(4.5, 0.2, 0),
        instant ? 0.01 : 1.0
      );
    }
  }

  private startCameraFlight(camPos: THREE.Vector3, targetPos: THREE.Vector3, duration = 1.05): void {
    this.flyStartPos.copy(this.camera.position);
    this.flyStartTarget.copy(this.controls.target);
    this.desiredCamPos = camPos.clone();
    this.desiredTarget.copy(targetPos);
    this.flyProgress = 0;
    this.flyDuration = duration;
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
    if (bodyId === 'iss' && this.issCraftGroup) {
      this.issCraftGroup.getWorldPosition(out);
      return true;
    }
    if (bodyId === 'halley' && this.halleyGroup) {
      this.halleyGroup.getWorldPosition(out);
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
    const dist =
      bodyId === 'iss'
        ? 1.15
        : bodyId === 'halley'
          ? 6.2
          : Math.max(3.6, baseR * 4.4 * ringBoost);

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
      this.startCameraFlight(new THREE.Vector3(14, 5.5, 36), new THREE.Vector3(14, 0, 0), 0.9);
      return;
    }

    if (preset === 'sun') {
      const camPos =
        state.mode === 'solar' ? new THREE.Vector3(0, 32, 54) : new THREE.Vector3(16, 11, 18);
      this.startCameraFlight(camPos, new THREE.Vector3(0, 1.2, 0), 1.05);
    } else if (preset === 'earth') {
      const earthPos = new THREE.Vector3();
      this.earthTiltGroup.getWorldPosition(earthPos);
      this.startCameraFlight(
        earthPos.clone().add(this.computeLitCameraOffset('earth', earthPos)),
        earthPos,
        1.05
      );
    } else if (preset === 'surface') {
      // "Yüzeyden Bakış": Calm, scenic ISS-style close-up directly above the selected City Pin
      const pinWorld = new THREE.Vector3();
      const earthPos = new THREE.Vector3();
      this.cityPinGroup.getWorldPosition(pinWorld);
      this.earthTiltGroup.getWorldPosition(earthPos);
      const upNormal = pinWorld.clone().sub(earthPos).normalize();
      const dist = 2.45 * state.planetScale;
      this.startCameraFlight(pinWorld.clone().addScaledVector(upNormal, dist), pinWorld, 1.15);
    } else if (preset === 'top') {
      const camPos =
        state.mode === 'solar' ? new THREE.Vector3(0, 92, 6) : new THREE.Vector3(0, 36, 4);
      this.startCameraFlight(camPos, new THREE.Vector3(0, 1.2, 0), 1.0);
    } else if (preset === 'body') {
      const pos = new THREE.Vector3();
      if (this.getBodyWorldPosition(bodyId, pos)) {
        this.startCameraFlight(pos.clone().add(this.computeLitCameraOffset(bodyId, pos)), pos, 1.1);
      }
    } else {
      this.startCameraFlight(new THREE.Vector3(19, 13, 19), new THREE.Vector3(4.5, 0.2, 0), 1.0);
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

    // Earth spin & synchronized cloud shadow UV offset
    const spinDay = jd - 2451545.0;
    this.earthMesh.rotation.y = state.useRealSpin ? spinDay * Math.PI * 2 : spinDay * 0.85;
    this.earthCloudsMesh.rotation.y = this.earthMesh.rotation.y * 1.12;
    this.earthShaderMat.uniforms.uCloudOffset.value =
      ((this.earthMesh.rotation.y - this.earthCloudsMesh.rotation.y) / (Math.PI * 2)) % 1;

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

    // Keep educational parallel solar rays synced with Earth's orbital radius & scale
    this.solarRaysGroup.position.set(earthRadius, 1.2, 0);
    this.solarRaysGroup.scale.setScalar(state.planetScale);

    // Position 90° Subsolar Point Marker on Earth's Sun-facing surface
    const earthWorld = new THREE.Vector3();
    this.earthTiltGroup.getWorldPosition(earthWorld);
    if (this.subsolarMarker.visible) {
      const sunWorld = new THREE.Vector3(0, 1.2, 0);
      const toSun = sunWorld.sub(earthWorld).normalize();
      const surfR = PLANET_DATA.earth.modelRadius * state.planetScale * 1.032;
      this.subsolarMarker.position.copy(earthWorld).addScaledVector(toSun, surfR);
      this.subsolarMarker.lookAt(earthWorld.clone().addScaledVector(toSun, surfR + 2));
    }

    // Update Earth GLSL shader with Moon world position for real-time Solar Eclipse shadow
    this.moonMesh.getWorldPosition(this.tempMoonWorld);
    this.earthShaderMat.uniforms.uMoonPosition.value.copy(this.tempMoonWorld);
    this.earthShaderMat.uniforms.uMoonRadius.value = PLANET_DATA.moon.modelRadius * state.planetScale;

    // 3D Eclipse Umbra & Penumbra Shadow Cones + Blood Moon tint
    if (state.mode !== 'comparison' && lunar.eclipseType === 'solar') {
      this.eclipseConeGroup.visible = true;
      this.eclipseConeGroup.position.copy(this.tempMoonWorld);
      this.eclipseConeGroup.lookAt(earthWorld);
      const dist = this.tempMoonWorld.distanceTo(earthWorld);
      this.eclipseConeGroup.scale.set(
        state.planetScale,
        state.planetScale,
        Math.max(1, dist)
      );
      const alpha = Math.min(1, 0.35 + lunar.eclipseIntensity * 0.65);
      this.eclipseUmbraMat.opacity = 0.45 * alpha;
      this.eclipsePenumbraMat.opacity = 0.2 * alpha;
      this.moonMaterial.color.setRGB(1, 1, 1);
      this.moonMaterial.emissive.setRGB(0, 0, 0);
    } else if (state.mode !== 'comparison' && lunar.eclipseType === 'lunar') {
      this.eclipseConeGroup.visible = true;
      this.eclipseConeGroup.position.copy(earthWorld);
      this.eclipseConeGroup.lookAt(this.tempMoonWorld);
      const dist = earthWorld.distanceTo(this.tempMoonWorld) + 1.0;
      this.eclipseConeGroup.scale.set(
        state.planetScale * 2.7,
        state.planetScale * 2.7,
        Math.max(1, dist)
      );
      const intensity = Math.min(1, lunar.eclipseIntensity * 1.4);
      this.eclipseUmbraMat.opacity = 0.35 * intensity;
      this.eclipsePenumbraMat.opacity = 0.16 * intensity;
      this.moonMaterial.color.setRGB(1.0, 1.0 - 0.62 * intensity, 1.0 - 0.72 * intensity);
      this.moonMaterial.emissive.setRGB(0.28 * intensity, 0.04 * intensity, 0.01 * intensity);
    } else {
      this.eclipseConeGroup.visible = false;
      this.moonMaterial.color.setRGB(1, 1, 1);
      this.moonMaterial.emissive.setRGB(0, 0, 0);
    }

    // Other solar system planets (true Kepler elliptical 3D positions + Saturn shadow + orbital trails)
    if (state.mode === 'solar') {
      this.updateTrailGeometry(this.earthTrailLine, 'earth', jd);
    }
    this.planetRigs.forEach((rig, key) => {
      const pos = computePlanetPosition(key, jd, 1.0);
      rig.rootGroup.position.set(pos.x, pos.y + 1.2, pos.z);
      rig.mesh.rotation.y = spinDay * 0.1 * PLANET_DATA[key].rotSpeed;

      if (key === 'saturn' && this.saturnRingMat) {
        this.saturnRingMat.uniforms.uPlanetPosition.value.set(pos.x, pos.y + 1.2, pos.z);
        this.saturnRingMat.uniforms.uPlanetRadius.value =
          PLANET_DATA.saturn.modelRadius * state.planetScale;
      }
      if (state.mode === 'solar') {
        this.updateTrailGeometry(rig.trailLine, key, jd);
      }
    });

    // Jupiter's 4 Galilean Moons (Io, Europa, Ganymede, Callisto)
    this.galileanMoons.forEach((gm) => {
      gm.pivot.rotation.y = gm.phase + spinDay * 0.25 * gm.speed;
    });

    // Halley's Comet: Kepler orbit + physically sun-opposed ion & dust tails (grow near perihelion!)
    if (this.halleyGroup) {
      const hPos = computePlanetPosition('halley', jd, 1.0);
      this.halleyGroup.position.set(hPos.x, hPos.y + 1.2, hPos.z);
      // Point -Z toward Sun so +Z tails extend strictly away from Sun
      const sunWorld = new THREE.Vector3(0, 1.2, 0);
      const awayTarget = this.halleyGroup.position.clone().multiplyScalar(2).sub(sunWorld);
      this.halleyGroup.lookAt(awayTarget);
      const distFromSun = Math.max(4, this.halleyGroup.position.distanceTo(sunWorld));
      const tailScale = THREE.MathUtils.clamp(22 / distFromSun, 0.45, 2.2);
      this.halleyIonTail.scale.set(1, 1, tailScale);
      this.halleyDustTail.scale.set(1, 1, tailScale * 0.9);
    }

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
        mode === 'comparison'
          ? this.comparisonClickables
          : mode === 'solar'
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
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.aspect = aspect;
      this.camera.fov = aspect < 0.85 ? 54 : 44;
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

    // Advance simulation clock (calm ISS-like speed in Surface view so the globe never spins wildly)
    if (state.isPlaying && state.mode !== 'comparison') {
      const rate =
        state.cameraPreset === 'surface'
          ? state.useRealSpin
            ? 0.05
            : 0.22
          : 10.8;
      const nextJD = state.jd + delta * rate * state.simSpeed;
      store.set({ jd: nextJD });
      this.updatePositions(store.get());
    }

    // Animated solar plasma, prominences, lens flare, aurora & twinkling stars
    this.sunPlasmaMat.uniforms.uTime.value = elapsed;
    if (this.starsMat) this.starsMat.uniforms.uTime.value = elapsed;
    if (this.auroraMat) this.auroraMat.uniforms.uTime.value = elapsed;
    if (this.sunProminencesGroup) this.sunProminencesGroup.rotation.y = elapsed * 0.035;
    const pulse = 13.6 + Math.sin(elapsed * 1.5) * 0.35;
    this.sunCoronaSprite.scale.set(pulse, pulse, 1);
    if (this.sunLensFlareSprite) {
      const flareScale = 17.2 + Math.sin(elapsed * 2.1) * 0.6;
      this.sunLensFlareSprite.scale.set(flareScale, flareScale, 1);
    }

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

    // Smooth ISS orbital motion around Earth (gentle speed when focused)
    if (this.issOrbitGroup) {
      const issRate = state.selectedBody === 'iss' && state.cameraPreset === 'body' ? 0.14 : 0.42;
      this.issOrbitGroup.rotation.y += delta * issRate * (state.isPlaying ? 1 : 0.15);
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
        const dist = 2.45 * state.planetScale;
        const idealCam = pinWorld.clone().addScaledVector(upNormal, dist);

        if (this.desiredCamPos) {
          this.desiredCamPos.copy(idealCam);
          this.desiredTarget.copy(pinWorld);
          if (this.camera.position.distanceTo(idealCam) < 0.08) {
            this.desiredCamPos = null;
          }
        } else {
          // Lock smoothly onto the pin with zero rubber-band whip
          this.camera.position.lerp(idealCam, 0.16);
          this.controls.target.lerp(pinWorld, 0.2);
        }
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

    // Smooth cubic ease-in-out camera flight
    if (this.desiredCamPos) {
      this.flyProgress = Math.min(1, this.flyProgress + delta / Math.max(0.15, this.flyDuration));
      const t = this.flyProgress;
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.flyStartPos, this.desiredCamPos, ease);
      this.controls.target.lerpVectors(this.flyStartTarget, this.desiredTarget, ease);

      if (this.flyProgress >= 1) {
        this.camera.position.copy(this.desiredCamPos);
        this.controls.target.copy(this.desiredTarget);
        this.desiredCamPos = null;
      }
    }

    this.controls.update();
    this.updateLabels();
    this.composer.render();
  };

  /**
   * Captures a high-resolution PNG snapshot with subtle Observatory telemetry stamp.
   */
  public captureSnapshot(): void {
    this.composer.render();
    const srcCanvas = this.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = srcCanvas.width;
    out.height = srcCanvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(srcCanvas, 0, 0);

    // Subtle bottom-left Observatory stamp
    const state = store.get();
    const dateStr = formatTurkishDate(julianDateToDate(state.jd));
    const modeLabel =
      state.mode === 'tellurion'
        ? 'TELLURION'
        : state.mode === 'solar'
          ? 'GÜNEŞ SİSTEMİ'
          : '109x KARŞILAŞTIRMA';
    const bodyLabel = PLANET_DATA[state.selectedBody].name.toUpperCase();

    const pad = Math.round(out.width * 0.022);
    const fontSize = Math.max(14, Math.round(out.width * 0.011));
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 18, 0.58)';
    const boxW = Math.round(fontSize * 26);
    const boxH = Math.round(fontSize * 3.1);
    const bx = pad;
    const by = out.height - pad - boxH;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 184, 90, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#e8b85a';
    ctx.font = `700 ${fontSize}px Space Grotesk, Inter, sans-serif`;
    ctx.fillText('HELIOS GÖZLEMEVİ', bx + fontSize, by + fontSize * 1.35);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.font = `500 ${Math.round(fontSize * 0.82)}px JetBrains Mono, monospace`;
    ctx.fillText(
      `${dateStr.toUpperCase()}  ·  ${modeLabel}  ·  ${bodyLabel}`,
      bx + fontSize,
      by + fontSize * 2.45
    );
    ctx.restore();

    const link = document.createElement('a');
    link.download = `helios-gozlemevi-${Date.now()}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  }

  public dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
  }
}
