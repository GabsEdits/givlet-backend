import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
//import { getUserFromCookie } from './user.js';

// DEBUG!!
let showAll = false;



/*// GET USER COOKIES
const user = getUserFromCookie();
if (user) {
  const { id, randomName, randomProfilePicture } = user;
  console.log('UUID:', id);
  console.log('Name:', randomName);
  console.log('Avatar URL:', randomProfilePicture);
} else {
  console.log('No user cookie found.');
}
*/

// GET CANVAS CONTAINER
const container = document.getElementById('three-canvas');

// SET UP CONSTANTS
const wallWidth = 10;
const wallHeight = 10;
const brickSize = { x: 0.88, y: 0.36, z: 0.4 };
const startPos = { x: 0, y: 0, z: 0 };

// SET UP ARRAYS
const brickPosition = [];
const brickModel = [];
const brickFilled = [];

// SET UP PLACEHOLDER STORAGE
const placeholderMeshes = [];
let loadedModels = [];

// THREE.JS SETUP
const scene = new THREE.Scene();
scene.background = new THREE.Color(window.matchMedia('(prefers-color-scheme: dark)').matches ? 0x060621 : 0xcccccc);
const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// PLACE CAMERA PROPERLY
camera.position.set(
    (wallWidth  * brickSize.x) / 2,
    (wallHeight * brickSize.y) / 2,
    20
);
camera.lookAt(
    (wallWidth  * brickSize.x) / 2,
    (wallHeight * brickSize.y) / 2,
    0
);

// LIGHTS & CONTROLS
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);
const controls = new OrbitControls(camera, renderer.domElement);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// PLACEHOLDER GEOMETRY/MATERIAL CREATION
const phGeo = new THREE.BoxGeometry(brickSize.x * 0.9, brickSize.y * 0.9, brickSize.z);
const phMat = new THREE.MeshBasicMaterial({
    color: 0x2f71ff,
    transparent: true,
    opacity: 0.4
});

// BUILD WALL DATA
function createWall(h, w, version = 0) {
    for (let row = 0; row < h; row++) {
        const variation = (row + version) % 2;
        for (let col = 0; col < w; col++) {

            const pos = new THREE.Vector3(
                startPos.x + col * brickSize.x + (variation * brickSize.x / 2),
                startPos.y + row * brickSize.y,
                startPos.z
            );

            // MODEL INDEX: 0, 1, 2
            let model = 1;
            if (col === 0) model = 1 + variation;
            else if (col === w-1) model = 1 - variation;

            brickPosition.push(pos);
            brickModel.push(model);
            brickFilled.push(false);
        }
    }
}
createWall(wallHeight, wallWidth);

// HELPERS
function shouldShowPlaceholder(i) {
    if (brickFilled[i]) return false;
    const row = Math.floor(i / wallWidth);
    const col = i % wallWidth;
    if (row === 0) return true;
    const base = (row - 1) * wallWidth;
    const v = row % 2;
    if (v === 0) {
        return (col > 0 && brickFilled[base + col - 1] && brickFilled[base + col]) || showAll;
    } else {
        return (col < wallWidth-1 && brickFilled[base + col] && brickFilled[base + col + 1]) || showAll;
    }
}

function updatePlaceholders() {
  // REMOVE OLD
  placeholderMeshes.forEach(m => scene.remove(m));
  placeholderMeshes.length = 0;
  // ADD NEW
  brickPosition.forEach((pt, i) => {
    if (shouldShowPlaceholder(i)) {
      const ph = new THREE.Mesh(phGeo, phMat.clone());
      ph.position.copy(pt);
      ph.userData.index = i;
      scene.add(ph);
      placeholderMeshes.push(ph);
    }
  });
}

// LOAD MODELS
const urls = ['/models/brick_0.glb', '/models/brick_1.glb', '/models/brick_2.glb'];
new GLTFLoader().loadAsync = function(url) {
    return new Promise((res, rej) => this.load(url, gltf => res(gltf), undefined, rej));
};
Promise.all(urls.map(u => new GLTFLoader().loadAsync(u)))
    .then(gltfs => {
        loadedModels = gltfs.map(g => g.scene);
        updatePlaceholders();
        animate();
    })
    .catch(console.error);

// RAYCAST HOVER AND CLICK
function updateHover(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = new Set(raycaster.intersectObjects(placeholderMeshes).map(i => i.object));
    placeholderMeshes.forEach(m => m.material.opacity = hits.has(m) ? 1 : 0.5);
}

function handleClick() {
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObjects(placeholderMeshes)[0];
  if (!hit) return;
  const idx = hit.object.userData.index;
  // FILL BRICK
  brickFilled[idx] = true;
  scene.remove(hit.object);
  placeholderMeshes.splice(placeholderMeshes.indexOf(hit.object), 1);
  // ADD REAL BRICK
  const inst = loadedModels[brickModel[idx]].clone(true);
  inst.position.copy(brickPosition[idx]);
  inst.rotation.y = Math.PI/2;
  scene.add(inst);
  // REBUILD PLACEHOLDERS
  updatePlaceholders();
}
renderer.domElement.addEventListener('pointermove', updateHover);
renderer.domElement.addEventListener('click', handleClick);

// RENDER LOOP
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
