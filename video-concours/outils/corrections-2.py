def appliquer(p, R):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

appliquer('compositions/compte.html', [
    # la photo reste visible en bas de l'image
    ('rgba(10,10,11,.9) 64%, rgba(10,10,11,.97) 100%)', 'rgba(10,10,11,.88) 62%, rgba(10,10,11,.62) 100%)'),
    # les bandes MOTEKA traversent puis restent posées en motif sur le rouge
    ('tl.fromTo(b, { x: -700 + i * 250, skewX: -34 }, { x: 1500 + i * 250, skewX: -34, duration: 0.7, ease: "power3.inOut" }, 14.9 + dt));',
     'tl.fromTo(b, { x: -700 + i * 250, skewX: -34, opacity: 1 }, { x: 380 + i * 300, skewX: -34, opacity: 0.16, duration: 0.7, ease: "power3.out" }, 14.9 + dt));'),
    # finale : les bandes reviennent en rouge sous le titre
    ('<div id="c-noir" class="clip c-monde" data-start="20.95" data-duration="4.5"></div>',
     '<div id="c-noir" class="clip c-monde" data-start="20.95" data-duration="4.5"><div id="c-n1" class="c-bande" style="background:#d11414" data-layout-ignore></div><div id="c-n2" class="c-bande" style="background:#d11414" data-layout-ignore></div><div id="c-n3" class="c-bande" style="background:#d11414" data-layout-ignore></div></div>'),
    ('      entre("#c-j6", 21.25, 24);',
     '      [["#c-n1", 0], ["#c-n2", 0.05], ["#c-n3", 0.1]].forEach(([b, dt], i) =>\n        tl.fromTo(b, { x: 1600 + i * 250, y: 900, skewX: -34, opacity: 1 }, { x: 200 + i * 300, y: 900, skewX: -34, opacity: 0.85, duration: 0.6, ease: "power3.out" }, 23.31 + dt));\n      entre("#c-j6", 21.25, 24);'),
])

appliquer('compositions/roulette.html', [
    ('tl.to("#r-roue-in", { scale: 0.42, y: -290, duration: 0.5, ease: "power3.inOut" }, 2.95);',
     'tl.to("#r-roue-in", { scale: 0.42, y: -290, duration: 0.45, ease: "power3.inOut" }, 2.72);'),
    ('tl.to("#r-index svg", { y: -20, scale: 0.6, transformOrigin: "50% 0%", duration: 0.5, ease: "power3.inOut" }, 2.95);',
     'tl.to("#r-index svg", { y: -20, scale: 0.6, transformOrigin: "50% 0%", duration: 0.45, ease: "power3.inOut" }, 2.72);'),
    ('<div id="r-soir" class="clip r-titre" style="top: 735px; font-size: 100px" data-start="3.17" data-duration="2.03">',
     '<div id="r-soir" class="clip r-titre" style="top: 735px; font-size: 100px" data-start="3.2" data-duration="2.0">'),
    ('{ clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.22, ease: "expo.out" }, 3.17);',
     '{ clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.22, ease: "expo.out" }, 3.2);'),
])

appliquer('compositions/fin.html', [
    ('{ x: 1500 + i * 260, skewX: -34, duration: 0.75, ease: "power3.inOut" }, dt));',
     '{ x: 2300 + i * 260, skewX: -34, duration: 0.85, ease: "power3.inOut" }, dt));'),
])
print('ok')
