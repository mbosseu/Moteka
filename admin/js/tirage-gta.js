/**
 * Sequence speciale du lot masterclass (jeu GTA 6 sur PS5) pour la page de tirage.
 * Ambiance neon "Vice City" 100 % maison : coucher de soleil degrade, palmiers en silhouette,
 * grille synthwave qui defile, brume, neons roses et cyan, boitier de jeu PS5 3D avec jaquette
 * dessinee en canvas (aucune image telechargee, aucun logo officiel).
 *
 * creerSequenceGta(...) renvoie { scene, camera, demarrer(), arreter(), maj(dt), redimensionner(w, h), actif }.
 * Les evenements (impact, titre, gagnant, fin) sont transmis par des fonctions de rappel.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const hasard = (a, b) => a + Math.random() * (b - a);

const ROSE = '#ff2e93';
const CYAN = '#18e4ff';
const VIOLET_NUIT = '#14052b';

/** Couleur lineaire "surexposee" pour que le bloom fasse briller les neons. */
function neon(hex, force) {
  return new THREE.Color(hex).multiplyScalar(force);
}

function toile(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function texture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ------------------------------------------------------------------ */
/* Dessins 2D (canvas)                                                 */
/* ------------------------------------------------------------------ */

/** Soleil synthwave : disque degrade jaune -> rose, coupe de bandes horizontales en bas. */
function dessinerSoleil(g, cx, cy, r) {
  g.save();
  const grd = g.createLinearGradient(0, cy - r, 0, cy + r);
  grd.addColorStop(0, '#fff3a0');
  grd.addColorStop(0.45, '#ffb04a');
  grd.addColorStop(0.75, '#ff4f7b');
  grd.addColorStop(1, '#d81b8c');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  let y = cy - r * 0.05;
  let ep = r * 0.025;
  while (y < cy + r) {
    g.fillRect(cx - r - 2, y, r * 2 + 4, ep);
    y += ep + r * 0.11;
    ep *= 1.32;
  }
  g.restore();
}

/** Palmier en silhouette (tronc courbe et palmes), pied en (x, y), hauteur h, penche vers sens (+1 / -1). */
function dessinerPalmier(g, x, y, h, sens = 1, couleur = '#0b0217') {
  g.save();
  g.fillStyle = couleur;
  g.strokeStyle = couleur;
  const sx = x + sens * h * 0.22;
  const sy = y - h;
  // tronc : segments de largeur decroissante
  const n = 14;
  for (let i = 0; i < n; i += 1) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const px = (t) => x + (sx - x) * t + sens * Math.sin(t * Math.PI) * h * 0.06;
    const py = (t) => y + (sy - y) * t;
    g.lineWidth = lerp(h * 0.05, h * 0.022, t0);
    g.beginPath();
    g.moveTo(px(t0), py(t0));
    g.lineTo(px(t1), py(t1));
    g.stroke();
  }
  // palmes
  const palmes = [-2.7, -2.2, -1.6, -1.0, -0.45, 0.1, 0.6, 1.15, 1.75, 2.35];
  for (const a0 of palmes) {
    const a = a0 - Math.PI / 2;
    const L = h * hasard(0.36, 0.5);
    const ex = sx + Math.cos(a) * L;
    const ey = sy + Math.sin(a) * L * 0.55 + L * 0.28;
    const cx = sx + Math.cos(a) * L * 0.5;
    const cy = sy + Math.sin(a) * L * 0.5 - L * 0.12;
    g.lineWidth = h * 0.012;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(cx, cy, ex, ey);
    g.stroke();
    // folioles
    for (let k = 1; k < 12; k += 1) {
      const t = k / 12;
      const bx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
      const by = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
      const lf = L * 0.2 * Math.sin(t * Math.PI) + L * 0.03;
      g.lineWidth = h * 0.007;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + Math.cos(a + s * 1.1) * lf * 0.5, by + lf * 0.85);
        g.stroke();
      }
    }
  }
  g.beginPath();
  g.arc(sx, sy, h * 0.03, 0, TAU);
  g.fill();
  g.restore();
}

/** Skyline : immeubles en silhouette avec fenetres neon, entre x0 et x1, sol en y. */
function dessinerSkyline(g, x0, x1, y, hMax, couleur = '#1b0733', fenetres = true) {
  g.save();
  let x = x0;
  while (x < x1) {
    const w = hasard(hMax * 0.12, hMax * 0.28);
    const h = hasard(hMax * 0.3, hMax);
    g.fillStyle = couleur;
    g.fillRect(x, y - h, w, h);
    if (Math.random() < 0.3) g.fillRect(x + w * 0.4, y - h - hMax * 0.08, w * 0.12, hMax * 0.08);
    if (fenetres) {
      for (let fy = y - h + hMax * 0.05; fy < y - hMax * 0.03; fy += hMax * 0.06) {
        for (let fx = x + w * 0.15; fx < x + w * 0.85; fx += w * 0.22) {
          if (Math.random() < 0.28) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(255,90,170,.85)' : 'rgba(40,230,255,.8)';
            g.fillRect(fx, fy, w * 0.08, hMax * 0.022);
          }
        }
      }
    }
    x += w + hasard(0, hMax * 0.03);
  }
  g.restore();
}

/** Texte en italique "maison" (cisaillement) avec contour et degrade. */
function titreGta(g, texte, cx, cy, taille, police, maxW = Infinity) {
  g.save();
  g.translate(cx, cy);
  g.transform(1, 0, -0.18, 1, 0, 0);
  g.font = `800 ${taille}px ${police}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const grd = g.createLinearGradient(0, -taille * 0.75, 0, 0);
  grd.addColorStop(0, '#fff8c8');
  grd.addColorStop(0.45, '#ffb347');
  grd.addColorStop(1, '#ff2e93');
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(255, 46, 147, .9)';
  g.shadowBlur = taille * 0.12;
  g.strokeStyle = '#12031f';
  g.lineWidth = taille * 0.09;
  g.strokeText(texte, 0, 0, maxW);
  g.shadowBlur = 0;
  g.fillStyle = grd;
  g.fillText(texte, 0, 0, maxW);
  g.lineWidth = taille * 0.012;
  g.strokeStyle = 'rgba(255,255,255,.75)';
  g.strokeText(texte, 0, 0, maxW);
  g.restore();
}

/**
 * Jaquette maison du boitier PS5 (format 13,5 x 17 cm) : bandeau bleu "PS5",
 * coucher de soleil, skyline, palmiers et titre "GTA VI".
 */
export function peindreJaquette(c, police) {
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const bandeau = Math.round(H * 0.105);
  // ciel
  const ciel = g.createLinearGradient(0, bandeau, 0, H * 0.72);
  ciel.addColorStop(0, '#1a0638');
  ciel.addColorStop(0.35, '#5a0f6e');
  ciel.addColorStop(0.7, '#d4246f');
  ciel.addColorStop(1, '#ff8a4c');
  g.fillStyle = ciel;
  g.fillRect(0, bandeau, W, H - bandeau);
  // etoiles
  g.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 0; i < 70; i += 1) g.fillRect(Math.random() * W, bandeau + Math.random() * H * 0.25, 2, 2);
  // soleil
  const horizon = H * 0.66;
  g.save();
  g.beginPath();
  g.rect(0, 0, W, horizon);
  g.clip();
  g.shadowColor = 'rgba(255,90,120,.9)';
  g.shadowBlur = W * 0.08;
  dessinerSoleil(g, W * 0.5, H * 0.5, W * 0.3);
  g.restore();
  // skyline
  dessinerSkyline(g, -10, W + 10, horizon, H * 0.2, '#22073d');
  // mer avec reflets
  const mer = g.createLinearGradient(0, horizon, 0, H);
  mer.addColorStop(0, '#3a0b55');
  mer.addColorStop(1, '#0d0220');
  g.fillStyle = mer;
  g.fillRect(0, horizon, W, H - horizon);
  for (let i = 0; i < 16; i += 1) {
    const yy = horizon + 6 + i * i * 1.25;
    if (yy > H * 0.8) break;
    const lw = W * (0.36 - i * 0.018);
    g.fillStyle = `rgba(255, ${120 + i * 6}, 120, ${0.75 - i * 0.04})`;
    g.fillRect(W / 2 - lw / 2 + hasard(-8, 8), yy, lw, 2 + i * 0.35);
  }
  // ligne de grille au sol (perspective)
  g.save();
  g.strokeStyle = 'rgba(24,228,255,.55)';
  g.lineWidth = 2;
  for (let i = -8; i <= 8; i += 1) {
    g.beginPath();
    g.moveTo(W / 2 + i * W * 0.02, H * 0.8);
    g.lineTo(W / 2 + i * W * 0.16, H);
    g.stroke();
  }
  for (let k = 0; k < 6; k += 1) {
    const yy = H * 0.8 + Math.pow(k / 6, 1.8) * H * 0.2;
    g.beginPath();
    g.moveTo(0, yy);
    g.lineTo(W, yy);
    g.stroke();
  }
  g.restore();
  // palmiers
  dessinerPalmier(g, W * 0.08, H * 0.98, H * 0.62, 1);
  dessinerPalmier(g, W * 0.95, H * 0.98, H * 0.55, -1);
  dessinerPalmier(g, W * 0.22, H * 0.9, H * 0.34, 1, '#130426');
  // titre
  titreGta(g, 'GTA VI', W * 0.5, H * 0.86, Math.round(W * 0.3), police, W * 0.86);
  // sous-titre
  g.save();
  g.font = `700 ${Math.round(W * 0.042)}px ${police}`;
  g.textAlign = 'center';
  g.fillStyle = CYAN;
  g.shadowColor = CYAN;
  g.shadowBlur = 16;
  const sous = 'L O T   M A S T E R C L A S S';
  g.fillText(sous, W * 0.5, H * 0.925);
  g.restore();
  // bandeau bleu PS5
  const bleu = g.createLinearGradient(0, 0, 0, bandeau);
  bleu.addColorStop(0, '#1b5fe0');
  bleu.addColorStop(1, '#0a3aa8');
  g.fillStyle = bleu;
  g.fillRect(0, 0, W, bandeau);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.fillRect(0, bandeau - 3, W, 3);
  g.fillStyle = '#ffffff';
  g.font = `800 ${Math.round(bandeau * 0.62)}px ${police}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('PS5', W * 0.05, bandeau * 0.54);
  g.textAlign = 'right';
  g.font = `600 ${Math.round(bandeau * 0.26)}px ${police}`;
  g.fillText('FIGHT & FURIOUS x MOTEKA', W * 0.95, bandeau * 0.54);
  // cadre fin
  g.strokeStyle = 'rgba(255,255,255,.18)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, W - 4, H - 4);
}

function peindreDosBoitier(c, police) {
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const bandeau = Math.round(H * 0.105);
  const fond = g.createLinearGradient(0, 0, 0, H);
  fond.addColorStop(0, '#1a0638');
  fond.addColorStop(1, '#07010f');
  g.fillStyle = fond;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#0a3aa8';
  g.fillRect(0, 0, W, bandeau);
  g.fillStyle = '#fff';
  g.font = `800 ${Math.round(bandeau * 0.62)}px ${police}`;
  g.textBaseline = 'middle';
  g.fillText('PS5', W * 0.05, bandeau * 0.54);
  titreGta(g, 'GTA VI', W * 0.5, H * 0.32, Math.round(W * 0.2), police, W * 0.8);
  for (let i = 0; i < 4; i += 1) {
    const x = W * 0.08 + (i % 2) * W * 0.44;
    const y = H * 0.4 + Math.floor(i / 2) * H * 0.2;
    const grd = g.createLinearGradient(x, y, x, y + H * 0.17);
    grd.addColorStop(0, i % 2 ? '#d4246f' : '#5a0f6e');
    grd.addColorStop(1, '#ff8a4c');
    g.fillStyle = grd;
    g.fillRect(x, y, W * 0.4, H * 0.17);
    dessinerPalmier(g, x + W * 0.05, y + H * 0.17, H * 0.14, 1);
  }
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = `700 ${Math.round(W * 0.05)}px ${police}`;
  g.fillText('LOT MASTERCLASS', W / 2, H * 0.86);
  g.font = `500 ${Math.round(W * 0.034)}px ${police}`;
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.fillText('Finale du samedi 28 novembre 2026 · offert par Moteka', W / 2, H * 0.91);
}

function peindreTranche(c, police) {
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  g.fillStyle = '#0d1f6b';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b5fe0';
  g.fillRect(0, 0, W, H * 0.105);
  g.fillStyle = '#fff';
  g.font = `800 ${Math.round(W * 0.55)}px ${police}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PS5', W / 2, H * 0.055);
  g.save();
  g.translate(W / 2, H * 0.55);
  g.rotate(Math.PI / 2);
  g.font = `800 ${Math.round(W * 0.62)}px ${police}`;
  g.fillStyle = '#ffb347';
  g.fillText('GTA VI', 0, 0);
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Sequence 3D                                                         */
/* ------------------------------------------------------------------ */
export function creerSequenceGta({ environnement = null, texPoint, police = 'sans-serif', rappels = {} }) {
  const scene = new THREE.Scene();
  const BRUME = new THREE.Color('#2a0a45');
  scene.background = new THREE.Color(VIOLET_NUIT);
  scene.fog = new THREE.Fog(BRUME, 18, 95);
  if (environnement) {
    scene.environment = environnement;
    scene.environmentIntensity = 0.7;
  }
  const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 300);
  scene.add(camera);

  const SOL_Y = -1.7;

  /* --- ciel degrade --- */
  const cCiel = toile(16, 1024);
  {
    const g = cCiel.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 1024);
    grd.addColorStop(0, '#090218');
    grd.addColorStop(0.5, '#1d0640');
    grd.addColorStop(0.7, '#4e0f6b');
    grd.addColorStop(0.83, '#b51d74');
    grd.addColorStop(0.93, '#ff5a6e');
    grd.addColorStop(1, '#ff9a4f');
    g.fillStyle = grd;
    g.fillRect(0, 0, 16, 1024);
  }
  const ciel = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 140),
    new THREE.MeshBasicMaterial({ map: texture(cCiel), fog: false, depthWrite: false })
  );
  ciel.position.set(0, SOL_Y + 70 - 6, -120);
  scene.add(ciel);

  // etoiles
  {
    const n = 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = hasard(-160, 160);
      pos[i * 3 + 1] = hasard(18, 70);
      pos[i * 3 + 2] = -110;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, map: texPoint, transparent: true, depthWrite: false, fog: false, color: 0xffffff, opacity: 0.7 })));
  }

  /* --- soleil synthwave --- */
  const cSoleil = toile(1024, 1024);
  dessinerSoleil(cSoleil.getContext('2d'), 512, 512, 500);
  const matSoleil = new THREE.MeshBasicMaterial({ map: texture(cSoleil), transparent: true, fog: false, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) });
  const soleil = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), matSoleil);
  soleil.position.set(0, SOL_Y + 9, -112);
  scene.add(soleil);
  const cHalo = toile(256, 256);
  {
    const g = cHalo.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,120,140,.9)');
    grd.addColorStop(0.4, 'rgba(255,60,150,.35)');
    grd.addColorStop(1, 'rgba(255,60,150,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ map: texture(cHalo), transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false })
  );
  halo.position.set(0, SOL_Y + 9, -114);
  scene.add(halo);

  /* --- skyline au loin --- */
  const cVille = toile(2048, 400);
  dessinerSkyline(cVille.getContext('2d'), 0, 2048, 400, 220, '#1c0636');
  const ville = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 23.4),
    new THREE.MeshBasicMaterial({ map: texture(cVille), transparent: true, alphaTest: 0.05, fog: false, depthWrite: false })
  );
  ville.position.set(0, SOL_Y + 11.7, -100);
  scene.add(ville);

  /* --- bande de brume a l'horizon --- */
  const cBrume = toile(8, 256);
  {
    const g = cBrume.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(255,80,160,0)');
    grd.addColorStop(0.6, 'rgba(255,80,160,.55)');
    grd.addColorStop(1, 'rgba(120,30,140,.0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 256);
  }
  const brumeHorizon = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 14),
    new THREE.MeshBasicMaterial({ map: texture(cBrume), transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false })
  );
  brumeHorizon.position.set(0, SOL_Y + 3, -90);
  scene.add(brumeHorizon);

  /* --- grille synthwave au sol --- */
  const uniformsGrille = {
    uDefile: { value: 0 },
    uLigne: { value: neon(ROSE, 2.2) },
    uLigne2: { value: neon(CYAN, 1.6) },
    uFond: { value: new THREE.Color('#0b0218') },
    uBrume: { value: BRUME.clone() },
  };
  const grille = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 220, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: uniformsGrille,
      vertexShader: /* glsl */ `
        varying vec3 vMonde;
        void main() {
          vec4 m = modelMatrix * vec4(position, 1.0);
          vMonde = m.xyz;
          gl_Position = projectionMatrix * viewMatrix * m;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uDefile;
        uniform vec3 uLigne;
        uniform vec3 uLigne2;
        uniform vec3 uFond;
        uniform vec3 uBrume;
        varying vec3 vMonde;
        void main() {
          vec2 p = vec2(vMonde.x, vMonde.z + uDefile) / 2.0;
          vec2 d = abs(fract(p - 0.5) - 0.5) / fwidth(p);
          float l = 1.0 - min(min(d.x, d.y), 1.0);
          float dist = -vMonde.z + 8.0;
          float pres = smoothstep(110.0, 10.0, dist);
          vec3 couleur = mix(uLigne2, uLigne, smoothstep(0.0, 60.0, dist));
          vec3 c = uFond + couleur * l * pres;
          c += vec3(0.25, 0.04, 0.2) * smoothstep(40.0, 110.0, dist);
          c = mix(c, uBrume, smoothstep(55.0, 115.0, dist));
          gl_FragColor = vec4(c, 1.0);
        }`,
      fog: false,
    })
  );
  grille.rotation.x = -Math.PI / 2;
  grille.position.set(0, SOL_Y, -95);
  scene.add(grille);

  /* --- palmiers en silhouette --- */
  const palmiers = [];
  function texturePalmier(seed) {
    const c = toile(1024, 1024);
    const g = c.getContext('2d');
    dessinerPalmier(g, 300, 1020, 680 + seed * 20, 1, '#0a0114');
    return texture(c);
  }
  const texPalmiers = [texturePalmier(0), texturePalmier(1), texturePalmier(2)];
  const placements = [
    [-3.3, -3.2, 6.4, 1], [3.5, -3.6, 6.9, -1],
    [-6.5, -12, 8.5, 1], [7.2, -14, 9, -1],
    [-12, -26, 10, 1], [13, -24, 10, -1], [-19, -38, 11, 1], [21, -40, 11, -1],
  ];
  placements.forEach(([x, z, h, sens], i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(h, h),
      new THREE.MeshBasicMaterial({ map: texPalmiers[i % 3], transparent: true, alphaTest: 0.4, color: 0xffffff, side: THREE.DoubleSide })
    );
    m.scale.x = sens;
    m.position.set(x + sens * h * 0.21, SOL_Y + h / 2, z);
    m.userData.base = m.position.x;
    m.userData.phase = Math.random() * TAU;
    scene.add(m);
    palmiers.push(m);
  });

  /* --- cadre neon derriere le boitier --- */
  const matRose = new THREE.MeshBasicMaterial({ color: neon(ROSE, 3.2), fog: false });
  const matCyan = new THREE.MeshBasicMaterial({ color: neon(CYAN, 2.6), fog: false });
  const cadre = new THREE.Group();
  const CW = 3.0;
  const CH = 3.7;
  const ep = 0.045;
  [[0, CH / 2, CW, ep], [0, -CH / 2, CW, ep], [-CW / 2, 0, ep, CH], [CW / 2, 0, ep, CH]].forEach(([x, y, w, h]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, ep), matRose);
    b.position.set(x, y, 0);
    cadre.add(b);
  });
  [[0, CH / 2 + 0.16, CW * 0.7, ep * 0.8], [0, -CH / 2 - 0.16, CW * 0.7, ep * 0.8]].forEach(([x, y, w, h]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, ep), matCyan);
    b.position.set(x, y, 0);
    cadre.add(b);
  });
  cadre.position.set(0, 0.3, -2.2);
  scene.add(cadre);

  // tubes verticaux de part et d'autre
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.5, 8), s < 0 ? matCyan : matRose);
    t.position.set(s * 3.9, SOL_Y + 2.75, -6);
    scene.add(t);
  }

  /* --- lumieres --- */
  scene.add(new THREE.HemisphereLight(0xff6ab8, 0x2a0a45, 0.9));
  const lumRose = new THREE.PointLight(ROSE, 40, 14, 1.5);
  const lumCyan = new THREE.PointLight(CYAN, 34, 14, 1.5);
  scene.add(lumRose, lumCyan);
  const face = new THREE.SpotLight(0xffffff, 60, 20, 0.5, 0.6, 1.2);
  face.position.set(0.5, 2.5, 6);
  scene.add(face, face.target);
  const lumImpact = new THREE.PointLight(0xffd0f0, 0, 12, 1.4);
  lumImpact.position.set(0, 0.4, 1.4);
  scene.add(lumImpact);

  /* --- boitier PS5 --- */
  const BW = 1.9;
  const BH = 2.39;
  const BD = 0.14;
  const boite = new THREE.Group();
  const corps = new THREE.Mesh(
    new RoundedBoxGeometry(BW, BH, BD, 4, 0.035),
    new THREE.MeshPhysicalMaterial({ color: 0x0f47c4, roughness: 0.18, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0x05123a })
  );
  boite.add(corps);
  const cJaq = toile(1024, 1288);
  const cDos = toile(1024, 1288);
  const cTranche = toile(96, 1288);
  const texJaq = texture(cJaq);
  const texDos = texture(cDos);
  const texTranche = texture(cTranche);
  const matJaq = new THREE.MeshPhysicalMaterial({ map: texJaq, emissiveMap: texJaq, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 });
  const avant = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.07, BH - 0.07), matJaq);
  avant.position.z = BD / 2 + 0.003;
  boite.add(avant);
  const arriere = new THREE.Mesh(
    new THREE.PlaneGeometry(BW - 0.07, BH - 0.07),
    new THREE.MeshPhysicalMaterial({ map: texDos, emissiveMap: texDos, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.35, clearcoat: 1 })
  );
  arriere.position.z = -BD / 2 - 0.003;
  arriere.rotation.y = Math.PI;
  boite.add(arriere);
  const tranche = new THREE.Mesh(
    new THREE.PlaneGeometry(BD - 0.02, BH - 0.07),
    new THREE.MeshPhysicalMaterial({ map: texTranche, emissiveMap: texTranche, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.3, clearcoat: 1 })
  );
  tranche.position.x = -BW / 2 - 0.003;
  tranche.rotation.y = -Math.PI / 2;
  boite.add(tranche);

  // reflet qui balaie la jaquette
  const cReflet = toile(512, 512);
  {
    const g = cReflet.getContext('2d');
    g.translate(256, 256);
    g.rotate(-0.5);
    const grd = g.createLinearGradient(-60, 0, 60, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(-60, -500, 120, 1000);
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.fillRect(80, -500, 14, 1000);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 512, 3);
    g.clearRect(0, 509, 512, 3);
    g.clearRect(0, 0, 3, 512);
    g.clearRect(509, 0, 3, 512);
  }
  const texReflet = texture(cReflet);
  texReflet.wrapS = THREE.ClampToEdgeWrapping;
  const matReflet = new THREE.MeshBasicMaterial({ map: texReflet, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6, fog: false });
  const reflet = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.07, BH - 0.07), matReflet);
  reflet.position.z = BD / 2 + 0.006;
  boite.add(reflet);
  boite.position.set(0, 0.3, 0);
  scene.add(boite);

  // ombre / reflet neon au sol sous le boitier
  const cTache = toile(256, 256);
  {
    const g = cTache.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,46,147,.7)');
    grd.addColorStop(1, 'rgba(255,46,147,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }
  const tache = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3),
    new THREE.MeshBasicMaterial({ map: texture(cTache), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
  );
  tache.rotation.x = -Math.PI / 2;
  tache.position.set(0, SOL_Y + 0.01, 0);
  scene.add(tache);

  // onde de choc a l'impact
  const onde = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 96),
    new THREE.MeshBasicMaterial({ color: neon(ROSE, 3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
  );
  onde.position.set(0, 0.3, -0.2);
  scene.add(onde);
  const onde2 = onde.clone();
  onde2.material = onde.material.clone();
  onde2.material.color = neon(CYAN, 2.6);
  scene.add(onde2);

  /* --- particules neon --- */
  const MAXP = 1400;
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  const pVel = new Float32Array(MAXP * 3);
  const pBase = new Float32Array(MAXP * 3);
  const pVie = new Float32Array(MAXP);
  const pDuree = new Float32Array(MAXP).fill(1);
  let pProchain = 0;
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  geoP.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(
    geoP,
    new THREE.PointsMaterial({ size: 0.08, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  );
  points.frustumCulled = false;
  scene.add(points);
  const COULEURS = [[2.4, 0.4, 1.3], [0.3, 2.0, 2.4], [2.4, 1.6, 0.5], [1.6, 0.6, 2.4]];
  function emettre(o, n, vitesse = 4, duree = 1.4, gravite = 1) {
    for (let i = 0; i < n; i += 1) {
      const j = pProchain;
      pProchain = (pProchain + 1) % MAXP;
      pPos[j * 3] = o.x;
      pPos[j * 3 + 1] = o.y;
      pPos[j * 3 + 2] = o.z;
      const d = new THREE.Vector3(hasard(-1, 1), hasard(-1, 1), hasard(-1, 1)).normalize();
      const v = vitesse * hasard(0.25, 1);
      pVel[j * 3] = d.x * v;
      pVel[j * 3 + 1] = d.y * v + gravite * 0.5;
      pVel[j * 3 + 2] = d.z * v;
      const c = COULEURS[(Math.random() * COULEURS.length) | 0];
      pBase[j * 3] = c[0];
      pBase[j * 3 + 1] = c[1];
      pBase[j * 3 + 2] = c[2];
      pDuree[j] = duree * hasard(0.6, 1.2);
      pVie[j] = pDuree[j];
    }
  }
  function majParticules(dt) {
    for (let j = 0; j < MAXP; j += 1) {
      if (pVie[j] <= 0) {
        pCol[j * 3] = pCol[j * 3 + 1] = pCol[j * 3 + 2] = 0;
        continue;
      }
      pVie[j] -= dt;
      pVel[j * 3 + 1] -= 2.4 * dt;
      pVel[j * 3] *= 0.98;
      pVel[j * 3 + 2] *= 0.98;
      pPos[j * 3] += pVel[j * 3] * dt;
      pPos[j * 3 + 1] += pVel[j * 3 + 1] * dt;
      pPos[j * 3 + 2] += pVel[j * 3 + 2] * dt;
      const k = clamp(pVie[j] / pDuree[j]);
      pCol[j * 3] = pBase[j * 3] * k;
      pCol[j * 3 + 1] = pBase[j * 3 + 1] * k;
      pCol[j * 3 + 2] = pBase[j * 3 + 2] * k;
    }
    geoP.attributes.position.needsUpdate = true;
    geoP.attributes.color.needsUpdate = true;
  }

  // brume basse qui derive
  const nappes = [];
  const cNappe = toile(128, 128);
  {
    const g = cNappe.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const texNappe = texture(cNappe);
  for (let i = 0; i < 14; i += 1) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texNappe, color: i % 2 ? 0xff4fae : 0x8a3cff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    );
    s.scale.set(hasard(6, 10), hasard(1.5, 2.5), 1);
    s.position.set(hasard(-8, 8), SOL_Y + hasard(0.2, 0.9), hasard(-14, 1));
    s.userData.v = hasard(0.15, 0.4) * (Math.random() < 0.5 ? -1 : 1);
    scene.add(s);
    nappes.push(s);
  }

  /* --- confettis neon --- */
  const NB_CONF = 360;
  const confettis = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.06, 0.11),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }),
    NB_CONF
  );
  confettis.frustumCulled = false;
  scene.add(confettis);
  const paletteConf = [neon(ROSE, 1.8), neon(CYAN, 1.6), neon('#ffd84a', 1.5), neon('#a24bff', 1.8), new THREE.Color(1.4, 1.4, 1.4)];
  const etatConf = Array.from({ length: NB_CONF }, (_, i) => {
    confettis.setColorAt(i, paletteConf[i % paletteConf.length]);
    return { p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), vr: new THREE.Vector3(), vie: 0 };
  });
  let prochainConf = 0;
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const un = new THREE.Vector3(1, 1, 1);
  function lancerConfettis(o, n, force = 3.5) {
    for (let i = 0; i < n; i += 1) {
      const c = etatConf[prochainConf];
      prochainConf = (prochainConf + 1) % NB_CONF;
      c.p.copy(o).add(new THREE.Vector3(hasard(-0.5, 0.5), hasard(-0.2, 0.2), hasard(-0.3, 0.3)));
      c.v.set(hasard(-1, 1) * force, hasard(0.5, 1.4) * force, hasard(-0.2, 1) * force * 0.6);
      c.r.set(hasard(0, TAU), hasard(0, TAU), hasard(0, TAU));
      c.vr.set(hasard(-9, 9), hasard(-9, 9), hasard(-9, 9));
      c.vie = hasard(3, 5.5);
    }
  }
  function pluie(n) {
    for (let i = 0; i < n; i += 1) {
      const c = etatConf[prochainConf];
      prochainConf = (prochainConf + 1) % NB_CONF;
      c.p.set(hasard(-2.4, 2.4), hasard(3.6, 4.4), hasard(-1, 1.5));
      c.v.set(hasard(-0.3, 0.3), hasard(-0.6, -0.2), 0);
      c.r.set(hasard(0, TAU), hasard(0, TAU), hasard(0, TAU));
      c.vr.set(hasard(-6, 6), hasard(-6, 6), hasard(-6, 6));
      c.vie = hasard(4, 6);
    }
  }
  function majConfettis(dt, t) {
    for (let i = 0; i < NB_CONF; i += 1) {
      const c = etatConf[i];
      if (c.vie > 0) {
        c.vie -= dt;
        c.v.y -= 5 * dt;
        c.v.multiplyScalar(0.975);
        c.v.y = Math.max(c.v.y, -1.3);
        c.p.addScaledVector(c.v, dt);
        c.p.x += Math.sin(t * 3 + i) * 0.005;
        c.r.x += c.vr.x * dt;
        c.r.y += c.vr.y * dt;
        c.r.z += c.vr.z * dt;
      } else c.p.y = -50;
      quat.setFromEuler(c.r);
      mat4.compose(c.p, quat, un);
      confettis.setMatrixAt(i, mat4);
    }
    confettis.instanceMatrix.needsUpdate = true;
  }

  /* --- deroule --- */
  const T_ARRIVEE = 2.7;
  const T_TITRE = 3.1;
  const T_GAGNANT = 4.5;
  const T_FIN = 7.5;
  let t = 0;
  let temps = 0;
  let evts = {};
  let jaquettePeinte = false;
  const seq = {
    scene,
    camera,
    actif: false,
    demarrer() {
      if (!jaquettePeinte) {
        peindreJaquette(cJaq, police);
        peindreDosBoitier(cDos, police);
        peindreTranche(cTranche, police);
        texJaq.needsUpdate = true;
        texDos.needsUpdate = true;
        texTranche.needsUpdate = true;
        jaquettePeinte = true;
      }
      t = 0;
      evts = {};
      seq.actif = true;
      boite.position.set(0, 1.6, -42);
      boite.rotation.set(0, 0, 0);
      onde.material.opacity = 0;
      onde2.material.opacity = 0;
      lumImpact.intensity = 0;
      etatConf.forEach((c) => { c.vie = 0; });
      pVie.fill(0);
    },
    arreter() {
      seq.actif = false;
    },
    redimensionner(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    maj(dt) {
      if (!seq.actif) return;
      t += dt;
      temps += dt;

      // arrivee du boitier en vrille depuis l'horizon
      const u = clamp(t / T_ARRIVEE);
      const e = easeOutQuint(u);
      if (t < T_ARRIVEE) {
        boite.position.set(Math.sin(u * Math.PI) * 1.2, lerp(1.6, 0.3, easeOut(u)), lerp(-42, 0, e));
        boite.rotation.set(lerp(0.6, 0, e), lerp(TAU * 5, 0, e), lerp(-0.4, 0, e));
        if (Math.random() < 0.9) {
          const o = boite.position.clone();
          emettre(o.add(new THREE.Vector3(hasard(-0.8, 0.8), hasard(-1, 1), 0)), 6, 1.2, 0.9, 0);
        }
      } else {
        const v = t - T_ARRIVEE;
        boite.position.set(0, 0.3 + Math.sin(v * 1.3) * 0.05, Math.sin(v * 9) * Math.exp(-v * 5) * 0.25);
        boite.rotation.set(Math.sin(v * 0.8) * 0.05, Math.sin(v * 0.6) * 0.42, Math.sin(v * 0.5) * 0.02);
      }

      // impact
      if (t >= T_ARRIVEE && !evts.impact) {
        evts.impact = true;
        const centre = new THREE.Vector3(0, 0.3, 0.3);
        emettre(centre, 700, 7, 1.8, 1);
        lancerConfettis(centre.clone().add(new THREE.Vector3(0, 0.8, 0)), 260, 4);
        lumImpact.intensity = 140;
        rappels.impact?.();
      }
      if (evts.impact) {
        const v = t - T_ARRIVEE;
        const k = clamp(v / 1.1);
        onde.scale.setScalar(lerp(1, 6, easeOut(k)));
        onde.material.opacity = (1 - k) * 0.9;
        const k2 = clamp((v - 0.15) / 1.3);
        onde2.scale.setScalar(lerp(1, 5, easeOut(k2)));
        onde2.material.opacity = v > 0.15 ? (1 - k2) * 0.8 : 0;
        lumImpact.intensity = Math.max(0, lumImpact.intensity - dt * 160);
      }
      if (t >= T_TITRE && !evts.titre) {
        evts.titre = true;
        rappels.titre?.();
      }
      if (t >= T_GAGNANT && !evts.gagnant) {
        evts.gagnant = true;
        lancerConfettis(new THREE.Vector3(-1.6, -1, 0.8), 120, 3.6);
        lancerConfettis(new THREE.Vector3(1.6, -1, 0.8), 120, 3.6);
        emettre(new THREE.Vector3(0, -1.2, 0.8), 260, 5, 1.6, 1);
        rappels.gagnant?.();
      }
      if (t >= T_FIN && !evts.fin) {
        evts.fin = true;
        rappels.fin?.();
      }
      if (t > T_GAGNANT && Math.random() < dt * 6) pluie(4);
      if (t > T_ARRIVEE && Math.random() < dt * 1.2) emettre(new THREE.Vector3(hasard(-1.4, 1.4), hasard(-0.8, 1.6), 0.4), 30, 2.4, 1.1, 0.5);

      // reflet qui balaie la jaquette toutes les 3 s
      const cycle = ((t + 1.2) % 3) / 3;
      texReflet.offset.x = lerp(0.9, -0.9, cycle);
      matReflet.opacity = 0.55 + (t < T_ARRIVEE ? 0.3 : 0);

      // decor vivant
      uniformsGrille.uDefile.value = (temps * 6) % 2000;
      soleil.scale.setScalar(1 + Math.sin(temps * 0.8) * 0.015);
      halo.material.opacity = 0.8 + Math.sin(temps * 1.6) * 0.15;
      const clignote = Math.random() < 0.03 ? 0.35 : 1;
      matRose.color.copy(neon(ROSE, 3.2 * clignote + Math.sin(temps * 5) * 0.2));
      matCyan.color.copy(neon(CYAN, 2.6 + Math.sin(temps * 3.3) * 0.3));
      cadre.scale.setScalar(evts.impact ? 1 + Math.sin(temps * 2) * 0.01 : lerp(0.6, 1, clamp(t / T_ARRIVEE)));
      lumRose.position.set(Math.cos(temps * 0.9) * 2.6, 1.4 + Math.sin(temps * 1.3) * 0.6, 2.2);
      lumCyan.position.set(Math.cos(temps * 0.9 + Math.PI) * 2.6, 0.2 + Math.cos(temps * 1.1) * 0.6, 2.2);
      palmiers.forEach((p) => {
        p.rotation.z = Math.sin(temps * 0.7 + p.userData.phase) * 0.012;
      });
      nappes.forEach((s) => {
        s.position.x += s.userData.v * dt;
        if (s.position.x > 10) s.position.x = -10;
        if (s.position.x < -10) s.position.x = 10;
      });
      tache.material.opacity = evts.impact ? 0.9 + Math.sin(temps * 3) * 0.1 : clamp(1 - (-boite.position.z) / 20);

      // camera : rase la grille puis remonte face au boitier
      const c = easeOut(clamp(t / 3.2));
      camera.position.set(Math.sin(temps * 0.35) * 0.25 * c, lerp(-1.1, 0.42, c), lerp(9.5, 6.5, c));
      camera.lookAt(0, lerp(1.2, 0.6, c), lerp(-20, 0, c));

      majParticules(dt);
      majConfettis(dt, temps);
    },
  };
  return seq;
}
