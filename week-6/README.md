# Week 6 — Driving & Stunt Games · Gladiator NXT EVO

A series of HTML/Three.js demos that turn a **VKB Gladiator NXT EVO** flight-sim joystick into a complete arcade driving and stunt experience in the browser, using the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API).

This week shifts from the air combat of [Week 5](../week-5/) to the ground, applying the same joystick toolkit to cars and motorbikes — start with the circuit racer, push your luck on the endless run, then go full Moto X3M on the stunt bike. Every demo loads a real **GLB 3D model** and rigs its wheels procedurally.

> 📖 **Background reading:** [glTF / GLB format — Khronos Group](https://www.khronos.org/gltf/) (the 3D model format every demo loads at runtime)

---

## 🎮 Hardware & Setup

- **Controller:** VKB Gladiator NXT EVO (USB)
- **Calibration tool:** [VKBDevCfg](https://vkbcontrollers.com/pages/downloads) (Windows)
- **Browser:** Chrome or Edge recommended (best Gamepad API support)
- **Run:** Open the HTML file with **Live Server** in VS Code (or any static server), then **press any button on the joystick** to wake it — browsers wait for input before exposing the gamepad.

> **Tip:** All versions share the same input pipeline. A wide deadzone plus an expo curve corrects sensor drift automatically so a resting stick never creeps the car. Push the stick forward to accelerate and pull back to brake/reverse — the throttle axis is split at center.

---

## 🛠 Week 6 Demos

### 1. Top Speed 3D — Circuit Racer
A full **WW-era sport car** (loads `1984_de_tomaso_pantera_gt5-s.glb`) on a hand-built closed circuit with chicanes, a hairpin, a quick chicane, and long sweepers. Drive a real twisting track with red/white curbs and boundary walls. Includes a styled **cyan speedometer** with needle, gear and odometer, a **mini-map** showing your live position and heading, **crash + rollover** physics with a recovery animation, scoring with a persisted high score, and a synthesized **engine + tyre sound**. The GLB loader rigs the four wheels by name (spinning the wheels, steering the fronts) while leaving brake calipers fixed.

**Controls:** stick push = accelerate · pull = reverse/brake · left/right = steer · keyboard <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> · load any `.glb` from the start screen

[![Top Speed 3D · Circuit Racer](https://img.shields.io/badge/Top%20Speed%203D%20%C2%B7%20Circuit%20Racer-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-6/racing-game.html)

---

### 2. Top Speed 3D — Endless
Everything from the circuit racer **plus an infinite procedurally generated track**. The road streams in ahead and recycles behind, so it never ends and is different every run. Difficulty is **milestone-stepped** — every 1200 m you clear a **checkered finish gate**, the LEVEL ticks up, and the corners get sharper, hazards denser, and top speed higher (constant between milestones, then a clean jump). Wide red & white **boundary walls** make the drivable road unmistakable, a **zoomed-out radar mini-map** shows the track and obstacles ahead, and a **guidance arrow** points the way after a crash spins you around. Crashes cost score but the run continues.

**Controls:** stick push = accelerate · pull = reverse/brake · left/right = steer · keyboard <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> · follow the yellow arrow if lost

[![Top Speed 3D · Endless](https://img.shields.io/badge/Top%20Speed%203D%20%C2%B7%20Endless-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-6/racing-endless.html)

---

### 3. Moto Stunt X3 — Beach Run
A 2D side-scrolling **dirt-bike stunt game** in the Moto X3M style, on a sandy beach circuit with a glowing sun, sea, and striped umbrellas. Ride over hills, gaps, and spinning **saw blades**, controlling your speed and balancing the bike in the air to land both wheels. Pull off full flips for a **+500 bonus**. Features a two-wheel physics model with deliberate, recoverable mid-air balance and a gentle auto-level assist, a stopwatch timer, score + persisted best, synthesized engine and crash audio, and a dedicated **jump**. Progress through **5 levels**, each one a little harder — bigger jumps, wider gaps, more and faster saws.

**Controls:** stick push = gas · pull = brake · left/right = lean/flip · any button = jump · keyboard <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> + <kbd>Space</kbd> jump

[![Moto Stunt X3 · Beach Run](https://img.shields.io/badge/Moto%20Stunt%20X3%20%C2%B7%20Beach%20Run-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-6/moto-x3.html)

---

## 🎯 Axis & Button Mapping

| Function | Joystick Input | Gamepad API Index | Keyboard |
|---|---|---|---|
| Accelerate / gas | Stick Y forward (push) | `axes[1]` < 0 | <kbd>↑</kbd> |
| Brake / reverse | Stick Y back (pull) | `axes[1]` > 0 | <kbd>↓</kbd> |
| Steer / lean | Stick X | `axes[0]` | <kbd>←</kbd> <kbd>→</kbd> |
| Jump (Moto X3) | Any joystick button | `buttons[*]` | <kbd>Space</kbd> |
| Load GLB car model | — | — | start-screen file picker |
| Show model parts list | — | — | on-screen PARTS LIST button |
| Start / enable audio | — | — | START button |

> **Note on the throttle split:** the Gladiator's main stick Y axis is read as a single value and split at center — negative (push forward) is accelerator, positive (pull back) is brake/reverse. There is no separate ministick throttle in these demos; everything maps to the main stick so the games also play cleanly on arrow keys alone.

---

## 🧠 Input Feel & Sensitivity

All three demos use the same input pipeline tuned for stable hands-on driving:

- **Wide deadzone** (0.12) — ignores sensor jitter and resting drift so a centered stick never creeps the car
- **Expo curve** (exponent ~2.2 on steer) — gentle near center for fine line corrections, sharper near the edges for hard cornering
- **Reduced steering authority** — low max steer with slow steering speed and a long virtual wheelbase, so the car feels planted at speed rather than twitchy
- **Low-speed turn boost** — extra yaw at a crawl that fades out by ~40 km/h, so the car can pivot tightly when slow without being darty when fast
- **Auto-level assist (Moto X3)** — in the air, when no lean is held the bike eases back toward horizontal; disabled while you actively lean so deliberate flips still work

---

## 🧪 Run Locally

```bash
# clone and serve
git clone https://github.com/benchvue/vibe-coding.git
cd vibe-coding/week-6

# any static server works — Python is easiest
python -m http.server 5500
```

Then open `http://localhost:5500/racing-game.html` (or `racing-endless.html` / `moto-x3.html`).

### Or with VS Code Live Server

1. Install the **Live Server** extension by Ritwick Dey.
2. Open the `week-6` folder in VS Code.
3. Right-click any `.html` file → **Open with Live Server**.
4. Browser opens at `http://127.0.0.1:5500/...`.

> **Note:** The Gamepad API is unreliable on `file://` URLs — always serve over HTTP. The racing demos also auto-load `1984_de_tomaso_pantera_gt5-s.glb` from the same folder; serving over HTTP lets that fetch succeed (or use the start-screen file picker).

---

## 🧰 Calibrating the Joystick

Before any of these demos feel right, the Gladiator should be calibrated through **VKBDevCfg**:

1. Plug the joystick directly into a USB port on the PC (not a hub).
2. Download **VKBDevCfg** and **zBootloader** from [vkbcontrollers.com/pages/downloads](https://vkbcontrollers.com/pages/downloads).
3. Run **VKBDevCfg as Administrator** → select your device.
4. **Tools** tab → click **Default**.
5. **Global → Devices → External Devices** → click **Find & AutoConfig**.
6. **Test → Axes1** tab → click **Start Calibr**.
7. Move the stick X (steer) and Y (throttle) to all extremes — slowly at the end stops.
8. Push the stick fully forward and pull fully back so the Y axis registers full accelerate/brake range.
9. Press the **A1 ministick center button** until the LED turns red, then circle it fully (used as the jump button in Moto X3).
10. Click **End Calibr**.

⚠️ Don't use Windows' built-in joystick calibration on VKB devices — it conflicts with the firmware.

If an axis still doesn't respond after calibration, your firmware may be older than v2.20 — flash the latest `_Gladiator_EVO_v2_20_X.vkb` file from the same downloads page.

---

## 🛠 Tech Stack

- **Three.js** (r128) — 3D rendering, scene graph, lighting, shadows
- **GLTFLoader** — loads the `1984_de_tomaso_pantera_gt5-s.glb` model and rigs wheels at runtime
- **Gamepad API** — joystick axis/button polling at 60 Hz
- **Web Audio API** — procedural engine drone, tyre/wind noise, crash and flip sounds (no audio files)
- **Procedural track streaming** — endless mode generates and recycles road nodes for an infinite circuit
- **Arcade vehicle model** — bicycle-model yaw with a low-speed turn boost; 2D two-wheel rigid body for the bike
- **Canvas 2D mini-map** — car-centred radar view rebuilt from live track data
- **Vanilla JS / HTML / CSS** — no build step, no framework

---

## 🏗 Architecture

For a full breakdown of how the circuit racer is structured — the one-directional data flow from input through the authoritative physics model to every downstream system, the per-frame execution order, and the core design principles — see the architecture reference:

[![Architecture — Top Speed 3D](https://img.shields.io/badge/Architecture%20%C2%B7%20Top%20Speed%203D-475569?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-6/ARCHITECTURE.html)

> The same single-file game-loop architecture (input → physics → systems → render, physics as the single source of truth) underlies all three demos — it's what let features like GLB loading, the mini-map, crash rollover, the guidance arrow and level progression be added incrementally without regressions.

---

## ⚖️ A Note on the Car Model

`1984_de_tomaso_pantera_gt5-s.glb` is a model of a real, trademarked vehicle. It is used here purely for personal, non-commercial learning. For anything published or monetised, swap in a CC0 / public-domain car (e.g. from Kenney, Quaternius, or a CC0 Sketchfab model) — the GLB loader will rig it the same way with no code changes.

---

## 📝 License

MIT — feel free to fork, remix, and extend. (Car model excepted — see the note above.)
