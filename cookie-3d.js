(function () {
  'use strict';

  function boot() {
    var stage = document.getElementById('cookie-stage');
    var canvas = document.getElementById('cookie-canvas');

    if (!stage || !canvas || !stage.contains(canvas)) {
      return;
    }

    var prefersReducedMotion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    var reducedMotion = Boolean(prefersReducedMotion && prefersReducedMotion.matches);
    var documentVisible = document.visibilityState !== 'hidden';
    var inViewport = true;
    var rendererReady = false;
    var contextLost = false;
    var animationFrame = 0;
    var lastFrameTime = 0;
    var pointerId = null;
    var pointerX = 0;
    var pointerY = 0;
    var pointerTime = 0;
    var velocityX = 0;
    var velocityY = 0;
    var rotationX = -0.24;
    var rotationY = -0.28;
    var idleRotation = 0;
    var idleTime = 0;
    var idleWeight = 1;
    var dragged = false;
    var interactionsBound = false;
    var fallback = null;
    var observer = null;
    var resizeObserver = null;
    var gl = null;
    var cpuGeometry = null;
    var materialProgram = null;
    var shadowProgram = null;
    var cookieMesh = null;
    var chipMesh = null;
    var shadowMesh = null;
    var materialLocations = null;
    var shadowLocations = null;
    var projectionMatrix = new Float32Array(16);
    var viewMatrix = new Float32Array(16);
    var viewProjectionMatrix = new Float32Array(16);
    var modelMatrix = new Float32Array(16);
    var cameraPosition = new Float32Array(3);
    var shadowStrength = 0.34;

    var originalTabIndex = canvas.getAttribute('tabindex');
    var originalAriaHidden = canvas.getAttribute('aria-hidden');
    var originalAriaLabel = canvas.getAttribute('aria-label');

    var MATERIAL_VERTEX_SHADER = [
      'attribute vec3 aPosition;',
      'attribute vec3 aNormal;',
      'attribute float aShade;',
      'uniform mat4 uModel;',
      'uniform mat4 uViewProjection;',
      'varying vec3 vWorldPosition;',
      'varying vec3 vLocalPosition;',
      'varying vec3 vWorldNormal;',
      'varying vec3 vLocalNormal;',
      'varying float vShade;',
      'void main(void) {',
      '  vec4 worldPosition = uModel * vec4(aPosition, 1.0);',
      '  vWorldPosition = worldPosition.xyz;',
      '  vLocalPosition = aPosition;',
      '  vWorldNormal = mat3(uModel) * aNormal;',
      '  vLocalNormal = aNormal;',
      '  vShade = aShade;',
      '  gl_Position = uViewProjection * worldPosition;',
      '}'
    ].join('\n');

    var MATERIAL_FRAGMENT_SHADER = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'varying vec3 vWorldPosition;',
      'varying vec3 vLocalPosition;',
      'varying vec3 vWorldNormal;',
      'varying vec3 vLocalNormal;',
      'varying float vShade;',
      'uniform vec3 uCameraPosition;',
      'uniform float uMaterial;',
      'uniform float uTime;',
      '',
      'float hash21(vec2 p) {',
      '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
      '  p3 += dot(p3, p3.yzx + 33.33);',
      '  return fract((p3.x + p3.y) * p3.z);',
      '}',
      '',
      'float noise21(vec2 p) {',
      '  vec2 cell = floor(p);',
      '  vec2 local = fract(p);',
      '  vec2 fade = local * local * (3.0 - 2.0 * local);',
      '  float a = hash21(cell);',
      '  float b = hash21(cell + vec2(1.0, 0.0));',
      '  float c = hash21(cell + vec2(0.0, 1.0));',
      '  float d = hash21(cell + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, fade.x), mix(c, d, fade.x), fade.y);',
      '}',
      '',
      'void main(void) {',
      '  vec3 normal = normalize(vWorldNormal);',
      '  vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);',
      '  float lightDrift = sin(uTime * 0.18) * 0.025;',
      '  vec3 keyDirection = normalize(vec3(-0.72 + lightDrift, 1.05, 1.55));',
      '  vec3 fillDirection = normalize(vec3(0.94, 0.23, -0.72));',
      '  vec3 skyDirection = normalize(vec3(-0.18, 1.0, 0.18));',
      '  float key = max(dot(normal, keyDirection), 0.0);',
      '  float fill = max(dot(normal, fillDirection), 0.0);',
      '  float sky = max(dot(normal, skyDirection), 0.0);',
      '  float facing = max(dot(normal, viewDirection), 0.0);',
      '  float fresnel = pow(1.0 - facing, 3.0);',
      '  vec3 halfDirection = normalize(keyDirection + viewDirection);',
      '  vec3 baseColor;',
      '  float gloss;',
      '',
      '  if (uMaterial < 0.5) {',
      '    vec2 crumbUv = vLocalPosition.xy;',
      '    float broad = noise21(crumbUv * 3.1 + vec2(1.7, 8.2));',
      '    float baked = noise21(crumbUv * 7.8 + vec2(9.3, 2.6));',
      '    float crumb = noise21(crumbUv * 24.0 + vLocalPosition.z * 3.0);',
      '    float grain = noise21(crumbUv * 68.0 + vec2(5.2, 13.7));',
      '    float toasted = broad * 0.44 + baked * 0.35 + crumb * 0.21;',
      '    vec3 deepCaramel = vec3(0.43, 0.155, 0.035);',
      '    vec3 goldenCaramel = vec3(0.88, 0.49, 0.205);',
      '    baseColor = mix(deepCaramel, goldenCaramel, 0.55 + toasted * 0.45);',
      '    baseColor *= 0.79 + crumb * 0.28 + grain * 0.07;',
      '    float pore = smoothstep(0.74, 0.96, grain) * smoothstep(0.2, 0.62, crumb);',
      '    baseColor *= 1.0 - pore * 0.32;',
      '    float folded = noise21(crumbUv * 10.0 + noise21(crumbUv * 2.1) * 5.0);',
      '    float crack = 1.0 - smoothstep(0.018, 0.075, abs(folded - 0.515));',
      '    crack *= smoothstep(0.53, 0.82, noise21(crumbUv * 3.7 + 14.0));',
      '    baseColor *= 1.0 - crack * 0.22;',
      '    float objectFace = abs(normalize(vLocalNormal).z);',
      '    float edge = 1.0 - smoothstep(0.22, 0.92, objectFace);',
      '    float rimToast = smoothstep(0.75, 1.02, length(vLocalPosition.xy) / 1.38);',
      '    baseColor *= mix(1.0, 0.70, edge);',
      '    baseColor *= 1.0 - rimToast * 0.14;',
      '    baseColor *= vShade;',
      '    gloss = 22.0;',
      '  } else {',
      '    float cocoa = noise21(vLocalPosition.xy * 23.0 + vLocalPosition.z * 9.0);',
      '    float cocoaFine = noise21(vLocalPosition.yz * 71.0 + 19.0);',
      '    baseColor = mix(vec3(0.050, 0.012, 0.009), vec3(0.205, 0.068, 0.034), cocoa * 0.75);',
      '    baseColor += vec3(0.025, 0.009, 0.004) * cocoaFine;',
      '    baseColor *= 0.91 + vShade * 0.09;',
      '    gloss = 72.0;',
      '  }',
      '',
      '  float diffuse = 0.34 + key * 0.76 + fill * 0.28 + sky * 0.09;',
      '  vec3 color = baseColor * diffuse;',
      '  float specularAmount = pow(max(dot(normal, halfDirection), 0.0), gloss);',
      '  float specularStrength = uMaterial < 0.5 ? 0.18 : 0.88;',
      '  color += vec3(1.0, 0.78, 0.52) * specularAmount * specularStrength;',
      '  color += vec3(0.46, 0.18, 0.07) * fresnel * (uMaterial < 0.5 ? 0.10 : 0.19);',
      '  color = color / (color + vec3(0.78));',
      '  color = pow(max(color, vec3(0.0)), vec3(0.92));',
      '  gl_FragColor = vec4(color, 1.0);',
      '}'
    ].join('\n');

    var SHADOW_VERTEX_SHADER = [
      'attribute vec3 aPosition;',
      'attribute vec2 aUv;',
      'uniform mat4 uViewProjection;',
      'varying vec2 vUv;',
      'void main(void) {',
      '  vUv = aUv;',
      '  gl_Position = uViewProjection * vec4(aPosition, 1.0);',
      '}'
    ].join('\n');

    var SHADOW_FRAGMENT_SHADER = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'varying vec2 vUv;',
      'uniform float uStrength;',
      'void main(void) {',
      '  vec2 p = (vUv - 0.5) * 2.0;',
      '  float softShadow = exp(-4.9 * dot(p, p));',
      '  float contactShadow = exp(-15.0 * dot(p * vec2(0.72, 1.0), p * vec2(0.72, 1.0)));',
      '  float alpha = (softShadow * 0.68 + contactShadow * 0.32) * uStrength;',
      '  alpha *= (1.0 - smoothstep(0.72, 1.02, abs(p.x))) * (1.0 - smoothstep(0.70, 1.02, abs(p.y)));',
      '  gl_FragColor = vec4(0.16, 0.052, 0.022, alpha);',
      '}'
    ].join('\n');

    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }

    function smoothstepValue(edge0, edge1, value) {
      var t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function randomFactory(seed) {
      var state = seed >>> 0;
      return function () {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }

    function MeshBuilder() {
      this.vertices = [];
      this.indices = [];
    }

    MeshBuilder.prototype.addVertex = function (x, y, z, shade) {
      var index = this.vertices.length / 7;
      this.vertices.push(x, y, z, 0, 0, 0, shade);
      return index;
    };

    MeshBuilder.prototype.addTriangle = function (a, b, c) {
      this.indices.push(a, b, c);
    };

    MeshBuilder.prototype.computeNormals = function () {
      var vertices = this.vertices;
      var indices = this.indices;
      var i;

      for (i = 0; i < indices.length; i += 3) {
        var a = indices[i] * 7;
        var b = indices[i + 1] * 7;
        var c = indices[i + 2] * 7;
        var abX = vertices[b] - vertices[a];
        var abY = vertices[b + 1] - vertices[a + 1];
        var abZ = vertices[b + 2] - vertices[a + 2];
        var acX = vertices[c] - vertices[a];
        var acY = vertices[c + 1] - vertices[a + 1];
        var acZ = vertices[c + 2] - vertices[a + 2];
        var nx = abY * acZ - abZ * acY;
        var ny = abZ * acX - abX * acZ;
        var nz = abX * acY - abY * acX;

        vertices[a + 3] += nx;
        vertices[a + 4] += ny;
        vertices[a + 5] += nz;
        vertices[b + 3] += nx;
        vertices[b + 4] += ny;
        vertices[b + 5] += nz;
        vertices[c + 3] += nx;
        vertices[c + 4] += ny;
        vertices[c + 5] += nz;
      }

      for (i = 0; i < vertices.length; i += 7) {
        var x = vertices[i + 3];
        var y = vertices[i + 4];
        var z = vertices[i + 5];
        var length = Math.sqrt(x * x + y * y + z * z);

        if (length < 0.000001) {
          vertices[i + 3] = 0;
          vertices[i + 4] = 0;
          vertices[i + 5] = 1;
        } else {
          vertices[i + 3] = x / length;
          vertices[i + 4] = y / length;
          vertices[i + 5] = z / length;
        }
      }
    };

    MeshBuilder.prototype.finish = function () {
      this.computeNormals();
      if (this.vertices.length / 7 > 65535) {
        throw new Error('Cookie mesh exceeded 16-bit index capacity.');
      }
      return {
        vertices: new Float32Array(this.vertices),
        indices: new Uint16Array(this.indices)
      };
    };

    function buildGeometry() {
      var radius = 1.38;
      var segments = 112;
      var outlineRings = [
        [0.115, 0.347],
        [0.32, 0.357],
        [0.53, 0.354],
        [0.73, 0.347],
        [0.85, 0.329],
        [0.925, 0.302],
        [0.971, 0.251],
        [0.994, 0.158],
        [1.0, 0.045],
        [0.997, -0.108],
        [0.978, -0.235],
        [0.928, -0.308],
        [0.844, -0.351],
        [0.68, -0.367],
        [0.43, -0.374],
        [0.16, -0.372]
      ];
      var frontProfile = [
        [0, 0.335],
        [0.115, 0.347],
        [0.32, 0.357],
        [0.53, 0.354],
        [0.73, 0.347],
        [0.85, 0.329],
        [0.925, 0.302],
        [0.971, 0.251],
        [0.994, 0.158],
        [1.0, 0.045]
      ];
      var backProfile = [
        [0, -0.37],
        [0.16, -0.372],
        [0.43, -0.374],
        [0.68, -0.367],
        [0.844, -0.351],
        [0.928, -0.308],
        [0.978, -0.235],
        [0.997, -0.108],
        [1.0, 0.045]
      ];
      var frontChipSpecs = [
        [-0.52, 0.49, 0.125, 0.2],
        [-0.08, 0.69, 0.105, 1.1],
        [0.43, 0.56, 0.132, 2.4],
        [0.7, 0.21, 0.105, 0.8],
        [0.5, -0.22, 0.14, 1.8],
        [0.09, -0.49, 0.105, 2.7],
        [-0.3, -0.62, 0.132, 0.4],
        [-0.68, -0.35, 0.12, 1.5],
        [-0.73, 0.04, 0.092, 2.2],
        [-0.11, 0.06, 0.145, 0.9],
        [0.26, 0.19, 0.095, 2.1],
        [0.79, -0.18, 0.078, 0.5],
        [-0.31, 0.34, 0.078, 1.9],
        [0.29, -0.73, 0.075, 2.8],
        [-0.72, 0.57, 0.066, 0.7]
      ];
      var backChipSpecs = [
        [-0.48, 0.58, 0.105, 1.2],
        [0.06, 0.72, 0.095, 0.4],
        [0.6, 0.42, 0.12, 2.5],
        [0.58, -0.07, 0.14, 1.6],
        [0.21, -0.58, 0.105, 2.8],
        [-0.28, -0.63, 0.13, 0.8],
        [-0.67, -0.23, 0.1, 2.1],
        [-0.65, 0.18, 0.115, 1.4],
        [-0.05, 0.15, 0.12, 0.3],
        [0.35, 0.02, 0.08, 2.0],
        [0.74, -0.42, 0.072, 1.0],
        [-0.25, 0.43, 0.07, 2.6]
      ];
      var sideChipSpecs = [
        [0.22, -0.045, 0.105],
        [1.12, 0.055, 0.12],
        [1.87, -0.12, 0.082],
        [2.78, 0.025, 0.118],
        [3.62, -0.075, 0.094],
        [4.4, 0.075, 0.11],
        [5.33, -0.005, 0.098],
        [5.96, -0.13, 0.08]
      ];
      var cookie = new MeshBuilder();
      var chips = new MeshBuilder();
      var random = randomFactory(0x4352554d);
      var frontChips = [];
      var backChips = [];
      var sideChips = [];

      function outlineAt(angle) {
        return (
          1 +
          Math.sin(angle * 3 + 0.37) * 0.0205 +
          Math.sin(angle * 7 - 1.4) * 0.014 +
          Math.sin(angle * 13 + 2.1) * 0.0075
        );
      }

      function radiusAt(t, angle) {
        return radius * t * (1 + (outlineAt(angle) - 1) * Math.min(1, t * 1.8));
      }

      function surfaceBump(t, angle) {
        var centerFade = 1 - Math.pow(clamp(t, 0, 1), 2.1);
        var edgeRipple = smoothstepValue(0.7, 1, t);
        return (
          Math.sin(angle * 11 + t * 27) * 0.0065 * centerFade +
          Math.sin(angle * 19 - t * 17) * 0.0038 * centerFade +
          Math.sin(angle * 5 + 1.8) * 0.009 * edgeRipple
        );
      }

      function profileHeight(profile, t) {
        var i;
        for (i = 1; i < profile.length; i += 1) {
          if (t <= profile[i][0]) {
            var blend = (t - profile[i - 1][0]) / (profile[i][0] - profile[i - 1][0]);
            return profile[i - 1][1] + (profile[i][1] - profile[i - 1][1]) * blend;
          }
        }
        return profile[profile.length - 1][1];
      }

      function sampleSurface(x, y, front) {
        var rawAngle = Math.atan2(y, x);
        var actualRadius = Math.sqrt(x * x + y * y);
        var t = actualRadius / (radius * Math.max(0.01, outlineAt(rawAngle)));
        var profile = front ? frontProfile : backProfile;
        var height = profileHeight(profile, clamp(t, 0, 1));
        return height + (front ? 1 : -1) * surfaceBump(clamp(t, 0, 1), rawAngle);
      }

      function normalizeVector(vector) {
        var length = Math.sqrt(
          vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]
        );
        if (length < 0.000001) {
          return;
        }
        vector[0] /= length;
        vector[1] /= length;
        vector[2] /= length;
      }

      function addChip(builder, center, normal, width, depth, height, rotation, shadeBase) {
        var n = [normal[0], normal[1], normal[2]];
        normalizeVector(n);
        var u;
        var v;

        if (Math.abs(n[2]) > 0.8) {
          u = [Math.cos(rotation), Math.sin(rotation), 0];
        } else {
          u = [-n[1], n[0], 0];
          normalizeVector(u);
        }

        v = [
          n[1] * u[2] - n[2] * u[1],
          n[2] * u[0] - n[0] * u[2],
          n[0] * u[1] - n[1] * u[0]
        ];
        normalizeVector(v);

        if (Math.abs(n[2]) <= 0.8) {
          var cosine = Math.cos(rotation);
          var sine = Math.sin(rotation);
          var rotatedU = [
            u[0] * cosine + v[0] * sine,
            u[1] * cosine + v[1] * sine,
            u[2] * cosine + v[2] * sine
          ];
          v = [
            n[1] * rotatedU[2] - n[2] * rotatedU[1],
            n[2] * rotatedU[0] - n[0] * rotatedU[2],
            n[0] * rotatedU[1] - n[1] * rotatedU[0]
          ];
          u = rotatedU;
          normalizeVector(v);
        }

        var ringCount = 8;
        var ringScales = [0.32, 0.68, 1.0, 0.87];
        var ringHeights = [0.94, 0.62, 0.13, -0.10];
        var start = builder.vertices.length / 7;
        var top = builder.addVertex(
          center[0] + n[0] * height,
          center[1] + n[1] * height,
          center[2] + n[2] * height,
          shadeBase
        );
        var ringIndices = [];
        var i;
        var ring;

        for (ring = 0; ring < ringScales.length; ring += 1) {
          var ringList = [];
          for (i = 0; i < ringCount; i += 1) {
            var angle = (i / ringCount) * Math.PI * 2;
            var wobble =
              1 +
              Math.sin(angle * 3 + rotation * 2.7) * 0.055 +
              Math.sin(angle * 5 - rotation) * 0.035;
            var alongU = Math.cos(angle) * width * ringScales[ring] * wobble;
            var alongV =
              Math.sin(angle) *
              depth *
              ringScales[ring] *
              (1 + Math.cos(angle * 2 + rotation) * 0.045);
            var alongN = height * ringHeights[ring];
            ringList.push(
              builder.addVertex(
                center[0] + u[0] * alongU + v[0] * alongV + n[0] * alongN,
                center[1] + u[1] * alongU + v[1] * alongV + n[1] * alongN,
                center[2] + u[2] * alongU + v[2] * alongV + n[2] * alongN,
                shadeBase + random() * 0.08 - 0.04
              )
            );
          }
          ringIndices.push(ringList);
        }

        for (i = 0; i < ringCount; i += 1) {
          var next = (i + 1) % ringCount;
          builder.addTriangle(top, ringIndices[0][i], ringIndices[0][next]);
        }

        for (ring = 0; ring < ringScales.length - 1; ring += 1) {
          for (i = 0; i < ringCount; i += 1) {
            var inner = ringIndices[ring][i];
            var innerNext = ringIndices[ring][(i + 1) % ringCount];
            var outer = ringIndices[ring + 1][i];
            var outerNext = ringIndices[ring + 1][(i + 1) % ringCount];
            builder.addTriangle(inner, outer, outerNext);
            builder.addTriangle(inner, outerNext, innerNext);
          }
        }

        if (builder.vertices.length / 7 - start > 100) {
          throw new Error('Invalid chip topology.');
        }
      }

      var i;
      var j;
      var centerFront = cookie.addVertex(0, 0, 0.335, 1);
      var ringIndices = [];

      for (i = 0; i < outlineRings.length; i += 1) {
        var profile = outlineRings[i];
        var ringList = [];
        for (j = 0; j < segments; j += 1) {
          var angle = (j / segments) * Math.PI * 2;
          var radialPosition = radiusAt(profile[0], angle);
          var onFrontOrBack = i <= 8 ? 1 : -1;
          var z =
            profile[1] + onFrontOrBack * surfaceBump(profile[0], angle) * (i <= 15 ? 1 : 0);
          ringList.push(
            cookie.addVertex(
              Math.cos(angle) * radialPosition,
              Math.sin(angle) * radialPosition,
              z,
              1
            )
          );
        }
        ringIndices.push(ringList);
      }

      for (j = 0; j < segments; j += 1) {
        cookie.addTriangle(
          centerFront,
          ringIndices[0][j],
          ringIndices[0][(j + 1) % segments]
        );
      }

      for (i = 0; i < ringIndices.length - 1; i += 1) {
        for (j = 0; j < segments; j += 1) {
          var nextJ = (j + 1) % segments;
          var innerVertex = ringIndices[i][j];
          var innerNextVertex = ringIndices[i][nextJ];
          var outerVertex = ringIndices[i + 1][j];
          var outerNextVertex = ringIndices[i + 1][nextJ];
          cookie.addTriangle(innerVertex, outerVertex, outerNextVertex);
          cookie.addTriangle(innerVertex, outerNextVertex, innerNextVertex);
        }
      }

      var centerBack = cookie.addVertex(0, 0, -0.37, 1);
      for (j = 0; j < segments; j += 1) {
        cookie.addTriangle(
          centerBack,
          ringIndices[ringIndices.length - 1][(j + 1) % segments],
          ringIndices[ringIndices.length - 1][j]
        );
      }

      frontChipSpecs.forEach(function (spec, index) {
        var x = spec[0] * radius;
        var y = spec[1] * radius;
        var z = sampleSurface(x, y, true) - 0.018;
        var chipRadius = spec[2] * radius;
        var ellipse = 0.84 + random() * 0.24;
        frontChips.push({
          x: x,
          y: y,
          z: z,
          radius: chipRadius * 1.2
        });
        addChip(
          chips,
          [x, y, z],
          [0, 0, 1],
          chipRadius * (0.92 + random() * 0.12),
          chipRadius * ellipse,
          chipRadius * (0.58 + random() * 0.12),
          spec[3] + index * 0.13,
          0.9 + random() * 0.08
        );
      });

      backChipSpecs.forEach(function (spec, index) {
        var x = spec[0] * radius;
        var y = spec[1] * radius;
        var z = sampleSurface(x, y, false) + 0.018;
        var chipRadius = spec[2] * radius;
        backChips.push({
          x: x,
          y: y,
          z: z,
          radius: chipRadius * 1.18
        });
        addChip(
          chips,
          [x, y, z],
          [0, 0, -1],
          chipRadius * (0.92 + random() * 0.14),
          chipRadius * (0.82 + random() * 0.18),
          chipRadius * (0.55 + random() * 0.12),
          spec[3] + index * 0.11,
          0.9 + random() * 0.09
        );
      });

      sideChipSpecs.forEach(function (spec, index) {
        var angle = spec[0];
        var outerRadius = radiusAt(0.987, angle);
        var normal = [Math.cos(angle), Math.sin(angle), spec[1] * 1.5];
        normalizeVector(normal);
        var chipRadius = spec[2] * radius;
        var center = [
          Math.cos(angle) * (outerRadius - 0.011),
          Math.sin(angle) * (outerRadius - 0.011),
          spec[1]
        ];
        sideChips.push({ center: center, radius: chipRadius });
        addChip(
          chips,
          center,
          normal,
          chipRadius * (0.92 + random() * 0.15),
          chipRadius * (0.66 + random() * 0.16),
          chipRadius * 0.42,
          index * 0.81,
          0.91 + random() * 0.08
        );
      });

      for (i = 0; i < cookie.vertices.length; i += 7) {
        var x = cookie.vertices[i];
        var y = cookie.vertices[i + 1];
        var z = cookie.vertices[i + 2];
        var occlusion = 0;
        var relevantChips = z >= -0.015 ? frontChips : backChips;

        for (j = 0; j < relevantChips.length; j += 1) {
          var chip = relevantChips[j];
          var dx = x - chip.x;
          var dy = y - chip.y;
          var distance = Math.sqrt(dx * dx + dy * dy);
          var influence = 1 - clamp(distance / chip.radius, 0, 1);
          occlusion += influence * influence * 0.11;
        }

        for (j = 0; j < sideChips.length; j += 1) {
          var sideChip = sideChips[j];
          var sideDx = x - sideChip.center[0];
          var sideDy = y - sideChip.center[1];
          var sideDz = z - sideChip.center[2];
          var sideDistance = Math.sqrt(
            sideDx * sideDx + sideDy * sideDy + sideDz * sideDz * 0.6
          );
          var sideInfluence = 1 - clamp(sideDistance / (sideChip.radius * 1.25), 0, 1);
          occlusion += sideInfluence * sideInfluence * 0.09;
        }

        cookie.vertices[i + 6] =
          (0.965 + Math.sin(x * 29 + y * 17 + z * 41) * 0.025) *
          (1 - Math.min(0.36, occlusion));
      }

      return {
        cookie: cookie.finish(),
        chips: chips.finish()
      };
    }

    function compileShader(context, type, source) {
      var shader = context.createShader(type);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        var log = context.getShaderInfoLog(shader) || 'Unknown shader compile error.';
        context.deleteShader(shader);
        throw new Error(log);
      }
      return shader;
    }

    function createProgram(context, vertexSource, fragmentSource) {
      var vertexShader = compileShader(context, context.VERTEX_SHADER, vertexSource);
      var fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentSource);
      var program = context.createProgram();
      context.attachShader(program, vertexShader);
      context.attachShader(program, fragmentShader);
      context.linkProgram(program);
      context.deleteShader(vertexShader);
      context.deleteShader(fragmentShader);

      if (!context.getProgramParameter(program, context.LINK_STATUS)) {
        var log = context.getProgramInfoLog(program) || 'Unknown WebGL link error.';
        context.deleteProgram(program);
        throw new Error(log);
      }
      return program;
    }

    function uploadMesh(context, geometry) {
      var vertexBuffer = context.createBuffer();
      var indexBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
      context.bufferData(context.ARRAY_BUFFER, geometry.vertices, context.STATIC_DRAW);
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
      context.bufferData(context.ELEMENT_ARRAY_BUFFER, geometry.indices, context.STATIC_DRAW);
      return {
        vertexBuffer: vertexBuffer,
        indexBuffer: indexBuffer,
        indexCount: geometry.indices.length
      };
    }

    function createShadowMesh(context) {
      var vertices = new Float32Array([
        -2.42, -1.59, -1.18, 0, 0,
        2.42, -1.59, -1.18, 1, 0,
        2.42, -1.59, 1.36, 1, 1,
        -2.42, -1.59, 1.36, 0, 1
      ]);
      var indices = new Uint16Array([0, 2, 1, 0, 3, 2]);
      var vertexBuffer = context.createBuffer();
      var indexBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
      context.bufferData(context.ARRAY_BUFFER, vertices, context.STATIC_DRAW);
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
      context.bufferData(context.ELEMENT_ARRAY_BUFFER, indices, context.STATIC_DRAW);
      return {
        vertexBuffer: vertexBuffer,
        indexBuffer: indexBuffer,
        indexCount: indices.length
      };
    }

    function initializeRenderer() {
      var options = {
        alpha: true,
        antialias: true,
        depth: true,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      };
      gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
      if (!gl) {
        throw new Error('WebGL is unavailable.');
      }

      materialProgram = createProgram(gl, MATERIAL_VERTEX_SHADER, MATERIAL_FRAGMENT_SHADER);
      shadowProgram = createProgram(gl, SHADOW_VERTEX_SHADER, SHADOW_FRAGMENT_SHADER);
      materialLocations = {
        position: gl.getAttribLocation(materialProgram, 'aPosition'),
        normal: gl.getAttribLocation(materialProgram, 'aNormal'),
        shade: gl.getAttribLocation(materialProgram, 'aShade'),
        model: gl.getUniformLocation(materialProgram, 'uModel'),
        viewProjection: gl.getUniformLocation(materialProgram, 'uViewProjection'),
        cameraPosition: gl.getUniformLocation(materialProgram, 'uCameraPosition'),
        material: gl.getUniformLocation(materialProgram, 'uMaterial'),
        time: gl.getUniformLocation(materialProgram, 'uTime')
      };
      shadowLocations = {
        position: gl.getAttribLocation(shadowProgram, 'aPosition'),
        uv: gl.getAttribLocation(shadowProgram, 'aUv'),
        viewProjection: gl.getUniformLocation(shadowProgram, 'uViewProjection'),
        strength: gl.getUniformLocation(shadowProgram, 'uStrength')
      };

      if (!cpuGeometry) {
        cpuGeometry = buildGeometry();
      }
      cookieMesh = uploadMesh(gl, cpuGeometry.cookie);
      chipMesh = uploadMesh(gl, cpuGeometry.chips);
      shadowMesh = createShadowMesh(gl);

      gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1);
      gl.depthFunc(gl.LEQUAL);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
      rendererReady = true;
      contextLost = false;
      hideFallback();
      canvas.classList.add('cookie-canvas--ready');
      stage.classList.add('cookie-stage--ready');

      if (!interactionsBound) {
        bindInteractions();
        interactionsBound = true;
      } else {
        canvas.setAttribute('tabindex', '0');
        canvas.setAttribute(
          'aria-keyshortcuts',
          'ArrowUp ArrowDown ArrowLeft ArrowRight Home'
        );
      }
      resizeCanvas();
      wake();
    }

    function perspectiveMatrix(out, fieldOfView, aspect, near, far) {
      var f = 1 / Math.tan(fieldOfView / 2);
      var range = 1 / (near - far);
      out[0] = f / aspect;
      out[1] = 0;
      out[2] = 0;
      out[3] = 0;
      out[4] = 0;
      out[5] = f;
      out[6] = 0;
      out[7] = 0;
      out[8] = 0;
      out[9] = 0;
      out[10] = (far + near) * range;
      out[11] = -1;
      out[12] = 0;
      out[13] = 0;
      out[14] = 2 * far * near * range;
      out[15] = 0;
    }

    function lookAtMatrix(out, eyeX, eyeY, eyeZ, targetX, targetY, targetZ) {
      var zX = eyeX - targetX;
      var zY = eyeY - targetY;
      var zZ = eyeZ - targetZ;
      var zLength = Math.sqrt(zX * zX + zY * zY + zZ * zZ);
      zX /= zLength;
      zY /= zLength;
      zZ /= zLength;

      var xX = zZ;
      var xY = 0;
      var xZ = -zX;
      var xLength = Math.sqrt(xX * xX + xZ * xZ);
      xX /= xLength;
      xY /= xLength;
      xZ /= xLength;

      var yX = zY * xZ - zZ * 0;
      var yY = zZ * xX - zX * xZ;
      var yZ = zX * 0 - zY * xX;

      out[0] = xX;
      out[1] = yX;
      out[2] = zX;
      out[3] = 0;
      out[4] = xY;
      out[5] = yY;
      out[6] = zY;
      out[7] = 0;
      out[8] = xZ;
      out[9] = yZ;
      out[10] = zZ;
      out[11] = 0;
      out[12] = -(xX * eyeX + xY * eyeY + xZ * eyeZ);
      out[13] = -(yX * eyeX + yY * eyeY + yZ * eyeZ);
      out[14] = -(zX * eyeX + zY * eyeY + zZ * eyeZ);
      out[15] = 1;
    }

    function multiplyMatrices(out, a, b) {
      var column;
      var row;
      for (column = 0; column < 4; column += 1) {
        for (row = 0; row < 4; row += 1) {
          out[column * 4 + row] =
            a[row] * b[column * 4] +
            a[4 + row] * b[column * 4 + 1] +
            a[8 + row] * b[column * 4 + 2] +
            a[12 + row] * b[column * 4 + 3];
        }
      }
    }

    function resizeCanvas() {
      if (!gl || !rendererReady) {
        return;
      }

      var rect = canvas.getBoundingClientRect();
      var cssWidth = Math.max(1, rect.width || stage.clientWidth || 1);
      var cssHeight = Math.max(1, rect.height || stage.clientHeight || cssWidth);
      var deviceScale = Math.min(window.devicePixelRatio || 1, cssWidth < 520 ? 1.75 : 2);
      var pixelWidth = Math.max(1, Math.round(cssWidth * deviceScale));
      var pixelHeight = Math.max(1, Math.round(cssHeight * deviceScale));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      gl.viewport(0, 0, pixelWidth, pixelHeight);
      var aspect = cssWidth / cssHeight;
      perspectiveMatrix(
        projectionMatrix,
        37 * (Math.PI / 180),
        aspect,
        0.1,
        36
      );
      var cameraDistance = 5.72 / Math.min(1, aspect);
      cameraPosition[0] = 0;
      cameraPosition[1] = 0.17;
      cameraPosition[2] = cameraDistance;
      lookAtMatrix(viewMatrix, cameraPosition[0], cameraPosition[1], cameraPosition[2], 0, -0.055, 0);
      multiplyMatrices(viewProjectionMatrix, projectionMatrix, viewMatrix);
      wake();
    }

    function createModelMatrix(rotationA, rotationB, rotationC, yOffset) {
      var cx = Math.cos(rotationA);
      var sx = Math.sin(rotationA);
      var cy = Math.cos(rotationB);
      var sy = Math.sin(rotationB);
      var cz = Math.cos(rotationC);
      var sz = Math.sin(rotationC);

      modelMatrix[0] = cz * cy;
      modelMatrix[1] = sz * cy;
      modelMatrix[2] = -sy;
      modelMatrix[3] = 0;
      modelMatrix[4] = cz * sy * sx - sz * cx;
      modelMatrix[5] = sz * sy * sx + cz * cx;
      modelMatrix[6] = cy * sx;
      modelMatrix[7] = 0;
      modelMatrix[8] = cz * sy * cx + sz * sx;
      modelMatrix[9] = sz * sy * cx - cz * sx;
      modelMatrix[10] = cy * cx;
      modelMatrix[11] = 0;
      modelMatrix[12] = 0;
      modelMatrix[13] = yOffset;
      modelMatrix[14] = 0;
      modelMatrix[15] = 1;
    }

    function bindMaterialMesh(mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
      gl.enableVertexAttribArray(materialLocations.position);
      gl.enableVertexAttribArray(materialLocations.normal);
      gl.enableVertexAttribArray(materialLocations.shade);
      gl.vertexAttribPointer(materialLocations.position, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(materialLocations.normal, 3, gl.FLOAT, false, 28, 12);
      gl.vertexAttribPointer(materialLocations.shade, 1, gl.FLOAT, false, 28, 24);
    }

    function draw() {
      if (!rendererReady || !gl || contextLost) {
        return;
      }

      var floatAmount = reducedMotion ? 0.035 : 0.055 * idleWeight;
      var floatY = 0.055 + (reducedMotion ? 0 : Math.sin(idleTime * 1.08) * floatAmount);
      var wobbleX =
        rotationX + (reducedMotion ? 0 : Math.sin(idleTime * 0.61) * 0.028 * idleWeight);
      var wobbleY = rotationY + idleRotation;
      var wobbleZ =
        -0.075 + (reducedMotion ? 0 : Math.sin(idleTime * 0.47) * 0.024 * idleWeight);
      createModelMatrix(wobbleX, wobbleY, wobbleZ, floatY);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(shadowProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadowMesh.vertexBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shadowMesh.indexBuffer);
      gl.enableVertexAttribArray(shadowLocations.position);
      gl.enableVertexAttribArray(shadowLocations.uv);
      gl.vertexAttribPointer(shadowLocations.position, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(shadowLocations.uv, 2, gl.FLOAT, false, 20, 12);
      gl.uniformMatrix4fv(shadowLocations.viewProjection, false, viewProjectionMatrix);
      gl.uniform1f(shadowLocations.strength, shadowStrength - floatY * 0.05);
      gl.drawElements(gl.TRIANGLES, shadowMesh.indexCount, gl.UNSIGNED_SHORT, 0);

      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.useProgram(materialProgram);
      gl.uniformMatrix4fv(materialLocations.model, false, modelMatrix);
      gl.uniformMatrix4fv(materialLocations.viewProjection, false, viewProjectionMatrix);
      gl.uniform3fv(materialLocations.cameraPosition, cameraPosition);
      gl.uniform1f(materialLocations.time, idleTime);

      bindMaterialMesh(cookieMesh);
      gl.uniform1f(materialLocations.material, 0);
      gl.drawElements(gl.TRIANGLES, cookieMesh.indexCount, gl.UNSIGNED_SHORT, 0);

      bindMaterialMesh(chipMesh);
      gl.uniform1f(materialLocations.material, 1);
      gl.drawElements(gl.TRIANGLES, chipMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    function updateMotion(deltaSeconds) {
      if (reducedMotion || deltaSeconds <= 0) {
        return;
      }

      var targetWeight = dragged ? 0 : 1;
      idleWeight += (targetWeight - idleWeight) * Math.min(1, deltaSeconds * 2.8);
      idleTime += deltaSeconds * idleWeight;

      if (!dragged) {
        rotationX += velocityX * deltaSeconds;
        rotationY += velocityY * deltaSeconds;
        var speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        var damping = Math.exp(-4.8 * deltaSeconds);
        velocityX *= damping;
        velocityY *= damping;
        if (Math.abs(velocityX) < 0.0005) {
          velocityX = 0;
        }
        if (Math.abs(velocityY) < 0.0005) {
          velocityY = 0;
        }
        idleRotation +=
          deltaSeconds * 0.115 * idleWeight * clamp(1 - speed / 1.8, 0.08, 1);
      }
    }

    function onFrame(timestamp) {
      animationFrame = 0;
      if (!rendererReady || contextLost || !documentVisible || !inViewport) {
        lastFrameTime = 0;
        return;
      }

      var deltaSeconds =
        lastFrameTime > 0 ? clamp((timestamp - lastFrameTime) / 1000, 0, 0.04) : 1 / 60;
      lastFrameTime = timestamp;
      updateMotion(deltaSeconds);
      draw();

      if (!reducedMotion) {
        wake();
      }
    }

    function wake() {
      if (
        rendererReady &&
        !contextLost &&
        documentVisible &&
        inViewport &&
        animationFrame === 0
      ) {
        animationFrame = window.requestAnimationFrame(onFrame);
      }
    }

    function pause() {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      lastFrameTime = 0;
    }

    function endPointer(event, canceled) {
      if (event.pointerId !== pointerId) {
        return;
      }

      if (canceled || (event.timeStamp && event.timeStamp - pointerTime > 125)) {
        velocityX = 0;
        velocityY = 0;
      }
      pointerId = null;
      dragged = false;
      stage.classList.remove('cookie-stage--dragging');
      canvas.classList.remove('cookie-canvas--dragging');
      if (
        event.type !== 'lostpointercapture' &&
        canvas.hasPointerCapture &&
        canvas.hasPointerCapture(event.pointerId)
      ) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch (ignore) {}
      }
      if (reducedMotion) {
        velocityX = 0;
        velocityY = 0;
      }
      wake();
    }

    function bindInteractions() {
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight Home');
      if (!originalAriaLabel) {
        canvas.setAttribute(
          'aria-label',
          'Interactive three-dimensional chocolate chip cookie. Drag or use the arrow keys to rotate it.'
        );
      }
      canvas.setAttribute('draggable', 'false');

      canvas.addEventListener('pointerdown', function (event) {
        if (
          pointerId !== null ||
          (event.pointerType === 'mouse' && event.button !== 0)
        ) {
          return;
        }
        event.preventDefault();
        pointerId = event.pointerId;
        pointerX = event.clientX;
        pointerY = event.clientY;
        pointerTime = event.timeStamp || performance.now();
        velocityX = 0;
        velocityY = 0;
        dragged = true;
        stage.classList.add('cookie-stage--dragging');
        canvas.classList.add('cookie-canvas--dragging');
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (ignore) {}
        try {
          canvas.focus({ preventScroll: true });
        } catch (ignore) {
          canvas.focus();
        }
        wake();
      });

      canvas.addEventListener(
        'pointermove',
        function (event) {
          if (event.pointerId !== pointerId) {
            return;
          }
          event.preventDefault();
          var now = event.timeStamp || performance.now();
          var elapsed = clamp((now - pointerTime) / 1000, 0.008, 0.06);
          var deltaX = event.clientX - pointerX;
          var deltaY = event.clientY - pointerY;
          var horizontalRotation = deltaX * 0.0085;
          var verticalRotation = deltaY * 0.0085;
          rotationY += horizontalRotation;
          rotationX += verticalRotation;
          velocityY = velocityY * 0.48 + clamp(horizontalRotation / elapsed, -5.6, 5.6) * 0.52;
          velocityX = velocityX * 0.48 + clamp(verticalRotation / elapsed, -5.6, 5.6) * 0.52;
          pointerX = event.clientX;
          pointerY = event.clientY;
          pointerTime = now;
          wake();
        },
        { passive: false }
      );

      canvas.addEventListener('pointerup', function (event) {
        endPointer(event, false);
      });
      canvas.addEventListener('pointercancel', function (event) {
        endPointer(event, true);
      });
      canvas.addEventListener('lostpointercapture', function (event) {
        endPointer(event, true);
      });
      canvas.addEventListener('dragstart', function (event) {
        event.preventDefault();
      });
      canvas.addEventListener('keydown', function (event) {
        var step = event.shiftKey ? 0.24 : 0.11;
        var handled = true;
        velocityX = 0;
        velocityY = 0;
        switch (event.key) {
          case 'ArrowLeft':
            rotationY -= step;
            break;
          case 'ArrowRight':
            rotationY += step;
            break;
          case 'ArrowUp':
            rotationX -= step;
            break;
          case 'ArrowDown':
            rotationX += step;
            break;
          case 'Home':
            rotationX = -0.24;
            rotationY = -0.28;
            idleRotation = 0;
            idleTime = 0;
            break;
          default:
            handled = false;
        }
        if (handled) {
          event.preventDefault();
          wake();
        }
      });
    }

    function showFallback() {
      stage.classList.remove('cookie-stage--ready');
      stage.classList.add('cookie-stage--fallback');
      canvas.classList.remove('cookie-canvas--ready');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('tabindex', '-1');

      if (fallback) {
        return;
      }

      fallback = document.createElement('div');
      fallback.className = 'cookie-3d-fallback';
      fallback.setAttribute('role', 'img');
      fallback.setAttribute(
        'aria-label',
        'Static illustration of a golden chocolate chip cookie. The interactive three-dimensional preview is unavailable.'
      );

      var visual = document.createElement('div');
      visual.className = 'cookie-3d-fallback__cookie';
      visual.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 11; i += 1) {
        var chip = document.createElement('span');
        chip.className = 'cookie-3d-fallback__chip';
        visual.appendChild(chip);
      }

      var note = document.createElement('span');
      note.className = 'cookie-3d-fallback__note';
      note.textContent = 'Static preview · 3D unavailable';
      note.setAttribute('aria-hidden', 'true');

      fallback.appendChild(visual);
      fallback.appendChild(note);
      stage.appendChild(fallback);
    }

    function hideFallback() {
      stage.classList.remove('cookie-stage--fallback');
      if (fallback && fallback.parentNode) {
        fallback.parentNode.removeChild(fallback);
      }
      fallback = null;
      if (originalAriaHidden === null) {
        canvas.removeAttribute('aria-hidden');
      } else {
        canvas.setAttribute('aria-hidden', originalAriaHidden);
      }
      if (originalTabIndex === null) {
        canvas.removeAttribute('tabindex');
      } else {
        canvas.setAttribute('tabindex', originalTabIndex);
      }
    }

    function handleContextLoss(event) {
      event.preventDefault();
      contextLost = true;
      rendererReady = false;
      pause();
      showFallback();
    }

    function handleContextRestore() {
      try {
        initializeRenderer();
      } catch (error) {
        rendererReady = false;
        showFallback();
        if (window.console && console.warn) {
          console.warn('Crumb & Co. cookie preview could not be restored.', error);
        }
      }
    }

    canvas.addEventListener('webglcontextlost', handleContextLoss, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestore, false);

    if ('ResizeObserver' in window) {
      resizeObserver = new window.ResizeObserver(function () {
        resizeCanvas();
      });
      resizeObserver.observe(stage);
    }
    window.addEventListener('resize', resizeCanvas, { passive: true });

    if ('IntersectionObserver' in window) {
      observer = new window.IntersectionObserver(
        function (entries) {
          var entry = entries[0];
          inViewport = Boolean(entry && entry.isIntersecting);
          if (inViewport) {
            lastFrameTime = 0;
            wake();
          } else {
            pause();
          }
        },
        { rootMargin: '120px 0px', threshold: 0.01 }
      );
      observer.observe(stage);
    }

    document.addEventListener('visibilitychange', function () {
      documentVisible = document.visibilityState !== 'hidden';
      if (documentVisible) {
        lastFrameTime = 0;
        wake();
      } else {
        pause();
      }
    });

    if (prefersReducedMotion) {
      var handleMotionPreference = function (event) {
        reducedMotion = event.matches;
        velocityX = 0;
        velocityY = 0;
        lastFrameTime = 0;
        if (reducedMotion) {
          pause();
        }
        wake();
      };
      if (prefersReducedMotion.addEventListener) {
        prefersReducedMotion.addEventListener('change', handleMotionPreference);
      } else if (prefersReducedMotion.addListener) {
        prefersReducedMotion.addListener(handleMotionPreference);
      }
    }

    try {
      initializeRenderer();
    } catch (error) {
      rendererReady = false;
      showFallback();
      if (window.console && console.warn) {
        console.warn('Crumb & Co. interactive cookie is using its static fallback.', error);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
