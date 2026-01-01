const players = [
  "Lionel Messi",
  "Cristiano Ronaldo",
  "LeBron James",
  "Serena Williams",
  "Stephen Curry",
    // NEW STARS
  "Kylian Mbappé",
  "Neymar",
  "Rafael Nadal",
  "Tiger Woods",
  "Shohei Ohtani"
];

const galleryTitle = document.getElementById("gallery-title");
const galleryGrid = document.getElementById("gallery-grid");

const playersEl = document.getElementById("players");

async function loadPlayer(name) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.player) return;

  const player = data.player[0];

  // CREATE STAR CARD (FIRST ROW - NEVER CHANGES)
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <img src="${player.strThumb || 'https://via.placeholder.com/200'}" />
    <h3>${player.strPlayer}</h3>
    <p>🏟 ${player.strTeam || "Unknown team"}</p>
    <p>🌍 ${player.strNationality}</p>
    <p style="font-size:0.85rem;">⭐ Click to see more photos</p>
  `;

  // CLICK → UPDATE SECOND ROW ONLY
  card.onclick = () => showGallery(player);

  playersEl.appendChild(card);
}


function showGallery(player) {
  galleryTitle.innerText = `📸 Photos of ${player.strPlayer}`;
  galleryGrid.innerHTML = "";

  const photos = [
    player.strThumb,
    player.strCutout,
    player.strFanart1,
    player.strFanart2,
    player.strFanart3,
    player.strFanart4
  ].filter(Boolean);

  photos.forEach(src => {
    const card = document.createElement("div");
    card.className = "photo-card";
    card.innerHTML = `<img src="${src}" />`;
    galleryGrid.appendChild(card);
  });

  // Scroll kids to gallery (nice touch)
  document
    .getElementById("photo-gallery")
    .scrollIntoView({ behavior: "smooth" });
}


players.forEach(loadPlayer);
