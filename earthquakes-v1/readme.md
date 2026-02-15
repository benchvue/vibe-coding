# 🌍 Interactive 3D Earthquake Visualization  
**CesiumJS + USGS Earthquake API**

## Overview

This project is a **web-based 3D geospatial visualization** that displays global earthquake activity on an interactive CesiumJS globe.

Earthquake data is retrieved in real time from the **USGS Earthquake GeoJSON REST API** and rendered as **magnitude-scaled 3D cylinder bars** at each epicenter.

The application allows users to filter earthquakes by time range and magnitude, explore events spatially, and interact with each earthquake via hover tooltips and detailed information panels.

## Overview

![3D Earthquake Visualization Overview](./images/overview.png)

This project is a **web-based 3D geospatial visualization** that displays global earthquake activity on an interactive CesiumJS globe.

---

## ✨ Key Features

- 🌍 **3D Earth visualization** using CesiumJS
- 🔄 **Live data** from USGS Earthquake API (GeoJSON)
- 🎛️ User-controlled filters:
  - Start time
  - End time
  - Minimum magnitude
- 📊 **3D cylinder bars** scaled by earthquake magnitude
- 🎨 Color-coded visualization by magnitude
- 🖱️ **Mouse hover tooltip** (two lines):
  ```
  5 km WSW of Cobb, California
  2024-01-01 12:34:56 UTC | Mag 4.8 Mw
  ```
- 🖱️ Click an event to open Cesium InfoBox with details
- ⚡ Efficient rendering using a **single reusable hover label**

---

## 🏗️ Architecture Overview

### High-Level System Architecture

```mermaid
flowchart LR
    User[User Browser]

    subgraph UI
        Controls[Filter UI<br/>Start / End / Min Mag]
        Tooltip[Hover Tooltip<br/>Place / Time / Magnitude]
        InfoBox[Cesium InfoBox]
    end

    subgraph App
        Cesium[CesiumJS Viewer<br/>3D Globe]
        Entities[Earthquake Entities<br/>3D Cylinders]
    end

    subgraph Data
        USGS[USGS Earthquake API<br/>GeoJSON]
    end

    User --> Controls
    Controls --> Cesium
    Cesium -->|Fetch| USGS
    USGS -->|GeoJSON| Cesium
    Cesium --> Entities
    Entities --> Tooltip
    Entities --> InfoBox
```

---

### Runtime Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Cesium
    participant USGS

    User->>UI: Select filters
    UI->>Cesium: loadEarthquakes()
    Cesium->>USGS: HTTP GET (GeoJSON)
    USGS-->>Cesium: FeatureCollection
    Cesium->>Cesium: Create 3D cylinders
    Cesium->>User: Render on globe
```

---

### Interaction Model (Hover & Click)

```mermaid
flowchart TD
    Mouse[Mouse Move / Click]
    Pick[Cesium Scene Pick]
    Entity{Earthquake Entity?}

    HoverLabel[Reusable Hover Label]
    InfoBox[Cesium InfoBox]

    Mouse --> Pick
    Pick --> Entity

    Entity -->|Hover| HoverLabel
    Entity -->|Click| InfoBox
```

---

## 🧩 Component Mapping

```mermaid
flowchart LR
    index[index.html]
    css[styles.css]
    js[main.js]

    subgraph main.js
        Viewer[Cesium Viewer]
        DataSource[CustomDataSource]
        Loader[USGS Loader]
        Hover[Hover Handler]
        Renderer[Cylinder Renderer]
    end

    index --> js
    index --> css

    js --> Viewer
    js --> DataSource
    js --> Loader
    js --> Hover
    js --> Renderer
```

---

## 📁 Project Structure

```
earthquake-cesium/
├── index.html     # Application entry point
├── styles.css     # UI styling
└── main.js        # Cesium logic, API calls, rendering
```

---

## 🚀 Getting Started

### 1️⃣ Prerequisites

- A **Cesium Ion access token** (free — see below)
- A local static web server (required for `fetch()`)

---

### 2️⃣ Get a Cesium Ion Access Token (Google Sign-In)

Cesium Ion provides free access to 3D terrain, satellite imagery, and tiling services. You can sign up with your **Google email** in under 2 minutes.

#### Step 1 — Go to Cesium Ion Sign Up

Open your browser and navigate to:

```
https://ion.cesium.com/signup/
```

#### Step 2 — Sign in with Google

1. Click the **"Sign in with Google"** button
2. Select your **Google account** (or enter your Gmail address)
3. Authorize Cesium to access your basic profile info
4. You'll be redirected to the **Cesium Ion Dashboard**

> 💡 You can also sign in with **GitHub** or **Epic Games** accounts.

#### Step 3 — Copy Your Access Token

1. In the Cesium Ion Dashboard, click **"Access Tokens"** in the left sidebar
   - Or go directly to: `https://ion.cesium.com/tokens`
2. You'll see a **default token** already created for your account
3. Click the **📋 Copy** button next to the default token

Your token will look like this:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ODNk...
```

#### Step 4 — Add the Token to Your Code

Edit `main.js` and replace the token value:

```js
Cesium.Ion.defaultAccessToken = "PASTE_YOUR_TOKEN_HERE";
```

> ⚠️ **Best Practice**: For production apps, create a **new token** instead of using the default one. Click **"Create Token"** on the Access Tokens page, give it a name (e.g., `earthquake-app`), and select only the scopes you need (`assets:read`).

---

### 3️⃣ Run Locally

Using Python:

```bash
cd earthquake-cesium
python -m http.server 8080
```

Open in browser:

```
http://localhost:8080
```

---

## 🔌 Data Source

**USGS Earthquake API**

Example endpoint:

```
https://earthquake.usgs.gov/fdsnws/event/1/query
  ?format=geojson
  &starttime=2024-01-01
  &endtime=2024-01-02
  &minmagnitude=4.5
```

Each earthquake feature includes:
- `place`
- `time`
- `magnitude`
- `coordinates`

---

## ⚙️ Design Decisions

- **Client-side only**  
  No backend or database required
- **Reusable hover label**  
  Prevents creating thousands of DOM or Cesium entities
- **Stateless data loading**  
  Every filter request fetches fresh data
- **Pure Cesium rendering**  
  No HTML overlays, better performance

---

## 📌 Limitations & Notes

- Large date ranges may return many events (performance impact)
- Depth is currently informational only (not extruded underground)
- Internet access required for Cesium terrain and USGS API

---

## 🔮 Possible Enhancements

- Depth-based subsurface visualization
- Magnitude legend overlay
- Clustering for dense datasets
- Time-lapse animation
- React / Angular integration
- WebGL performance tuning

---

## 🧠 Attribution

This project was **generated and iteratively refined using ChatGPT** as a coding assistant, with human-guided design and validation.

---

## 📜 License

This project uses public earthquake data from the **United States Geological Survey (USGS)**.  
CesiumJS is subject to its respective license.
