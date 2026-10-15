# HOME TEAM FM — Live Visuals v2

A pirate radio station broadcasting from inside the music. Audio-reactive 3D visuals for iPhone, laptop and TV.

**Open:** https://esaias27.github.io/hometeam-viz-v2/ · v1 (liquid looks): https://esaias27.github.io/hometeam-viz/

1. Open in Safari → Share → **Add to Home Screen**
2. Launch from the icon → **Tap to Start** → allow the mic
3. Settings → Display & Brightness → Auto-Lock → **Never**
4. USB-C → HDMI to mirror to a TV (rotate to landscape)

## Worlds

All seven share one particle budget, so switching morphs one into the next.

1. **Tower** – the transmitter: every height of the tower is a band of the spectrum and sends rings of light outward and toward you; kicks fire a full shell from the antenna, hats crack lightning
2. **Lot** – lanterns, a crowd of phone lights and searchlights under a fireworks show: peonies, willows, glitter, crossettes, crackle and rings. When the music builds and drops, the lot answers with a finale and the camera cranes up
3. **Storm** – a supercell seen from the grass: the trunk is pushed around by big 3D noise climbing from the ground into the cloud, with a wide twisting base and satellite vortices
4. **Reef** – an endless glide through a kelp forest rising out of murky water, thickening into groves and thinning into clearings
5. **Bloom** – an endless blossom: each new flower is born at the heart as a different species and opens outward forever
6. **Tide** – the spectrum as an ocean of ridgelines
7. **Highway** – the drive home: the car surges and coasts, and bass sends ripples down the tunnel

## How it works

WebGL2 HDR renderer: sphere-impostor particles lit by a core light and three orbiting wisps, filament ribbons, feedback trails, dual-filter bloom, depth of field, ACES tonemapping and colour grades. Audio is split into 16 log bands with per-band auto gain and separate kick / snare / hat onset detection. Taps and camera motion send shockwaves from where they happen. The logo forms out of its own particle pool.

Every world has its own settings (counts and divisions, motion, audio response, camera) and they all glide into place, so a slider move or a preset is a morph. Presets save the world with the lens, logo and color, and a share link opens straight into a look. Mutate nudges everything somewhere new.

Lens: a kaleidoscope (3–12 fold) and an echo that feeds each frame back into the next, so the light recedes forever. The HOME TEAM logo can sit on top of it all as glass, holo foil, a displacement, a ghost outline or a window.

Color: exposure, highlight roll-off (keeps hot cores coloured instead of white), white point, hot cores, glow threshold, a flash limiter, saturation and contrast.

Laptop keys: `1–7` worlds · `←/→` travel · `A` auto · `M` mutate · `K` kaleidoscope · `E` echo · `O` logo overlay · `L` particle logo · `G` color · `C` camera · `D` demo · `Space` kick · `H` hide · `F` full screen · `P` stats

## Building

`src/app.html` is the source. `python3 src/build.py` inlines the fonts (Oswald, IBM Plex Mono, Instrument Serif — all SIL OFL) and logo into `index.html` and writes `manifest.webmanifest` and the offline service worker `sw.js`.

Test locally: `python3 -m http.server` then open http://localhost:8000/ (the mic needs https or localhost).
