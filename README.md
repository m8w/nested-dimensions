# Nested Dimensions

Live visuals in 3D space: flame-fractal streams and MilkDrop (Butterchurn) layers become screens floating through three dimensions, moved by MilkDrop-style equations, audio and MIDI. Feedback planes nest the scene inside itself. Runs in any modern browser, phones included, built on three.js and WebGL2.

By xik6 (William Victor Newbold).

**Open it:** https://m8w.github.io/nested-dimensions/

## What it does

- **Four screens in one 3D scene.** Two MilkDrop planes run real presets through Butterchurn. The Stream plane takes video (your fractal stream, a camera or a file) and shows a Julia-set fractal until one is connected. The Nested plane shows the previous frame, so the whole scene repeats inside itself, frame within frame.
- **Solids (v0.3).** Each screen can become a box, a cube or a sphere with its picture on every face. The solid's proportions come from the picture's, and the picture's brightness raises its surface.
- **Video background (v0.3).** The dark space behind the solids fills with William Victor Newbold's videos from archive.org, crossfading nonstop. It can also play your own videos or a generated nebula.
- **Nonstop audio (v0.2).** Archive radio plays the xik6 catalog from archive.org at random, crossfaded, on up to four lanes at once. It also plays your own files, shuffled, or follows a live input that reconnects by itself.
- **Mac launcher (v0.3).** Double-click to open it in its own window, with sound that starts by itself and a window that reopens if it closes.
- **Equations.** The camera and each plane run a small MilkDrop-flavoured program every frame that sets position, rotation, scale, opacity and glow from time, audio, tracks and MIDI. Edit them live in the page.
- **Trails.** MilkDrop-style feedback behind everything: each frame zooms, turns and fades the last one.
- **Four scenes:** orbit, stack, tunnel, lissajous.
- **Video and MIDI:** video files anywhere; live video (OBS Virtual Camera, a webcam) and Web MIDI where the browser allows them.
- **Scene files.** A scene is plain JSON, so it can be saved, shared, generated and sequenced.

## Nonstop audio

Open **Sources** and pick one:

- **Archive radio** (the default). The page searches archive.org for the uploads of William Victor Newbold (about 580 audio items) and plays them at random, track after track. It favours tracks the device hasn't played yet and keeps that history between visits. Recordings longer than 20 minutes play an 8–14 minute stretch from a random point, so the 10-hour sessions turn up as excerpts. Type another creator name, or any archive.org search such as `collection:something`, into the Search box to play other uploads.
- **My files.** Add files, or a whole folder on a computer. They play shuffled, each once before any repeats. Browsers can't keep files between visits, so the list empties on reload.
- **Live input.** Follows BlackHole or a mic for the visuals and never sends it to the speakers. If the device drops, the page reconnects within a few seconds. Once the browser has allowed the input, it reconnects by itself after a reload.

How it keeps going:

- **Crossfades.** Each lane loads its next track 40 seconds before the current one ends, then crossfades with an equal-power curve (0–12 s, default 6).
- **Lanes.** Up to four lanes play at once, each on its own random path, mixed through a compressor.
- **Recovery.** If a file won't load, the page tries the item's other archive.org servers, then moves on to another track. A track that stalls for 15 seconds is replaced. A slow or missing archive.org falls back to the last catalog list the page saved.
- **Background.** The audio runs on its own clock, so it keeps going in a background tab. On a phone the page keeps the screen awake while sound is playing, and lock-screen controls can pause or skip.
- **Starting.** Browsers hold sound back until the first tap or key press. If that happens, a **Start audio** button appears, and the first track has already loaded by then. On a dedicated broadcast machine, start Chrome with `--autoplay-policy=no-user-gesture-required` so it starts by itself.

Each new track also brings a new MilkDrop preset on one plane. The equations can follow the music through `track`, `trackpos`, `newtrack` and `lanes`.

## Solids

Every screen is one mesh that morphs between three forms, with the picture wrapped on every face:

- `depth` 0 is a flat screen. Raise it and the screen deepens into a box; around 0.9 a 16:9 screen becomes roughly a cube.
- `round` 0 is a box and 1 is a sphere. Values in between give rounded boxes.
- `relief` raises the surface by the picture's own brightness: 0.1 is gentle, 0.5 is strong, and negative values carve in. A MilkDrop preset or a video becomes a moving landscape on the solid.

The width and height come from the source's proportions, so a 4:3 video makes a 4:3 solid. The solids are shaded by how they face the camera, so they read as volumes. The scenes use them: in **orbit** three solids breathe between screen, cube and sphere around the nested screen, in **tunnel** they tumble towards you, and in **lissajous** their surfaces rise with the mids. **stack** keeps flat layers.

## Video background

Open **Sources → Background**:

- **Archive video** (the default) plays William Victor Newbold's videos from archive.org (about 60 items) behind the solids. Each is muted, plays a 1–2½ minute stretch from a random point, and crossfades into the next. Lighter files are chosen on phones. If a video won't load, the page tries the item's other servers and then moves on.
- **My videos** does the same with your own video files.
- **Shader** is a slow generated nebula that swells with the bass. It also fills in while a video loads, or if archive.org can't be reached.
- **Off** leaves it black.

The background fills only what the 3D scene doesn't cover, so the solids stay solid. A little shows through their darkest parts, and it shows inside the nested frame. The Camera block can move it with `bg` (brightness, 1 = the level slider), `bgzoom`, `bgrot`, `bgx` and `bgy`; the scenes drift it against the camera for depth. Press **B** for the next clip.

## Mac launcher

To put the launcher on your Desktop, paste this into Terminal once:

```
curl -fsSL https://m8w.github.io/nested-dimensions/launch/install-mac.sh | bash
```

Then double-click **Nested Dimensions** on the Desktop. It opens the page in its own Chrome window (Edge, Brave or Chromium also work) where:

- sound starts by itself, with no Start audio tap;
- the page keeps full speed even when another window covers it;
- the Mac stays awake while it runs;
- the window opens again if the browser closes or crashes.

It uses its own browser profile, so your everyday Chrome is untouched. Allow the microphone, camera or MIDI in that window once, and it remembers. Press Control-C in its Terminal window to stop it. The launcher itself is [`launch/Nested Dimensions.command`](launch/Nested%20Dimensions.command); it opens a 1920 × 1080 window by default, which you can change with `ND_WIDTH` and `ND_HEIGHT`, or set `ND_FULL=1` for fullscreen.

## Running it

- **GitHub Pages:** Settings → Pages → Build and deployment → Deploy from a branch → `main`, `/ (root)` → Save. The site appears at the address above a minute later.
- **Locally:** run any static server in this folder, for example `python3 -m http.server`, then open http://localhost:8000. Camera, microphone and MIDI only work over https or on localhost.
- There is no build step. Everything is in `index.html`; the libraries load from jsDelivr: three.js 0.186.1, butterchurn 2.6.7 and butterchurn-presets 2.4.7.

## With a streaming rig

1. **Audio:** Sources → Live input → choose BlackHole (or whichever device carries the mix) → Listen. Or let Archive radio play the catalog. The bands drive the equations and both MilkDrop planes.
2. **Video:** bring the fractal stream into OBS and start the Virtual Camera. In OBS 30 or later the virtual camera can output a single source, so pick the fractal source there. Then Sources → Camera → OBS Virtual Camera → Start. It lands on the Stream plane and reconnects if OBS restarts the camera.
3. **MIDI:** Sources → MIDI → Connect, in Chrome or Edge. Every MIDI input is heard, IAC buses included. Notes and controllers arrive as `note`, `vel`, `onset`, `held` and `cc1`–`cc16`.
4. Press **H** to hide the controls and **F** for fullscreen, then capture the browser window in OBS.

The page remembers the audio source, camera and MIDI, so after a reload (or an 11:45 cycle restart) it reconnects everything the browser has already allowed.

Keys: **H** controls · **F** fullscreen · **S** next scene · **N** new MilkDrop presets · **K** skip track · **B** next background clip · **E** equations · **Ctrl/⌘ + Enter** apply an edit.

## The equation language

Each block runs every frame, top to bottom. The Camera block runs first, then the four planes.

```
// a screen on a ring, pushed by the bass
ph = time*0.3 + i*tau/3;
x = cos(ph)*3;
z = sin(ph)*3;
ry = pi/2 - ph;
sx = 1.9 + bass*0.2; sy = sx;
```

- Statements end with `;`. `^` is power, `//` starts a comment, comparisons give 1 or 0, `if(test, a, b)` picks a value.
- Any new name is a variable that keeps its value from frame to frame, as in MilkDrop. Unset names read as 0.
- The language is interpreted, never passed to `eval`, so a typo can only stop that one block. The page reports the line and keeps the last working version running.

| Inputs | |
|---|---|
| `time`, `frame`, `dt`, `fps` | seconds since start (scaled by the speed slider), frame count, seconds per frame, frame rate |
| `bass`, `mid`, `treb` | audio bands: about 1 at a steady level, up to 4 on hits, 0 with no audio |
| `bass_att`, `mid_att`, `treb_att`, `vol` | smoothed bands, and the average of the three |
| `note`, `vel`, `onset`, `held` | last MIDI note and velocity (0–1); `onset` jumps to 1 on each note and fades; notes held |
| `cc1` – `cc16` | MIDI controller values (0–1) |
| `track`, `trackpos` | seconds into the newest track, and how far through it (0–1) |
| `newtrack`, `lanes` | a pulse that jumps to 1 when any track starts and fades; lanes playing |
| `i`, `n`, `aspect` | plane number (0 MilkDrop A, 1 Stream, 2 MilkDrop B, 3 Nested), plane count, screen width ÷ height |
| `pi`, `tau` | constants |
| `q1` – `q8` | set in the Camera block, readable in every plane |

| Plane outputs | |
|---|---|
| `x`, `y`, `z` | position |
| `rx`, `ry`, `rz` | rotation in radians |
| `sx`, `sy`, `sz` | scale (a 16:9 screen is 1.6 × 0.9 at scale 1); `sz` follows `sx` and `sy` unless set |
| `depth`, `round` | solid form: `depth` 0 flat, ~0.9 a cube; `round` 0 box, 1 sphere |
| `relief` | the picture's brightness pushes the surface out (negative carves in) |
| `a` | opacity, 0–1 |
| `add` | 1 for additive glow, 0 for normal blending |
| `bright` | colour gain |

| Camera outputs | |
|---|---|
| `cx`, `cy`, `cz` | camera position |
| `tx`, `ty`, `tz` | the point it looks at |
| `fov`, `roll` | field of view in degrees, roll in radians |
| `fit` | distance multiplier; it starts larger on tall screens so phones see the whole scene |
| `zoom`, `rot`, `decay` | trails: zoom and rotation per frame, and how much of the last frame stays (0 turns trails off) |
| `bg`, `bgzoom`, `bgrot`, `bgx`, `bgy` | background: brightness (1 = the level slider, 0 hides it), zoom, rotation in radians, pan |

Functions: `sin cos tan asin acos atan atan2 abs sqrt sqr pow exp log log10 floor ceil int min max sign clamp mix fract tri noise rand frand above below equal band bor bnot if`.

## Scene files

**Copy scene JSON** in the Equations panel copies the current scene. Paste JSON into the editor and press Apply to load it, or use **Load scene file**.

```json
{
  "format": "nested-dimensions/scene",
  "version": 1,
  "name": "orbit",
  "camera": "cz = 7.5; decay = 0.88; q1 = time*0.22;",
  "planes": {
    "mdA": "ph = q1; x = cos(ph)*3; z = sin(ph)*3;",
    "stream": "ph = q1 + tau/3; x = cos(ph)*3; z = sin(ph)*3;",
    "mdB": "ph = q1 + 2*tau/3; x = cos(ph)*3; z = sin(ph)*3;",
    "nest": "rz = time*0.03; sx = 2.2; sy = sx;"
  },
  "milkdrop": { "mdA": "Flexi - predator-prey-spirals", "mdB": "martin - another kind of groove" }
}
```

Because scenes are plain text, ButterForge-style tools can write, mutate and sequence them the same way they handle `.milk` presets.

## Next ideas

- Choose the preset for each plane, including presets converted by ButterForge.
- More planes, and any source on any plane.
- A scene sequencer driven by time or MIDI.
- The three.js WebGPU renderer, keeping WebGL2 as the fallback.
- Flame fractals rendered on the GPU in the browser, then true 3D flames.
- Recording the canvas to a video file.

## Credits

- [three.js](https://threejs.org) (MIT)
- [Butterchurn](https://github.com/jberg/butterchurn) by Jordan Berg, a WebGL implementation of MilkDrop (MIT). MilkDrop was created by Ryan Geiss.
- [butterchurn-presets](https://github.com/jberg/butterchurn-presets): presets by the MilkDrop community; each preset's title names its authors.

## License

MIT. See [LICENSE](LICENSE).
