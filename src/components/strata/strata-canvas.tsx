import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface StrataCanvasProps {
  interactive: boolean;
  onTakeover?: () => void;
  speedMultiplier?: number;
}

export function StrataCanvas({
  interactive,
  onTakeover,
}: StrataCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hudStats, setHudStats] = useState({
    speed: 0,
    altitude: 3.2,
    shield: 100,
    boost: 100,
    activeBolts: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c0e);
    scene.fog = new THREE.FogExp2(0x0a0c0e, 0.0075);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      600
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0x22262c, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xdce3eb, 2.2);
    dirLight.position.set(45, 80, -30);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x404854, 1.0);
    fillLight.position.set(-50, 30, 20);
    scene.add(fillLight);

    // --- PROCEDURAL STEPPED CONTOUR TERRAIN ---
    const STEP_HEIGHT = 2.4;
    const MAX_ELEVATION = 42.0;
    const CANYON_WIDTH = 26.0;
    const CHUNK_SIZE = 60.0;
    const CHUNK_SEGS = 30;

    // Fast organic noise function
    function noise2D(x: number, z: number): number {
      const qx = Math.sin(x * 0.024 + 1.2) * Math.cos(z * 0.018 + 0.5);
      const qz = Math.sin(z * 0.028 + 3.4) * Math.cos(x * 0.015 + 2.1);
      const fbm =
        Math.sin(x * 0.012 + qz * 2.1) * 0.5 +
        Math.cos(z * 0.014 + qx * 2.1) * 0.5 +
        Math.sin(x * 0.035 + z * 0.032) * 0.25;
      return (fbm + 1.25) / 2.5;
    }

    function canyonCenterAt(z: number): number {
      return (
        Math.sin(z * 0.008) * 36.0 +
        Math.cos(z * 0.022 + 1.1) * 12.0 +
        Math.sin(z * 0.045) * 4.0
      );
    }

    function sampleRawHeight(x: number, z: number): number {
      const cx = canyonCenterAt(z);
      const distToCanyon = Math.abs(x - cx);
      const baseHeight = noise2D(x, z) * MAX_ELEVATION;

      // Valley carver factor
      const halfWidth = CANYON_WIDTH * 0.5;
      let carveFactor = 1.0;
      if (distToCanyon < halfWidth) {
        carveFactor = 0.0; // Flat canyon floor
      } else if (distToCanyon < halfWidth + 24.0) {
        const t = (distToCanyon - halfWidth) / 24.0;
        carveFactor = t * t * (3.0 - 2.0 * t);
      }

      let height = baseHeight * carveFactor;

      // River island / islet
      const islandPeriod = 160.0;
      const localZ = ((z % islandPeriod) + islandPeriod) % islandPeriod;
      const dz = Math.abs(localZ - islandPeriod * 0.5);
      if (distToCanyon < 6.0 && dz < 18.0) {
        const isletDist = distToCanyon * distToCanyon * 4.0 + dz * dz;
        if (isletDist < 190.0) {
          height = STEP_HEIGHT * 2.0;
        }
      }

      return height;
    }

    function sampleSteppedHeight(x: number, z: number): number {
      const raw = sampleRawHeight(x, z);
      const level = Math.floor(raw / STEP_HEIGHT);
      return level * STEP_HEIGHT;
    }

    // Material for dark matte terrain
    const terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x121417,
      roughness: 0.88,
      metalness: 0.12,
      flatShading: true,
    });

    // Material for chalk-white contour edge lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xe8eff8,
      transparent: true,
      opacity: 0.85,
    });

    // River / lake water plane
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x07090b,
      roughness: 0.18,
      metalness: 0.85,
    });

    type ChunkMesh = {
      cx: number;
      cz: number;
      mesh: THREE.Mesh;
      wireframe: THREE.LineSegments;
      scatterGroup: THREE.Group;
    };

    const activeChunks = new Map<string, ChunkMesh>();

    function buildChunk(cx: number, cz: number): ChunkMesh {
      const minX = cx * CHUNK_SIZE;
      const minZ = cz * CHUNK_SIZE;
      const step = CHUNK_SIZE / CHUNK_SEGS;

      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      const linePositions: number[] = [];
      const scatterGroup = new THREE.Group();

      for (let iz = 0; iz < CHUNK_SEGS; iz++) {
        const z0 = minZ + iz * step;
        const z1 = z0 + step;

        for (let ix = 0; ix < CHUNK_SEGS; ix++) {
          const x0 = minX + ix * step;
          const x1 = x0 + step;

          const h00 = sampleSteppedHeight(x0, z0);
          const h10 = sampleSteppedHeight(x1, z0);
          const h01 = sampleSteppedHeight(x0, z1);
          const h11 = sampleSteppedHeight(x1, z1);

          // Quad faces (2 triangles)
          positions.push(
            x0, h00, z0,
            x1, h10, z0,
            x0, h01, z1,

            x1, h10, z0,
            x1, h11, z1,
            x0, h01, z1
          );

          // Contour step edge detection -> add line segments
          if (Math.abs(h10 - h00) >= STEP_HEIGHT * 0.8) {
            const h = Math.max(h00, h10) + 0.05;
            linePositions.push(x0 + step * 0.5, h, z0, x0 + step * 0.5, h, z1);
          }
          if (Math.abs(h01 - h00) >= STEP_HEIGHT * 0.8) {
            const h = Math.max(h00, h01) + 0.05;
            linePositions.push(x0, h, z0 + step * 0.5, x1, h, z0 + step * 0.5);
          }

          // Scatter: wireframe pine trees on high terraces
          const cx_val = canyonCenterAt(z0);
          const distToCanyon = Math.abs(x0 - cx_val);
          if (distToCanyon > 28.0 && h00 > 12.0 && Math.random() < 0.03) {
            const tree = buildPineTree(x0, h00, z0);
            scatterGroup.add(tree);
          }
        }
      }

      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(geometry, terrainMaterial);

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePositions, 3)
      );
      const wireframe = new THREE.LineSegments(lineGeo, lineMaterial);

      scene.add(mesh);
      scene.add(wireframe);
      scene.add(scatterGroup);

      return { cx, cz, mesh, wireframe, scatterGroup };
    }

    function buildPineTree(x: number, y: number, z: number): THREE.Group {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const levels = 3;
      for (let i = 0; i < levels; i++) {
        const coneGeo = new THREE.ConeGeometry(1.2 - i * 0.3, 1.8, 5);
        const edges = new THREE.EdgesGeometry(coneGeo);
        const line = new THREE.LineSegments(edges, lineMaterial);
        line.position.y = 1.0 + i * 1.1;
        group.add(line);
      }
      return group;
    }

    // River floor water ribbon
    const waterGeo = new THREE.PlaneGeometry(120, 600);
    waterGeo.rotateX(-Math.PI * 0.5);
    const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
    waterMesh.position.y = 0.15;
    scene.add(waterMesh);

    // --- STAR WARS STYLE SPEEDER / SPACESHIP ---
    const shipGroup = new THREE.Group();

    // Fuselage
    const bodyGeo = new THREE.ConeGeometry(0.85, 3.8, 4);
    bodyGeo.rotateX(Math.PI * 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1f242b,
      roughness: 0.4,
      metalness: 0.8,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    shipGroup.add(bodyMesh);

    // Wing vanes (X-wing / Speeder aesthetic)
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x181c22,
      metalness: 0.9,
    });
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.8), wingMat);
    wingL.position.set(-1.1, 0, -0.4);
    wingL.rotateY(0.2);
    shipGroup.add(wingL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.8), wingMat);
    wingR.position.set(1.1, 0, -0.4);
    wingR.rotateY(-0.2);
    shipGroup.add(wingR);

    // Wireframe edge outlines for ship
    const bodyEdges = new THREE.EdgesGeometry(bodyGeo);
    const shipWire = new THREE.LineSegments(
      bodyEdges,
      new THREE.LineBasicMaterial({ color: 0x9eb1c7 })
    );
    shipGroup.add(shipWire);

    // Thruster glow (Twin cyan repulsor ion engines)
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x4df0ff });
    const thrusterGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 8);
    thrusterGeo.rotateX(Math.PI * 0.5);

    const thrustL = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrustL.position.set(-0.6, 0.05, -1.8);
    shipGroup.add(thrustL);

    const thrustR = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrustR.position.set(0.6, 0.05, -1.8);
    shipGroup.add(thrustR);

    scene.add(shipGroup);

    // --- THRUSTER PARTICLE TRAILS & CLOUD SYSTEM ---
    const MAX_PARTICLES = 160;
    const particlePositions = new Float32Array(MAX_PARTICLES * 3);
    const particleSizes = new Float32Array(MAX_PARTICLES);
    const particleAges = new Float32Array(MAX_PARTICLES);
    let particleHead = 0;

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particleGeo.setAttribute("size", new THREE.BufferAttribute(particleSizes, 1));

    const particleMat = new THREE.PointsMaterial({
      color: 0x5ce6ff,
      size: 0.8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // --- BLASTER PROJECTILES ---
    type Blaster = {
      mesh: THREE.Line;
      vel: THREE.Vector3;
      life: number;
    };
    const activeBlasters: Blaster[] = [];
    const blasterMat = new THREE.LineBasicMaterial({
      color: 0x38d9a9,
      linewidth: 2,
    });

    function fireBlaster() {
      const bGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 3.5),
      ]);
      const boltMesh = new THREE.Line(bGeo, blasterMat);
      boltMesh.position.copy(shipGroup.position);
      boltMesh.rotation.copy(shipGroup.rotation);

      const fwd = new THREE.Vector3(0, 0, 1).applyEuler(shipGroup.rotation);
      activeBlasters.push({
        mesh: boltMesh,
        vel: fwd.multiplyScalar(160.0),
        life: 2.0,
      });
      scene.add(boltMesh);
    }

    // --- KEYBOARD CONTROLS ---
    const keys = {
      w: false,
      s: false,
      a: false,
      d: false,
      space: false,
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") keys.w = true;
      if (k === "s" || k === "arrowdown") keys.s = true;
      if (k === "a" || k === "arrowleft") keys.a = true;
      if (k === "d" || k === "arrowright") keys.d = true;
      if (k === " ") {
        keys.space = true;
        if (!interactive && onTakeover) onTakeover();
      }
      if (k === "control" || k === "f") {
        fireBlaster();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") keys.w = false;
      if (k === "s" || k === "arrowdown") keys.s = false;
      if (k === "a" || k === "arrowleft") keys.a = false;
      if (k === "d" || k === "arrowright") keys.d = false;
      if (k === " ") keys.space = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Initial craft state
    let shipX = canyonCenterAt(0);
    let shipZ = 0;
    let shipY = 3.2;
    let shipYaw = 0;
    let shipPitch = 0;
    let shipRoll = 0;
    let shipSpeed = 48.0;

    let lastTime = performance.now();
    let animationFrameId: number;

    // --- MAIN RENDER LOOP ---
    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!interactive) {
        // --- AUTOPILOT / ATTRACT MODE ---
        // Auto-pilot smoothly steers down the winding canyon
        const lookaheadZ = shipZ + 36.0;
        const targetX = canyonCenterAt(lookaheadZ);
        const dx = targetX - shipX;
        const desiredYaw = Math.atan2(dx, 36.0);

        shipYaw += (desiredYaw - shipYaw) * dt * 2.8;
        shipRoll = -(desiredYaw - shipYaw) * 1.4;
        shipSpeed = 52.0;

        shipX += Math.sin(shipYaw) * shipSpeed * dt;
        shipZ += Math.cos(shipYaw) * shipSpeed * dt;
      } else {
        // --- MANUAL PILOT ---
        let steer = 0;
        if (keys.a) steer -= 1;
        if (keys.d) steer += 1;

        let throttle = 0.8;
        if (keys.w) throttle = 1.0;
        if (keys.s) throttle = 0.4;
        if (keys.space) throttle = 1.6; // Boost!

        const targetSpeed = throttle * 60.0;
        shipSpeed += (targetSpeed - shipSpeed) * dt * 3.0;

        shipYaw += steer * 2.2 * dt;
        shipRoll += (-steer * 0.7 - shipRoll) * dt * 7.0;

        shipX += Math.sin(shipYaw) * shipSpeed * dt;
        shipZ += Math.cos(shipYaw) * shipSpeed * dt;
      }

      // Ground hover spring
      const groundH = sampleSteppedHeight(shipX, shipZ);
      const targetHoverY = groundH + 3.2;
      shipY += (targetHoverY - shipY) * dt * 8.0;
      shipPitch = -((targetHoverY - shipY) / 15.0);

      // Apply to 3D ship
      shipGroup.position.set(shipX, shipY, shipZ);
      shipGroup.rotation.set(shipPitch, shipYaw, shipRoll);

      // Update camera (Dynamic chase camera behind the craft)
      const camOffsetDist = 16.0;
      const camOffsetHeight = 5.8;
      const targetCamX = shipX - Math.sin(shipYaw) * camOffsetDist;
      const targetCamZ = shipZ - Math.cos(shipYaw) * camOffsetDist;
      const targetCamY = shipY + camOffsetHeight;

      camera.position.x += (targetCamX - camera.position.x) * dt * 5.0;
      camera.position.y += (targetCamY - camera.position.y) * dt * 5.0;
      camera.position.z += (targetCamZ - camera.position.z) * dt * 5.0;

      const lookAhead = new THREE.Vector3(
        shipX + Math.sin(shipYaw) * 18.0,
        shipY + 1.2,
        shipZ + Math.cos(shipYaw) * 18.0
      );
      camera.lookAt(lookAhead);

      // Water ribbon follows ship Z
      waterMesh.position.z = shipZ;
      waterMesh.position.x = canyonCenterAt(shipZ);

      // Spawn thruster particle
      const pIdx = particleHead % MAX_PARTICLES;
      particlePositions[pIdx * 3] = shipX - Math.sin(shipYaw) * 1.8;
      particlePositions[pIdx * 3 + 1] = shipY;
      particlePositions[pIdx * 3 + 2] = shipZ - Math.cos(shipYaw) * 1.8;
      particleSizes[pIdx] = 0.9;
      particleAges[pIdx] = 0;
      particleHead++;

      // Age particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        particleAges[i] += dt;
        particleSizes[i] += dt * 1.2;
      }
      particleGeo.attributes.position.needsUpdate = true;
      particleGeo.attributes.size.needsUpdate = true;

      // Update blaster bolts
      for (let i = activeBlasters.length - 1; i >= 0; i--) {
        const b = activeBlasters[i];
        b.mesh.position.addScaledVector(b.vel, dt);
        b.life -= dt;
        if (b.life <= 0) {
          scene.remove(b.mesh);
          activeBlasters.splice(i, 1);
        }
      }

      // Stream terrain chunks around the craft
      const centerChunkZ = Math.floor(shipZ / CHUNK_SIZE);
      const centerChunkX = Math.floor(shipX / CHUNK_SIZE);

      const neededKeys = new Set<string>();
      for (let dz = -1; dz <= 5; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const cx = centerChunkX + dx;
          const cz = centerChunkZ + dz;
          const key = `${cx},${cz}`;
          neededKeys.add(key);
          if (!activeChunks.has(key)) {
            activeChunks.set(key, buildChunk(cx, cz));
          }
        }
      }

      // Cull far chunks
      for (const [key, chunk] of activeChunks.entries()) {
        if (!neededKeys.has(key)) {
          scene.remove(chunk.mesh);
          scene.remove(chunk.wireframe);
          scene.remove(chunk.scatterGroup);
          activeChunks.delete(key);
        }
      }

      renderer.render(scene, camera);

      // Update HUD state
      setHudStats({
        speed: Math.round(shipSpeed * 3.6),
        altitude: Math.round((shipY - groundH) * 10) / 10,
        shield: 100,
        boost: keys.space ? 75 : 100,
        activeBolts: activeBlasters.length,
      });
    };

    animationFrameId = requestAnimationFrame(animate);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [interactive, onTakeover]);

  return (
    <div className="relative size-full overflow-hidden select-none">
      <div ref={containerRef} className="size-full" />

      {/* Retro-futuristic Flight HUD */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex items-end justify-between px-8 text-xs font-mono">
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-md">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-wider">SPEED</div>
            <div className="text-sm font-semibold text-white tracking-widest">
              {hudStats.speed} <span className="text-[10px] text-muted-foreground">KM/H</span>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div>
            <div className="text-[10px] text-muted-foreground tracking-wider">ALTITUDE</div>
            <div className="text-sm font-semibold text-emerald-400 tracking-widest">
              {hudStats.altitude} <span className="text-[10px] text-muted-foreground">M</span>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div>
            <div className="text-[10px] text-muted-foreground tracking-wider">SHIELD</div>
            <div className="text-sm font-semibold text-cyan-400 tracking-widest">
              {hudStats.shield}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-md">
          <div className="text-[11px] text-muted-foreground">
            {interactive ? (
              <span className="text-emerald-400 font-medium">
                MANUAL CONTROL: <span className="text-white">WASD / BOOST: SPACE / FIRE: CTRL</span>
              </span>
            ) : (
              <span className="text-cyan-400">
                ATTRACT MODE // AUTONOMOUS CANYON SWEEP ACTIVE
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
