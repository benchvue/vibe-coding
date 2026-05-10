# Week 5 — WW2 Flight & Dogfight Sim · Gladiator NXT EVO

A series of HTML/Three.js demos that turn a **VKB Gladiator NXT EVO** flight-sim joystick into a complete aircraft training and combat experience in the browser, using the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API).

This week builds on the 3D walker from [Week 4](../week-4/) and applies the same joystick toolkit to flight — start with the axes trainer to learn the mechanics, then take off in the flight simulator, then dogfight in the combat sim.

> 📖 **Background reading:** [Aircraft principal axes — Wikipedia](https://en.wikipedia.org/wiki/Aircraft_principal_axes#/media/File:Yaw_Axis_Corrected.svg) (the diagram every pilot learns first)

---

## 🎮 Hardware & Setup

- **Controller:** VKB Gladiator NXT EVO (USB)
- **Calibration tool:** [VKBDevCfg](https://vkbcontrollers.com/pages/downloads) (Windows)
- **Browser:** Chrome or Edge recommended (best Gamepad API support)
- **Run:** Open the HTML file with **Live Server** in VS Code (or any static server), then **press any button on the joystick** to wake it — browsers wait for input before exposing the gamepad.

> **Tip:** All versions share the same calibration logic. The first ½ second after the joystick connects, the page averages the resting axis values and treats that as zero, which corrects sensor drift automatically. Press <kbd>C</kbd> any time to re-center manually.

---

## 🛠 Week 5 Demos

### 1. Aircraft Axes Live — 3-Axis Trainer
Interactive 3D learning tool that visualizes the **three principal axes of an aircraft** — Pitch, Roll, Yaw — in real time as you move the joystick. A simplified airframe sits at the origin with three colored axis lines passing through it (red Pitch, blue Roll, green Yaw). Move the stick or twist it and the plane rotates around the matching axis instantly. Perfect for building muscle memory before flying. Drag the canvas to look from any angle, scroll to zoom.

**Controls:** stick pitch · stick roll · stick twist (yaw) · keyboard <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> + <kbd>Q</kbd> <kbd>E</kbd> · <kbd>C</kbd> recenter

[![Axes Live — 3-Axis Trainer](https://img.shields.io/badge/Axes%20Live%20%C2%B7%203--Axis%20Trainer-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-5/aircraft_axes_live.html)

---

### 2. Flight Simulator — WW2 Fighter Free Flight
A full **WW2-era fighter** (BF-109 styling) flying over a procedural landscape with rolling terrain, towns, mountains, and clouds. The aircraft is always airborne — no takeoff or landing — so you can focus purely on stick feel. Includes an **artificial horizon**, compass strip, speed/altitude/throttle gauges, engine drone + wind sound, and an **auto-level assist** that gently rolls the wings flat when you center the stick (toggle with <kbd>L</kbd>, snap to level instantly with <kbd>Z</kbd>). The ministick on top of the grip controls throttle.

**Controls:** stick pitch / roll / twist · ministick = throttle · keyboard <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> + <kbd>Q</kbd> <kbd>E</kbd> · <kbd>↑</kbd> <kbd>↓</kbd> throttle · <kbd>L</kbd> auto-level · <kbd>Z</kbd> snap level · <kbd>M</kbd> mute

[![Flight Sim — WW2 Free Flight](https://img.shields.io/badge/Flight%20Sim%20%C2%B7%20Free%20Flight-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-5/flight_sim_v1.html)

---

### 3. Dogfight Simulator — WW2 Air Combat
Everything from the flight sim **plus combat**. German Luftwaffe fighters (gray with red rudder accents) spawn around you and pursue. Pull the **A1 trigger** for continuous machine-gun fire (~11 rounds/sec) with muzzle flash, tracer rounds, and synthesized gunshot sound. A **3D aim reticle** floats ahead of your nose showing exactly where bullets will land — it auto-snaps to enemies in your firing cone. Includes radar, hull integrity bar, kill counter, explosion effects, and **GAME OVER** when health hits zero. Score: +100 per kill, +5 per hit, −5 when you take damage.

**Controls:** all of Flight Sim + A1 trigger · <kbd>Space</kbd> · enemy AI fires back

[![Dogfight Sim — Air Combat](https://img.shields.io/badge/Dogfight%20Sim%20%C2%B7%20Combat-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-5/dogfight_v1.html)

---

## 🎯 Axis & Button Mapping

| Function | Joystick Input | Gamepad API Index | Keyboard |
|---|---|---|---|
| Pitch (nose up/down) | Stick Y | `axes[1]` | <kbd>W</kbd> <kbd>S</kbd> |
| Roll (bank left/right) | Stick X | `axes[0]` | <kbd>A</kbd> <kbd>D</kbd> |
| Yaw (rudder) | Stick twist (Rz) | `axes[2]` (or `[3]`) | <kbd>Q</kbd> <kbd>E</kbd> |
| Throttle | A1 ministick Y | `axes[5]` (or `[4]`) | <kbd>↑</kbd> <kbd>↓</kbd> |
| Fire guns | A1 trigger (front red) | `buttons[0]` | <kbd>Space</kbd> |
| Auto-level toggle | — | — | <kbd>L</kbd> |
| Snap to level | — | — | <kbd>Z</kbd> |
| Re-center calibration | — | — | <kbd>C</kbd> |
| Mute / unmute | — | — | <kbd>M</kbd> |

> **Note on yaw:** the Gladiator NXT EVO exposes stick twist on the Rz axis. If twist isn't responding in any browser, run **VKBDevCfg → Tools → Default**, then **Start Calibr**, twist the stick fully each direction, and click **End Calibr**. See the calibration section below.

---

## 🧠 Input Feel & Sensitivity

All three demos use the same input pipeline tuned for stable hands-on flight:

- **Wide deadzone** (0.18 for stick, 0.22 for yaw) — ignores sensor jitter and resting drift
- **Expo curve** (exponent 2.5) — gentle near center for fine control, sharp near edges for hard maneuvers (the same standard real flight sims use)
- **Auto-calibration** — first 30 frames after connection are averaged to define "centered"
- **Reduced rotation rates** — pitch 0.5 rad/s, roll 1.0 rad/s, yaw 0.3 rad/s at full deflection (gentler than arcade defaults)
- **Auto-level assist** — when sticks are near center, the plane gently rolls back to wings-level. Strength scales with stick activity, so it never fights your input.

---

## 🧪 Run Locally

```bash
# clone and serve
git clone https://github.com/benchvue/vibe-coding.git
cd vibe-coding/week-5

# any static server works — Python is easiest
python -m http.server 5500
```

Then open `http://localhost:5500/aircraft_axes_live.html` (or `flight_sim_v1.html` / `dogfight_v1.html`).

### Or with VS Code Live Server

1. Install the **Live Server** extension by Ritwick Dey.
2. Open the `week-5` folder in VS Code.
3. Right-click any `.html` file → **Open with Live Server**.
4. Browser opens at `http://127.0.0.1:5500/...`.

> **Note:** The Gamepad API is unreliable on `file://` URLs — always serve over HTTP.

---

## 🧰 Calibrating the Joystick

Before any of these demos work well, the Gladiator should be calibrated through **VKBDevCfg**:

1. Plug the joystick directly into a USB port on the PC (not a hub).
2. Download **VKBDevCfg** and **zBootloader** from [vkbcontrollers.com/pages/downloads](https://vkbcontrollers.com/pages/downloads).
3. Run **VKBDevCfg as Administrator** → select your device.
4. **Tools** tab → click **Default**.
5. **Global → Devices → External Devices** → click **Find & AutoConfig**.
6. **Test → Axes1** tab → click **Start Calibr**.
7. Move pitch, roll, yaw to all extremes — slowly at the end stops.
8. **Twist the stick fully clockwise and counter-clockwise** so the Rz (yaw) axis registers full range.
9. Move the mini-throttle full up and down.
10. Press the **A1 ministick center button** until the LED turns red, then circle the ministick fully.
11. Click **End Calibr**.

⚠️ Don't use Windows' built-in joystick calibration on VKB devices — it conflicts with the firmware.

If yaw still doesn't work after calibration, your firmware may be older than v2.20 — flash the latest `_Gladiator_EVO_v2_20_X.vkb` file from the same downloads page.

---

## 🛠 Tech Stack

- **Three.js** (r160) — 3D rendering, scene graph, lighting, shadows, sky shader
- **Gamepad API** — joystick axis/button polling at 60Hz
- **Web Audio API** — procedural engine drone, wind, gunshots, explosions, hit feedback (no audio files)
- **Quaternion-based flight model** — proper roll/pitch/yaw composition without gimbal lock
- **Raycaster aim solver** — 3D reticle snaps to enemies in firing cone
- **Vanilla JS / HTML / CSS** — no build step, no framework
- **CSS variables** — clean white theme with semantic color palette

---

## 📝 License

MIT — feel free to fork, remix, and extend.
