/**
 * Sequence speciale du lot premium (24 h de location de la Golf 8 R) pour la page de tirage,
 * construite autour de la photo du loueur partenaire (/fight-furious/assets/img/golf-8r.jpg, non retouchee).
 * Garage de nuit : LED rouges et enseigne qui s'allument, rideau metallique qui se leve sur la photo,
 * phares qui s'allument, balayage de lumiere chrome, sol mouille qui reflete la photo (Reflector),
 * pluie fine, fumee, etincelles, trainees lumineuses rouges d'une voiture fantome qui derape devant
 * l'ecran, compte-tours jusqu'a la zone rouge, travelling de camera (effet 2.5D).
 * La photo est affichee telle quelle (materiau sans eclairage, sans brouillard) pour rester nette :
 * la page de tirage coupe le tone mapping et releve le seuil du bloom pendant la sequence.
 * Son moteur synthetise en Web Audio : demarreur, montee de regime, rupteur, petarades, crissement.
 *
 * creerSequenceGolf(...) renvoie { scene, camera, demarrer(), arreter(), maj(dt), redimensionner(w, h), actif }.
 * Les evenements (phares, depart, passage, titre, gagnant, fin) sont transmis par des fonctions de rappel.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lisse = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hasard = (a, b) => a + Math.random() * (b - a);
const angleCourt = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const ROUGE = '#d11414';
const URL_PHOTO = '/fight-furious/assets/img/golf-8r.jpg';
/** Phares avant de la voiture sur la photo (coordonnees de texture : u depuis la gauche, v depuis le bas). */
const PHARES_PHOTO = [[0.565, 0.405], [0.918, 0.413]];

/** Photo chargee des l'import du module (environ 220 Ko) pour etre prete a la revelation. */
let photoTexture = null;
function texturePhoto() {
  if (!photoTexture) {
    photoTexture = new THREE.TextureLoader().load(URL_PHOTO);
    photoTexture.colorSpace = THREE.SRGBColorSpace;
    photoTexture.anisotropy = 8;
  }
  return photoTexture;
}
if (typeof document !== 'undefined') texturePhoto();

/** Couleur lineaire surexposee pour que le bloom fasse briller les lumieres. */
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
/* Textures dessinees (canvas)                                         */
/* ------------------------------------------------------------------ */

/** Asphalte sombre a grain fin. */
function textureAsphalte() {
  const c = toile(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#16161a';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 22000; i += 1) {
    const v = 14 + Math.random() * 38;
    g.fillStyle = `rgb(${v},${v},${v + 2})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  }
  for (let i = 0; i < 10; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = hasard(40, 120);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(0,0,0,.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Carte des flaques (clair = sec et mat, sombre = flaque lisse et transparente au reflet). */
function textureFlaques() {
  const c = toile(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(214,214,214)';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const rx = hasard(30, 110);
    const ry = rx * hasard(0.4, 0.9);
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    grd.addColorStop(0, 'rgba(70,70,70,1)');
    grd.addColorStop(0.65, 'rgba(85,85,85,.9)');
    grd.addColorStop(1, 'rgba(85,85,85,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.fill();
    g.restore();
  }
  for (let i = 0; i < 6000; i += 1) {
    const v = 150 + Math.random() * 90;
    g.fillStyle = `rgba(${v},${v},${v},.25)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const t = texture(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Beton de la facade du garage avec joints de panneaux. */
function textureFacade() {
  const c = toile(1024, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#202024';
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 14000; i += 1) {
    const v = 22 + Math.random() * 30;
    g.fillStyle = `rgb(${v},${v},${v + 3})`;
    g.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,.6)';
  g.lineWidth = 3;
  for (let x = 0; x <= 1024; x += 128) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, 256);
  g.lineTo(1024, 256);
  g.stroke();
  for (let i = 0; i < 20; i += 1) {
    const x = Math.random() * 1024;
    const grd = g.createLinearGradient(0, 300, 0, 512);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = grd;
    g.fillRect(x, 300, hasard(6, 30), 212);
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Lame du rideau metallique : ondulations claires / sombres. */
function textureLame() {
  const c = toile(16, 128);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#3a3c42');
  grd.addColorStop(0.25, '#9a9ea8');
  grd.addColorStop(0.5, '#5a5d65');
  grd.addColorStop(0.75, '#b4b8c0');
  grd.addColorStop(0.92, '#4a4c52');
  grd.addColorStop(1, '#1a1b1e');
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 128);
  return texture(c);
}

/** Bouffee de fumee douce. */
function textureFumee() {
  const c = toile(128, 128);
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i += 1) {
    const x = 64 + hasard(-18, 18);
    const y = 64 + hasard(-18, 18);
    const r = hasard(26, 46);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.32)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  return texture(c);
}

/** Enseigne neon "MOTEKA" au-dessus du garage. */
function textureEnseigne(police) {
  const c = toile(1024, 256);
  const g = c.getContext('2d');
  g.font = `800 150px ${police}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,40,40,1)';
  g.shadowBlur = 40;
  g.fillStyle = '#ff5050';
  g.fillText('MOTEKA', 512, 132);
  g.shadowBlur = 12;
  g.fillStyle = '#ffd6d6';
  g.fillText('MOTEKA', 512, 132);
  return texture(c);
}

/** Compte-tours (redessine a chaque image) : graduations, zone rouge, aiguille, rapport engage. */
function dessinerCompteTours(g, rpm, rupteur, rapport, temps, police) {
  const W = g.canvas.width;
  const cx = W / 2;
  const cy = W / 2;
  const R = W * 0.45;
  const a0 = Math.PI * 0.75;
  const a1 = Math.PI * 2.25;
  const angle = (r) => a0 + (clamp(r, 0, 8000) / 8000) * (a1 - a0);
  const clignote = rupteur && Math.floor(temps * 18) % 2 === 0;
  g.clearRect(0, 0, W, W);

  // cadran
  const fond = g.createRadialGradient(cx, cy * 0.8, R * 0.1, cx, cy, R);
  fond.addColorStop(0, 'rgba(34,34,40,.94)');
  fond.addColorStop(1, 'rgba(4,4,6,.94)');
  g.fillStyle = fond;
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.fill();
  // lunette chromee
  const chrome = g.createLinearGradient(0, cy - R, 0, cy + R);
  chrome.addColorStop(0, '#f2f4f8');
  chrome.addColorStop(0.45, '#5e6168');
  chrome.addColorStop(0.55, '#2a2b30');
  chrome.addColorStop(1, '#c9ccd3');
  g.lineWidth = W * 0.026;
  g.strokeStyle = chrome;
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.stroke();
  if (clignote) {
    g.save();
    g.shadowColor = '#ff2020';
    g.shadowBlur = W * 0.06;
    g.strokeStyle = '#ff2a2a';
    g.lineWidth = W * 0.02;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.stroke();
    g.restore();
  }

  // zone rouge
  g.save();
  g.lineWidth = W * 0.035;
  g.strokeStyle = rpm > 6400 ? '#ff2222' : '#8a0c0c';
  if (rpm > 6400) {
    g.shadowColor = '#ff2020';
    g.shadowBlur = W * 0.04;
  }
  g.beginPath();
  g.arc(cx, cy, R * 0.86, angle(6500), angle(8000));
  g.stroke();
  g.restore();

  // anneau de progression
  g.save();
  g.lineCap = 'round';
  g.lineWidth = W * 0.012;
  g.strokeStyle = rpm > 6500 ? '#ff3a3a' : '#9fd0ff';
  g.shadowColor = g.strokeStyle;
  g.shadowBlur = W * 0.03;
  g.beginPath();
  g.arc(cx, cy, R * 0.94, a0, angle(rpm));
  g.stroke();
  g.restore();

  // graduations
  for (let i = 0; i <= 80; i += 1) {
    const r = i * 100;
    const a = angle(r);
    const majeure = i % 10 === 0;
    const moyenne = i % 5 === 0;
    const l = majeure ? W * 0.055 : moyenne ? W * 0.035 : W * 0.018;
    g.strokeStyle = r >= 6500 ? '#ff4a4a' : '#e9ebf0';
    g.lineWidth = majeure ? W * 0.01 : moyenne ? W * 0.006 : W * 0.003;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
    g.lineTo(cx + Math.cos(a) * (R * 0.8 - l), cy + Math.sin(a) * (R * 0.8 - l));
    g.stroke();
  }
  g.font = `700 ${Math.round(W * 0.085)}px ${police}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k <= 8; k += 1) {
    const a = angle(k * 1000);
    g.fillStyle = k >= 7 ? '#ff4a4a' : '#f4f2ef';
    g.fillText(String(k), cx + Math.cos(a) * R * 0.56, cy + Math.sin(a) * R * 0.56);
  }

  // diodes de passage de rapport
  for (let i = 0; i < 7; i += 1) {
    const seuil = 5200 + i * 380;
    const allume = rupteur ? clignote : rpm >= seuil;
    const couleur = i < 3 ? '#38e06a' : i < 5 ? '#ffc21a' : '#ff2a2a';
    g.save();
    g.fillStyle = allume ? (rupteur ? '#ff2a2a' : couleur) : 'rgba(255,255,255,.08)';
    if (allume) {
      g.shadowColor = g.fillStyle;
      g.shadowBlur = W * 0.03;
    }
    g.beginPath();
    g.arc(cx + (i - 3) * W * 0.06, cy - R * 0.38, W * 0.018, 0, TAU);
    g.fill();
    g.restore();
  }

  // rapport et regime
  g.fillStyle = rupteur ? '#ff3a3a' : '#ffffff';
  g.font = `800 ${Math.round(W * 0.2)}px ${police}`;
  g.fillText(String(rapport), cx, cy + R * 0.3);
  g.fillStyle = 'rgba(244,242,239,.6)';
  g.font = `600 ${Math.round(W * 0.042)}px ${police}`;
  g.fillText('x1000 TR/MIN', cx, cy + R * 0.62);

  // aiguille
  const a = angle(rpm);
  g.save();
  g.translate(cx, cy);
  g.rotate(a);
  g.shadowColor = '#ff2020';
  g.shadowBlur = W * 0.035;
  g.fillStyle = '#ff2a2a';
  g.beginPath();
  g.moveTo(-R * 0.16, -W * 0.012);
  g.lineTo(R * 0.86, -W * 0.004);
  g.lineTo(R * 0.86, W * 0.004);
  g.lineTo(-R * 0.16, W * 0.012);
  g.closePath();
  g.fill();
  g.restore();
  const moyeu = g.createRadialGradient(cx - 4, cy - 4, 0, cx, cy, W * 0.05);
  moyeu.addColorStop(0, '#6a6d75');
  moyeu.addColorStop(1, '#0c0c0e');
  g.fillStyle = moyeu;
  g.beginPath();
  g.arc(cx, cy, W * 0.045, 0, TAU);
  g.fill();
}

/* ------------------------------------------------------------------ */
/* Son moteur (Web Audio, sans fichier)                                */
/* ------------------------------------------------------------------ */
function tamponBruit(ctx, duree) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duree), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  return buf;
}

function courbeSaturation(k) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

function creerSonMoteur(ctx) {
  const t0 = ctx.currentTime;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 6;
  const maitre = ctx.createGain();
  maitre.gain.setValueAtTime(0.0001, t0);
  maitre.gain.exponentialRampToValueAtTime(0.42, t0 + 0.2);
  comp.connect(maitre);
  maitre.connect(ctx.destination);
  const bruitBuf = tamponBruit(ctx, 2);
  const sources = [];
  const demarrerSource = (s) => {
    s.start(t0);
    sources.push(s);
    return s;
  };

  // moteur : trois oscillateurs (allumage 4 cylindres), saturation, passe-bas
  const sat = ctx.createWaveShaper();
  sat.curve = courbeSaturation(14);
  sat.oversample = '2x';
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.Q.value = 2.5;
  filtre.frequency.value = 300;
  const gMoteur = ctx.createGain();
  gMoteur.gain.value = 0;
  sat.connect(filtre);
  filtre.connect(gMoteur);
  gMoteur.connect(comp);
  const oscs = [
    ['sawtooth', 1, 0.5],
    ['square', 0.5, 0.34],
    ['sawtooth', 2.01, 0.16],
  ].map(([type, mult, niveau]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = 30 * mult;
    const g = ctx.createGain();
    g.gain.value = niveau;
    o.connect(g);
    g.connect(sat);
    demarrerSource(o);
    return { o, mult };
  });

  // souffle d'echappement
  const bruit = ctx.createBufferSource();
  bruit.buffer = bruitBuf;
  bruit.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.value = 200;
  const gBruit = ctx.createGain();
  gBruit.gain.value = 0;
  bruit.connect(bp);
  bp.connect(gBruit);
  gBruit.connect(comp);
  demarrerSource(bruit);

  // crissement de pneus
  const cri = ctx.createOscillator();
  cri.type = 'sawtooth';
  cri.frequency.value = 1050;
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 9;
  const gVib = ctx.createGain();
  gVib.gain.value = 60;
  vibrato.connect(gVib);
  gVib.connect(cri.frequency);
  const criFiltre = ctx.createBiquadFilter();
  criFiltre.type = 'bandpass';
  criFiltre.frequency.value = 1150;
  criFiltre.Q.value = 6;
  const bruitCri = ctx.createBufferSource();
  bruitCri.buffer = bruitBuf;
  bruitCri.loop = true;
  const gCri = ctx.createGain();
  gCri.gain.value = 0;
  cri.connect(criFiltre);
  bruitCri.connect(criFiltre);
  criFiltre.connect(gCri);
  gCri.connect(comp);
  demarrerSource(cri);
  demarrerSource(vibrato);
  demarrerSource(bruitCri);

  // nappe grave cinematographique
  const nappe = ctx.createGain();
  nappe.gain.setValueAtTime(0.0001, t0);
  nappe.gain.exponentialRampToValueAtTime(0.06, t0 + 1.5);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 220;
  nf.connect(nappe);
  nappe.connect(comp);
  [55, 55.4, 82.4].forEach((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(nf);
    demarrerSource(o);
  });

  const unCoup = (duree, frequence, q, niveau, type = 'lowpass', retard = 0) => {
    const t = ctx.currentTime + retard;
    const s = ctx.createBufferSource();
    s.buffer = bruitBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequence;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(niveau, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    s.connect(f);
    f.connect(g);
    g.connect(comp);
    s.start(t, Math.random());
    s.stop(t + duree + 0.02);
  };
  const sinus = (f0, f1, duree, niveau, retard = 0) => {
    const t = ctx.currentTime + retard;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + duree);
    const g = ctx.createGain();
    g.gain.setValueAtTime(niveau, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g);
    g.connect(comp);
    o.start(t);
    o.stop(t + duree + 0.02);
  };

  let coupe = false;
  return {
    /** Mise a jour continue : regime (tr/min), charge (0..1), rupteur, crissement (0..1). */
    maj(rpm, charge, rupteur, crissement, temps) {
      const t = ctx.currentTime;
      const f = Math.max(8, (rpm / 60) * 2);
      oscs.forEach(({ o, mult }) => o.frequency.setTargetAtTime(f * mult, t, 0.012));
      filtre.frequency.setTargetAtTime(160 + rpm * 0.42 + charge * 1100, t, 0.03);
      bp.frequency.setTargetAtTime(120 + rpm * 0.18, t, 0.03);
      coupe = rupteur && Math.floor(temps * 22) % 2 === 0;
      const niveau = rpm < 100 ? 0 : coupe ? 0.03 : 0.16 + charge * 0.32;
      gMoteur.gain.setTargetAtTime(niveau, t, 0.008);
      gBruit.gain.setTargetAtTime(rpm < 100 ? 0 : 0.05 + charge * 0.22 * (coupe ? 0.2 : 1), t, 0.02);
      gCri.gain.setTargetAtTime(crissement * 0.09, t, 0.05);
      cri.frequency.setTargetAtTime(980 + crissement * 260, t, 0.08);
    },
    /** Petarade d'echappement au lever de pied. */
    pop() {
      unCoup(hasard(0.04, 0.09), hasard(500, 1100), 1, hasard(0.5, 0.9));
      sinus(hasard(70, 110), 40, 0.12, 0.35);
    },
    /** Demarreur (environ 0,5 s). */
    demarreur() {
      for (let i = 0; i < 6; i += 1) unCoup(0.06, 380, 3, 0.4, 'bandpass', i * 0.075);
      sinus(55, 35, 0.5, 0.15);
    },
    /** Claquement des neons qui s'allument. */
    clac() {
      unCoup(0.05, 3200, 2, 0.3, 'highpass');
      sinus(140, 60, 0.15, 0.2);
    },
    /** Rideau metallique qui s'enroule (cliquetis des lames) puis butee. */
    rideau(duree) {
      const t = ctx.currentTime;
      const n = Math.floor(duree * 16);
      for (let i = 0; i < n; i += 1) unCoup(0.05, hasard(1800, 2800), 4, 0.16, 'bandpass', (i / n) * duree);
      const s = ctx.createBufferSource();
      s.buffer = bruitBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.2);
      g.gain.setValueAtTime(0.08, t + duree - 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      s.connect(f);
      f.connect(g);
      g.connect(comp);
      s.start(t);
      s.stop(t + duree + 0.05);
      sinus(110, 40, 0.4, 0.4, duree);
      unCoup(0.2, 600, 1, 0.4, 'lowpass', duree);
    },
    /** Souffle du passage devant la camera. */
    souffle() {
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = bruitBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      s.connect(f);
      f.connect(g);
      g.connect(comp);
      s.start(t);
      s.stop(t + 1);
    },
    arreter() {
      const t = ctx.currentTime;
      maitre.gain.cancelScheduledValues(t);
      maitre.gain.setValueAtTime(Math.max(0.0001, maitre.gain.value), t);
      maitre.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      sources.forEach((s) => {
        try { s.stop(t + 0.5); } catch { /* deja arretee */ }
      });
      setTimeout(() => maitre.disconnect(), 700);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Effets : trainees lumineuses, fumee, flammes, etincelles             */
/* ------------------------------------------------------------------ */
class Trainee {
  constructor(couleur, largeur, vie = 0.55, max = 90) {
    this.couleur = couleur;
    this.largeur = largeur;
    this.vie = vie;
    this.max = max;
    this.points = [];
    this.pos = new Float32Array(max * 2 * 3);
    this.col = new Float32Array(max * 2 * 3);
    const index = [];
    for (let i = 0; i < max - 1; i += 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setIndex(index);
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
    );
    this.mesh.frustumCulled = false;
  }

  vider() {
    this.points.length = 0;
    this.geo.setDrawRange(0, 0);
  }

  maj(dt, position, actif) {
    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points[0].age > this.vie) this.points.shift();
    if (actif) {
      this.points.push({ p: position.clone(), age: 0 });
      if (this.points.length > this.max) this.points.shift();
    }
    const n = this.points.length;
    for (let i = 0; i < n; i += 1) {
      const { p, age } = this.points[i];
      const k = Math.pow(1 - clamp(age / this.vie), 1.6) * (i / Math.max(1, n - 1));
      const h = this.largeur * (0.4 + 0.6 * k);
      this.pos.set([p.x, p.y + h / 2, p.z, p.x, p.y - h / 2, p.z], i * 6);
      const c = this.couleur;
      this.col.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
  }
}


/* ------------------------------------------------------------------ */
/* Sequence 3D                                                         */
/* ------------------------------------------------------------------ */
export function creerSequenceGolf({ environnement = null, texPoint, police = 'sans-serif', obtenirAudio = () => null, rappels = {} }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040406');
  scene.fog = new THREE.FogExp2(0x060609, 0.026);
  if (environnement) {
    scene.environment = environnement;
    scene.environmentIntensity = 0.4;
  }
  const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 200);
  camera.layers.enable(1);
  scene.add(camera);

  /* --- dimensions : ouverture du garage carree, la photo la remplit exactement --- */
  const Z_FACADE = -6.5;
  const OUV = 4.2;
  const Z_PHOTO = Z_FACADE - 0.42;
  const CY = OUV / 2;

  /* --- sol mouille : miroir (Reflector) sous un asphalte a flaques semi-transparent --- */
  const miroir = new Reflector(new THREE.PlaneGeometry(140, 140), {
    textureWidth: 512,
    textureHeight: 1024,
    color: 0x6e7076,
    clipBias: 0.003,
  });
  miroir.rotation.x = -Math.PI / 2;
  scene.add(miroir);
  const texFlaques = textureFlaques();
  texFlaques.repeat.set(12, 12);
  const texAsphalte = textureAsphalte();
  texAsphalte.repeat.set(28, 28);
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({
      map: texAsphalte, roughness: 0.8, roughnessMap: texFlaques, metalness: 0.05,
      alphaMap: texFlaques, transparent: true, opacity: 0.92, depthWrite: false, envMapIntensity: 0.5,
    })
  );
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = 0.004;
  sol.renderOrder = 1;
  scene.add(sol);

  // ligne de stand pointillee
  const matLigne = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.5, transparent: true, opacity: 0.6, depthWrite: false });
  for (let z = -4.5; z < 14; z += 2.2) {
    for (const x of [-3.4, 3.4]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1.1), matLigne);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, 0.008, z);
      l.renderOrder = 2;
      scene.add(l);
    }
  }

  /* --- la photo, au fond de l'ouverture du garage --- */
  const matPhoto = new THREE.MeshBasicMaterial({ map: texturePhoto(), fog: false, toneMapped: false, color: new THREE.Color(0, 0, 0) });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(OUV, OUV), matPhoto);
  photo.position.set(0, CY, Z_PHOTO);
  scene.add(photo);
  // balayage de lumiere chrome (bande diagonale additive, discrete pour ne pas bruler l'image)
  const cBalayage = toile(512, 512);
  {
    const g = cBalayage.getContext('2d');
    g.translate(256, 256);
    g.rotate(-0.55);
    const grd = g.createLinearGradient(-70, 0, 70, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(-70, -500, 140, 1000);
    g.fillStyle = 'rgba(255,255,255,.2)';
    g.fillRect(95, -500, 10, 1000);
  }
  const texBalayage = texture(cBalayage);
  texBalayage.wrapS = THREE.ClampToEdgeWrapping;
  const matBalayage = new THREE.MeshBasicMaterial({ map: texBalayage, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false, toneMapped: false });
  const balayage = new THREE.Mesh(new THREE.PlaneGeometry(OUV, OUV), matBalayage);
  balayage.position.set(0, CY, Z_PHOTO + 0.01);
  scene.add(balayage);
  // reflets des phares de la photo qui s'allument
  const halosPhares = PHARES_PHOTO.map(([u, v]) => {
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoint, color: new THREE.Color(1.3, 1.4, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    h.position.set((u - 0.5) * OUV, v * OUV, Z_PHOTO + 0.03);
    h.scale.set(0.55, 0.16, 1);
    scene.add(h);
    return h;
  });

  /* --- facade du garage : beton, enseigne, LED rouges, rideau metallique --- */
  const texFacade = textureFacade();
  const morceaux = [
    [-(OUV / 2 + 7.5), 4.75, 15, 9.5],
    [OUV / 2 + 7.5, 4.75, 15, 9.5],
    [0, OUV + (9.5 - OUV) / 2, OUV, 9.5 - OUV],
  ];
  morceaux.forEach(([x, y, w, h]) => {
    const t = texFacade.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 8, h / 4);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0.05 }));
    m.position.set(x, y, Z_FACADE - 0.2);
    scene.add(m);
  });
  // tableau chrome autour de l'ouverture
  const matChrome = new THREE.MeshStandardMaterial({ color: 0xd8dbe2, metalness: 1, roughness: 0.18, envMapIntensity: 1.6 });
  [[0, OUV + 0.04, OUV + 0.16, 0.08], [-(OUV / 2 + 0.04), OUV / 2, 0.08, OUV + 0.08], [OUV / 2 + 0.04, OUV / 2, 0.08, OUV + 0.08]].forEach(([x, y, w, h]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), matChrome);
    b.position.set(x, y, Z_FACADE + 0.02);
    scene.add(b);
  });
  const enseigne = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 1.0),
    new THREE.MeshBasicMaterial({ map: textureEnseigne(police), transparent: true, depthWrite: false, color: new THREE.Color(0, 0, 0) })
  );
  enseigne.position.set(0, OUV + 1.45, Z_FACADE + 0.02);
  scene.add(enseigne);
  const matLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
  [
    [0, OUV + 0.7, OUV + 0.9, 0.05],
    [-(OUV / 2 + 0.45), OUV / 2 + 0.2, 0.05, OUV + 0.8],
    [OUV / 2 + 0.45, OUV / 2 + 0.2, 0.05, OUV + 0.8],
  ].forEach(([x, y, w, h]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), matLed);
    b.position.set(x, y, Z_FACADE + 0.03);
    scene.add(b);
  });
  const caisson = new THREE.Mesh(
    new RoundedBoxGeometry(OUV + 0.5, 0.5, 0.45, 3, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x222327, metalness: 0.8, roughness: 0.35 })
  );
  caisson.position.set(0, OUV + 0.3, Z_FACADE + 0.2);
  scene.add(caisson);
  const lames = [];
  const matLame = new THREE.MeshStandardMaterial({ map: textureLame(), metalness: 0.85, roughness: 0.38, envMapIntensity: 1.2 });
  const matBasLame = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.6, roughness: 0.4 });
  const NB_LAMES = 19;
  const H_LAME = OUV / (NB_LAMES - 1);
  for (let i = 0; i < NB_LAMES; i += 1) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(OUV, H_LAME * 0.98, 0.05), i === 0 ? matBasLame : matLame);
    l.userData.y0 = i * H_LAME + H_LAME / 2;
    l.position.set(0, l.userData.y0, Z_FACADE + 0.06);
    scene.add(l);
    lames.push(l);
  }
  // halo de lumiere qui s'echappe sous le rideau
  const cHalo = toile(256, 128);
  {
    const g = cHalo.getContext('2d');
    const grd = g.createRadialGradient(128, 0, 0, 128, 0, 128);
    grd.addColorStop(0, 'rgba(255,200,170,.8)');
    grd.addColorStop(0.5, 'rgba(255,70,60,.3)');
    grd.addColorStop(1, 'rgba(255,40,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
  }
  const haloSol = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 6),
    new THREE.MeshBasicMaterial({ map: texture(cHalo), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })
  );
  haloSol.rotation.x = -Math.PI / 2;
  haloSol.position.set(0, 0.02, Z_FACADE + 3);
  haloSol.renderOrder = 3;
  scene.add(haloSol);

  /* --- circuit de nuit : pylones d'eclairage au loin --- */
  const halos = [];
  for (const [x, z] of [[-12, -3], [12, -4], [-15, 12], [16, 10]]) {
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 12, 8), new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.6, roughness: 0.5 }));
    mat.position.set(x, 6, z);
    scene.add(mat);
    const tete = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.4) }));
    tete.position.set(x, 12.2, z);
    tete.lookAt(0, 0, 2);
    scene.add(tete);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoint, color: 0xfff1dc, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    h.scale.set(6, 6, 1);
    h.position.set(x, 12.2, z);
    scene.add(h);
    halos.push(h);
  }

  /* --- lumieres (la photo n'en depend pas : elles eclairent le decor) --- */
  scene.add(new THREE.HemisphereLight(0x8a96b8, 0x120406, 0.3));
  const lune = new THREE.DirectionalLight(0xa8b8ff, 0.35);
  lune.position.set(-6, 10, 6);
  scene.add(lune);
  const lumRouge = new THREE.PointLight(ROUGE, 0, 9, 1.4);
  lumRouge.position.set(0, 0.6, Z_FACADE + 1.4);
  scene.add(lumRouge);
  const fuite = new THREE.PointLight(0xffe2cc, 0, 7, 1.5);
  fuite.position.set(0, 0.3, Z_FACADE + 0.6);
  scene.add(fuite);

  /* --- voiture fantome : seulement ses lumieres, qui derapent devant la photo --- */
  const lumArriere = new THREE.PointLight('#ff1a1a', 0, 7, 1.4);
  const lumAvant = new THREE.PointLight(0xdfe8ff, 0, 9, 1.4);
  scene.add(lumArriere, lumAvant);
  const trainees = [
    new Trainee(neon('#ff2020', 2.4), 0.08, 0.7),
    new Trainee(neon('#ff2020', 2.4), 0.08, 0.7),
    new Trainee(new THREE.Color(1.5, 1.6, 1.9), 0.05, 0.35),
    new Trainee(new THREE.Color(1.5, 1.6, 1.9), 0.05, 0.35),
  ];
  trainees.forEach((t) => scene.add(t.mesh));
  const trajet = new THREE.CatmullRomCurve3(
    [
      [-9, -4.4], [-3.5, -4.1], [1.2, -3.6], [3.3, -1.6], [2.9, 1.0], [0.6, 2.4],
      [-2.0, 1.6], [-2.7, -0.9], [-0.6, -2.5], [3.0, -2.7], [10, -2.0],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal'
  );
  const fantome = { pos: new THREE.Vector3(), cap: 0, derive: 0, uPrec: 0 };
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const avantV = new THREE.Vector3();
  const droiteV = new THREE.Vector3();
  const capA = (u) => {
    trajet.getTangentAt(clamp(u, 0, 1), tmpA);
    return Math.atan2(tmpA.x, tmpA.z);
  };

  /* --- fumee --- */
  const texFumee = textureFumee();
  const NB_FUMEE = 160;
  const fumees = Array.from({ length: NB_FUMEE }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFumee, color: 0xa9acb4, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false;
    s.userData = { v: new THREE.Vector3(), vie: 0, duree: 1, taille: 1, rot: 0, max: 0.4 };
    scene.add(s);
    return s;
  });
  let prochaineFumee = 0;
  function emettreFumee(o, n, force = 1, max = 0.4) {
    for (let i = 0; i < n; i += 1) {
      const s = fumees[prochaineFumee];
      prochaineFumee = (prochaineFumee + 1) % NB_FUMEE;
      const u = s.userData;
      s.position.copy(o).add(new THREE.Vector3(hasard(-0.15, 0.15), hasard(0, 0.1), hasard(-0.15, 0.15)));
      u.v.set(hasard(-0.8, 0.8) * force, hasard(0.25, 0.8), hasard(-0.3, 1) * force);
      u.duree = hasard(1.6, 2.8);
      u.vie = u.duree;
      u.taille = hasard(0.5, 0.9);
      u.rot = hasard(-0.6, 0.6);
      u.max = max;
      s.material.rotation = hasard(0, TAU);
      s.visible = true;
    }
  }
  function majFumee(dt) {
    for (const s of fumees) {
      const u = s.userData;
      if (u.vie <= 0) {
        s.visible = false;
        continue;
      }
      u.vie -= dt;
      const k = 1 - u.vie / u.duree;
      u.v.multiplyScalar(1 - dt * 0.9);
      u.v.y += dt * 0.12;
      s.position.addScaledVector(u.v, dt);
      const t = u.taille * (1 + k * 4.5);
      s.scale.set(t, t, 1);
      s.material.rotation += u.rot * dt;
      s.material.opacity = u.max * lisse(0, 0.08, k) * (1 - k);
    }
  }

  /* --- etincelles --- */
  const MAXP = 900;
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
    new THREE.PointsMaterial({ size: 0.07, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  );
  points.frustumCulled = false;
  scene.add(points);
  const COULEURS = [[2.6, 0.25, 0.2], [2.2, 2.2, 2.2], [2.6, 1.5, 0.4]];
  function etincelles(o, n, vitesse = 4, duree = 1.2) {
    for (let i = 0; i < n; i += 1) {
      const j = pProchain;
      pProchain = (pProchain + 1) % MAXP;
      pPos.set([o.x, o.y, o.z], j * 3);
      const d = new THREE.Vector3(hasard(-1, 1), hasard(-0.2, 1), hasard(-1, 1)).normalize();
      const v = vitesse * hasard(0.3, 1);
      pVel.set([d.x * v, d.y * v + 1, d.z * v], j * 3);
      pBase.set(COULEURS[(Math.random() * COULEURS.length) | 0], j * 3);
      pDuree[j] = duree * hasard(0.6, 1.2);
      pVie[j] = pDuree[j];
    }
  }
  function majEtincelles(dt) {
    for (let j = 0; j < MAXP; j += 1) {
      if (pVie[j] <= 0) {
        pCol[j * 3] = pCol[j * 3 + 1] = pCol[j * 3 + 2] = 0;
        continue;
      }
      pVie[j] -= dt;
      pVel[j * 3 + 1] -= 6 * dt;
      for (let a = 0; a < 3; a += 1) pPos[j * 3 + a] += pVel[j * 3 + a] * dt;
      if (pPos[j * 3 + 1] < 0.02) {
        pPos[j * 3 + 1] = 0.02;
        pVel[j * 3 + 1] *= -0.35;
      }
      const k = clamp(pVie[j] / pDuree[j]);
      for (let a = 0; a < 3; a += 1) pCol[j * 3 + a] = pBase[j * 3 + a] * k;
    }
    geoP.attributes.position.needsUpdate = true;
    geoP.attributes.color.needsUpdate = true;
  }

  /* --- pluie fine --- */
  const NB_PLUIE = 650;
  const pluiePos = new Float32Array(NB_PLUIE * 6);
  const geoPluie = new THREE.BufferGeometry();
  geoPluie.setAttribute('position', new THREE.BufferAttribute(pluiePos, 3));
  const gouttes = Array.from({ length: NB_PLUIE }, () => new THREE.Vector3(hasard(-10, 10), hasard(0, 11), hasard(-6, 12)));
  const pluie = new THREE.LineSegments(
    geoPluie,
    new THREE.LineBasicMaterial({ color: 0x8fa2c4, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  pluie.frustumCulled = false;
  scene.add(pluie);
  function majPluie(dt) {
    for (let i = 0; i < NB_PLUIE; i += 1) {
      const g = gouttes[i];
      g.y -= dt * 13;
      g.x += dt * 1.2;
      if (g.y < 0) {
        g.y += 11;
        g.x = hasard(-10, 10);
      }
      pluiePos.set([g.x, g.y, g.z, g.x - 0.03, g.y + 0.32, g.z], i * 6);
    }
    geoPluie.attributes.position.needsUpdate = true;
  }

  /* --- compte-tours (espace camera, calque 1 : absent du reflet), sous la photo --- */
  const cTours = toile(512, 512);
  const gTours = cTours.getContext('2d');
  const texTours = texture(cTours);
  const hud = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texTours, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0, toneMapped: false })
  );
  hud.renderOrder = 10;
  hud.layers.set(1);
  camera.add(hud);
  function placerHud() {
    const d = 2;
    const demiH = d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const demiL = demiH * camera.aspect;
    const taille = Math.min(demiH * 0.48, demiL * 0.8);
    hud.scale.set(taille, taille, 1);
    hud.position.set(0, -demiH + taille * 0.5 + demiH * 0.05, -d);
  }

  /** Distance de camera pour que la photo occupe la bande centrale (entre le titre et les textes du bas). */
  function distanceHeros() {
    const tanV = Math.tan(THREE.MathUtils.degToRad(25));
    const parHauteur = OUV / (0.5 * 2 * tanV);
    const parLargeur = OUV / (0.9 * 2 * tanV * camera.aspect);
    return Math.max(parHauteur, parLargeur);
  }

  /* --- deroule --- */
  const T_LED = 0.3;
  const T_RIDEAU = 0.8;
  const D_RIDEAU = 1.8;
  const T_DEMARREUR = 1.2;
  const T_PHARES = 2.0;
  const T_DEPART = 3.1;
  const D_COURSE = 3.4;
  const T_ARRET = T_DEPART + D_COURSE;
  const T_TITRE = T_ARRET + 0.1;
  const T_GAGNANT = T_ARRET + 1.4;
  const T_FIN = T_ARRET + 4.2;

  let t = 0;
  let temps = 0;
  let evts = {};
  let son = null;
  let rpm = 0;
  let rapport = 'N';
  let chargePrec = 0;
  let pops = 0;
  let tPop = 0;
  let secousse = 0;
  let tBalayage = -1;
  const camPos = new THREE.Vector3();
  const camVise = new THREE.Vector3();

  /** Regime vise, rapport et charge selon le moment de la sequence. */
  function scenario(tc) {
    if (tc < T_DEMARREUR) return { cible: 0, rapport: 'N', charge: 0 };
    if (tc < T_DEMARREUR + 0.45) return { cible: 260 + Math.sin(tc * 70) * 80, rapport: 'N', charge: 0.3 };
    if (tc < 2.1) return { cible: 980, rapport: 'N', charge: 0.1 };
    if (tc < 2.3) return { cible: 5600, rapport: 'N', charge: 1 };
    if (tc < 2.5) return { cible: 1500, rapport: 'N', charge: 0 };
    if (tc < T_DEPART) return { cible: 8000, rapport: 1, charge: 1 };
    if (tc < T_ARRET) {
      const tau = (tc - T_DEPART) / D_COURSE;
      if (tau < 0.14) return { cible: 8000, rapport: 1, charge: 1 };
      if (tau < 0.38) return { cible: 5300 + ((tau - 0.14) / 0.24) * 2500, rapport: 2, charge: 1 };
      if (tau < 0.62) return { cible: 6300 + Math.sin(tc * 9) * 700, rapport: 2, charge: 0.85 };
      if (tau < 0.72) return { cible: 5800, rapport: 3, charge: 1 };
      return { cible: 7600 - (tau - 0.72) * 4000, rapport: 3, charge: tau < 0.9 ? 1 : 0 };
    }
    if (tc >= T_GAGNANT && tc < T_GAGNANT + 0.55) return { cible: 8000, rapport: 'N', charge: 1 };
    if (tc >= T_GAGNANT + 0.55 && tc < T_GAGNANT + 1.0) return { cible: 1400, rapport: 'N', charge: 0 };
    return { cible: 1050, rapport: 'N', charge: 0.1 };
  }

  const seq = {
    scene,
    camera,
    actif: false,
    demarrer() {
      t = 0;
      evts = {};
      seq.actif = true;
      rpm = 0;
      rapport = 'N';
      chargePrec = 0;
      pops = 0;
      tPop = 0;
      secousse = 0;
      tBalayage = -1;
      fantome.derive = 0;
      fantome.uPrec = 0;
      matPhoto.color.setScalar(0);
      matBalayage.opacity = 0;
      halosPhares.forEach((h) => { h.material.opacity = 0; });
      lames.forEach((l) => { l.position.y = l.userData.y0; l.visible = true; });
      haloSol.material.opacity = 0;
      matLed.color.setRGB(0, 0, 0);
      enseigne.material.color.setRGB(0, 0, 0);
      lumRouge.intensity = 0;
      fuite.intensity = 0;
      lumArriere.intensity = 0;
      lumAvant.intensity = 0;
      hud.material.opacity = 0;
      trainees.forEach((tr) => tr.vider());
      fumees.forEach((s) => { s.userData.vie = 0; s.visible = false; });
      pVie.fill(0);
      const d = distanceHeros();
      camPos.set(0.4, CY + 0.2, Z_PHOTO + d + 2.6);
      camVise.set(0, CY, Z_PHOTO);
      son?.arreter();
      son = null;
      const ctx = obtenirAudio();
      if (ctx) {
        try {
          if (ctx.state === 'suspended') ctx.resume();
          son = creerSonMoteur(ctx);
        } catch {
          son = null;
        }
      }
      placerHud();
    },
    arreter() {
      seq.actif = false;
      son?.arreter();
      son = null;
    },
    redimensionner(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      miroir.getRenderTarget().setSize(Math.max(64, Math.round(w * dpr * 0.5)), Math.max(64, Math.round(h * dpr * 0.5)));
      placerHud();
    },
    maj(dt) {
      if (!seq.actif) return;
      dt = Math.min(dt, 1 / 20);
      t += dt;
      temps += dt;

      /* LED rouges et enseigne */
      if (t >= T_LED && !evts.led) {
        evts.led = true;
        son?.clac();
      }
      const scintille = t < T_LED ? 0 : t < T_LED + 0.5 ? (Math.sin(t * 61) > 0.2 || Math.random() < 0.2 ? 1 : 0.05) : 1;
      matLed.color.copy(neon(ROUGE, 3 * scintille * (0.92 + Math.sin(temps * 4) * 0.08)));
      enseigne.material.color.setScalar(1.7 * scintille);
      lumRouge.intensity = 24 * scintille;

      /* rideau metallique qui s'enroule et revele la photo */
      if (t >= T_RIDEAU && !evts.rideau) {
        evts.rideau = true;
        son?.rideau(D_RIDEAU);
      }
      const leve = easeInOut(clamp((t - T_RIDEAU) / D_RIDEAU)) * (OUV + 0.1);
      lames.forEach((l, i) => {
        const y = l.userData.y0 + leve;
        l.position.y = y + (leve > 0 && leve < OUV ? Math.sin(temps * 40 + i) * 0.004 : 0);
        l.visible = y - H_LAME / 2 < OUV;
      });
      haloSol.material.opacity = clamp(leve / 1.2) * 0.7 * (1 - lisse(T_DEPART, T_DEPART + 1, t) * 0.5);
      fuite.intensity = 18 * clamp(leve / 1.5);
      // le showroom s'allume derriere le rideau (quelques clignotements), sans jamais surexposer la photo
      const tLum = t - (T_RIDEAU + 0.25);
      const lumPhoto = tLum < 0 ? 0.12 : tLum < 0.5 ? (Math.sin(tLum * 55) > 0 ? 0.85 : 0.3) : lisse(0.5, 1.1, tLum) * 0.15 + 0.85;
      matPhoto.color.setScalar(lumPhoto);
      if (t > T_RIDEAU && t < T_RIDEAU + D_RIDEAU && Math.random() < dt * 25) {
        emettreFumee(new THREE.Vector3(hasard(-1.8, 1.8), 0.1, Z_FACADE + 0.4), 1, 0.4, 0.28);
      }

      /* demarreur, phares de la photo */
      if (t >= T_DEMARREUR && !evts.demarreur) {
        evts.demarreur = true;
        son?.demarreur();
      }
      if (t >= T_PHARES && !evts.phares) {
        evts.phares = true;
        tBalayage = 0;
        rappels.phares?.();
      }
      if (t >= T_PHARES) {
        const u = t - T_PHARES;
        const k = u < 0.1 ? 1 : u < 0.2 ? 0.15 : lisse(0.2, 0.45, u);
        halosPhares.forEach((h, i) => {
          h.material.opacity = 0.75 * k * (0.92 + Math.sin(temps * 3 + i) * 0.08);
        });
      }

      /* balayage chrome sur la photo (au reveal des phares et a l'arrivee du titre) */
      if (tBalayage >= 0) {
        tBalayage += dt;
        const k = clamp(tBalayage / 1.1);
        texBalayage.offset.x = lerp(0.85, -0.85, easeInOut(k));
        matBalayage.opacity = 0.32 * Math.sin(k * Math.PI);
        if (k >= 1) tBalayage = -1;
      }

      /* regime moteur */
      const sc = scenario(t);
      const kRpm = sc.cible > rpm ? 9 : 5;
      rpm += (sc.cible - rpm) * (1 - Math.exp(-dt * kRpm));
      const rupteur = sc.cible >= 7900 && rpm > 7550;
      const rpmAffiche = rupteur ? 7700 + Math.sin(temps * 70) * 220 : rpm;
      if (typeof sc.rapport === 'number' && typeof rapport === 'number' && sc.rapport > rapport) pops = Math.max(pops, 2);
      rapport = sc.rapport;
      if (chargePrec > 0.5 && sc.charge < 0.2 && rpm > 3000) pops = Math.max(pops, 5);
      if (rupteur && Math.random() < dt * 6) pops = Math.max(pops, 1);
      chargePrec = sc.charge;

      /* launch control : fumee de burn devant la photo */
      let crissement = 0;
      if (t > 2.5 && t < T_DEPART) {
        crissement = 0.5;
        if (Math.random() < dt * 30) emettreFumee(new THREE.Vector3(hasard(-1.6, 1.6), 0.12, Z_FACADE + 0.5), 1, 0.7, 0.32);
      }

      /* voiture fantome : trainees lumineuses en derapage devant la photo */
      const enCourse = t >= T_DEPART && t < T_ARRET;
      if (enCourse) {
        if (!evts.depart) {
          evts.depart = true;
          secousse = 0.3;
          rappels.depart?.();
          etincelles(new THREE.Vector3(0, 0.2, Z_FACADE + 0.6), 120, 4, 1);
        }
        const tau = clamp((t - T_DEPART) / D_COURSE);
        const u = clamp(0.65 * tau + 0.35 * easeInOut(tau));
        trajet.getPointAt(u, fantome.pos);
        const courbure = angleCourt(capA(u + 0.035) - capA(u));
        const cible = clamp(courbure * 7, -0.8, 0.8);
        fantome.derive += (cible - fantome.derive) * (1 - Math.exp(-dt * 5));
        fantome.cap = capA(u) + fantome.derive;
        avantV.set(Math.sin(fantome.cap), 0, Math.cos(fantome.cap));
        droiteV.set(avantV.z, 0, -avantV.x);
        crissement = Math.max(crissement, clamp(Math.abs(fantome.derive) / 0.6));
        const arriere = tmpB.copy(fantome.pos).addScaledVector(avantV, -2.1);
        lumArriere.position.copy(arriere).setY(0.8);
        lumAvant.position.copy(fantome.pos).addScaledVector(avantV, 2.6).setY(0.7);
        lumArriere.intensity = 30;
        lumAvant.intensity = 40;
        if (Math.random() < dt * 60 * crissement) emettreFumee(arriere.clone().setY(0.12), 1, 0.9, 0.38);
        if (Math.random() < dt * 8 * crissement) etincelles(arriere.clone().setY(0.05), 12, 2.5, 0.6);
        if (!evts.passage && fantome.pos.distanceTo(camera.position) < 5.2 && tau > 0.3) {
          evts.passage = true;
          secousse = 0.5;
          son?.souffle();
          rappels.passage?.();
        }
      } else {
        lumArriere.intensity = Math.max(0, lumArriere.intensity - dt * 60);
        lumAvant.intensity = Math.max(0, lumAvant.intensity - dt * 80);
      }
      for (let i = 0; i < 4; i += 1) {
        const feu = i < 2;
        const cote = i % 2 ? 1 : -1;
        tmpA.copy(fantome.pos).addScaledVector(avantV, feu ? -2.1 : 2.15).addScaledVector(droiteV, cote * (feu ? 0.62 : 0.6));
        tmpA.y = feu ? 0.9 : 0.72;
        trainees[i].maj(dt, tmpA, enCourse);
      }

      /* petarades */
      tPop -= dt;
      if (pops > 0 && tPop <= 0) {
        pops -= 1;
        tPop = hasard(0.06, 0.16);
        son?.pop();
        if (enCourse) etincelles(tmpB.copy(fantome.pos).addScaledVector(avantV, -2.3).setY(0.3), 18, 2, 0.4);
      }

      /* son */
      son?.maj(rpm, sc.charge, rupteur, crissement, temps);

      /* compte-tours */
      const kHud = lisse(T_DEMARREUR, T_DEMARREUR + 0.4, t) * (1 - lisse(T_ARRET - 0.4, T_ARRET + 0.2, t));
      hud.material.opacity = kHud;
      hud.visible = kHud > 0.01;
      if (hud.visible) {
        dessinerCompteTours(gTours, rpmAffiche, rupteur, rapport, temps, police);
        texTours.needsUpdate = true;
      }

      /* evenements de fin */
      if (t >= T_TITRE && !evts.titre) {
        evts.titre = true;
        tBalayage = 0;
        rappels.titre?.();
      }
      if (t >= T_GAGNANT && !evts.gagnant) {
        evts.gagnant = true;
        secousse = 0.12;
        etincelles(new THREE.Vector3(-2.4, 0.1, Z_PHOTO + 2.5), 160, 5, 1.5);
        etincelles(new THREE.Vector3(2.4, 0.1, Z_PHOTO + 2.5), 160, 5, 1.5);
        rappels.gagnant?.();
      }
      if (t >= T_FIN && !evts.fin) {
        evts.fin = true;
        rappels.fin?.();
      }
      if (t > T_ARRET && Math.random() < dt * 3) emettreFumee(new THREE.Vector3(hasard(-3, 3), 0.08, hasard(Z_FACADE + 0.5, Z_FACADE + 3)), 1, 0.3, 0.22);

      /* camera : approche, travelling bas pendant la glisse, puis plan fixe sur la photo */
      const d = distanceHeros();
      let pos;
      let vise;
      if (t < T_DEPART) {
        const k = easeInOut(clamp(t / T_DEPART));
        pos = tmpA.set(lerp(0.4, -0.25, k), lerp(CY + 0.2, CY - 0.35, k), Z_PHOTO + d + lerp(2.6, 0.6, k));
        vise = tmpB.set(0, lerp(CY, CY - 0.2, k), Z_PHOTO);
      } else if (t < T_ARRET) {
        const tau = (t - T_DEPART) / D_COURSE;
        const k = Math.sin(clamp(tau) * Math.PI);
        pos = tmpA.set(lerp(-0.25, 0.9, tau), lerp(CY - 0.35, 1.0, k), Z_PHOTO + d + lerp(0.6, 1.2, k));
        vise = tmpB.set(fantome.pos.x * 0.35 * k, lerp(CY - 0.2, 1.1, k), lerp(Z_PHOTO, fantome.pos.z - 2, k * 0.6));
      } else {
        const v = t - T_ARRET;
        const k = easeInOut(clamp(v / 1.6));
        const derive = Math.sin(v * 0.3) * 0.35;
        pos = tmpA.set(lerp(0.9, derive, k), lerp(1.0, CY, k), Z_PHOTO + d + lerp(1.2, 0.15 + Math.sin(v * 0.2) * 0.1, k));
        vise = tmpB.set(derive * 0.2, CY, Z_PHOTO);
      }
      camPos.lerp(pos, 1 - Math.exp(-dt * 4));
      camVise.lerp(vise, 1 - Math.exp(-dt * 5));
      camera.position.copy(camPos);
      if (secousse > 0) {
        camera.position.x += hasard(-1, 1) * secousse * 0.06;
        camera.position.y += hasard(-1, 1) * secousse * 0.06;
        secousse = Math.max(0, secousse - dt * 1.2);
      }
      camera.lookAt(camVise);

      halos.forEach((h, i) => { h.material.opacity = 0.38 + Math.sin(temps * 0.7 + i) * 0.04; });
      majFumee(dt);
      majEtincelles(dt);
      majPluie(dt);
    },
  };
  return seq;
}
