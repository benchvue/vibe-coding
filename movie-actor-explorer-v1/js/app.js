// ===============================
// ENV
// ===============================
const READ_ACCESS_TOKEN = window.__ENV__.READ_ACCESS_TOKEN;

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

// ===============================
// TMDB FETCH HELPER
// ===============================
async function tmdbFetch(endpoint) {
  const res = await fetch(BASE_URL + endpoint, {
    headers: {
      Authorization: `Bearer ${READ_ACCESS_TOKEN}`,
      "Content-Type": "application/json;charset=utf-8"
    }
  });

  if (!res.ok) {
    throw new Error("TMDB API error");
  }

  return res.json();
}

// ===============================
// ACTORS (MEN + WOMEN)
// ===============================
const famousActors = [
  { id: 287, name: "Brad Pitt" },
  { id: 31, name: "Tom Hanks" },
  { id: 500, name: "Tom Cruise" },
  { id: 3223, name: "Robert Downey Jr." },
  { id: 1245, name: "Scarlett Johansson" },
  { id: 11701, name: "Angelina Jolie" },
  { id: 524, name: "Natalie Portman" },
  { id: 10990, name: "Emma Watson" },
  { id: 72129, name: "Jennifer Lawrence" }
];

const actorsEl = document.getElementById("actors");
const moviesEl = document.getElementById("movie-grid");
const titleEl = document.getElementById("movie-title");

// ===============================
// RENDER ACTORS
// ===============================
async function renderActors() {
  for (const actor of famousActors) {
    const person = await tmdbFetch(`/person/${actor.id}`);

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${
        person.profile_path
          ? IMAGE_URL + person.profile_path
          : "https://via.placeholder.com/300x450?text=No+Image"
      }" />
      <div class="card-body">
        <div class="card-title">${actor.name}</div>
      </div>
    `;

    card.onclick = () => loadMovies(actor);
    actorsEl.appendChild(card);
  }
}

renderActors();

// ===============================
// LOAD MOVIES
// ===============================
async function loadMovies(actor) {
  titleEl.innerText = `🎞️ Movies starring ${actor.name}`;
  moviesEl.innerHTML = "";

  const data = await tmdbFetch(`/person/${actor.id}/movie_credits`);

  data.cast
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 12)
    .forEach(movie => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${
          movie.poster_path
            ? IMAGE_URL + movie.poster_path
            : "https://via.placeholder.com/300x450?text=No+Poster"
        }" />
        <div class="card-body">
          <div class="card-title">${movie.title}</div>
        </div>
      `;

      moviesEl.appendChild(card);
    });
}
