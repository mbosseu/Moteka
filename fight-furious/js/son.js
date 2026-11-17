/* FIGHT & Furious · moteur sonore synthétisé (Web Audio, aucun fichier son).
   Un moteur 6 cylindres dont le régime suit l'aiguille, une cloche de ring. */
window.Son = (() => {
  let ctx = null, maitre, moteurGain, filtre, bruitGain, bruitFiltre, oscs = [], analyseur;
  let coupe = false;
  const etat = { rpm: 0, charge: 0, volume: 0 };

  function courbe(k = 3) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x); }
    return c;
  }

  function init() {
    if (ctx) return ctx.resume();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    maitre = ctx.createGain(); maitre.gain.value = coupe ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    analyseur = ctx.createAnalyser(); analyseur.fftSize = 512;
    maitre.connect(comp).connect(analyseur).connect(ctx.destination);

    // moteur : trois oscillateurs saturés puis filtrés
    const somme = ctx.createGain(); somme.gain.value = .5;
    const sat = ctx.createWaveShaper(); sat.curve = courbe(4); sat.oversample = "4x";
    filtre = ctx.createBiquadFilter(); filtre.type = "lowpass"; filtre.Q.value = 3; filtre.frequency.value = 300;
    moteurGain = ctx.createGain(); moteurGain.gain.value = 0;
    [["sawtooth", 1, .6], ["square", .5, .5], ["sawtooth", 2.01, .18], ["triangle", .25, .5]].forEach(([type, mult, g]) => {
      const o = ctx.createOscillator(); o.type = type;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(somme); o.start(); oscs.push({ o, mult });
    });
    somme.connect(sat).connect(filtre).connect(moteurGain).connect(maitre);

    // souffle d'admission / échappement
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const bruit = ctx.createBufferSource(); bruit.buffer = buf; bruit.loop = true;
    bruitFiltre = ctx.createBiquadFilter(); bruitFiltre.type = "bandpass"; bruitFiltre.Q.value = .8;
    bruitGain = ctx.createGain(); bruitGain.gain.value = 0;
    bruit.connect(bruitFiltre).connect(bruitGain).connect(maitre); bruit.start();

    requestAnimationFrame(boucle);
    return ctx.resume();
  }

  // applique le régime en continu (avec un léger tremblement de ralenti)
  function boucle() {
    const t = ctx.currentTime;
    const rpm = Math.max(0, etat.rpm);
    const tremble = rpm < 1500 ? (Math.random() - .5) * 40 : 0;
    const f = Math.max(4, (rpm + tremble) / 20); // 6 cylindres : 3 allumages par tour
    oscs.forEach(({ o, mult }) => o.frequency.setTargetAtTime(f * mult, t, .02));
    filtre.frequency.setTargetAtTime(220 + rpm * .55 + etat.charge * 1400, t, .04);
    const v = etat.volume * (rpm < 60 ? 0 : .35 + Math.min(1, rpm / 9000) * .45 + etat.charge * .25);
    moteurGain.gain.setTargetAtTime(v, t, .05);
    bruitFiltre.frequency.setTargetAtTime(600 + rpm * .35, t, .05);
    bruitGain.gain.setTargetAtTime(etat.volume * (.04 + rpm / 9000 * .12 + etat.charge * .08), t, .05);
    requestAnimationFrame(boucle);
  }

  // cloche de ring : partiels inharmoniques à décroissance exponentielle
  function cloche(coups = 1, ecart = .32) {
    if (!ctx) return;
    for (let k = 0; k < coups; k++) {
      const t0 = ctx.currentTime + k * ecart;
      [[1, .5], [2.02, .28], [2.76, .22], [4.07, .12], [5.4, .08]].forEach(([r, g]) => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 760 * r;
        const e = ctx.createGain();
        e.gain.setValueAtTime(0, t0);
        e.gain.linearRampToValueAtTime(g * .5, t0 + .004);
        e.gain.exponentialRampToValueAtTime(.0001, t0 + 1.8 / Math.sqrt(r));
        o.connect(e).connect(maitre); o.start(t0); o.stop(t0 + 2);
      });
    }
  }

  // petit clic mécanique
  function clic() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square"; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(300, t + .04);
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    o.connect(g).connect(maitre); o.start(t); o.stop(t + .06);
  }

  function couper(oui) {
    coupe = oui;
    if (!ctx) return;
    const t = ctx.currentTime;
    maitre.gain.cancelScheduledValues(t);
    maitre.gain.setValueAtTime(maitre.gain.value, t);
    maitre.gain.linearRampToValueAtTime(oui ? 0 : 1, t + .25);
  }

  function niveau() {
    if (!analyseur) return new Uint8Array(0);
    const a = new Uint8Array(analyseur.fftSize);
    analyseur.getByteTimeDomainData(a);
    return a;
  }

  return { init, etat, cloche, clic, couper, niveau, get pret() { return !!ctx; }, get actif() { return !!ctx && ctx.state === "running"; }, get coupe() { return coupe; } };
})();
