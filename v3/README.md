# HOME TEAM FM — Live Visuals v3 (GPU)

**Open:** https://esaias27.github.io/hometeam-viz-v2/v3/ · v2 stays at https://esaias27.github.io/hometeam-viz-v2/

v3 is a rebuild of v2's engine on the GPU. Every world is a shader that writes its particles into float textures, so worlds
run tens of thousands of particles instead of 6,000: the CPU only listens to the music and decides what happens.

- **Particles:** each world writes position, size, colour and energy per particle; a blend pass morphs between worlds,
  adds the logo pool, dust and the wisps, and applies shockwaves. In-focus pearls are drawn into a depth buffer, glows,
  bokeh and filaments are added on top.
- **Filaments:** dense line work (Tide's grid, Reef's kelp, Highway's rings, Bloom's web) is computed on the GPU too.
- **Fireworks** (Lot) are a GPU particle simulation with spawn bursts in a ring buffer.
- **Detail** (Performance) scales all particle counts: 1 on laptops, 0.6 on phones by default.

## Camera
Each world has a real orbit camera: target, distance, heading / pitch / bank, focal length in mm, f-stop and focus.
Alt + left / middle / right drag tumbles / tracks / dollies, the wheel dollies (Maya and Cinema 4D style).
On a phone, turn on **Fly** (the crosshair button): one finger orbits, two fingers pan and pinch.
Shift + 1–6 stores an angle, F1–F6 or Alt + 1–6 recalls it. Tours glide between stored angles on the beat, cut on the beat, or cut on drops.

## Worlds
1. **Tower** – spectrum rings pulsing out and toward you, kick shells, lightning
2. **Lot** – 30k phone lights, thousands of lanterns, searchlights, mortar streaks and a dozen firework types; drops trigger a finale
3. **Storm** – supercell sky, noise-driven trunk, debris swirling in along inflow bands, rain curtains, lightning that lights the cloud
4. **Reef** – hundreds of kelp stalks over coral beds, gliding forever through fog
5. **Bloom** – the endless blossom with a web of light between petals
6. **Tide** – the live waveform, trigger-locked and mirrored, rolling back to the horizon as terrain; also spectrum, kick rings, noise ocean
7. **Highway** – the tunnel, with the city sliding past

## Building
`python3 v3/src/build.py` joins `v3/src/js/*.js` into `v3/src/app.html`, inlines the shared fonts and logo from `src/`, and writes `v3/index.html`, the manifest and service worker.
