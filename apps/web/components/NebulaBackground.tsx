"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Reconstructed from Elias-Thorne-Interface-Architect-DESIGN.md's WebGL
// section (the original shader source in that file is truncated) -- full
// custom fidelity per explicit user request, not the simplified CSS
// approximation. Dot-matrix particle field: sparse, black, soft circular
// falloff per point, a slow per-point "breathing pulse" alpha animation,
// and a subtle pointer-position drift. Black dots read as a soft depth-fade
// texture against the page's dark gradient background (visible mostly near
// the gradient's lighter #2a2a2e end, nearly invisible near #09090b) --
// intentionally subtle/meditative, not a bright starfield.
//
// NOT visually verified in a live browser this session (Chrome tooling is
// blocked by site permissions for this environment, including localhost --
// see conversation). Verified: compiles, the page serves without a server
// error, and the shader/Three.js API usage follows the standard
// r150+-stable patterns. Treat the visual result as UNVERIFIED until
// checked in an actual browser.

const POINT_SPACING_PX = 48;
const BREATHE_SPEED = 0.4;
const DRIFT_RADIUS_PX = 400;
const DRIFT_STRENGTH_PX = 6;

const vertexShader = /* glsl */ `
  uniform float u_time;
  uniform vec2 u_mouse;
  attribute float aPhase;
  attribute float aSize;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    vec2 toMouse = u_mouse - pos.xy;
    float dist = length(toMouse);
    float drift = smoothstep(${DRIFT_RADIUS_PX.toFixed(1)}, 0.0, dist) * ${DRIFT_STRENGTH_PX.toFixed(1)};
    pos.xy += normalize(toMouse + vec2(0.0001)) * drift;

    float pulse = 0.5 + 0.5 * sin(u_time * ${BREATHE_SPEED.toFixed(2)} + aPhase);
    vAlpha = pulse;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 + 0.3 * pulse);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    float circle = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(0.0, 0.0, 0.0, circle * vAlpha * 0.35);
  }
`;

function buildPointCloud(width: number, height: number): THREE.Points {
  const cols = Math.ceil(width / POINT_SPACING_PX) + 1;
  const rows = Math.ceil(height / POINT_SPACING_PX) + 1;
  const count = cols * rows;

  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * POINT_SPACING_PX - width / 2;
      const y = height / 2 - row * POINT_SPACING_PX;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 0;
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 1.5 + Math.random() * 2;
      i++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(-9999, -9999) },
    },
  });

  return new THREE.Points(geometry, material);
}

export function NebulaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 10);
    camera.position.z = 1;

    let points = buildPointCloud(width, height);
    scene.add(points);

    const clock = new THREE.Clock();
    let frameId: number;

    const animate = () => {
      const material = points.material as THREE.ShaderMaterial;
      material.uniforms.u_time!.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    const onPointerMove = (event: PointerEvent) => {
      const material = points.material as THREE.ShaderMaterial;
      material.uniforms.u_mouse!.value.set(event.clientX - width / 2, height / 2 - event.clientY);
    };
    window.addEventListener("pointermove", onPointerMove);

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      renderer.setSize(width, height);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();

      scene.remove(points);
      points.geometry.dispose();
      (points.material as THREE.ShaderMaterial).dispose();
      points = buildPointCloud(width, height);
      scene.add(points);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      points.geometry.dispose();
      (points.material as THREE.ShaderMaterial).dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 h-full w-full"
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
