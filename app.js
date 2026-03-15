
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";

const weapons = [
  {
    name: "AK-47",
    type: "Assault Rifle",
    rarity: "Black Market",
    modelPath: "assets/firearms/models/firearms/assault_rifles/ak47/ak47.json",
  },
  {
    name: "Dragunov",
    type: "Sniper",
    rarity: "Elite",
    modelPath: "assets/firearms/models/firearms/snipers/dragunov/dragunov.json",
  },
  {
    name: "Fire Katana",
    type: "Legendary Blade",
    rarity: "Event Drop",
    modelPath: "assets/lionos_forge/models/katanas_vol_1/fire_katana.json",
  },
  {
    name: "Cosmic Katana",
    type: "Mythic Blade",
    rarity: "Ultra Rare",
    modelPath: "assets/lionos_forge/models/katanas_vol_1/cosmic_katana.json",
  },
];

const listEl = document.getElementById("weapon-list");
const viewerNoteEl = document.getElementById("viewer-note");
const weaponNameEl = document.getElementById("weapon-name");
const weaponMetaEl = document.getElementById("weapon-meta");
const viewerEl = document.getElementById("viewer");

for (const weapon of weapons) {
  const button = document.createElement("button");
  button.className = "weapon-button";
  button.innerHTML = `<strong>${weapon.name}</strong><span>${weapon.type} • ${weapon.rarity}</span>`;
  button.addEventListener("click", () => selectWeapon(weapon, button));
  listEl.appendChild(button);
  weapon.button = button;
}

let currentGroup = null;
let currentRaf = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f17);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
camera.position.set(0, 0.4, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewerEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 12;
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 1.65);
key.position.set(4, 6, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x80c8ff, 0.65);
rim.position.set(-6, -2, -5);
scene.add(rim);

const gridGlow = new THREE.Mesh(
  new THREE.CircleGeometry(6.5, 64),
  new THREE.MeshBasicMaterial({ color: 0x142130, transparent: true, opacity: 0.65 })
);
gridGlow.rotation.x = -Math.PI / 2;
gridGlow.position.y = -2.4;
scene.add(gridGlow);

const loadingOverlay = document.createElement("div");
loadingOverlay.className = "loading-overlay";
loadingOverlay.textContent = "Loading model…";
viewerEl.appendChild(loadingOverlay);

function resize() {
  const width = viewerEl.clientWidth;
  const height = viewerEl.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function animate() {
  currentRaf = requestAnimationFrame(animate);
  if (currentGroup) {
    currentGroup.rotation.y += 0.006;
    currentGroup.rotation.x = Math.sin(performance.now() * 0.00055) * 0.08 - 0.12;
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();

async function selectWeapon(weapon, button) {
  for (const item of weapons) item.button.classList.remove("active");
  button.classList.add("active");
  weaponNameEl.textContent = weapon.name;
  weaponMetaEl.textContent = `${weapon.type} • ${weapon.rarity}`;
  viewerNoteEl.textContent = `Rendering live from ${weapon.modelPath}. This viewer reads the included resource-pack JSON and PNG textures directly in the browser.`;
  loadingOverlay.style.display = "grid";

  if (currentGroup) {
    disposeGroup(currentGroup);
    scene.remove(currentGroup);
    currentGroup = null;
  }

  try {
    const group = await loadMinecraftModel(weapon.modelPath);
    currentGroup = group;
    scene.add(group);
  } catch (err) {
    console.error(err);
    loadingOverlay.textContent = "Could not load model.";
  } finally {
    loadingOverlay.style.display = "none";
  }
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose?.();
    if (Array.isArray(obj.material)) obj.material.forEach((m) => disposeMaterial(m));
    else if (obj.material) disposeMaterial(obj.material);
  });
}
function disposeMaterial(material) {
  if (material.map) material.map.dispose?.();
  material.dispose?.();
}

async function loadMinecraftModel(modelPath) {
  const model = await fetch(modelPath).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${modelPath}`);
    return r.json();
  });

  const root = modelPath.split("/models/")[0];
  const textureDefs = model.textures || {};
  const textureMap = {};

  for (const [key, value] of Object.entries(textureDefs)) {
    if (key === "particle" || typeof value !== "string" || value.startsWith("#")) continue;
    const texture = await new THREE.TextureLoader().loadAsync(resolveTexturePath(value, root));
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    textureMap[`#${key}`] = texture;
  }

  const elements = model.elements || [];
  const prepared = computeBounds(elements);
  const holder = new THREE.Group();
  holder.scale.setScalar(3.35 / prepared.longest);
  holder.position.set(-prepared.center.x * holder.scale.x, -prepared.center.y * holder.scale.x, -prepared.center.z * holder.scale.x);

  for (const element of elements) {
    const mesh = buildElementMesh(element, model.texture_size || [16, 16], textureMap);
    holder.add(mesh);
  }

  const wrapper = new THREE.Group();
  wrapper.add(holder);
  return wrapper;
}

function computeBounds(elements) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const e of elements) {
    minX = Math.min(minX, e.from[0], e.to[0]);
    minY = Math.min(minY, e.from[1], e.to[1]);
    minZ = Math.min(minZ, e.from[2], e.to[2]);
    maxX = Math.max(maxX, e.from[0], e.to[0]);
    maxY = Math.max(maxY, e.from[1], e.to[1]);
    maxZ = Math.max(maxZ, e.from[2], e.to[2]);
  }
  const center = new THREE.Vector3((minX + maxX)/2, (minY + maxY)/2, (minZ + maxZ)/2);
  const longest = Math.max(maxX-minX, maxY-minY, maxZ-minZ, 1);
  return { center, longest };
}

function buildElementMesh(element, textureSize, textureMap) {
  const from = element.from;
  const to = element.to;
  const size = [Math.max(0.001, to[0]-from[0]), Math.max(0.001, to[1]-from[1]), Math.max(0.001, to[2]-from[2])];
  const center = [(from[0]+to[0])/2, (from[1]+to[1])/2, (from[2]+to[2])/2];
  const geometry = new THREE.BoxGeometry(...size);

  const materials = [
    buildFaceMaterial(element.faces?.east, textureSize, textureMap),
    buildFaceMaterial(element.faces?.west, textureSize, textureMap),
    buildFaceMaterial(element.faces?.up, textureSize, textureMap),
    buildFaceMaterial(element.faces?.down, textureSize, textureMap),
    buildFaceMaterial(element.faces?.south, textureSize, textureMap),
    buildFaceMaterial(element.faces?.north, textureSize, textureMap),
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  const rotation = element.rotation;
  if (!rotation) {
    mesh.position.set(...center);
    return mesh;
  }

  const pivot = rotation.origin || center;
  const group = new THREE.Group();
  group.position.set(...pivot);
  const angle = THREE.MathUtils.degToRad(rotation.angle || 0);
  if (rotation.axis === "x") group.rotation.x = angle;
  if (rotation.axis === "y") group.rotation.y = angle;
  if (rotation.axis === "z") group.rotation.z = angle;
  mesh.position.set(center[0]-pivot[0], center[1]-pivot[1], center[2]-pivot[2]);
  group.add(mesh);
  return group;
}

function buildFaceMaterial(face, textureSize, textureMap) {
  if (!face?.texture || !textureMap[face.texture]) {
    return new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  const baseTexture = textureMap[face.texture];
  const texture = baseTexture.clone();
  texture.needsUpdate = true;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const [u1, v1, u2, v2] = face.uv || [0, 0, textureSize[0], textureSize[1]];
  const minU = Math.min(u1, u2) / textureSize[0];
  const maxU = Math.max(u1, u2) / textureSize[0];
  const minV = Math.min(v1, v2) / textureSize[1];
  const maxV = Math.max(v1, v2) / textureSize[1];

  texture.repeat.set(maxU - minU, maxV - minV);
  texture.offset.set(minU, 1 - maxV);
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(face.rotation || 0);

  return new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    metalness: 0.04,
    roughness: 0.82,
  });
}

function resolveTexturePath(textureRef, root) {
  const relative = textureRef.includes(":") ? textureRef.split(":")[1] : textureRef;
  return `${root}/textures/${relative}.png`;
}

selectWeapon(weapons[0], weapons[0].button);
