
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const weapons = [
  {
    name: "AK-47",
    type: "Assault Rifle",
    model: "assets/firearms/models/firearms/assault_rifles/ak47/ak47.json",
  },
  {
    name: "Dragunov",
    type: "Sniper",
    model: "assets/firearms/models/firearms/snipers/dragunov/dragunov.json",
  },
  {
    name: "Fire Katana",
    type: "Katana",
    model: "assets/lionos_forge/models/katanas_vol_1/fire_katana.json",
  },
  {
    name: "Cosmic Katana",
    type: "Katana",
    model: "assets/lionos_forge/models/katanas_vol_1/cosmic_katana.json",
  },
];

const list = document.getElementById("weapon-list");
const titleEl = document.getElementById("viewer-title");
const metaEl = document.getElementById("viewer-meta");
const statusEl = document.getElementById("viewer-status");

for (const [index, weapon] of weapons.entries()) {
  const button = document.createElement("button");
  button.className = "weapon-item" + (index === 0 ? " active" : "");
  button.innerHTML = `<strong>${weapon.name}</strong><small>${weapon.type}</small>`;
  button.addEventListener("click", () => selectWeapon(weapon, button));
  list.appendChild(button);
}

for (const button of document.querySelectorAll('.copy-ip')) {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => button.textContent = original, 1200);
    } catch {
      alert(button.dataset.copy);
    }
  });
}

const viewer = createViewer(document.getElementById("viewer"));
selectWeapon(weapons[0], list.firstElementChild);

async function selectWeapon(weapon, button) {
  document.querySelectorAll('.weapon-item').forEach(el => el.classList.remove('active'));
  button.classList.add('active');
  titleEl.textContent = weapon.name;
  metaEl.textContent = weapon.type;
  statusEl.textContent = 'Loading model…';
  try {
    await viewer.loadWeapon(weapon.model);
    statusEl.textContent = 'Drag to rotate.';
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'Could not load this model.';
  }
}

function createViewer(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f141d);

  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 30;

  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(8, 10, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ca9ff, 1.0);
  rim.position.set(-6, 2, -8);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x101722, roughness: 0.95, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.5;
  scene.add(floor);

  let current = null;
  const textureLoader = new THREE.TextureLoader();

  async function loadWeapon(modelPath) {
    if (current) {
      scene.remove(current);
      disposeGroup(current);
      current = null;
    }
    const model = await fetch(modelPath).then(r => {
      if (!r.ok) throw new Error(`Missing model: ${modelPath}`);
      return r.json();
    });

    const rootPath = modelPath.split('/models/')[0];
    const textures = {};
    for (const [key, value] of Object.entries(model.textures || {})) {
      if (key === 'particle' || typeof value !== 'string' || value.startsWith('#')) continue;
      const path = resolveTexturePath(rootPath, value);
      const tex = await textureLoader.loadAsync(path);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      textures[`#${key}`] = tex;
    }

    current = buildModelGroup(model, textures);
    scene.add(current);
    frameObject(current);
  }

  function frameObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
    object.position.y -= box.min.y + size.y * 0.1;

    const maxSide = Math.max(size.x, size.y, size.z, 1);
    camera.position.set(maxSide * 1.4, maxSide * 0.8, maxSide * 1.6);
    controls.target.set(0, size.y * 0.15, 0);
    controls.update();
  }

  function animate() {
    requestAnimationFrame(animate);
    if (current) current.rotation.y += 0.004;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return { loadWeapon };
}

function buildModelGroup(model, textures) {
  const textureSize = model.texture_size || [16, 16];
  const group = new THREE.Group();

  for (const element of model.elements || []) {
    const from = element.from;
    const to = element.to;
    const size = [
      Math.max(0.01, to[0] - from[0]),
      Math.max(0.01, to[1] - from[1]),
      Math.max(0.01, to[2] - from[2]),
    ];
    const center = [
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2,
      (from[2] + to[2]) / 2,
    ];

    const materials = [
      buildMaterial(element.faces?.east, textureSize, textures),
      buildMaterial(element.faces?.west, textureSize, textures),
      buildMaterial(element.faces?.up, textureSize, textures),
      buildMaterial(element.faces?.down, textureSize, textures),
      buildMaterial(element.faces?.south, textureSize, textures),
      buildMaterial(element.faces?.north, textureSize, textures),
    ];

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), materials);
    mesh.position.set(...center);

    if (element.rotation) {
      const pivot = new THREE.Group();
      pivot.position.set(...element.rotation.origin);
      mesh.position.sub(pivot.position);
      const angle = THREE.MathUtils.degToRad(element.rotation.angle || 0);
      if (element.rotation.axis === 'x') pivot.rotation.x = angle;
      if (element.rotation.axis === 'y') pivot.rotation.y = angle;
      if (element.rotation.axis === 'z') pivot.rotation.z = angle;
      pivot.add(mesh);
      group.add(pivot);
    } else {
      group.add(mesh);
    }
  }

  return group;
}

function buildMaterial(face, textureSize, textures) {
  if (!face || !face.texture || !textures[face.texture]) {
    return new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false });
  }
  const tex = textures[face.texture].clone();
  const [u1, v1, u2, v2] = face.uv || [0, 0, textureSize[0], textureSize[1]];
  const minU = Math.min(u1, u2) / textureSize[0];
  const maxU = Math.max(u1, u2) / textureSize[0];
  const minV = Math.min(v1, v2) / textureSize[1];
  const maxV = Math.max(v1, v2) / textureSize[1];
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(Math.max(maxU - minU, 0.0001), Math.max(maxV - minV, 0.0001));
  tex.offset.set(minU, 1 - maxV);
  tex.rotation = THREE.MathUtils.degToRad(face.rotation || 0);
  tex.center.set(0.5, 0.5);
  tex.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.05 });
}

function resolveTexturePath(rootPath, ref) {
  const [, relative] = ref.includes(':') ? ref.split(':') : ['minecraft', ref];
  return `${rootPath}/textures/${relative}.png`;
}

function disposeGroup(group) {
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(mat => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    }
  });
}
