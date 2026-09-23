/* Maple Leaf Motors — Three.js background scene v2.0 (daylight prairie highway)
   Fixed canvas behind all content. Live traffic in both directions, tumbling
   maple leaves, turning wind turbines, hazy skyline, scroll + pointer camera. */
(function () {
  'use strict';

  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IS_MOBILE = window.innerWidth < 768;
  const LEAF_COUNT = IS_MOBILE ? 55 : 140;

  const COLORS = {
    skyTop: 0xe9eef3,
    horizon: 0xfbf6f1,
    fog: 0xf6f0ea,
    fieldA: 0xeae3d8,
    fieldB: 0xf0e4c6,
    asphalt: '#6b6f76',
    city: 0xd3d9e0,
    red: 0xd2102e,
  };

  function init() {
    if (typeof THREE === 'undefined') { setTimeout(init, 60); return; }

    const canvas = document.createElement('canvas');
    canvas.id = 'mlm-bg-scene';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;display:block;';
    document.body.insertBefore(canvas, document.body.firstChild);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, alpha: false, powerPreference: 'low-power' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1 : 1.5));
    renderer.setClearColor(COLORS.horizon, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.fog, 40, 260);

    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 700);

    /* Lights: soft daylight */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dccb, 1.35));
    const sun = new THREE.DirectionalLight(0xfff3e6, 1.6);
    sun.position.set(-30, 60, 20);
    scene.add(sun);

    scene.add(makeSky());
    scene.add(makeSun());
    scene.add(makeTerrain());
    const road = makeRoad();
    scene.add(road.mesh);
    scene.add(makeSkyline());
    const turbines = makeTurbines();
    scene.add(turbines);
    const traffic = makeTraffic();
    scene.add(traffic);
    const leaves = makeLeaves(LEAF_COUNT);
    scene.add(leaves.mesh);

    /* Camera state driven by scroll (GSAP) + pointer parallax */
    const cam = { x: IS_MOBILE ? 0 : -16, y: 14, z: 26, lookY: 1 };
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    if (!REDUCE_MOTION && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      bindScrollCamera(cam);
      gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' });
    }
    if (!REDUCE_MOTION && !IS_MOBILE) {
      addEventListener('pointermove', e => {
        pointer.x = e.clientX / innerWidth - 0.5;
        pointer.y = e.clientY / innerHeight - 0.5;
      }, { passive: true });
    }

    const clock = new THREE.Clock();
    const lookTarget = new THREE.Vector3();
    (function loop() {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (!REDUCE_MOTION) {
        road.texture.offset.y += dt * 0.06;
        updateTraffic(traffic, dt);
        updateLeaves(leaves, dt, t);
        turbines.children.forEach((tb, i) => { tb.userData.rotor.rotation.z += dt * (0.6 + i * 0.12); });
      }

      pointer.sx += (pointer.x - pointer.sx) * 0.04;
      pointer.sy += (pointer.y - pointer.sy) * 0.04;
      camera.position.set(cam.x + pointer.sx * 6, cam.y - pointer.sy * 2.5, cam.z);
      lookTarget.set(cam.x * 0.85 + pointer.sx * 4, cam.lookY, cam.z - 45);
      camera.lookAt(lookTarget);

      renderer.render(scene, camera);
    })();

    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  }

  /* ── Sky dome: warm horizon fading to pale sky ── */
  function makeSky() {
    const geo = new THREE.SphereGeometry(500, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(COLORS.skyTop) }, bottom: { value: new THREE.Color(COLORS.horizon) } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.45, h)), 1.0); }'
    });
    return new THREE.Mesh(geo, mat);
  }

  /* ── Soft sun glow low on the horizon ── */
  function makeSun() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,236,214,1)');
    g.addColorStop(0.25, 'rgba(255,214,190,0.55)');
    g.addColorStop(1, 'rgba(255,214,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true }));
    sprite.scale.set(220, 220, 1);
    sprite.position.set(-60, 30, -420);
    return sprite;
  }

  /* ── Rolling prairie with field stripes; flat along the road ── */
  function makeTerrain() {
    const geo = new THREE.PlaneGeometry(700, 700, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const a = new THREE.Color(COLORS.fieldA), b = new THREE.Color(COLORS.fieldB), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const away = Math.max(0, Math.abs(x) - 24);
      const h = away > 0 ? (Math.sin(x * 0.045) * Math.cos(z * 0.03) * 5 + Math.sin(z * 0.08 + x * 0.02) * 2) * Math.min(1, away / 40) : 0;
      pos.setY(i, h - 0.3);
      const stripe = (Math.floor((x + 400) / 38) + Math.floor((z + 400) / 52)) % 2;
      tmp.copy(stripe ? a : b).lerp(new THREE.Color(0xffffff), Math.random() * 0.08);
      tmp.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.position.z = -200;
    return mesh;
  }

  function makeRoad() {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) {           // subtle asphalt grain
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    ctx.strokeStyle = '#f4f4f4';
    ctx.lineWidth = 5;
    [s * 0.25, s * 0.75].forEach(x => {        // lane dashes
      ctx.setLineDash([46, 44]);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = '#e4b53a';               // yellow centre double line
    ctx.lineWidth = 4;
    [s / 2 - 6, s / 2 + 6].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); });
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    [14, s - 14].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); });

    const texture = new THREE.CanvasTexture(c);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 22);
    texture.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 700), new THREE.MeshLambertMaterial({ map: texture }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.05, -300);
    return { mesh, texture };
  }

  /* ── Distant hazy skyline (fog does the atmospheric fade) ── */
  function makeSkyline() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.city });
    for (let i = 0; i < 26; i++) {
      const w = 5 + Math.random() * 7, h = 8 + Math.random() * 34, d = 5 + Math.random() * 5;
      const side = i % 2 ? 1 : -1;
      const x = side * (22 + Math.random() * 70);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, h / 2 - 0.3, -190 - Math.random() * 60);
      g.add(m);
    }
    return g;
  }

  /* ── Wind turbines on the hills ── */
  function makeTurbines() {
    const g = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const spots = [[-70, -120], [-95, -150], [80, -110], [110, -165], [-130, -95]];
    spots.forEach(([x, z], i) => {
      const t = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 26, 8), white);
      tower.position.y = 13;
      t.add(tower);
      const rotor = new THREE.Group();
      rotor.position.set(0, 26, 0.8);
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), white));
      for (let k = 0; k < 3; k++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 0.15), white);
        blade.position.y = 5.5;
        const arm = new THREE.Group();
        arm.rotation.z = (k * Math.PI * 2) / 3;
        arm.add(blade);
        rotor.add(arm);
      }
      rotor.rotation.z = i;
      t.add(rotor);
      t.userData.rotor = rotor;
      t.position.set(x, 2 + (i % 2) * 3, z);
      t.rotation.y = x > 0 ? -0.4 : 0.4;
      g.add(t);
    });
    return g;
  }

  /* ── Traffic: two lanes each way, cars loop along the highway ── */
  function makeTraffic() {
    const g = new THREE.Group();
    const paints = [0xd2102e, 0xffffff, 0xc9ced6, 0x2b2f36, 0xd2102e, 0xf2f2f2, 0x8d949e];
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fb4c8 });
    const tire = new THREE.MeshLambertMaterial({ color: 0x1d1f23 });
    const head = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
    const tail = new THREE.MeshBasicMaterial({ color: 0xff2a3d });
    const lanes = [{ x: -11, dir: 1 }, { x: -4, dir: 1 }, { x: 4, dir: -1 }, { x: 11, dir: -1 }];
    const count = IS_MOBILE ? 8 : 14;

    for (let i = 0; i < count; i++) {
      const lane = lanes[i % lanes.length];
      const truck = i % 5 === 3;
      const paint = new THREE.MeshLambertMaterial({ color: paints[i % paints.length] });
      const car = new THREE.Group();
      const len = truck ? 6 : 4.6;

      const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, len), paint);
      body.position.y = 0.72;
      car.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, truck ? 2.2 : 2.4), paint);
      cab.position.set(0, 1.42, truck ? -1 : 0.1);
      car.add(cab);
      const wind = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.05), glass);
      wind.position.set(0, 1.42, (truck ? -1 : 0.1) - (truck ? 1.12 : 1.22));
      car.add(wind);

      const wheels = [];
      const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
      [[-1.15, len * 0.3], [1.15, len * 0.3], [-1.15, -len * 0.3], [1.15, -len * 0.3]].forEach(([wx, wz]) => {
        const w = new THREE.Mesh(wg, tire);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.42, wz);
        car.add(w);
        wheels.push(w);
      });
      const lg = new THREE.BoxGeometry(0.4, 0.2, 0.05);
      [-0.75, 0.75].forEach(lx => {
        const f = new THREE.Mesh(lg, head); f.position.set(lx, 0.8, -len / 2 - 0.01); car.add(f);
        const r = new THREE.Mesh(lg, tail); r.position.set(lx, 0.8, len / 2 + 0.01); car.add(r);
      });

      // dir 1 = driving toward the camera (+z), -1 = driving away
      car.rotation.y = lane.dir === 1 ? Math.PI : 0;
      car.position.set(lane.x, 0, -290 + Math.random() * 300);
      car.userData = { dir: lane.dir, speed: 14 + Math.random() * 10, wheels };
      g.add(car);
    }
    return g;
  }

  function updateTraffic(g, dt) {
    g.children.forEach(car => {
      const d = car.userData;
      car.position.z += d.dir * d.speed * dt;
      if (car.position.z > 12) car.position.z = -300;
      if (car.position.z < -300) car.position.z = 12;
      d.wheels.forEach(w => { w.rotation.x += d.speed * dt / 0.42; });
    });
  }

  /* ── Tumbling 3D maple leaves (single instanced draw call) ── */
  function makeLeaves(count) {
    const shape = new THREE.Shape();
    const pts = [[0, 1], [0.2, 0.5], [0.6, 0.62], [0.4, 0.2], [1, 0.3], [0.7, -0.1], [1, -0.4], [0.5, -0.3], [0.3, -0.9], [0, -0.7],
      [-0.3, -0.9], [-0.5, -0.3], [-1, -0.4], [-0.7, -0.1], [-1, 0.3], [-0.4, 0.2], [-0.6, 0.62], [-0.2, 0.5]];
    shape.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(p => shape.lineTo(p[0], p[1]));
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const palette = [0xd2102e, 0xe0352a, 0xb80d25, 0xf0642f, 0xd2102e];
    const state = [];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      state.push(spawnLeaf({}, true));
      mesh.setColorAt(i, col.setHex(palette[i % palette.length]));
    }
    return { mesh, state, dummy: new THREE.Object3D() };
  }

  function spawnLeaf(s, anywhere) {
    s.x = (Math.random() - 0.5) * 90;
    s.y = anywhere ? Math.random() * 40 : 38 + Math.random() * 8;
    s.z = -Math.random() * 100 - 4;
    s.fall = 1.2 + Math.random() * 1.6;
    s.sway = 0.6 + Math.random() * 1.4;
    s.phase = Math.random() * Math.PI * 2;
    s.spin = new THREE.Vector3(Math.random() * 2, Math.random() * 2, Math.random());
    s.rot = new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    s.scale = 0.35 + Math.random() * 0.45;
    return s;
  }

  function updateLeaves(leaves, dt, t) {
    const { mesh, state, dummy } = leaves;
    for (let i = 0; i < state.length; i++) {
      const s = state[i];
      s.y -= s.fall * dt;
      s.x += Math.sin(t * s.sway + s.phase) * dt * 1.6 + dt * 0.8;   // light prevailing wind
      s.rot.x += s.spin.x * dt; s.rot.y += s.spin.y * dt; s.rot.z += s.spin.z * dt;
      if (s.y < -0.2 || s.x > 60) spawnLeaf(s, false);
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.copy(s.rot);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /* ── Scroll camera: glides down the highway as the page scrolls ── */
  function bindScrollCamera(cam) {
    const k = IS_MOBILE ? 0 : 1;   // phones keep the road centred
    const stops = [
      { x: -16, y: 14, z: 26, lookY: 1 },
      { x: -20, y: 7, z: 8, lookY: 2 },
      { x: -12, y: 10, z: -12, lookY: 1 },
      { x: -18, y: 20, z: -32, lookY: -2 },
      { x: -22, y: 6, z: -48, lookY: 3 },
      { x: -14, y: 12, z: -62, lookY: 0 },
    ];
    const tl = gsap.timeline({ scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 1.6 } });
    stops.slice(1).forEach(s => tl.to(cam, Object.assign({ ease: 'sine.inOut', duration: 1 }, s, { x: s.x * k })));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
