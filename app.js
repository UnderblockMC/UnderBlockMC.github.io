import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const WEAPONS = [
  {
    id: 'ak47',
    name: 'AK-47',
    type: 'Assault rifle',
    pack: 'firearms',
    model: './assets/firearms/models/firearms/assault_rifles/ak47/ak47.json',
  },
  {
    id: 'dragunov',
    name: 'Dragunov',
    type: 'Sniper rifle',
    pack: 'firearms',
    model: './assets/firearms/models/firearms/snipers/dragunov/dragunov.json',
  },
  {
    id: 'fire_katana',
    name: 'Fire Katana',
    type: 'Katana',
    pack: 'lionos_forge',
    model: './assets/lionos_forge/models/katanas_vol_1/fire_katana.json',
  },
  {
    id: 'cosmic_katana',
    name: 'Cosmic Katana',
    type: 'Katana',
    pack: 'lionos_forge',
    model: './assets/lionos_forge/models/katanas_vol_1/cosmic_katana.json',
  },
];

const viewerEl = document.getElementById('viewer');
const listEl = document.getElementById('weaponList');
const metaName = document.getElementById('metaName');
const metaType = document.getElementById('metaType');
const metaPack = document.getElementById('metaPack');
const resetViewBtn = document.getElementById('resetView');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1118);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 10, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewerEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 80;
controls.target.set(0, 3, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(18, 24, 16);
scene.add(key);
const fill = new THREE.DirectionalLight(0x8fb4ff, 0.4);
fill.position.set(-14, 12, -18);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshBasicMaterial({ color: 0x111824, transparent: true, opacity: 0.55 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -8;
scene.add(floor);

let currentGroup = null;
let currentAnimationFrame = 0;
const textureLoader = new THREE.TextureLoader();

function buildWeaponButtons() {
  WEAPONS.forEach((weapon, index) => {
    const button = document.createElement('button');
    button.className = 'weapon-btn';
    button.innerHTML = `<strong>${weapon.name}</strong><small>${weapon.type}</small>`;
    button.addEventListener('click', () => loadWeapon(weapon.id));
    if (index === 0) button.classList.add('active');
    listEl.appendChild(button);
    weapon.button = button;
  });
}

function setActiveButton(id) {
  WEAPONS.forEach((weapon) => weapon.button.classList.toggle('active', weapon.id === id));
}

function resizeRenderer() {
  const width = viewerEl.clientWidth || 800;
  const height = viewerEl.clientHeight || 620;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resizeRenderer);
resizeRenderer();

function resolveTexture(baseDir, ref) {
  if (!ref || ref.startsWith('#')) return null;
  const parts = ref.split(':');
  const relative = (parts.length === 2 ? parts[1] : parts[0]) + '.png';
  const path = './assets/' + (parts.length === 2 ? parts[0] : '') + '/textures/' + relative;
  return path.replace('/./', '/');
}

function createInvisibleMaterial() {
  return new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function applyTextureTransform(texture, uv, textureSize, rotationDeg = 0) {
  const [u1, v1, u2, v2] = uv || [0, 0, textureSize[0], textureSize[1]];
  const minU = Math.min(u1, u2) / textureSize[0];
  const maxU = Math.max(u1, u2) / textureSize[0];
  const minV = Math.min(v1, v2) / textureSize[1];
  const maxV = Math.max(v1, v2) / textureSize[1];
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.repeat.set(maxU - minU, maxV - minV);
  texture.offset.set(minU, 1 - maxV);
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(rotationDeg || 0);
}

function faceMaterial(face, textures, textureSize) {
  if (!face?.texture || !textures[face.texture]) return createInvisibleMaterial();
  const tex = textures[face.texture].clone();
  applyTextureTransform(tex, face.uv, textureSize, face.rotation || 0);
  return new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    metalness: 0.0,
    roughness: 1.0,
  });
}

function buildMeshFromModel(model, textures) {
  const root = new THREE.Group();
  const textureSize = model.texture_size || [16, 16];
  const boundsMin = [Infinity, Infinity, Infinity];
  const boundsMax = [-Infinity, -Infinity, -Infinity];

  for (const element of model.elements || []) {
    const from = element.from;
    const to = element.to;
    for (let i = 0; i < 3; i++) {
      boundsMin[i] = Math.min(boundsMin[i], from[i], to[i]);
      boundsMax[i] = Math.max(boundsMax[i], from[i], to[i]);
    }

    const size = [
      Math.max(0.01, to[0] - from[0]),
      Math.max(0.01, to[1] - from[1]),
      Math.max(0.01, to[2] - from[2]),
    ];
    const center = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    const rotation = element.rotation || { angle: 0, axis: 'y', origin: center };
    const pivot = rotation.origin || center;
    const euler = new THREE.Euler(
      rotation.axis === 'x' ? THREE.MathUtils.degToRad(rotation.angle || 0) : 0,
      rotation.axis === 'y' ? THREE.MathUtils.degToRad(rotation.angle || 0) : 0,
      rotation.axis === 'z' ? THREE.MathUtils.degToRad(rotation.angle || 0) : 0,
      'XYZ'
    );

    const materials = [
      faceMaterial(element.faces?.east, textures, textureSize),
      faceMaterial(element.faces?.west, textures, textureSize),
      faceMaterial(element.faces?.up, textures, textureSize),
      faceMaterial(element.faces?.down, textures, textureSize),
      faceMaterial(element.faces?.south, textures, textureSize),
      faceMaterial(element.faces?.north, textures, textureSize),
    ];

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(...pivot);
    pivotGroup.rotation.copy(euler);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), materials);
    mesh.position.set(center[0] - pivot[0], center[1] - pivot[1], center[2] - pivot[2]);
    pivotGroup.add(mesh);
    root.add(pivotGroup);
  }

  const size = boundsMax.map((v, i) => v - boundsMin[i]);
  const longest = Math.max(...size, 1);
  const center = boundsMin.map((v, i) => (v + boundsMax[i]) / 2);
  root.position.set(-center[0], -center[1], -center[2]);
  const scale = 16 / longest;
  root.scale.setScalar(scale);
  return root;
}

async function loadTextures(model) {
  const textureRefs = Object.entries(model.textures || {}).filter(([k, v]) => k !== 'particle' && typeof v === 'string' && !v.startsWith('#'));
  const loaded = {};
  await Promise.all(textureRefs.map(([key, ref]) => new Promise((resolve, reject) => {
    const path = resolveTexture('', ref);
    textureLoader.load(path, (texture) => {
      loaded['#' + key] = texture;
      resolve();
    }, undefined, reject);
  })));
  return loaded;
}

async function loadWeapon(id) {
  currentAnimationFrame += 1;
  const requestId = currentAnimationFrame;
  const weapon = WEAPONS.find((item) => item.id === id);
  if (!weapon) return;

  setActiveButton(id);
  metaName.textContent = weapon.name;
  metaType.textContent = weapon.type;
  metaPack.textContent = weapon.pack;

  viewerEl.classList.add('loading');

  try {
    const response = await fetch(weapon.model);
    if (!response.ok) throw new Error('Could not load model file.');
    const model = await response.json();
    const textures = await loadTextures(model);
    if (requestId !== currentAnimationFrame) return;

    if (currentGroup) {
      scene.remove(currentGroup);
      disposeGroup(currentGroup);
      currentGroup = null;
    }

    currentGroup = buildMeshFromModel(model, textures);
    scene.add(currentGroup);
    resetCamera();
  } catch (error) {
    console.error(error);
    if (currentGroup) {
      scene.remove(currentGroup);
      disposeGroup(currentGroup);
      currentGroup = null;
    }
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x7c8798, roughness: 0.9 })
    );
    currentGroup = new THREE.Group();
    currentGroup.add(fallback);
    scene.add(currentGroup);
  } finally {
    viewerEl.classList.remove('loading');
  }
}

function disposeGroup(group) {
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
    else if (child.material) disposeMaterial(child.material);
  });
}
function disposeMaterial(material) {
  if (material.map) material.map.dispose();
  material.dispose();
}

function resetCamera() {
  camera.position.set(0, 8, 28);
  controls.target.set(0, 2, 0);
  controls.update();
}
resetViewBtn.addEventListener('click', resetCamera);

function animate() {
  requestAnimationFrame(animate);
  if (currentGroup) currentGroup.rotation.y += 0.005;
  controls.update();
  renderer.render(scene, camera);
}

buildWeaponButtons();
loadWeapon(WEAPONS[0].id);
animate();
