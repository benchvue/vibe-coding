// main.js (ES module)

// ======================
// Cesium access token
// ======================
Cesium.Ion.defaultAccessToken = "YOUR_CESIUM_ION_ACCESS_TOKEN_HERE";

// ======================
// Viewer
// ======================
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  animation: false,
  timeline: false,
  infoBox: true,
  selectionIndicator: true,
});

viewer.scene.globe.enableLighting = true;

// ======================
// Data source
// ======================
const quakeSource = new Cesium.CustomDataSource("earthquakes");
viewer.dataSources.add(quakeSource);

// ======================
// UI
// ======================
const startInput = document.getElementById("startTime");
const endInput = document.getElementById("endTime");
const minMagInput = document.getElementById("minMag");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

// Default: last 1 day
const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

startInput.value = formatDate(yesterday);
endInput.value = formatDate(today);

// ======================
// Hover label entity
// ======================
const hoverLabel = viewer.entities.add({
  label: {
    show: false,
    text: "",
    font: "14px sans-serif",
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(15, -10),
    showBackground: true,
    backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
});

// ======================
// Mouse hover handler
// ======================
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.endPosition);

  if (
    Cesium.defined(picked) &&
    picked.id &&
    picked.id.properties
  ) {
    const props = picked.id.properties;

    const place = props.place?.getValue();
    const mag = props.mag?.getValue();
    const time = props.time?.getValue();

    if (!place || !mag || !time) return;

    hoverLabel.position = picked.id.position.getValue(
      viewer.clock.currentTime
    );

    hoverLabel.label.text =
      `${place}\n` +
      `${formatUtc(time)} | Mag ${mag.toFixed(1)} Mw`;

    hoverLabel.label.show = true;
  } else {
    hoverLabel.label.show = false;
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// ======================
// Helpers
// ======================
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function formatUtc(ms) {
  const d = new Date(ms);
  return d.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function magToHeight(mag) {
  return 20000 + mag * 20000; // meters
}

function magToRadius(mag) {
  return 10000 + mag * 2000;
}

function magToColor(mag) {
  if (mag < 4) return Cesium.Color.YELLOW.withAlpha(0.8);
  if (mag < 6) return Cesium.Color.ORANGE.withAlpha(0.8);
  return Cesium.Color.RED.withAlpha(0.85);
}

// ======================
// Load earthquakes
// ======================
async function loadEarthquakes() {
  quakeSource.entities.removeAll();
  setStatus("Loading…");

  const url =
    `https://earthquake.usgs.gov/fdsnws/event/1/query` +
    `?format=geojson` +
    `&starttime=${startInput.value}` +
    `&endtime=${endInput.value}` +
    `&minmagnitude=${minMagInput.value}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    for (const f of data.features) {
      const [lon, lat] = f.geometry.coordinates;
      const mag = f.properties.mag;
      const place = f.properties.place;
      const time = f.properties.time;

      const height = magToHeight(mag);
      const radius = magToRadius(mag);

      const center = Cesium.Cartesian3.fromDegrees(
        lon,
        lat,
        height / 2
      );

      quakeSource.entities.add({
        position: center,

        properties: {
          place,
          mag,
          time,
        },

        cylinder: {
          length: height,
          topRadius: radius,
          bottomRadius: radius,
          material: magToColor(mag),
          outline: true,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
        },

        description: `
          <b>${place}</b><br/>
          Time: ${formatUtc(time)}<br/>
          Magnitude: ${mag} Mw
        `,
      });
    }

    viewer.flyTo(quakeSource);
    setStatus(`Loaded ${data.features.length} earthquakes`);
  } catch (err) {
    console.error(err);
    setStatus("Error loading data");
  }
}

// ======================
// Events
// ======================
loadBtn.onclick = loadEarthquakes;
clearBtn.onclick = () => {
  quakeSource.entities.removeAll();
  setStatus("Cleared");
};

// Initial load
loadEarthquakes();
