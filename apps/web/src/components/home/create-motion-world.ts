import * as THREE from 'three';
import { gsap } from 'gsap';

export type WorldVariant = 'hero' | 'film' | 'platform';

/** Original real-time 3D: buildings, moving signals, a rotating core and expanding ground rings. */
export function createMotionWorld(canvas: HTMLCanvasElement, variant: WorldVariant) {
  const dark = variant === 'film';
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, window.innerWidth < 800 ? 1.25 : 1.5),
  );
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 80);
  camera.position.set(10, 8, 11);
  camera.lookAt(0, 0.6, 0);
  const world = new THREE.Group();
  scene.add(world);
  const city = new THREE.Group();
  world.add(city);
  scene.add(new THREE.AmbientLight(0xdce7ff, dark ? 1.5 : 2.3));
  const sunlight = new THREE.DirectionalLight(0xffffff, dark ? 2 : 2.8);
  sunlight.position.set(-5, 12, 6);
  scene.add(sunlight);

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const edgeUnit = new THREE.EdgesGeometry(unit);
  const edgeSource = edgeUnit.getAttribute('position');
  const edges: number[] = [];
  const buildings: { x: number; z: number; height: number; width: number }[] = [];
  for (let x = -4; x <= 4; x++)
    for (let z = -4; z <= 4; z++) {
      if (x === 0 || z === 0 || (x * 11 + z * 13 + 50) % 5 === 0) continue;
      const seed = (((x + 5) * 31 + (z + 5) * 17) % 19) / 19;
      const height = 0.45 + seed * 2.5;
      const width = 0.59 + ((x + z + 10) % 3) * 0.08;
      buildings.push({ x: x * 1.12, z: z * 1.12, height, width });
    }
  const buildingMaterial = new THREE.MeshPhongMaterial({
    color: dark ? 0x284a7d : 0xe4ecff,
    transparent: true,
    opacity: dark ? 0.83 : 0.72,
    shininess: 95,
    specular: dark ? 0x5277ba : 0xffffff,
  });
  const buildingsMesh = new THREE.InstancedMesh(unit, buildingMaterial, buildings.length);
  const dummy = new THREE.Object3D();
  buildings.forEach(({ x, z, height, width }, index) => {
    dummy.position.set(x, height / 2, z);
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    buildingsMesh.setMatrixAt(index, dummy.matrix);
    for (let i = 0; i < edgeSource.count; i++)
      edges.push(
        edgeSource.getX(i) * width + x,
        (edgeSource.getY(i) + 0.5) * height,
        edgeSource.getZ(i) * width + z,
      );
    // Horizontal facade lines articulate the architectural scale without extra meshes.
    for (let y = 0.38; y < height; y += 0.38) {
      edges.push(
        x - width / 2,
        y,
        z - width / 2,
        x + width / 2,
        y,
        z - width / 2,
        x + width / 2,
        y,
        z - width / 2,
        x + width / 2,
        y,
        z + width / 2,
        x + width / 2,
        y,
        z + width / 2,
        x - width / 2,
        y,
        z + width / 2,
        x - width / 2,
        y,
        z + width / 2,
        x - width / 2,
        y,
        z - width / 2,
      );
    }
  });
  city.add(buildingsMesh);
  const cityEdges = new THREE.BufferGeometry();
  cityEdges.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
  city.add(
    new THREE.LineSegments(
      cityEdges,
      new THREE.LineBasicMaterial({
        color: dark ? 0x789fe8 : 0x507df4,
        transparent: true,
        opacity: dark ? 0.7 : 0.47,
      }),
    ),
  );
  edgeUnit.dispose();

  const groundMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBlue: { value: new THREE.Color(dark ? 0x709eff : 0x2c5bff) },
      uStrength: { value: dark ? 0.35 : 0.23 },
    },
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uBlue; uniform float uStrength;
      void main(){vec2 p=(vUv-.5)*16.;vec2 g=abs(fract(p/.56-.5)-.5)/max(fwidth(p/.56),vec2(.001));
      float grid=1.-min(min(g.x,g.y),1.);float d=length(p);float wave=exp(-pow((d-mod(uTime*.9,7.))*5.,2.));
      float fade=1.-smoothstep(4.8,8.2,d);gl_FragColor=vec4(uBlue,(grid*uStrength+wave*.18)*fade);}`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  world.add(ground);

  const hub = new THREE.Group();
  world.add(hub);
  const hubGeometry = new THREE.BoxGeometry(1.25, 1.5, 1.25);
  const hubShell = new THREE.Mesh(
    hubGeometry,
    new THREE.MeshPhongMaterial({
      color: dark ? 0x3a68bb : 0xbdd1ff,
      transparent: true,
      opacity: 0.2,
      shininess: 120,
      depthWrite: false,
    }),
  );
  hubShell.position.y = 0.78;
  hub.add(hubShell);
  const hubEdgeGeometry = new THREE.EdgesGeometry(hubGeometry);
  const hubEdges = new THREE.LineSegments(
    hubEdgeGeometry,
    new THREE.LineBasicMaterial({
      color: dark ? 0xaec5ff : 0x2c5bff,
      transparent: true,
      opacity: 0.9,
    }),
  );
  hubEdges.position.y = 0.78;
  hub.add(hubEdges);
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.43, 0),
    new THREE.MeshPhongMaterial({
      color: 0x2c5bff,
      emissive: 0x123dc0,
      emissiveIntensity: dark ? 0.9 : 0.3,
      shininess: 100,
    }),
  );
  core.position.y = 0.8;
  hub.add(core);
  const ringGeometry = new THREE.RingGeometry(0.97, 1.0, 80);
  const rings = Array.from({ length: 3 }, () => {
    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: dark ? 0x8da4ff : 0x2c5bff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    world.add(ring);
    return ring;
  });
  const orbit = new THREE.Group();
  hub.add(orbit);
  for (let i = 0; i < 3; i++) {
    const satellite = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshBasicMaterial({ color: dark ? 0xaec5ff : 0x2c5bff }),
    );
    const angle = (i * Math.PI * 2) / 3;
    satellite.position.set(Math.cos(angle) * 1.3, 0.5 + i * 0.22, Math.sin(angle) * 1.3);
    orbit.add(satellite);
  }

  const starts = [
    new THREE.Vector3(-4.8, 0.12, 0),
    new THREE.Vector3(0, 0.12, -4.8),
    new THREE.Vector3(4.8, 0.12, 0),
    new THREE.Vector3(0, 0.12, 4.8),
  ];
  const curves = starts.map(
    (start) =>
      new THREE.CubicBezierCurve3(
        start,
        new THREE.Vector3(start.x * 0.65, 0.22, start.z * 0.65),
        new THREE.Vector3(start.x * 0.15, 1.8, start.z * 0.15),
        new THREE.Vector3(0, 0.8, 0),
      ),
  );
  const routes = curves.map((curve) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(56));
    const route = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: dark ? 0x8da4ff : 0x2c5bff,
        transparent: true,
        opacity: 0.3,
      }),
    );
    world.add(route);
    return route;
  });
  const terminals = starts.map((point, index) => {
    const terminal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.06, 24),
      new THREE.MeshBasicMaterial({ color: 0x2c5bff, transparent: true, opacity: 0.75 }),
    );
    terminal.position.copy(point);
    world.add(terminal);
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.012, 4, 40),
      new THREE.MeshBasicMaterial({
        color: dark ? 0x8da4ff : 0x2c5bff,
        transparent: true,
        opacity: 0.5,
      }),
    );
    edge.position.copy(point);
    edge.rotation.x = Math.PI / 2;
    world.add(edge);
    return { mesh: terminal, edge, index };
  });
  const signalCount = 32;
  const signals = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.045, 0.045, 0.14),
    new THREE.MeshBasicMaterial({ color: dark ? 0xd1e0ff : 0x2c5bff }),
    signalCount,
  );
  signals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  world.add(signals);
  const trailPositions = new Float32Array(signalCount * 6);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  world.add(
    new THREE.LineSegments(
      trailGeometry,
      new THREE.LineBasicMaterial({
        color: dark ? 0x8da4ff : 0x2c5bff,
        transparent: true,
        opacity: dark ? 0.5 : 0.35,
      }),
    ),
  );
  const point = new THREE.Vector3();
  const behind = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, 1);
  let elapsed = 0,
    previous = 0,
    frame = 0,
    active = false,
    disposed = false,
    focus = -1,
    targetX = 0,
    targetY = 0,
    pointerX = 0,
    pointerY = 0;
  const intro = gsap.fromTo(
    city.scale,
    { y: 0.08 },
    { y: 1, duration: 1.6, ease: 'power3.out', paused: true },
  );

  function render(now = 0) {
    if (disposed) return;
    // A 30 fps budget keeps the network fluid without continuously saturating mobile GPUs.
    if (active && previous && now - previous < 1000 / 30) {
      frame = requestAnimationFrame(render);
      return;
    }
    if (active) {
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      elapsed += delta;
      previous = now;
    }
    groundMaterial.uniforms.uTime!.value = elapsed;
    core.rotation.set(elapsed * 0.23, elapsed * 0.55, elapsed * 0.16);
    core.position.y = 0.82 + Math.sin(elapsed * 1.4) * 0.13;
    orbit.rotation.y = -elapsed * 0.45;
    pointerX += (targetX - pointerX) * 0.035;
    pointerY += (targetY - pointerY) * 0.035;
    world.rotation.y =
      Math.sin(elapsed * 0.18) * 0.075 + pointerX * 0.11 + (focus < 0 ? 0 : (focus - 1.5) * 0.055);
    world.rotation.x = pointerY * 0.035;
    rings.forEach((ring, index) => {
      const phase = (elapsed * 0.25 + index / 3) % 1;
      ring.scale.setScalar(1 + phase * 2.6);
      ring.material.opacity = (1 - phase) * (dark ? 0.48 : 0.4);
    });
    terminals.forEach(({ edge, index }) => {
      const pulse = 0.9 + Math.sin(elapsed * 2.4 + index) * 0.15;
      edge.scale.setScalar(pulse);
    });
    const positions = trailGeometry.getAttribute('position');
    for (let i = 0; i < signalCount; i++) {
      const route = i % 4;
      const phase = (elapsed * 0.16 + (i / signalCount) * 3) % 1;
      curves[route]!.getPoint(phase, point);
      curves[route]!.getPoint(Math.max(0, phase - 0.065), behind);
      curves[route]!.getTangent(phase, tangent);
      dummy.position.copy(point);
      dummy.scale.setScalar(focus < 0 || focus === route ? 1.2 : 0.55);
      dummy.quaternion.setFromUnitVectors(forward, tangent.normalize());
      dummy.updateMatrix();
      signals.setMatrixAt(i, dummy.matrix);
      positions.setXYZ(i * 2, point.x, point.y, point.z);
      positions.setXYZ(i * 2 + 1, behind.x, behind.y, behind.z);
    }
    signals.instanceMatrix.needsUpdate = true;
    positions.needsUpdate = true;
    renderer.render(scene, camera);
    if (active) frame = requestAnimationFrame(render);
  }
  return {
    resize(width: number, height: number) {
      if (!width || !height || disposed) return;
      renderer.setSize(width, height, false);
      const view = variant === 'hero' ? 9.5 : 10.6;
      const aspect = width / height;
      camera.left = (-view * aspect) / 2;
      camera.right = (view * aspect) / 2;
      camera.top = view / 2;
      camera.bottom = -view / 2;
      camera.updateProjectionMatrix();
      if (!active) render();
    },
    setActive(value: boolean) {
      if (disposed || active === value) return;
      active = value;
      canvas.dataset.animationActive = String(value);
      if (active) {
        previous = 0;
        intro.resume();
        frame = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(frame);
        intro.pause();
      }
    },
    setPointer(x: number, y: number) {
      targetX = x;
      targetY = y;
    },
    setFocus(index: number) {
      focus = index;
      routes.forEach((route, i) => {
        route.material.opacity = index < 0 ? 0.35 : i === index ? 0.85 : 0.13;
      });
      if (!active) render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      cancelAnimationFrame(frame);
      intro.kill();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          const material = object.material;
          if (Array.isArray(material)) material.forEach((m) => materials.add(m));
          else materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
    },
  };
}
