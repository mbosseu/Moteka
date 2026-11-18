/**
 * Tirage du soir FIGHT & Furious x Moteka, au format story 9:16 (three.js r160).
 * Une seule animation enchainee :
 *   1. garage de nuit (beton mouille, faisceaux rouges, neons) : tambour de verre plein de boules
 *      numerotees (vrais numeros de tickets) et afficheur a rouleau qui fait defiler les numeros ;
 *   2. le rouleau ralentit et s'arrete sur le gagnant choisi (enregistre par l'API en mode reel) ;
 *   3. "Felicitations Prenom N. - ticket n. X" ;
 *   4. un ticket a gratter 3D arrive : on le gratte au doigt / a la souris (ou grattage automatique)
 *      et il revele le lot Moteka gagne.
 * Mode demo (?mode=demo) : tirage factice, rien n'est enregistre. Mode reel (?mode=reel) : POST /api/admin/tirage.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ------------------------------------------------------------------ */
/* Parametres                                                          */
/* ------------------------------------------------------------------ */
const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'reel' ? 'reel' : 'demo';
const LOT_DEMANDE = params.get('lot') || '';
const $ = (s) => document.querySelector(s);

const ROUGE = 0xd11414;
const OR = 0xe8c66a;
const POLICE = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => {
  const c1 = 1.4;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const mod = (a, n) => ((a % n) + n) % n;
const hasard = (a, b) => a + Math.random() * (b - a);
const mobile = matchMedia('(pointer: coarse)').matches;

const PRENOMS_DEMO = ['Camille', 'Lucas', 'Sarah', 'Mehdi', 'Julie', 'Thomas', 'Ines', 'Nicolas', 'Lea', 'Karim'];
const LOT_DEMO = { nom: "Location 24 h d'une grosse voiture", description: 'Une grosse voiture à votre disposition pendant 24 heures, offerte par Moteka.' };

/* ------------------------------------------------------------------ */
/* Ressources : polices et logos                                       */
/* ------------------------------------------------------------------ */
function chargerImage(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

async function chargerPolices() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`800 120px ${POLICE}`),
        document.fonts.load(`700 60px ${POLICE}`),
        document.fonts.load(`600 40px ${POLICE}`),
        document.fonts.load('500 30px Barlow'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* polices systeme en secours */
  }
}

const logos = { bc: null, moteka: null };

function dessinerImage(ctx, img, cx, cy, maxW, maxH) {
  if (!img) return 0;
  const r = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * r;
  const h = img.height * r;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  return w;
}

function texteAjuste(ctx, texte, x, y, maxW, taille, poids = 800) {
  let t = taille;
  ctx.font = `${poids} ${t}px ${POLICE}`;
  while (ctx.measureText(texte).width > maxW && t > 10) {
    t -= 2;
    ctx.font = `${poids} ${t}px ${POLICE}`;
  }
  ctx.fillText(texte, x, y);
  return t;
}

function lignesCoupees(ctx, texte, maxW) {
  const mots = String(texte).split(/\s+/);
  const lignes = [];
  let courante = '';
  for (const m of mots) {
    const essai = courante ? `${courante} ${m}` : m;
    if (ctx.measureText(essai).width > maxW && courante) {
      lignes.push(courante);
      courante = m;
    } else courante = essai;
  }
  if (courante) lignes.push(courante);
  return lignes;
}

function textureCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ------------------------------------------------------------------ */
/* Moteur                                                              */
/* ------------------------------------------------------------------ */
const story = $('#story');
const canvas = $('#toile');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060607);
scene.fog = new THREE.FogExp2(0x060607, 0.04);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 120);
scene.add(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function redimensionner() {
  const w = story.clientWidth;
  const h = story.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(redimensionner).observe(story);

/* ------------------------------------------------------------------ */
/* Decor : garage de nuit (meme ambiance que le site du gala)          */
/* ------------------------------------------------------------------ */
function textureBeton() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i += 1) {
    const v = 110 + Math.random() * 110;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  for (let i = 0; i < 16; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 30 + Math.random() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(10,10,10,0.95)');
    grd.addColorStop(1, 'rgba(10,10,10,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

const sol = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, roughnessMap: textureBeton(), metalness: 0.65 })
);
sol.rotation.x = -Math.PI / 2;
sol.position.y = -0.35;
sol.receiveShadow = true;
scene.add(sol);

const mur = new THREE.Mesh(new THREE.PlaneGeometry(60, 16), new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.92 }));
mur.position.set(0, 7, -9);
scene.add(mur);
const neonMat = new THREE.MeshBasicMaterial({ color: ROUGE, toneMapped: false });
for (let i = -3; i <= 3; i += 1) {
  const n = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.05), neonMat);
  n.position.set(i * 3.4, 7.4, -8.9);
  scene.add(n);
}

let banniereTex = null;
function peindreBanniere() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#0e0e0e';
  g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#d11414';
  g.fillRect(0, 0, 1024, 8);
  g.fillRect(0, 152, 1024, 8);
  dessinerImage(g, logos.bc, 300, 80, 360, 118);
  g.fillStyle = '#999b9a';
  g.font = `700 44px ${POLICE}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('x', 512, 80);
  if (!dessinerImage(g, logos.moteka, 740, 80, 380, 60)) {
    g.fillStyle = '#fff';
    g.font = `800 72px ${POLICE}`;
    g.fillText('MOTEKA', 740, 82);
  }
  banniereTex = textureCanvas(c);
  return banniereTex;
}
const banniere = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 1.56),
  new THREE.MeshStandardMaterial({ color: 0x0e0e0e, emissive: 0x000000, emissiveIntensity: 0.5, roughness: 0.8 })
);
banniere.position.set(0, 5.6, -8.85);
scene.add(banniere);

scene.add(new THREE.AmbientLight(0xffffff, 0.08));
const projecteurs = [];
const faisceauMat = new THREE.MeshBasicMaterial({ color: ROUGE, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
[
  [-3.4, 9, 2.6, ROUGE, 150],
  [3.4, 9, 2.6, ROUGE, 150],
  [0, 10, 5, 0xffffff, 85],
].forEach(([x, y, z, couleur, intensite], i) => {
  const sp = new THREE.SpotLight(couleur, intensite, 30, Math.PI / 6.5, 0.55, 1.35);
  sp.position.set(x, y, z);
  sp.target.position.set(x * 0.15, 1, 0);
  sp.castShadow = i === 2 && !mobile;
  sp.shadow.mapSize.set(1024, 1024);
  scene.add(sp, sp.target);
  projecteurs.push(sp);
  if (i < 2) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 32, 1, true), faisceauMat);
    f.position.set(x * 0.6, 4.6, z * 0.5);
    f.rotation.z = (x > 0 ? 1 : -1) * 0.28;
    scene.add(f);
  }
});
const contreJour = new THREE.DirectionalLight(0xffffff, 1.1);
contreJour.position.set(-5, 5, -7);
scene.add(contreJour);
const lumiereImpact = new THREE.PointLight(0xffe0c8, 0, 14, 1.6);
lumiereImpact.position.set(0, 3.35, 1.4);
scene.add(lumiereImpact);

/* ------------------------------------------------------------------ */
/* Tambour de verre et boules numerotees                               */
/* ------------------------------------------------------------------ */
const TAMBOUR_R = 1.22;
const TAMBOUR_L = 2.1;
const BOULE_R = 0.155;
const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 1, roughness: 0.16 });
const rougeLaque = new THREE.MeshPhysicalMaterial({ color: ROUGE, metalness: 0.35, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0x1a0000 });

const tambour = new THREE.Group();
tambour.position.set(0, 0.95, 0);
scene.add(tambour);
const tambourRotatif = new THREE.Group();
tambour.add(tambourRotatif);

const verre = new THREE.Mesh(
  new THREE.CylinderGeometry(TAMBOUR_R, TAMBOUR_R, TAMBOUR_L, 64, 1, true),
  new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1,
    side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2,
  })
);
verre.rotation.z = Math.PI / 2;
verre.renderOrder = 2;
tambourRotatif.add(verre);
for (const x of [-TAMBOUR_L / 2, TAMBOUR_L / 2]) {
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(TAMBOUR_R, 0.055, 16, 96), chrome);
  anneau.rotation.y = Math.PI / 2;
  anneau.position.x = x;
  tambourRotatif.add(anneau);
  const moyeu = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 32), rougeLaque);
  moyeu.rotation.z = Math.PI / 2;
  moyeu.position.x = x;
  tambourRotatif.add(moyeu);
  // rayons de la roue
  for (let k = 0; k < 6; k += 1) {
    const rayon = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, TAMBOUR_R, 8), chrome);
    const a = (k / 6) * TAU;
    rayon.position.set(x, Math.sin(a) * TAMBOUR_R * 0.5, Math.cos(a) * TAMBOUR_R * 0.5);
    rayon.rotation.x = -a + Math.PI / 2;
    tambourRotatif.add(rayon);
  }
}
for (let k = 0; k < 8; k += 1) {
  const a = (k / 8) * TAU;
  const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, TAMBOUR_L, 8), k % 2 ? chrome : rougeLaque);
  barre.rotation.z = Math.PI / 2;
  barre.position.set(0, Math.sin(a) * TAMBOUR_R, Math.cos(a) * TAMBOUR_R);
  tambourRotatif.add(barre);
}
const axe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, TAMBOUR_L + 0.9, 16), chrome);
axe.rotation.z = Math.PI / 2;
tambour.add(axe);
// pieds en A et socle
for (const x of [-TAMBOUR_L / 2 - 0.35, TAMBOUR_L / 2 + 0.35]) {
  for (const s of [-1, 1]) {
    const pied = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.55, 0.12), rougeLaque);
    pied.position.set(x, -0.62, s * 0.38);
    pied.rotation.x = s * 0.42;
    pied.castShadow = true;
    tambour.add(pied);
  }
}
const socle = new THREE.Mesh(new THREE.BoxGeometry(TAMBOUR_L + 1.3, 0.12, 1.5), new THREE.MeshStandardMaterial({ color: 0x18181a, metalness: 0.7, roughness: 0.3 }));
socle.position.y = -1.24;
socle.castShadow = socle.receiveShadow = true;
tambour.add(socle);
const filSocle = new THREE.Mesh(new THREE.BoxGeometry(TAMBOUR_L + 1.32, 0.02, 1.52), neonMat);
filSocle.position.y = -1.17;
tambour.add(filSocle);

function textureBoule(numero, fond, encre) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = fond;
  g.fillRect(0, 0, 512, 256);
  for (const cx of [128, 384]) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(cx, 128, 62, 80, 0, 0, TAU);
    g.fill();
    g.fillStyle = encre;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    texteAjuste(g, String(numero), cx, 134, 104, 92);
  }
  return textureCanvas(c);
}

const boules = [];
const geoBoule = new THREE.SphereGeometry(BOULE_R, 32, 24);
function construireBoules(numeros) {
  for (const b of boules) {
    tambour.remove(b.mesh);
    b.mesh.material.map?.dispose();
    b.mesh.material.dispose();
  }
  boules.length = 0;
  const liste = [...numeros].sort(() => Math.random() - 0.5).slice(0, mobile ? 30 : 42);
  const couleurs = [
    ['#d11414', '#111111'],
    ['#f4f2ef', '#d11414'],
    ['#141416', '#d11414'],
    ['#e8c66a', '#111111'],
  ];
  // positions de repos : tas au fond du tambour
  const repos = [];
  for (let couche = 0; repos.length < liste.length && couche < 12; couche += 1) {
    const y = -TAMBOUR_R + BOULE_R + couche * BOULE_R * 1.65;
    const demiCorde = Math.sqrt(Math.max(0, (TAMBOUR_R - BOULE_R) ** 2 - y * y));
    const nz = Math.max(1, Math.floor((2 * demiCorde) / (BOULE_R * 2.05)));
    for (let ix = 0; ix < 6 && repos.length < liste.length; ix += 1) {
      for (let iz = 0; iz < nz && repos.length < liste.length; iz += 1) {
        repos.push(new THREE.Vector3(
          -0.82 + ix * 0.33 + (couche % 2) * 0.08 + hasard(-0.03, 0.03),
          y,
          nz === 1 ? 0 : -demiCorde + (iz / (nz - 1)) * 2 * demiCorde
        ));
      }
    }
  }
  liste.forEach((n, i) => {
    const [fond, encre] = couleurs[i % couleurs.length];
    const mesh = new THREE.Mesh(
      geoBoule,
      new THREE.MeshPhysicalMaterial({ map: textureBoule(n, fond, encre), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04 })
    );
    mesh.castShadow = !mobile;
    mesh.rotation.set(hasard(0, TAU), hasard(0, TAU), 0);
    tambour.add(mesh);
    boules.push({
      mesh,
      repos: repos[i] || new THREE.Vector3(0, -TAMBOUR_R + BOULE_R, 0),
      phase: hasard(0, TAU),
      vitesse: hasard(0.55, 1.35),
      rayon: hasard(0.35, TAMBOUR_R - BOULE_R - 0.02),
      x: hasard(-0.85, 0.85),
      graine: hasard(0, 100),
    });
  });
}

let angleTambour = 0;
function animerTambour(dt, vitesse, t) {
  // vitesse : 0 (arret) .. 1 (pleine rotation)
  angleTambour += dt * vitesse * 7.5;
  tambourRotatif.rotation.x = angleTambour;
  const melange = easeInOut(clamp(vitesse * 1.6));
  for (const b of boules) {
    b.phase += dt * vitesse * 7.5 * b.vitesse;
    const a = b.phase + Math.sin(t * 2.3 + b.graine) * 0.6;
    const r = Math.min(TAMBOUR_R - BOULE_R - 0.02, b.rayon + Math.sin(b.phase * 1.7 + b.graine) * 0.35);
    const vol = new THREE.Vector3(
      b.x + Math.sin(b.phase * 0.9 + b.graine) * 0.12,
      Math.sin(a) * Math.abs(r),
      Math.cos(a) * Math.abs(r)
    );
    b.mesh.position.lerpVectors(b.repos, vol, melange);
    b.mesh.rotation.x += dt * vitesse * 9 * b.vitesse;
    b.mesh.rotation.y += dt * vitesse * 4;
  }
}

/* ------------------------------------------------------------------ */
/* Afficheur a rouleau (les numeros defilent et s'arretent)            */
/* ------------------------------------------------------------------ */
const NB_FACES = 10;
const PAS = TAU / NB_FACES;
const FACE_H = 0.64;
const FACE_W = 2.75;
const APOTHEME = FACE_H / (2 * Math.tan(Math.PI / NB_FACES));
const afficheur = new THREE.Group();
afficheur.position.set(0, 3.35, 0.15);
scene.add(afficheur);
const rouleau = new THREE.Group();
rouleau.position.z = -APOTHEME;
afficheur.add(rouleau);

const faces = [];
function peindreFace(face, numero, gagnant = false) {
  const g = face.ctx;
  const w = face.canvas.width;
  const h = face.canvas.height;
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, gagnant ? '#2a0606' : '#141416');
  grd.addColorStop(0.5, gagnant ? '#3d0909' : '#1d1d21');
  grd.addColorStop(1, gagnant ? '#2a0606' : '#141416');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 0, w, 3);
  g.fillRect(0, h - 3, w, 3);
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillStyle = '#d11414';
  g.font = `700 34px ${POLICE}`;
  g.fillText('TICKET', 46, h / 2 - 22);
  g.fillText('N.', 46, h / 2 + 22);
  g.textAlign = 'center';
  g.fillStyle = gagnant ? '#ffe7b0' : '#f4f2ef';
  texteAjuste(g, numero == null ? '---' : String(numero), w / 2 + 40, h / 2 + 6, w - 260, 150);
  face.numero = numero;
  face.texture.needsUpdate = true;
}

const faceGeo = new THREE.PlaneGeometry(FACE_W, FACE_H * 1.002);
for (let k = 0; k < NB_FACES; k += 1) {
  const c = document.createElement('canvas');
  c.width = 860;
  c.height = 200;
  const texture = textureCanvas(c);
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0.15, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.32 });
  const pivot = new THREE.Group();
  pivot.rotation.x = k * PAS;
  const mesh = new THREE.Mesh(faceGeo, mat);
  mesh.position.z = APOTHEME;
  pivot.add(mesh);
  rouleau.add(pivot);
  faces.push({ canvas: c, ctx: c.getContext('2d'), texture, mat, mesh, numero: null, derriere: false, verrou: false });
}
// joues du rouleau
for (const x of [-FACE_W / 2 - 0.02, FACE_W / 2 + 0.02]) {
  const joue = new THREE.Mesh(new THREE.CylinderGeometry(APOTHEME * 1.06, APOTHEME * 1.06, 0.04, NB_FACES), chrome);
  joue.rotation.z = Math.PI / 2;
  joue.position.x = x;
  rouleau.add(joue);
}

// Facade de l'afficheur : panneau perce d'une fenetre, liseres neon, fleches
(function facade() {
  const W = 3.5;
  const H = 2.3;
  const fw = FACE_W + 0.08;
  const fh = FACE_H * 1.2;
  const forme = new THREE.Shape();
  forme.moveTo(-W / 2, -H / 2);
  forme.lineTo(W / 2, -H / 2);
  forme.lineTo(W / 2, H / 2);
  forme.lineTo(-W / 2, H / 2);
  forme.closePath();
  const trou = new THREE.Path();
  trou.moveTo(-fw / 2, -fh / 2);
  trou.lineTo(-fw / 2, fh / 2);
  trou.lineTo(fw / 2, fh / 2);
  trou.lineTo(fw / 2, -fh / 2);
  trou.closePath();
  forme.holes.push(trou);
  const panneau = new THREE.Mesh(
    new THREE.ExtrudeGeometry(forme, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1d, metalness: 0.85, roughness: 0.32 })
  );
  panneau.position.z = 0.02;
  panneau.castShadow = true;
  afficheur.add(panneau);
  // caisson arriere qui cache le rouleau
  const caisson = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, H - 0.1, APOTHEME * 2 + 0.3), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.8, side: THREE.BackSide }));
  caisson.position.z = -APOTHEME;
  afficheur.add(caisson);
  for (const y of [fh / 2 + 0.07, -fh / 2 - 0.07]) {
    const lisere = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.1, 0.035, 0.03), neonMat);
    lisere.position.set(0, y, 0.27);
    afficheur.add(lisere);
  }
  const flecheForme = new THREE.Shape();
  flecheForme.moveTo(0, 0);
  flecheForme.lineTo(-0.16, 0.12);
  flecheForme.lineTo(-0.16, -0.12);
  flecheForme.closePath();
  const flecheGeo = new THREE.ExtrudeGeometry(flecheForme, { depth: 0.04, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(flecheGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false }));
    f.position.set(s * (fw / 2 + 0.2), 0, 0.26);
    f.rotation.z = s === -1 ? 0 : Math.PI;
    afficheur.add(f);
  }
  // ombrage de courbure devant le rouleau (effet de profondeur)
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(0,0,0,0.95)');
  grd.addColorStop(0.22, 'rgba(0,0,0,0)');
  grd.addColorStop(0.78, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.95)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const ombre = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  ombre.position.z = 0.012;
  afficheur.add(ombre);
  const vitre = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fh),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.02, clearcoat: 1, envMapIntensity: 2.5, depthWrite: false })
  );
  vitre.position.z = 0.2;
  afficheur.add(vitre);
})();

/* ------------------------------------------------------------------ */
/* Particules : etincelles, poussiere de grattage, confettis           */
/* ------------------------------------------------------------------ */
function texturePoint() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const texPoint = texturePoint();

class Particules {
  constructor(max, { taille, additif, gravite }) {
    this.max = max;
    this.gravite = gravite;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.vie = new Float32Array(max);
    this.duree = new Float32Array(max).fill(1);
    this.base = new Float32Array(max * 3);
    this.prochain = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: taille, map: texPoint, vertexColors: true, transparent: true, depthWrite: false,
        blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additif,
      })
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emettre(origine, n, { vitesse = 4, couleur = [1, 0.7, 0.4], duree = 1.2, cone = null } = {}) {
    for (let i = 0; i < n; i += 1) {
      const j = this.prochain;
      this.prochain = (this.prochain + 1) % this.max;
      this.pos[j * 3] = origine.x;
      this.pos[j * 3 + 1] = origine.y;
      this.pos[j * 3 + 2] = origine.z;
      const d = new THREE.Vector3(hasard(-1, 1), hasard(-1, 1), hasard(-1, 1)).normalize();
      if (cone) d.add(cone).normalize();
      const v = vitesse * hasard(0.3, 1);
      this.vel[j * 3] = d.x * v;
      this.vel[j * 3 + 1] = d.y * v;
      this.vel[j * 3 + 2] = d.z * v;
      this.base[j * 3] = couleur[0];
      this.base[j * 3 + 1] = couleur[1];
      this.base[j * 3 + 2] = couleur[2];
      this.duree[j] = duree * hasard(0.6, 1.2);
      this.vie[j] = this.duree[j];
    }
  }

  maj(dt) {
    for (let j = 0; j < this.max; j += 1) {
      if (this.vie[j] <= 0) {
        this.col[j * 3] = this.col[j * 3 + 1] = this.col[j * 3 + 2] = 0;
        continue;
      }
      this.vie[j] -= dt;
      this.vel[j * 3 + 1] -= this.gravite * dt;
      this.vel[j * 3] *= 0.985;
      this.vel[j * 3 + 2] *= 0.985;
      this.pos[j * 3] += this.vel[j * 3] * dt;
      this.pos[j * 3 + 1] += this.vel[j * 3 + 1] * dt;
      this.pos[j * 3 + 2] += this.vel[j * 3 + 2] * dt;
      const k = clamp(this.vie[j] / this.duree[j]);
      this.col[j * 3] = this.base[j * 3] * k;
      this.col[j * 3 + 1] = this.base[j * 3 + 1] * k;
      this.col[j * 3 + 2] = this.base[j * 3 + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
const etincelles = new Particules(900, { taille: 0.07, additif: true, gravite: 5.5 });
const poussiere = new Particules(700, { taille: 0.035, additif: false, gravite: 4 });

const NB_CONFETTIS = mobile ? 260 : 420;
const confettis = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.07, 0.12),
  new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0.55, roughness: 0.35 }),
  NB_CONFETTIS
);
confettis.frustumCulled = false;
scene.add(confettis);
const etatConfettis = Array.from({ length: NB_CONFETTIS }, () => ({
  p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), vr: new THREE.Vector3(), vie: 0,
}));
const palette = [new THREE.Color(ROUGE), new THREE.Color(0xffffff), new THREE.Color(OR), new THREE.Color(0xff3b3b), new THREE.Color(0xc0c0c8)];
etatConfettis.forEach((_, i) => confettis.setColorAt(i, palette[i % palette.length]));
const tmpMat = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const UN = new THREE.Vector3(1, 1, 1);
let prochainConfetti = 0;

function lancerConfettis(origine, n, force = 4) {
  for (let i = 0; i < n; i += 1) {
    const c = etatConfettis[prochainConfetti];
    prochainConfetti = (prochainConfetti + 1) % NB_CONFETTIS;
    c.p.copy(origine).add(new THREE.Vector3(hasard(-0.4, 0.4), hasard(-0.2, 0.2), hasard(-0.3, 0.3)));
    c.v.set(hasard(-1, 1) * force, hasard(0.6, 1.4) * force, hasard(-0.5, 1) * force * 0.6);
    c.r.set(hasard(0, TAU), hasard(0, TAU), hasard(0, TAU));
    c.vr.set(hasard(-8, 8), hasard(-8, 8), hasard(-8, 8));
    c.vie = hasard(3, 5);
  }
}

function majConfettis(dt, t) {
  for (let i = 0; i < NB_CONFETTIS; i += 1) {
    const c = etatConfettis[i];
    if (c.vie > 0) {
      c.vie -= dt;
      c.v.y -= 6 * dt;
      c.v.multiplyScalar(0.975);
      c.v.y = Math.max(c.v.y, -1.6);
      c.p.addScaledVector(c.v, dt);
      c.p.x += Math.sin(t * 3 + i) * 0.006;
      c.r.x += c.vr.x * dt;
      c.r.y += c.vr.y * dt;
      c.r.z += c.vr.z * dt;
    } else c.p.y = -50;
    tmpQ.setFromEuler(c.r);
    tmpMat.compose(c.p, tmpQ, UN);
    confettis.setMatrixAt(i, tmpMat);
  }
  confettis.instanceMatrix.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* Ticket a gratter                                                    */
/* ------------------------------------------------------------------ */
const TICKET_W = 2.3;
const TICKET_H = 3.3;
const TEX_W = 1024;
const TEX_H = Math.round((TEX_W * TICKET_H) / TICKET_W);
const ZONE = { x: 70, y: Math.round(TEX_H * 0.555), w: TEX_W - 140, h: Math.round(TEX_H * 0.33) };

const TICKET_Y = -0.25;
const TICKET_Z = -6.2;
const ticket = new THREE.Group();
ticket.visible = false;
camera.add(ticket);
const voile = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
voile.position.z = -9;
camera.add(voile);
const lumiereTicket = new THREE.DirectionalLight(0xffffff, 0);
lumiereTicket.position.set(2.5, 3, 1);
lumiereTicket.target = ticket;
camera.add(lumiereTicket);
const lumiereTicketRouge = new THREE.PointLight(ROUGE, 0, 10, 1.5);
lumiereTicketRouge.position.set(-2.2, -1.5, -3.5);
camera.add(lumiereTicketRouge);

function formeTicket(w, h, r, n, ny) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, ny - n);
  s.absarc(x0 + w, ny, n, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h);
  s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, ny + n);
  s.absarc(x0, ny, n, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

function peindreTicket(res) {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const g = c.getContext('2d');
  const fond = g.createLinearGradient(0, 0, TEX_W, TEX_H);
  fond.addColorStop(0, '#1f1f23');
  fond.addColorStop(0.55, '#121214');
  fond.addColorStop(1, '#1a0d0d');
  g.fillStyle = fond;
  g.fillRect(0, 0, TEX_W, TEX_H);
  // trame diagonale discrete
  g.strokeStyle = 'rgba(255,255,255,0.025)';
  g.lineWidth = 2;
  for (let x = -TEX_H; x < TEX_W; x += 26) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + TEX_H, TEX_H);
    g.stroke();
  }
  g.fillStyle = '#d11414';
  g.fillRect(0, 0, TEX_W, 22);
  g.fillRect(0, TEX_H - 22, TEX_W, 22);
  // trois barres Moteka
  g.fillStyle = '#d11414';
  for (let i = 0; i < 3; i += 1) {
    const x = 70 + i * 40;
    g.beginPath();
    g.moveTo(x + 30, 70);
    g.lineTo(x + 50, 70);
    g.lineTo(x + 20, 122);
    g.lineTo(x, 122);
    g.closePath();
    g.fill();
  }
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillStyle = '#f4f2ef';
  g.font = `800 50px ${POLICE}`;
  g.fillText('FIGHT', 220, 98);
  const lf = g.measureText('FIGHT ').width;
  g.fillStyle = '#ff2a2a';
  g.fillText('&', 220 + lf, 98);
  g.fillStyle = '#f4f2ef';
  g.font = `600 50px ${POLICE}`;
  g.fillText('FURIOUS', 220 + lf + g.measureText('& ').width + 6, 98);
  dessinerImage(g, logos.bc, TEX_W - 250, 96, 170, 80);
  g.textAlign = 'center';
  g.fillStyle = '#e8c66a';
  g.font = `700 40px ${POLICE}`;
  g.fillText('T I C K E T   G A G N A N T', TEX_W / 2, 210);
  g.fillStyle = '#f4f2ef';
  g.font = `800 64px ${POLICE}`;
  g.fillText('N.', TEX_W / 2 - 180, 360);
  g.font = `800 230px ${POLICE}`;
  g.fillText(String(res.numero), TEX_W / 2 + 40, 360);
  g.fillStyle = '#ffffff';
  texteAjuste(g, `${res.prenom}${res.initiale ? ` ${res.initiale}.` : ''}`.toUpperCase(), TEX_W / 2, 530, TEX_W - 180, 92);
  g.fillStyle = '#9a9aa2';
  g.font = `600 34px ${POLICE}`;
  g.fillText(`TIRAGE DU ${new Date(`${res.date_tirage}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}`, TEX_W / 2, 615);
  // ligne perforee
  const yPerfo = TEX_H * 0.5;
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.setLineDash([16, 14]);
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(70, yPerfo);
  g.lineTo(TEX_W - 70, yPerfo);
  g.stroke();
  g.setLineDash([]);
  // zone du lot (sous la couche a gratter)
  const z = ZONE;
  const zg = g.createLinearGradient(0, z.y, 0, z.y + z.h);
  zg.addColorStop(0, '#2b0707');
  zg.addColorStop(1, '#120303');
  g.fillStyle = zg;
  g.fillRect(z.x, z.y, z.w, z.h);
  g.strokeStyle = '#e8c66a';
  g.lineWidth = 6;
  g.strokeRect(z.x + 10, z.y + 10, z.w - 20, z.h - 20);
  g.fillStyle = '#e8c66a';
  g.font = `700 44px ${POLICE}`;
  g.fillText('V O U S   G A G N E Z', TEX_W / 2, z.y + 70);
  g.fillStyle = '#ffffff';
  g.font = `800 92px ${POLICE}`;
  const lignes = lignesCoupees(g, String(res.lot.nom).toUpperCase(), z.w - 90).slice(0, 3);
  const taille = lignes.length > 2 ? 74 : 92;
  g.font = `800 ${taille}px ${POLICE}`;
  const debut = z.y + z.h / 2 + 10 - ((lignes.length - 1) * taille * 0.95) / 2;
  lignes.forEach((l, i) => texteAjuste(g, l, TEX_W / 2, debut + i * taille * 0.95, z.w - 90, taille));
  if (res.lot.description) {
    g.fillStyle = '#c9c9cf';
    g.font = `500 32px Barlow, Arial, sans-serif`;
    const d = lignesCoupees(g, res.lot.description, z.w - 120).slice(0, 2);
    d.forEach((l, i) => g.fillText(l, TEX_W / 2, z.y + z.h - 78 + i * 38));
  }
  // pied
  g.fillStyle = '#9a9aa2';
  g.font = `600 30px ${POLICE}`;
  g.fillText('LOT OFFERT PAR', TEX_W / 2 - 150, TEX_H - 95);
  if (!dessinerImage(g, logos.moteka, TEX_W / 2 + 110, TEX_H - 95, 260, 32)) {
    g.fillStyle = '#fff';
    g.fillText('MOTEKA', TEX_W / 2 + 110, TEX_H - 95);
  }
  const t = textureCanvas(c);
  t.repeat.set(1 / TICKET_W, 1 / TICKET_H);
  t.offset.set(0.5, 0.5);
  return t;
}

function peindreDos() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * TICKET_H) / TICKET_W);
  const g = c.getContext('2d');
  g.fillStyle = '#d11414';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < c.height; y += 60) {
    for (let x = (y / 60) % 2 ? 30 : 0; x < c.width; x += 60) {
      g.beginPath();
      g.moveTo(x + 18, y + 10);
      g.lineTo(x + 30, y + 10);
      g.lineTo(x + 12, y + 40);
      g.lineTo(x, y + 40);
      g.closePath();
      g.fill();
    }
  }
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 64px ${POLICE}`;
  g.fillText('FIGHT & FURIOUS', c.width / 2, c.height / 2 - 30);
  g.font = `600 30px ${POLICE}`;
  g.fillText('BOXING CENTER x MOTEKA', c.width / 2, c.height / 2 + 30);
  const t = textureCanvas(c);
  t.repeat.set(-1 / TICKET_W, 1 / TICKET_H);
  t.offset.set(0.5, 0.5);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// couche argentee a gratter
const GRAT_W = 512;
const GRAT_H = Math.round((GRAT_W * ZONE.h) / ZONE.w);
const masque = document.createElement('canvas');
masque.width = GRAT_W;
masque.height = GRAT_H;
const mctx = masque.getContext('2d');
const masqueTex = new THREE.CanvasTexture(masque);

function peindreArgent() {
  const c = document.createElement('canvas');
  c.width = GRAT_W;
  c.height = GRAT_H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, GRAT_W, GRAT_H);
  grd.addColorStop(0, '#9c9ca4');
  grd.addColorStop(0.3, '#e6e6ec');
  grd.addColorStop(0.5, '#a8a8b0');
  grd.addColorStop(0.75, '#d9d9df');
  grd.addColorStop(1, '#8e8e96');
  g.fillStyle = grd;
  g.fillRect(0, 0, GRAT_W, GRAT_H);
  for (let i = 0; i < 5000; i += 1) {
    const v = 140 + Math.random() * 100;
    g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`;
    g.fillRect(Math.random() * GRAT_W, Math.random() * GRAT_H, 1.5, 1.5);
  }
  g.save();
  g.translate(GRAT_W / 2, GRAT_H / 2);
  g.rotate(-0.18);
  g.fillStyle = 'rgba(80,80,90,0.28)';
  g.font = `800 26px ${POLICE}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let y = -GRAT_H; y < GRAT_H; y += 44) {
    for (let x = -GRAT_W; x < GRAT_W; x += 170) g.fillText('MOTEKA', x + ((y / 44) % 2 ? 85 : 0), y);
  }
  g.restore();
  g.fillStyle = 'rgba(30,30,34,0.85)';
  g.font = `800 44px ${POLICE}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('GRATTEZ ICI', GRAT_W / 2, GRAT_H / 2);
  return textureCanvas(c);
}

const matGrattage = new THREE.MeshStandardMaterial({
  map: null, alphaMap: masqueTex, transparent: true, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.4,
});
const zoneW = (ZONE.w / TEX_W) * TICKET_W;
const zoneH = (ZONE.h / TEX_H) * TICKET_H;
const zoneCx = ((ZONE.x + ZONE.w / 2) / TEX_W - 0.5) * TICKET_W;
const zoneCy = (0.5 - (ZONE.y + ZONE.h / 2) / TEX_H) * TICKET_H;
const coucheGrattage = new THREE.Mesh(new THREE.PlaneGeometry(zoneW, zoneH), matGrattage);

const piece = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.2, 0.035, 48),
  new THREE.MeshStandardMaterial({ color: OR, metalness: 1, roughness: 0.22 })
);
piece.rotation.x = Math.PI / 2;
piece.visible = false;

let ticketConstruit = false;
let faceAvant = null;
let faceArriere = null;
function construireTicket(res) {
  const n = 0.13;
  const yN = 0; // perforation au milieu de la texture
  const forme = formeTicket(TICKET_W, TICKET_H, 0.12, n, yN);
  const epaisseur = 0.025;
  if (!ticketConstruit) {
    const tranche = new THREE.Mesh(
      new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 24 }),
      new THREE.MeshStandardMaterial({ color: OR, metalness: 1, roughness: 0.25 })
    );
    tranche.position.z = -epaisseur / 2;
    ticket.add(tranche);
    const geoFace = new THREE.ShapeGeometry(forme, 24);
    faceAvant = new THREE.Mesh(geoFace, new THREE.MeshPhysicalMaterial({ roughness: 0.38, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    faceAvant.position.z = epaisseur / 2 + 0.0095;
    ticket.add(faceAvant);
    faceArriere = new THREE.Mesh(geoFace, new THREE.MeshPhysicalMaterial({ map: peindreDos(), roughness: 0.4, clearcoat: 0.5 }));
    faceArriere.rotation.y = Math.PI;
    faceArriere.position.z = -epaisseur / 2 - 0.0095;
    ticket.add(faceArriere);
    coucheGrattage.position.set(zoneCx, zoneCy, epaisseur / 2 + 0.012);
    ticket.add(coucheGrattage);
    ticket.add(piece);
    matGrattage.map = peindreArgent();
    ticketConstruit = true;
  }
  faceAvant.material.map?.dispose();
  faceAvant.material.map = peindreTicket(res);
  faceAvant.material.needsUpdate = true;
  mctx.globalCompositeOperation = 'source-over';
  mctx.fillStyle = '#ffffff';
  mctx.fillRect(0, 0, GRAT_W, GRAT_H);
  masqueTex.needsUpdate = true;
  matGrattage.opacity = 1;
  matGrattage.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* Son (Web Audio, sans fichier)                                       */
/* ------------------------------------------------------------------ */
let audio = null;
function initAudio() {
  if (audio || !$('#opt-son').checked) return;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    audio = null;
  }
}
function son(type) {
  if (!audio || !$('#opt-son').checked) return;
  const t = audio.currentTime;
  const gain = audio.createGain();
  gain.connect(audio.destination);
  if (type === 'tic') {
    const o = audio.createOscillator();
    o.type = 'square';
    o.frequency.value = 2100;
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(gain);
    o.start(t);
    o.stop(t + 0.035);
  } else if (type === 'impact') {
    const o = audio.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(gain);
    o.start(t);
    o.stop(t + 0.95);
    const bruit = audio.createBufferSource();
    const buf = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    bruit.buffer = buf;
    const g2 = audio.createGain();
    g2.gain.value = 0.25;
    bruit.connect(g2);
    g2.connect(audio.destination);
    bruit.start(t);
  } else if (type === 'fanfare') {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.11 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.9);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t + i * 0.11);
      o.stop(t + i * 0.11 + 1);
    });
  } else if (type === 'gratte') {
    const bruit = audio.createBufferSource();
    const buf = audio.createBuffer(1, audio.sampleRate * 0.06, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * 0.5;
    bruit.buffer = buf;
    const filtre = audio.createBiquadFilter();
    filtre.type = 'highpass';
    filtre.frequency.value = 3000;
    gain.gain.value = 0.05;
    bruit.connect(filtre);
    filtre.connect(gain);
    bruit.start(t);
  }
}

/* ------------------------------------------------------------------ */
/* Donnees : API ou demo                                               */
/* ------------------------------------------------------------------ */
let numeros = [];
let candidats = [];
let candidatsVisibles = [];
let pretBase = false;
let resultat = null;
let erreurTirage = null;
let infoTirage = null;

async function api(chemin, options = {}) {
  const res = await fetch(chemin, {
    credentials: 'same-origin',
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  let data = {};
  try { data = await res.json(); } catch { /* vide */ }
  if (!res.ok || data.ok === false) {
    const err = new Error(data.message || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function aujourdhui() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function candidatChoisi() {
  const v = $('#choix-gagnant').value;
  if (!v) return null;
  return candidats.find((c) => String(c.numero) === v) || null;
}

function tirageDepuisCandidat(c) {
  const initiale = c.initiale || String(c.nom || '').trim().charAt(0).toUpperCase();
  return {
    numero: Number(c.numero),
    prenom: c.prenom || '',
    initiale,
    date_tirage: aujourdhui(),
    lot: infoTirage?.prochain_lot || LOT_DEMO,
  };
}

function tirageDemo() {
  const choisi = candidatChoisi();
  if (choisi) return tirageDepuisCandidat(choisi);
  const numero = numeros[Math.floor(Math.random() * numeros.length)];
  const prenom = PRENOMS_DEMO[Math.floor(Math.random() * PRENOMS_DEMO.length)];
  return {
    numero,
    prenom,
    initiale: 'ABCDEFGHIJKLMNOPRSTV'[Math.floor(Math.random() * 20)],
    date_tirage: aujourdhui(),
    lot: infoTirage?.prochain_lot || LOT_DEMO,
  };
}

function remplirSelectCandidats(liste) {
  candidatsVisibles = liste;
  const sel = $('#choix-gagnant');
  const courant = sel.value;
  sel.innerHTML = '<option value="">Choisir le gagnant...</option>';
  for (const c of liste) {
    const opt = document.createElement('option');
    opt.value = String(c.numero);
    opt.textContent = `${c.label || c.prenom} (ticket n. ${c.numero})`;
    sel.appendChild(opt);
  }
  if (courant && liste.some((c) => String(c.numero) === courant)) sel.value = courant;
}

function filtrerCandidats(q) {
  const needle = String(q || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!needle) {
    remplirSelectCandidats(candidats);
    return;
  }
  remplirSelectCandidats(
    candidats.filter((c) => {
      const hay = `${c.label} ${c.prenom} ${c.nom} ${c.numero}`.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
      return hay.includes(needle);
    })
  );
}

function majBoutonLancer() {
  const bouton = $('#lancer');
  const okGagnant = !!candidatChoisi();
  bouton.disabled = !pretBase || !okGagnant;
}

function basculerPleinEcran() {
  const el = $('#story');
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen?.().catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Deroule de l'animation                                              */
/* ------------------------------------------------------------------ */
const P = { attente: 0, intro: 1, tourne: 2, ralenti: 3, arret: 4, ticketEntree: 5, grattage: 6, revele: 7, erreur: 8 };
let phase = P.attente;
let tPhase = 0;
let angleRouleau = 0;
let vitesseRouleau = 0;
const V_MAX = 15;
let ralenti = null; // { a0, a1, duree, kGagnant }
let derniereFace = 0;
let vitesseTambour = 0.12;
let secousse = 0;
let flashNiveau = 0;
let grattageAuto = false;
let tAuto = 0;
let dernierPointAuto = null;
let pourcentage = 0;
let tMesure = 0;

const cam = { pos: new THREE.Vector3(2.8, 3.6, 10.5), cible: new THREE.Vector3(0, 2.2, 0) };
const CAM_BASE = { pos: new THREE.Vector3(0, 2.15, 7.7), cible: new THREE.Vector3(0, 2.05, 0) };
const CAM_AFFICHEUR = { pos: new THREE.Vector3(0, 3.25, 5.0), cible: new THREE.Vector3(0, 3.1, 0) };

function changerPhase(p) {
  phase = p;
  tPhase = 0;
}

function numeroAuHasard(exclure) {
  if (!numeros.length) return null;
  if (numeros.length === 1) return numeros[0];
  let n = numeros[Math.floor(Math.random() * numeros.length)];
  for (let i = 0; i < 5 && n === exclure; i += 1) n = numeros[Math.floor(Math.random() * numeros.length)];
  return n;
}

function majFaces() {
  for (let k = 0; k < NB_FACES; k += 1) {
    const f = faces[k];
    const a = mod(angleRouleau + k * PAS, TAU);
    const derriere = a > Math.PI * 0.62 && a < Math.PI * 1.38;
    if (derriere && !f.derriere) {
      if (ralenti && k === ralenti.kGagnant && resultat) {
        if (!f.verrou) {
          peindreFace(f, resultat.numero, true);
          f.verrou = true;
        }
      } else if (!f.verrou) {
        peindreFace(f, numeroAuHasard(resultat?.numero));
      }
    }
    f.derriere = derriere;
  }
  const index = Math.floor(angleRouleau / PAS);
  if (index !== derniereFace) {
    derniereFace = index;
    son('tic');
  }
}

function demarrerRalenti() {
  const distance = (V_MAX * 6.2) / 3; // ralenti d'environ 6 s (courbe cubique)
  const a0 = angleRouleau;
  const a1 = Math.ceil((a0 + distance) / PAS) * PAS;
  const duree = (3 * (a1 - a0)) / V_MAX;
  const kGagnant = mod(-Math.round(a1 / PAS), NB_FACES);
  // La face gagnante recoit le bon numero a son prochain passage a l'arriere du rouleau (invisible),
  // ce qui arrive plusieurs fois pendant les ~5 tours du ralenti.
  ralenti = { a0, a1, duree, kGagnant };
}

function afficherResultat() {
  const r = resultat;
  $('#gagnant').innerHTML = `<span class="anim" style="animation-delay:.25s">${echapper(r.prenom)}${r.initiale ? ` ${echapper(r.initiale)}.` : ''}</span>`;
  $('#ticket-gagnant').textContent = `Ticket n. ${r.numero}`;
  $('#ticket-gagnant').classList.add('anim');
  $('#ticket-gagnant').style.animationDelay = '.5s';
  $('.felicitations').classList.add('anim');
  $('#resultat').hidden = false;
  $('#compteur').style.opacity = '0';
}

function echapper(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function flash(force = 1) {
  flashNiveau = Math.max(flashNiveau, force);
}

function pointMonde(local, objet) {
  return objet.localToWorld(local.clone());
}

/* --- grattage --- */
const raycaster = new THREE.Raycaster();
const pointeur = new THREE.Vector2();
let gratteEnCours = false;
let dernierPoint = null;

function uvSousPointeur(ev) {
  const r = canvas.getBoundingClientRect();
  pointeur.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointeur, camera);
  const hit = raycaster.intersectObject(coucheGrattage, false)[0];
  return hit ? { uv: hit.uv, point: hit.point } : null;
}

function gratter(uv, rayon, monde) {
  const x = uv.x * GRAT_W;
  const y = (1 - uv.y) * GRAT_H;
  mctx.globalCompositeOperation = 'source-over';
  mctx.strokeStyle = '#000000';
  mctx.fillStyle = '#000000';
  mctx.lineCap = 'round';
  mctx.lineJoin = 'round';
  mctx.lineWidth = rayon * 2;
  mctx.beginPath();
  if (dernierPoint) mctx.moveTo(dernierPoint.x, dernierPoint.y);
  else mctx.moveTo(x - 0.1, y);
  mctx.lineTo(x, y);
  mctx.stroke();
  // bords irreguliers
  for (let i = 0; i < 3; i += 1) {
    mctx.beginPath();
    mctx.arc(x + hasard(-rayon, rayon), y + hasard(-rayon, rayon), hasard(2, rayon * 0.45), 0, TAU);
    mctx.fill();
  }
  dernierPoint = { x, y };
  masqueTex.needsUpdate = true;
  if (monde) poussiere.emettre(monde, 3, { vitesse: 1.4, couleur: [0.78, 0.78, 0.82], duree: 0.8, cone: new THREE.Vector3(0, 0.5, 1) });
  if (Math.random() < 0.35) son('gratte');
}

function mesurerGrattage() {
  const d = mctx.getImageData(0, 0, GRAT_W, GRAT_H).data;
  let grattes = 0;
  let total = 0;
  for (let i = 0; i < d.length; i += 4 * 9) {
    total += 1;
    if (d[i + 1] < 128) grattes += 1;
  }
  return grattes / total;
}

canvas.addEventListener('pointerdown', (ev) => {
  if (phase !== P.grattage || grattageAuto) return;
  const h = uvSousPointeur(ev);
  if (!h) return;
  initAudio();
  gratteEnCours = true;
  dernierPoint = null;
  canvas.setPointerCapture(ev.pointerId);
  gratter(h.uv, 30, h.point);
});
canvas.addEventListener('pointermove', (ev) => {
  const r = canvas.getBoundingClientRect();
  inclinaison.set(((ev.clientX - r.left) / r.width) * 2 - 1, ((ev.clientY - r.top) / r.height) * 2 - 1);
  if (!gratteEnCours || phase !== P.grattage) return;
  const h = uvSousPointeur(ev);
  if (h) {
    gratter(h.uv, 30, h.point);
    piece.visible = true;
    const local = ticket.worldToLocal(h.point.clone());
    piece.position.set(local.x + 0.12, local.y - 0.1, 0.16);
  } else dernierPoint = null;
});
const finGratte = () => {
  gratteEnCours = false;
  dernierPoint = null;
  if (!grattageAuto) piece.visible = false;
};
canvas.addEventListener('pointerup', finGratte);
canvas.addEventListener('pointercancel', finGratte);
const inclinaison = new THREE.Vector2();

function demarrerGrattageAuto() {
  if (phase !== P.grattage || grattageAuto) return;
  grattageAuto = true;
  tAuto = 0;
  dernierPoint = null;
  dernierPointAuto = null;
  piece.visible = true;
}

function revelerLot() {
  changerPhase(P.revele);
  piece.visible = false;
  $('#consigne').hidden = true;
  $('#resultat').hidden = true;
  $('#nom-lot').textContent = resultat.lot?.nom || '';
  $('#lot-final').hidden = false;
  $('#lot-final').classList.add('visible');
  flash(0.55);
  son('fanfare');
  const centre = pointMonde(new THREE.Vector3(0, 0, 0.5), ticket);
  lancerConfettis(centre.clone().add(new THREE.Vector3(0, 1.4, 0)), 260, 3.2);
  etincelles.emettre(pointMonde(new THREE.Vector3(zoneCx, zoneCy, 0.1), ticket), 160, { vitesse: 3.5, couleur: [1, 0.85, 0.5], duree: 1.4 });
  setTimeout(() => {
    $('#fin').hidden = false;
  }, 2500);
}

/* --- lancement --- */
async function lancer() {
  if (phase !== P.attente || !numeros.length || $('#lancer').disabled) return;
  const choisi = candidatChoisi();
  if (!choisi) return;
  initAudio();
  if (audio?.state === 'suspended') audio.resume();
  grattageAuto = false;
  $('#panneau').classList.add('cache');
  $('#erreur-tirage').hidden = true;
  changerPhase(P.intro);
  resultat = null;
  erreurTirage = null;
  if (MODE === 'reel') {
    try {
      const corps = { numero: choisi.numero };
      if (LOT_DEMANDE) corps.lot_id = LOT_DEMANDE;
      const data = await api('/api/admin/tirage', { method: 'POST', body: JSON.stringify(corps) });
      resultat = data.tirage;
    } catch (err) {
      erreurTirage = err.message || 'Tirage impossible';
    }
  } else {
    await new Promise((r) => setTimeout(r, 400));
    resultat = tirageDepuisCandidat(choisi);
  }
}

function reinitialiser() {
  ralenti = null;
  resultat = null;
  erreurTirage = null;
  vitesseRouleau = 0;
  grattageAuto = false;
  pourcentage = 0;
  faces.forEach((f) => {
    f.verrou = false;
    f.mat.emissiveIntensity = 0.32;
    peindreFace(f, numeroAuHasard());
  });
  ticket.visible = false;
  voile.material.opacity = 0;
  lumiereTicket.intensity = 0;
  lumiereTicketRouge.intensity = 0;
  for (const id of ['#resultat', '#consigne', '#lot-final', '#fin']) $(id).hidden = true;
  $('#lot-final').classList.remove('visible');
  $('#resultat').classList.remove('haut');
  $('#titre-tirage').classList.remove('cache');
  $('#compteur').style.opacity = '1';
  $('#panneau').classList.remove('cache');
  cam.pos.set(2.8, 3.6, 10.5);
  changerPhase(P.attente);
}

/* --- boucle --- */
const horloge = new THREE.Clock();
let temps = 0;

function boucle() {
  const dt = Math.min(horloge.getDelta(), 1 / 20);
  temps += dt;
  tPhase += dt;

  let camCible = CAM_BASE;
  let camLissage = 1.6;

  switch (phase) {
    case P.attente: {
      vitesseTambour = lerp(vitesseTambour, 0.1, dt);
      vitesseRouleau = lerp(vitesseRouleau, 0.25, dt);
      angleRouleau += vitesseRouleau * dt;
      camCible = { pos: new THREE.Vector3(Math.sin(temps * 0.25) * 1.6, 2.5, 8.6), cible: CAM_BASE.cible };
      camLissage = 0.8;
      break;
    }
    case P.intro: {
      vitesseTambour = lerp(vitesseTambour, 1, dt * 1.2);
      vitesseRouleau = Math.min(V_MAX, vitesseRouleau + dt * 9);
      angleRouleau += vitesseRouleau * dt;
      if (tPhase > 0.6) $('#titre-tirage').classList.add('cache');
      if (vitesseRouleau >= V_MAX) changerPhase(P.tourne);
      break;
    }
    case P.tourne: {
      vitesseTambour = lerp(vitesseTambour, 1, dt * 2);
      angleRouleau += V_MAX * dt;
      camCible = { pos: new THREE.Vector3(Math.sin(temps * 0.6) * 0.9, 2.25, 7.3), cible: CAM_BASE.cible };
      if (erreurTirage && tPhase > 1) {
        changerPhase(P.erreur);
      } else if (resultat && tPhase > 3.6) {
        demarrerRalenti();
        changerPhase(P.ralenti);
      }
      break;
    }
    case P.ralenti: {
      const u = clamp(tPhase / ralenti.duree);
      angleRouleau = ralenti.a0 + (ralenti.a1 - ralenti.a0) * easeOut(u);
      vitesseTambour = Math.pow(1 - u, 2);
      // la camera s'approche de l'afficheur pendant le suspense
      const k = easeInOut(clamp((u - 0.35) / 0.65));
      camCible = {
        pos: new THREE.Vector3().lerpVectors(CAM_BASE.pos, CAM_AFFICHEUR.pos, k),
        cible: new THREE.Vector3().lerpVectors(CAM_BASE.cible, CAM_AFFICHEUR.cible, k),
      };
      camLissage = 2.4;
      if (u >= 1) {
        changerPhase(P.arret);
        flash(1);
        secousse = 0.35;
        son('impact');
        const f = faces[ralenti.kGagnant];
        if (f.numero !== resultat.numero) peindreFace(f, resultat.numero, true);
        const centre = pointMonde(new THREE.Vector3(0, 0, 0.35), afficheur);
        etincelles.emettre(centre, 420, { vitesse: 6.5, couleur: [1, 0.62, 0.32], duree: 1.6 });
        for (const s of [-1, 1]) etincelles.emettre(centre.clone().add(new THREE.Vector3(s * 1.5, 0, 0)), 120, { vitesse: 4, couleur: [1, 0.25, 0.2], duree: 1.2 });
        lancerConfettis(centre.clone().add(new THREE.Vector3(0, 1.2, 0)), 300, 4.2);
        afficherResultat();
      }
      break;
    }
    case P.arret: {
      vitesseTambour = 0;
      // petit rebond mecanique du rouleau
      angleRouleau = ralenti.a1 + Math.sin(tPhase * 22) * Math.exp(-tPhase * 6) * 0.06;
      const f = faces[ralenti.kGagnant];
      f.mat.emissiveIntensity = 0.5 + Math.abs(Math.sin(tPhase * 6)) * 0.9 * Math.exp(-tPhase * 0.4);
      lumiereImpact.intensity = 60 * Math.exp(-tPhase * 2.5);
      camCible = CAM_AFFICHEUR;
      if (tPhase > 0.9 && tPhase - dt <= 0.9) lancerConfettis(pointMonde(new THREE.Vector3(0, 1.6, 0.4), afficheur), 160, 3);
      if (tPhase > 4.6) {
        $('#resultat').classList.add('haut');
        construireTicket(resultat);
        ticket.visible = true;
        changerPhase(P.ticketEntree);
      }
      break;
    }
    case P.ticketEntree: {
      const u = clamp(tPhase / 1.9);
      const e = easeOutBack(u);
      ticket.position.set(0, lerp(-6.5, TICKET_Y, e), TICKET_Z);
      ticket.scale.setScalar(1);
      ticket.rotation.set(lerp(-1.2, 0, easeOut(u)), lerp(TAU * 1.5, 0, easeOut(u)), lerp(0.5, 0, e));
      voile.material.opacity = 0.62 * easeOut(u);
      lumiereTicket.intensity = 2.6 * u;
      lumiereTicketRouge.intensity = 18 * u;
      camCible = { pos: new THREE.Vector3(0, 2.6, 7.6), cible: new THREE.Vector3(0, 2.3, 0) };
      if (u >= 1) {
        changerPhase(P.grattage);
        flash(0.35);
        $('#consigne').hidden = false;
        if ($('#opt-auto').checked) setTimeout(demarrerGrattageAuto, 1200);
      }
      break;
    }
    case P.grattage:
    case P.revele: {
      camCible = { pos: new THREE.Vector3(0, 2.6, 7.6), cible: new THREE.Vector3(0, 2.3, 0) };
      // au moment de la revelation, le ticket remonte et se reduit pour laisser la place au nom du lot
      const haut = phase === P.revele ? easeInOut(clamp(tPhase / 1.2)) : 0;
      ticket.position.set(0, lerp(TICKET_Y, 0.42, haut) + Math.sin(temps * 1.4) * 0.03, TICKET_Z);
      ticket.scale.setScalar(lerp(1, 0.8, haut));
      const visee = phase === P.grattage && (gratteEnCours || grattageAuto) ? 0.25 : 1;
      ticket.rotation.x = lerp(ticket.rotation.x, inclinaison.y * 0.12 * visee + Math.sin(temps * 0.9) * 0.03, dt * 4);
      ticket.rotation.y = lerp(ticket.rotation.y, inclinaison.x * 0.2 * visee + Math.sin(temps * 0.7) * 0.05, dt * 4);
      if (phase === P.grattage) {
        if (grattageAuto) {
          tAuto += dt;
          const u = clamp(tAuto / 4.2);
          const rangs = 6;
          const rang = Math.min(rangs - 1, Math.floor(u * rangs));
          const f = u * rangs - rang;
          const x = 0.04 + (rang % 2 ? 1 - f : f) * 0.92;
          const y = 1 - ((rang + 0.5) / rangs + Math.sin(f * Math.PI * 4) * 0.04);
          const uv = new THREE.Vector2(x, y);
          if (dernierPointAuto && Math.abs(dernierPointAuto.x - x) > 0.5) dernierPoint = null;
          dernierPointAuto = uv;
          const local = new THREE.Vector3(zoneCx + (x - 0.5) * zoneW, zoneCy + (y - 0.5) * zoneH, 0.03);
          gratter(uv, 40, pointMonde(local, ticket));
          piece.position.set(local.x + 0.1, local.y - 0.08, 0.16);
          piece.rotation.z = Math.sin(temps * 12) * 0.2;
          if (u >= 1) pourcentage = 1;
        }
        tMesure += dt;
        if (tMesure > 0.25) {
          tMesure = 0;
          pourcentage = Math.max(pourcentage, mesurerGrattage());
        }
        if (pourcentage >= 0.58) revelerLot();
      } else {
        matGrattage.opacity = Math.max(0, matGrattage.opacity - dt * 1.4);
        if (tPhase < 3 && Math.random() < 0.15) lancerConfettis(pointMonde(new THREE.Vector3(hasard(-1.5, 1.5), 2.6, 0.5), ticket), 6, 1);
      }
      break;
    }
    case P.erreur: {
      vitesseRouleau = Math.max(0, (vitesseRouleau || V_MAX) - dt * 6);
      angleRouleau += vitesseRouleau * dt;
      vitesseTambour = lerp(vitesseTambour, 0, dt);
      if (tPhase < dt * 2) {
        $('#erreur-tirage').textContent = `Tirage non enregistré : ${erreurTirage}`;
        $('#erreur-tirage').hidden = false;
        $('#fin').hidden = false;
      }
      break;
    }
    default:
      break;
  }

  majFaces();
  animerTambour(dt, vitesseTambour, temps);
  etincelles.maj(dt);
  poussiere.maj(dt);
  majConfettis(dt, temps);

  // projecteurs qui respirent
  projecteurs[0].intensity = 140 + Math.sin(temps * 2.1) * 25;
  projecteurs[1].intensity = 140 + Math.cos(temps * 1.7) * 25;

  // camera
  const k = 1 - Math.exp(-dt * camLissage);
  cam.pos.lerp(camCible.pos, k);
  cam.cible.lerp(camCible.cible, k);
  camera.position.copy(cam.pos);
  if (secousse > 0) {
    camera.position.x += hasard(-1, 1) * secousse * 0.25;
    camera.position.y += hasard(-1, 1) * secousse * 0.25;
    secousse = Math.max(0, secousse - dt * 0.9);
  }
  camera.lookAt(cam.cible);

  // flash et bloom
  flashNiveau = Math.max(0, flashNiveau - dt * 1.8);
  $('#flash').style.opacity = String(Math.min(1, flashNiveau * 0.9));
  bloom.strength = 0.55 + flashNiveau * 2.2;

  composer.render();
  requestAnimationFrame(boucle);
}

/* ------------------------------------------------------------------ */
/* Demarrage                                                           */
/* ------------------------------------------------------------------ */
function majInfo(texte) {
  $('#info').textContent = texte;
}

async function preparer() {
  const libelle = $('#mode-libelle');
  libelle.textContent = MODE === 'reel' ? 'Tirage réel' : 'Répétition (démo)';
  libelle.className = `mode ${MODE === 'reel' ? 'reel' : 'demo'}`;
  $('#badge-demo').hidden = MODE === 'reel';
  if (params.get('auto') === '1') $('#opt-auto').checked = true;
  $('#date-tirage').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const [bc, moteka] = await Promise.all([
    chargerImage('/fight-furious/assets/logo/boxing-center.png'),
    chargerImage('/fight-furious/assets/logo/moteka-blanc.svg'),
    chargerPolices(),
  ]);
  logos.bc = bc;
  logos.moteka = moteka;
  const b = peindreBanniere();
  banniere.material.map = b;
  banniere.material.emissiveMap = b;
  banniere.material.color.set(0xffffff);
  banniere.material.emissive.set(0xffffff);
  banniere.material.needsUpdate = true;

  let pret = true;
  try {
    infoTirage = await api('/api/admin/tirage');
    numeros = infoTirage.numeros || [];
    candidats = infoTirage.candidats || [];
  } catch (err) {
    if (MODE === 'reel') {
      pret = false;
      majInfo(err.status === 401 ? 'Session expirée : reconnectez-vous au back-office, puis revenez sur cette page.' : `Impossible de préparer le tirage : ${err.message}`);
    }
  }
  if (MODE === 'demo' && !numeros.length) numeros = Array.from({ length: 160 }, (_, i) => 100 + i);
  if (!candidats.length && numeros.length) {
    candidats = numeros.map((n, i) => {
      const prenom = PRENOMS_DEMO[i % PRENOMS_DEMO.length];
      const initiale = 'ABCDEFGHIJKLMNOPRSTV'[i % 20];
      return {
        numero: n,
        prenom,
        nom: 'Demo',
        initiale,
        label: `${prenom} ${initiale}.`,
      };
    });
  }
  remplirSelectCandidats(candidats);

  redimensionner();
  construireBoules(numeros.length ? numeros : [100]);
  faces.forEach((f) => peindreFace(f, numeroAuHasard()));
  $('#compteur').innerHTML = `<b>${numeros.length}</b> ticket${numeros.length > 1 ? 's' : ''} en jeu`;

  if (MODE === 'reel' && pret) {
    if (infoTirage.deja_tire) {
      pret = false;
      majInfo("Le tirage d'aujourd'hui a déjà eu lieu. Utilisez la répétition ou consultez l'historique.");
    } else if (infoTirage.dans_periode === false) {
      pret = false;
      majInfo('Les tirages réels ont lieu du lundi 23 au vendredi 27 novembre 2026 uniquement. Utilisez la répétition (démo) en attendant.');
    } else if (!numeros.length) {
      pret = false;
      majInfo('Aucun ticket éligible.');
    } else if (!infoTirage.prochain_lot) {
      pret = false;
      majInfo('Aucun lot disponible : vérifiez les lots dans le back-office.');
    } else {
      const lot = LOT_DEMANDE ? infoTirage.lots_restants.find((l) => String(l.id) === LOT_DEMANDE) : infoTirage.prochain_lot;
      majInfo(`${numeros.length} tickets éligibles. Lot : ${lot ? lot.nom : 'prochain lot'}. Choisissez le gagnant puis lancez : le rouleau s’arrêtera sur lui et le résultat sera enregistré.`);
    }
  } else if (MODE === 'demo') {
    majInfo('Répétition : choisissez un gagnant pour tester l’animation (rien n’est enregistré).');
  }
  pretBase = pret;
  const bouton = $('#lancer');
  bouton.textContent = MODE === 'reel' ? 'Lancer le tirage réel' : 'Lancer la démo';
  majBoutonLancer();
  bouton.addEventListener('click', lancer);
  $('#filtre-gagnant').addEventListener('input', (e) => filtrerCandidats(e.target.value));
  $('#choix-gagnant').addEventListener('change', majBoutonLancer);
  document.querySelectorAll('.btn-plein-ecran').forEach((b) => b.addEventListener('click', basculerPleinEcran));
  $('#rejouer').hidden = MODE === 'reel';
  $('#rejouer').addEventListener('click', reinitialiser);
  requestAnimationFrame(boucle);
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    if (phase === P.attente && !$('#lancer').disabled) {
      e.preventDefault();
      lancer();
    }
  } else if (e.key === 'a' || e.key === 'A') demarrerGrattageAuto();
  else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    basculerPleinEcran();
  } else if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('sans-ui');
  else if ((e.key === 'r' || e.key === 'R') && MODE === 'demo') reinitialiser();
});

preparer();
