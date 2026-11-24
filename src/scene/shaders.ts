import * as THREE from 'three';

/**
 * Custom GLSL Earth Shader:
 * - Day side: NASA 2K satellite texture + ocean specular sun glint
 * - Terminator: Warm amber-orange twilight scattering band
 * - Night side: Warm glowing continental city lights
 * - Real-time Solar Eclipse Umbra/Penumbra shadow cast by the Moon
 */
export function createEarthDayNightMaterial(
  dayMap: THREE.Texture,
  nightMap: THREE.Texture,
  specMap: THREE.Texture
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: dayMap },
      uNightMap: { value: nightMap },
      uSpecMap: { value: specMap },
      uSunPosition: { value: new THREE.Vector3(0, 1.2, 0) },
      uMoonPosition: { value: new THREE.Vector3(100, 100, 100) },
      uMoonRadius: { value: 0.32 },
      uUseSpecMap: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDayMap;
      uniform sampler2D uNightMap;
      uniform sampler2D uSpecMap;
      uniform vec3 uSunPosition;
      uniform vec3 uMoonPosition;
      uniform float uMoonRadius;
      uniform float uUseSpecMap;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunPosition - vWorldPosition);
        vec3 V = normalize(cameraPosition - vWorldPosition);

        float ndotl = dot(N, L);
        float dayFactor = smoothstep(-0.12, 0.22, ndotl);
        float nightFactor = 1.0 - smoothstep(-0.22, 0.06, ndotl);
        float twilight = exp(-pow(ndotl * 7.5, 2.0)) * 0.42;

        vec3 dayTex = texture2D(uDayMap, vUv).rgb;
        vec3 nightTex = texture2D(uNightMap, vUv).rgb;
        float oceanMask = mix(0.25, texture2D(uSpecMap, vUv).r, uUseSpecMap);

        // Solar Eclipse shadow projection from Moon onto Earth (only when Moon is between Earth & Sun)
        vec3 toSun = uSunPosition - vWorldPosition;
        float distToSun = length(toSun);
        vec3 toMoon = uMoonPosition - vWorldPosition;
        float proj = dot(toMoon, L);
        float eclipseShadow = 1.0;
        if (proj > 0.0 && proj < distToSun) {
          vec3 perp = toMoon - L * proj;
          float distToAxis = length(perp);
          float umbra = smoothstep(uMoonRadius * 0.45, uMoonRadius * 1.35, distToAxis);
          eclipseShadow = mix(0.18, 1.0, umbra);
        }

        // Diffuse + ocean specular reflection
        float diff = max(ndotl, 0.0) * eclipseShadow;
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 34.0) * oceanMask * dayFactor * eclipseShadow * 0.72;

        vec3 dayColor = dayTex * (0.06 + diff * 1.25) + vec3(0.55, 0.82, 1.0) * spec;
        vec3 twilightColor = vec3(0.95, 0.42, 0.16) * twilight * eclipseShadow * (0.4 + 0.6 * (1.0 - oceanMask));
        vec3 nightColor = dayTex * 0.045 + nightTex * vec3(1.0, 0.78, 0.42) * nightFactor * 1.55;

        vec3 finalColor = mix(nightColor, dayColor, dayFactor) + twilightColor;
        gl_FragColor = vec4(finalColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Custom GLSL Rayleigh Atmospheric Scattering Halo around Earth
 */
export function createEarthAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(0, 1.2, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunPosition - vWorldPos);

        float rim = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 3.0);
        float sunSide = smoothstep(-0.35, 0.55, dot(N, L));
        vec3 dayGlow = vec3(0.24, 0.66, 1.0);
        vec3 nightGlow = vec3(0.08, 0.22, 0.6);
        vec3 col = mix(nightGlow, dayGlow, sunSide);

        gl_FragColor = vec4(col, rim * (0.28 + 0.62 * sunSide));
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Custom GLSL Animated Solar Plasma Photosphere with Granulation & Limb Darkening
 */
export function createSunPlasmaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vPosition = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;

      // Compact 3D value noise for solar convection granulation
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.05 + vec3(0.15, -0.11, 0.08);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 p = normalize(vPosition) * 3.8;
        float n1 = fbm(p + vec3(uTime * 0.12, uTime * 0.08, -uTime * 0.06));
        float n2 = fbm(p * 2.1 - vec3(uTime * 0.16, -uTime * 0.1, uTime * 0.12) + n1 * 1.4);
        float plasma = clamp(n1 * 0.55 + n2 * 0.65, 0.0, 1.0);

        // Limb darkening
        vec3 V = normalize(cameraPosition - vWorldPos);
        float center = clamp(dot(normalize(vNormal), V), 0.0, 1.0);
        float limb = pow(center, 0.45);

        vec3 deepOrange = vec3(0.76, 0.16, 0.02);
        vec3 midOrange = vec3(0.98, 0.46, 0.06);
        vec3 hotYellow = vec3(1.0, 0.88, 0.42);
        vec3 coreWhite = vec3(1.0, 0.98, 0.86);

        vec3 col = mix(deepOrange, midOrange, smoothstep(0.15, 0.52, plasma));
        col = mix(col, hotYellow, smoothstep(0.48, 0.78, plasma));
        col = mix(col, coreWhite, smoothstep(0.78, 0.96, plasma) * limb);

        // Slight sunspot darkening
        float spot = smoothstep(0.24, 0.16, n1 * n2);
        col *= (1.0 - spot * 0.55);

        // Bright emissive output for selective bloom
        col *= (0.72 + 0.68 * limb);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Custom GLSL Saturn Ring Shader with real-time Planetary Shadow cast by Saturn onto its rings
 */
export function createSaturnRingShadowMaterial(ringMap: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRingMap: { value: ringMap },
      uSunPosition: { value: new THREE.Vector3(0, 1.2, 0) },
      uPlanetPosition: { value: new THREE.Vector3(34, 1.2, 0) },
      uPlanetRadius: { value: 1.9 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uRingMap;
      uniform vec3 uSunPosition;
      uniform vec3 uPlanetPosition;
      uniform float uPlanetRadius;

      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vec4 tex = texture2D(uRingMap, vUv);
        if (tex.a < 0.02) discard;

        // Ray from ring point toward Sun: test intersection with Saturn sphere
        vec3 toSun = normalize(uSunPosition - vWorldPos);
        vec3 toPlanet = uPlanetPosition - vWorldPos;
        float proj = dot(toPlanet, toSun);
        float shadow = 1.0;
        if (proj > 0.0) {
          vec3 perp = toPlanet - toSun * proj;
          float d = length(perp);
          shadow = mix(0.12, 1.0, smoothstep(uPlanetRadius * 0.94, uPlanetRadius * 1.06, d));
        }

        vec3 col = tex.rgb * (0.14 + 0.92 * shadow);
        gl_FragColor = vec4(col, tex.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Custom GLSL Aurora Borealis & Australis Curtain Shader (brightest on Earth's night side)
 */
export function createAuroraMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunPosition: { value: new THREE.Vector3(0, 1.2, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunPosition;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 L = normalize(uSunPosition - vWorldPos);
        vec3 N = normalize(vWorldNormal);
        float nightMask = 1.0 - smoothstep(-0.15, 0.25, dot(N, L));

        // Vertical flowing aurora curtains
        float wave1 = sin(vUv.x * 28.0 + uTime * 1.4 + sin(vUv.x * 9.0 - uTime * 0.7) * 2.0);
        float wave2 = sin(vUv.x * 46.0 - uTime * 1.9);
        float curtain = smoothstep(-0.2, 0.9, wave1 * 0.65 + wave2 * 0.35);

        // Vertical fade (bright bottom emerald edge, soft fading violet top)
        float vertFade = smoothstep(0.0, 0.22, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));

        vec3 emerald = vec3(0.12, 0.95, 0.55);
        vec3 violet = vec3(0.62, 0.25, 0.96);
        vec3 col = mix(emerald, violet, smoothstep(0.18, 0.85, vUv.y));

        float alpha = curtain * vertFade * (0.28 + 0.72 * nightMask) * 0.72;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col * 1.3, alpha);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Reusable Fresnel Atmospheric Rim Halo Shader for Venus, Mars, Jupiter, Uranus, Neptune
 */
export function createPlanetAtmosphereMaterial(
  colorHex: string,
  intensity = 0.55
): THREE.ShaderMaterial {
  const c = new THREE.Color(colorHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(0, 1.2, 0) },
      uColor: { value: c },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunPosition;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunPosition - vWorldPos);
        float rim = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 3.4);
        float sunSide = smoothstep(-0.3, 0.65, dot(N, L));
        gl_FragColor = vec4(uColor, rim * uIntensity * (0.2 + 0.8 * sunSide));
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Subtle Twinkling Deep-Space Starfield Shader
 */
export function createTwinklingStarsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vTwinkle = 0.72 + 0.28 * sin(uTime * 1.6 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (320.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor * vTwinkle, core * 0.92);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
