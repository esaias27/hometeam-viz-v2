# HOME TEAM FM — Live Visuals v2

A pirate radio station broadcasting from inside the music. Audio-reactive 3D visuals for iPhone, laptop and TV.

**Open:** https://esaias27.github.io/hometeam-viz-v2/ · v1 (liquid looks): https://esaias27.github.io/hometeam-viz/

1. Open in Safari → Share → **Add to Home Screen**
2. Launch from the icon → **Tap to Start** → allow the mic
3. Settings → Display & Brightness → Auto-Lock → **Never**
4. USB-C → HDMI to mirror to a TV (rotate to landscape)

## Worlds

All seven share one particle budget, so switching morphs one into the next.

1. **Tower** – the HOME TEAM tower in pearls of light; kicks send signal rings across the receivers, snares throw radio waves, hats crack lightning
2. **Lot** – lanterns rising over a crowd of phone lights; kicks ripple through the crowd
3. **Storm** – a spinning storm cell; hits fire branching lightning
4. **Reef** – kelp forest; bass is the current, kicks run light up the stalks
5. **Bloom** – golden-angle flower that opens with the music
6. **Tide** – the spectrum as rolling ridgelines
7. **Highway** – the drive home

## How it works

WebGL2 HDR renderer: sphere-impostor particles lit by a core light and three orbiting wisps, filament ribbons, feedback trails, dual-filter bloom, depth of field, ACES tonemapping and colour grades. Audio is split into 16 log bands with per-band auto gain and separate kick / snare / hat onset detection. Taps and camera motion send shockwaves from where they happen. The logo forms out of its own particle pool.

Laptop keys: `1–7` worlds · `←/→` travel · `A` auto · `L` logo · `G` color · `C` camera · `D` demo · `Space` kick · `H` hide · `F` full screen · `P` stats

## Building

`src/app.html` is the source. `python3 src/build.py` inlines the font and logo into `index.html` and writes `manifest.webmanifest` and the offline service worker `sw.js`.

Test locally: `python3 -m http.server` then open http://localhost:8000/ (the mic needs https or localhost).
