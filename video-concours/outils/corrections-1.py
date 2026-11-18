import re, subprocess

def dur(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

def appliquer(p, R):
    s = open(p, encoding='utf-8').read()
    for a, b in R:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

# index : chaque son a sa durée réelle
p = 'index.html'; s = open(p, encoding='utf-8').read()
def ajoute(m):
    tag = m.group(0)
    if 'data-duration' in tag:
        return tag
    src = re.search(r'src="([^"]+)"', tag).group(1)
    return tag.replace(' data-track-index', f' data-duration="{dur(src):.2f}" data-track-index', 1)
s = re.sub(r'<audio [^>]*>', ajoute, s)
open(p, 'w', encoding='utf-8').write(s)

appliquer('compositions/compte.html', [
    ('<circle cx="500" cy="500" r="470" fill="#121215" fill-opacity=".86" />', '<circle cx="500" cy="500" r="470" fill="#121215" />'),
    ('font-size="26" letter-spacing="6">× 1000 TR/MIN', 'font-size="36" letter-spacing="6">× 1000 TR/MIN'),
    ('<div id="c-flash"></div>', '<div id="c-flash" data-layout-ignore></div>'),
    ('<div id="c-b1" class="c-bande"></div><div id="c-b2" class="c-bande"></div><div id="c-b3" class="c-bande"></div>',
     '<div id="c-b1" class="c-bande" data-layout-ignore></div><div id="c-b2" class="c-bande" data-layout-ignore></div><div id="c-b3" class="c-bande" data-layout-ignore></div>'),
    ('style="top: 1125px; font-size: 175px" data-start="5.6"', 'style="top: 1125px; font-size: 150px" data-start="5.6"'),
    ('style="top: 1065px; font-size: 128px" data-start="7.7"', 'style="top: 1065px; font-size: 112px" data-start="7.7"'),
    ('style="top: 1065px; font-size: 128px" data-start="10.5"', 'style="top: 1065px; font-size: 112px" data-start="10.5"'),
    ('style="top: 1065px; font-size: 128px" data-start="12.65"', 'style="top: 1065px; font-size: 112px" data-start="12.65"'),
    ('style="top: 880px" data-start="14.9"', 'style="top: 860px" data-start="14.9"'),
    ('style="top: 935px; font-size: 380px" data-start="17.45"', 'style="top: 910px; font-size: 330px" data-start="17.45"'),
    ('style="top: 960px; font-size: 300px" data-start="18.51"', 'style="top: 930px; font-size: 280px" data-start="18.51"'),
    ('style="top: 935px; font-size: 380px" data-start="19.98"', 'style="top: 910px; font-size: 330px" data-start="19.98"'),
    ('style="top: 1290px; color: #f4f2ef" data-start="17.45"', 'style="top: 1235px; color: #f4f2ef" data-start="17.45"'),
    ('style="top: 830px; font-size: 440px; text-align: center; left: 0; right: 0" data-start="23.31"',
     'style="top: 800px; font-size: 400px; text-align: center; left: 0; right: 0" data-start="23.31"'),
    ('style="top: 1240px; font-size: 90px; text-align: center; left: 0; right: 0; color: #ff2a2a" data-start="24.59"',
     'style="top: 1180px; font-size: 90px; text-align: center; left: 0; right: 0; color: #ff2a2a" data-start="24.59"'),
    ('tl.fromTo("#c-flash", { opacity: 0.95 }, { opacity: 0, duration: 0.35, ease: "power2.out" }, 22.02);',
     'gsap.set("#c-flash", { opacity: 0 });\n      tl.fromTo("#c-flash", { opacity: 0.95 }, { opacity: 0, duration: 0.35, ease: "power2.out", immediateRender: false }, 22.02);'),
    ('tl.fromTo("#c-flash", { opacity: 0.7 }, { opacity: 0, duration: 0.3, ease: "power2.out" }, 23.31);',
     'tl.fromTo("#c-flash", { opacity: 0.7 }, { opacity: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, 23.31);'),
])

appliquer('compositions/tickets.html', [
    ('style="top: 260px; font-size: 250px"', 'style="top: 300px; font-size: 250px"'),
    ('style="top: 260px; font-size: 190px"', 'style="top: 300px; font-size: 190px"'),
    ('.t-souche small { font: 700 26px', '.t-souche small { font: 700 30px'),
    ('<div id="t-b1" class="t-bande"></div><div id="t-b2" class="t-bande"></div><div id="t-b3" class="t-bande"></div>',
     '<div id="t-b1" class="t-bande" data-layout-ignore></div><div id="t-b2" class="t-bande" data-layout-ignore></div><div id="t-b3" class="t-bande" data-layout-ignore></div>'),
])

appliquer('compositions/roulette.html', [
    ('style="top: 186px" data-start="0.94"', 'style="top: 260px" data-start="0.94"'),
    ('#r-roue-box { position: absolute; left: 40px; top: 300px; width: 1000px; height: 1000px; }',
     '#r-roue-box { position: absolute; left: 90px; top: 380px; width: 900px; height: 900px; }'),
    ('#r-index { position: absolute; left: 490px; top: 250px;', '#r-index { position: absolute; left: 490px; top: 335px;'),
    ('#r-ticket { position: absolute; left: 110px; top: 1010px; width: 860px; height: 300px; }',
     '#r-ticket { position: absolute; left: 110px; top: 960px; width: 860px; height: 270px; }'),
    ('<div id="r-soir" class="clip r-titre" style="top: 800px; font-size: 104px" data-start="4.5" data-duration="0.7">',
     '<div id="r-soir" class="clip r-titre" style="top: 735px; font-size: 100px" data-start="3.17" data-duration="2.03">'),
    ('tl.to("#r-roue-in", { scale: 0.5, y: -280,', 'tl.to("#r-roue-in", { scale: 0.42, y: -290,'),
    ('tl.to("#r-index svg", { y: -30, scale: 0.6,', 'tl.to("#r-index svg", { y: -20, scale: 0.6,'),
    ('<div id="r-argent">GRATTE ICI</div>', '<div id="r-argent" data-layout-allow-occlusion data-layout-allow-overlap>GRATTE ICI</div>'),
    ('<div class="r-lot">', '<div class="r-lot" data-layout-allow-overlap>'),
    ('{ clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.22, ease: "expo.out" }, 4.5);',
     '{ clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.22, ease: "expo.out" }, 3.17);'),
])

appliquer('compositions/fin.html', [
    ('top: 880px; text-align: center; font: 700 38px', 'top: 880px; text-align: center; font: 700 32px'),
    ('font: 600 44px "Inter", sans-serif; color: #f4f2ef; }', 'font: 600 38px "Inter", sans-serif; color: #f4f2ef; }'),
    ('<div id="f-b1" class="f-bande"></div><div id="f-b2" class="f-bande"></div><div id="f-b3" class="f-bande"></div>',
     '<div id="f-b1" class="f-bande" data-layout-ignore></div><div id="f-b2" class="f-bande" data-layout-ignore></div><div id="f-b3" class="f-bande" data-layout-ignore></div>'),
    ('<div id="f-affiche-box">', '<div id="f-affiche-box" data-layout-ignore>'),
])
print('ok')
