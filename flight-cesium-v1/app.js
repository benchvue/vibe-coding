/* app.js
 *
 * Requires a backend proxy endpoint:
 *   GET /api/flights?dep=PEK&arr=AUS&date=2026-01-01
 *
 * Place an airplane model here (or change the URL):
 *   ./models/airplane.glb
 */

// -------------------- CONFIG --------------------
Cesium.Ion.defaultAccessToken = "YOUR_CESIUM_ION_ACCESS_TOKEN_HERE";


// Major US airports
const AIRPORTS = {
  LAX: { name: "Los Angeles (LAX)", lat: 33.9416, lon: -118.4085 },
  JFK: { name: "New York (JFK)", lat: 40.6413, lon: -73.7781 },
  SFO: { name: "San Francisco (SFO)", lat: 37.6213, lon: -122.3790 },
  ORD: { name: "Chicago O'Hare (ORD)", lat: 41.9742, lon: -87.9073 },
  DFW: { name: "Dallas/Fort Worth (DFW)", lat: 32.8998, lon: -97.0403 },
  ATL: { name: "Atlanta (ATL)", lat: 33.6407, lon: -84.4277 },
  SEA: { name: "Seattle (SEA)", lat: 47.4502, lon: -122.3088 },
  DEN: { name: "Denver (DEN)", lat: 39.8561, lon: -104.6737 },
  MIA: { name: "Miami (MIA)", lat: 25.7959, lon: -80.2870 },
  BOS: { name: "Boston (BOS)", lat: 42.3656, lon: -71.0096 }
};

// ========================================

// Cesium viewer
const viewer = new Cesium.Viewer("cesiumContainer", {
  timeline: true,
  animation: true,
  shouldAnimate: true
});

viewer.scene.globe.enableLighting = true;

// UI elements
const depSelect = document.getElementById("depSelect");
const arrSelect = document.getElementById("arrSelect");
const durationSelect = document.getElementById("durationSelect");
const startBtn = document.getElementById("startBtn");

// Populate dropdowns
Object.entries(AIRPORTS).forEach(([code, a]) => {
  const opt1 = new Option(a.name, code);
  const opt2 = new Option(a.name, code);
  depSelect.add(opt1);
  arrSelect.add(opt2);
});

// Defaults
depSelect.value = "LAX";
arrSelect.value = "JFK";

// Button handler
startBtn.addEventListener("click", startFlight);

function startFlight() {
  viewer.entities.removeAll();

  const depCode = depSelect.value;
  const arrCode = arrSelect.value;
  const duration = Number(durationSelect.value);

  if (depCode === arrCode) {
    alert("Departure and arrival must be different.");
    return;
  }

  const dep = AIRPORTS[depCode];
  const arr = AIRPORTS[arrCode];

  drawAirport(depCode, dep, Cesium.Color.GREEN);
  drawAirport(arrCode, arr, Cesium.Color.RED);
  drawRoute(dep, arr);
  animatePlane(dep, arr, `${depCode} → ${arrCode}`, duration);
}

// ------------------ Airport Markers ------------------
function drawAirport(code, a, color) {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat),
    point: { pixelSize: 10, color },
    label: {
      text: code,
      pixelOffset: new Cesium.Cartesian2(0, -20)
    }
  });
}

// ------------------ Route ------------------
function drawRoute(dep, arr) {
  viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray([
        dep.lon, dep.lat,
        arr.lon, arr.lat
      ]),
      width: 2,
      material: Cesium.Color.CYAN
    }
  });

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      (dep.lon + arr.lon) / 2,
      (dep.lat + arr.lat) / 2,
      2_000_000
    )
  });
}

// ------------------ Plane Animation (10–30 sec) ------------------
function animatePlane(dep, arr, label, durationSeconds) {
  const start = Cesium.JulianDate.now();
  const stop = Cesium.JulianDate.addSeconds(
    start,
    durationSeconds,
    new Cesium.JulianDate()
  );

  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.clock.multiplier = 1;

  const position = new Cesium.SampledPositionProperty();
  const samples = 120;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const time = Cesium.JulianDate.addSeconds(
      start,
      t * durationSeconds,
      new Cesium.JulianDate()
    );

    const lat = Cesium.Math.lerp(dep.lat, arr.lat, t);
    const lon = Cesium.Math.lerp(dep.lon, arr.lon, t);

    position.addSample(
      time,
      Cesium.Cartesian3.fromDegrees(lon, lat, 12_000)
    );
  }

  const plane = viewer.entities.add({
    position,
    orientation: new Cesium.VelocityOrientationProperty(position),

    // 3D CYLINDER AIRPLANE
    cylinder: {
      length: 30_000,
      topRadius: 2_000,
      bottomRadius: 2_000,
      material: Cesium.Color.YELLOW.withAlpha(0.9)
    },

    label: {
      text: label,
      pixelOffset: new Cesium.Cartesian2(0, -35),
      showBackground: true
    },

    path: {
      width: 2,
      material: Cesium.Color.YELLOW
    }
  });

  viewer.trackedEntity = plane;
}


