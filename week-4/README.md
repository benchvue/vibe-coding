# Week 4 — Gladiator NXT EVO 3D Walker

A series of HTML/Three.js demos that turn a **VKB Gladiator NXT EVO** flight-sim joystick into a full 3D walking + shooting controller in the browser, using the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API).

Each version builds on the previous one — start with v1 and work up.

---

## 🎮 Hardware & Setup

- **Controller:** VKB Gladiator NXT EVO (USB)
- **Calibration tool:** [VKBDevCfg](https://vkbcontrollers.com/pages/downloads) (Windows)
- **Browser:** Chrome or Edge recommended (best Gamepad API support)
- **Run:** Open the HTML file with **Live Server** in VS Code (or any static server), then **press any button on the joystick** to wake it — browsers wait for input before exposing the gamepad.

> **Tip:** All versions share the same calibration logic. The first ½ second after the joystick connects, the page averages the resting axis values and treats that as zero, which corrects sensor drift automatically. Press <kbd>C</kbd> any time to re-center manually.

---

## 🛠 Week 4 Demos

### 1. v1 — Forward / Back Walking
Single-axis demo. Push the stick **forward / back** to walk along the Z-axis. The character turns 180° to face the direction of motion. Includes a compass, distance counter, and pitch-axis telemetry bar.

**Controls:** stick pitch · keyboard <kbd>W</kbd> <kbd>S</kbd> or <kbd>↑</kbd> <kbd>↓</kbd>

[![Walker v1 — Forward / Back](https://img.shields.io/badge/v1%20%C2%B7%20Forward%20%2F%20Back-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-4/joystick_walker-v1.html)

---

### 2. v2 — Full 3-Axis Free Roam
Adds **roll** (strafe sideways) and **yaw** (turn body). Walk in any direction relative to where you're facing. Includes a top-down mini-map with trail, position/heading readout, and reference pillars scattered through the scene.

**Controls:** pitch · roll · yaw · keyboard <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> + <kbd>Q</kbd> <kbd>E</kbd> to turn

[![Walker v2 — Full 3-Axis](https://img.shields.io/badge/v2%20%C2%B7%20Full%203--Axis%20Roam-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-4/joystick_walker-v2.html)

---

### 3. v3 — Trigger to Shoot
Pull the **A1 trigger** (front red trigger, button index 0 on VKB sticks) to fire glowing red balls. Hit the cyan torus targets scattered around the scene for **+10 points** each. Includes muzzle flash, ball physics, score counter, and target dots on the mini-map.

**Controls:** all of v2 + A1 trigger · <kbd>Space</kbd> · left-click

[![Walker v3 — Shoot](https://img.shields.io/badge/v3%20%C2%B7%20Trigger%20Shoot-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-4/joystick_walker-v3.html)

---

### 4. v4 — Aim Up / Down + Laser Targeting
Adds **vertical aim** so you can shoot rings at any height — from floor level to ceiling. Use the **A1 ministick** (small thumb stick on top of the grip) to tilt aim up or down. A red **laser line** projects from your chest to show exactly where the ball will fly; the crosshair turns **green when locked on a target**.

**Controls:** all of v3 + A1 ministick Y for aim · keyboard <kbd>R</kbd> / <kbd>F</kbd>

[![Walker v4 — Aim & Laser](https://img.shields.io/badge/v4%20%C2%B7%20Aim%20%26%20Laser-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-4/joystick_walker-v4.html)

---

### 5. v5 — Procedural Sound
Adds **Web Audio API** sound effects — laser zap on fire, crystalline thump on hit, and footsteps tied to the walk cycle. All sounds are synthesized on the fly (no audio files). Click anywhere on the page once to enable audio (browser policy), then press <kbd>M</kbd> to mute / unmute.

**Controls:** all of v4 + <kbd>M</kbd> to mute

[![Walker v5 — Sound](https://img.shields.io/badge/v5%20%C2%B7%20Procedural%20Sound-238636?style=for-the-badge&logoColor=white)](https://benchvue.github.io/vibe-coding/week-4/joystick_walker-v5.html)

---

## 🎯 Axis & Button Mapping

| Function | Joystick Input | Gamepad API Index | Keyboard |
|---|---|---|---|
| Walk forward / back | Pitch (Y) | `axes[1]` | <kbd>W</kbd> <kbd>S</kbd> |
| Strafe left / right | Roll (X) | `axes[0]` | <kbd>A</kbd> <kbd>D</kbd> |
| Turn body | Yaw / twist (Rz) | `axes[2]` (or `[3]`) | <kbd>Q</kbd> <kbd>E</kbd> |
| Aim up / down | A1 ministick Y | `axes[5]` (or `[4]`) | <kbd>R</kbd> <kbd>F</kbd> |
| Fire | A1 trigger (front red) | `buttons[0]` | <kbd>Space</kbd> / click |
| Re-center calibration | — | — | <kbd>C</kbd> |
| Mute / unmute (v5) | — | — | <kbd>M</kbd> |

---

## 🧪 Run Locally

```bash
# clone and serve
git clone https://github.com/benchvue/vibe-coding.git
cd vibe-coding/week-4

# any static server works — Python is easiest
python -m http.server 5500
```

Then open `http://localhost:5500/joystick_walker-v1.html` (or v2 / v3 / v4 / v5).

### Or with VS Code Live Server

1. Install the **Live Server** extension by Ritwick Dey.
2. Open the `week-4` folder in VS Code.
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
8. Move the mini-throttle full up and down.
9. Press the **A1 ministick center button** until the LED turns red, then circle the ministick fully.
10. Click **End Calibr**.

⚠️ Don't use Windows' built-in joystick calibration on VKB devices — it conflicts with the firmware.

---

## 🛠 Tech Stack

- **Three.js** (r160) — 3D rendering, scene graph, lighting, shadows
- **Gamepad API** — joystick axis/button polling
- **Web Audio API** (v5) — procedural sound synthesis
- **Vanilla JS / HTML / CSS** — no build step, no framework
- **CSS variables** — themed dark UI with cyan / orange accent palette

---

## 📝 License

MIT — feel free to fork, remix, and extend.
