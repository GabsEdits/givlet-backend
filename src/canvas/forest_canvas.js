import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
//import { getUserFromCookie } from '/user.ts';
import { generateRandomUser, saveUserToCookie, getUserFromCookie } from '../lib/user.ts';
import { io } from 'socket.io-client';

// GET USER COOKIES
/*const user = getUserFromCookie(document.cookie);
if (user) {
  const { id, randomName, randomProfilePicture } = user;
  console.log('UUID:', id);
  console.log('Name:', randomName);
  console.log('Avatar URL:', randomProfilePicture);
} else {
  console.log('No user cookie found.');
}*/
// try to read an existing user…
let user = getUserFromCookie(document.cookie);

// …if there isn't one, create & save it
if (!user) {
  user = generateRandomUser();
  // here we actually write to the browser’s cookie store:
  saveUserToCookie(user, cookieString => {
    document.cookie = cookieString;
  });
}

console.log('UUID:', user.id);
console.log('Name:', user.name);
console.log('Avatar URL:', user.profilePicture);



// SEEDED PRNG (mulberry32)
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// GENERATE TREE LOCATIONS BASED ON SEED
function generatePoints(count, seed, spacing = 6, y = 0) {
  const rand = mulberry32(seed);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const halfJitter = spacing * 0.4;
  const pts = [];
  for (let j = 0; j < rows && pts.length < count; j++) {
    for (let i = 0; i < cols && pts.length < count; i++) {
      const x0 = i * spacing, z0 = j * spacing;
      const dx = (rand() * 2 - 1) * halfJitter;
      const dz = (rand() * 2 - 1) * halfJitter;
      pts.push(new THREE.Vector3(x0 + dx, y, z0 + dz));
    }
  }
  return pts;
}

// SCENE SETUP
const container = document.getElementById('three-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(
    window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 0x060621 // DARK MODE
        : 0xcccccc // LIGHT MODE
);

const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

const controls = new OrbitControls(camera, renderer.domElement);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// PLACEHOLDER TEMPLATE
const phGeo = new THREE.CylinderGeometry(1, 1, 0.1, 9, 1);
const phMat = new THREE.MeshBasicMaterial({
  color: 0x2f71ff,
  transparent: true,
  opacity: 0.4
});

// DATA & STATE
const TREE_COUNT = 2000;
const TREE_SPACING = 6;
const TREE_Y = 0;

const treePosition = generatePoints(TREE_COUNT, 4096, TREE_SPACING, TREE_Y);
let treeFilled = []; // TO HOLD NULL OR UUID
const placeholderMeshes = [];

let loadedModel       = null;
let animateStarted    = false;

// SOCKET.IO SETUP
const socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 3
  }); // PROXIED BY VITE TO ws://localhost:3000/socket.io
socket.on('connect', () => console.log('[socket] connected as', socket.id));
socket.on('connect_error', err => console.error('[socket] connect_error', err));
socket.on('disconnect', () => console.log('[socket] disconnected'));
socket.on('error', err => console.error('[socket] error', err));

// CLONE & PLACE A REAL TREE AT INDEX i
function addTreeInstance(i) {
  const inst = loadedModel.clone(true);
  inst.rotation.y = Math.random() * Math.PI * 2;
  inst.position.copy(treePosition[i]);
  scene.add(inst);
}

// BUILD PLACEHOLDERS FOR ALL THE EMPTY SLOTS
function updatePlaceholders() {
  // REMOVE OLD PLACEHOLDERS
  placeholderMeshes.forEach(m => scene.remove(m));
  placeholderMeshes.length = 0;

  // ADD NEW PLACEHOLDERS
  treePosition.forEach((pt, i) => {
    if (!treeFilled[i]) {
      const ph = new THREE.Mesh(phGeo, phMat.clone());
      ph.position.copy(pt);
      ph.userData.index = i;
      scene.add(ph);
      placeholderMeshes.push(ph);
    }
  });
}

// INITIAL STATE FROM SERVER
socket.on('init', data => {
  treeFilled = data;
  // PLACE ANY PRE-FILLED TREES
  if (loadedModel) {
    treeFilled.forEach((uuid, i) => {
      if (uuid) addTreeInstance(i);
    });
  }
  updatePlaceholders();
  if (!animateStarted) {
    animate();
    animateStarted = true;
  }
});

// REAL-TIME UPDATE
socket.on('treePlaced', ({ index, uuid }) => {
  treeFilled[index] = uuid;
  // PLACE NEW TREES
  if (loadedModel) addTreeInstance(index);
  updatePlaceholders();
});

// LOAD TREE MODEL
new GLTFLoader()
  .loadAsync('/models/tree.glb')
  .then(gltf => {
    loadedModel = gltf.scene;
    // IF PRE-FILLED FROM INIT?
    treeFilled.forEach((uuid, i) => {
      if (uuid) addTreeInstance(i);
    });
    updatePlaceholders();
    if (!animateStarted) {
      animate();
      animateStarted = true;
    }
  })
  .catch(err => console.error('Error loading tree.glb:', err));

// HHANDLE INTERACTION
function updateHover(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = new Set(raycaster.intersectObjects(placeholderMeshes).map(i => i.object));
  placeholderMeshes.forEach(m => {
    m.material.opacity = hits.has(m) ? 1 : 0.4;
  });
}

function handleClick() {
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObjects(placeholderMeshes)[0];
  if (!hit) return;
  const idx = hit.object.userData.index;
  // ask server to place
  console.log('[user]', user);
  socket.emit('placeTree', { index: idx, uuid: user.id, name: user.name, pfp: user.profilePicture });
}

renderer.domElement.addEventListener('pointermove', updateHover);
renderer.domElement.addEventListener('click', handleClick);

// RENDER LOOP
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
