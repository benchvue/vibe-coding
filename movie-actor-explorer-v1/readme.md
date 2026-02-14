# 🎬 Movie Actor Explorer

![Movie Actor Explorer](./images/overview.png)

A lightweight **frontend-only movie explorer** that displays famous actors as cards and shows their movies when clicked.

Built with **pure HTML, CSS, and JavaScript** using the **TMDB (The Movie Database) REST API**.  
No Node.js, no build tools, no frameworks.

---

## 📸 Overview

**Movie Actor Explorer** allows you to:

- View famous actors as visual cards
- Click an actor to see their most popular movies
- Display movie posters fetched from TMDB
- Run everything locally or on any static hosting (GitHub Pages, Nginx, S3)

This project is ideal for:
- Learning REST APIs
- Frontend practice
- UI prototyping
- Vibe coding demos 🎧

---

## 📁 Project Structure

```
movie-actor-explorer/
│
├─ index.html
├─ env.js # API token (DO NOT COMMIT)
├─ css/
│ └─ style.css
└─ js/
└─ app.js
```

---

## ▶️ How to Run

### Option 1: Open Directly
1. Download or clone the project
2. Open `index.html` in your web browser

### Option 2: VS Code Live Server (Recommended)
1. Open the folder in VS Code
2. Right-click `index.html`
3. Select **“Open with Live Server”**

No build or installation steps are required.

---

## 🧠 Architecture

```
Browser
|
|-- index.html
|-- style.css
|-- app.js
|-- env.js (token)
|
TMDB REST API
```


### Key Design Decisions

- Uses `env.js` instead of `.env` (browser-safe workaround)
- API token injected via `window.__ENV__`
- REST calls authenticated using Bearer token
- Stateless, frontend-only architecture

---

## 🔗 REST API Usage

This project uses **TMDB v3 REST endpoints** authenticated by a **v4 Read Access Token**.

---

### Example 1: Get Actor Details

**Request**

```
GET https://api.themoviedb.org/3/person/287

Authorization: Bearer YOUR_READ_ACCESS_TOKEN
```


**Response (JSON)**
```json
{
  "id": 287,
  "name": "Brad Pitt",
  "popularity": 78.4,
  "profile_path": "/kU3B75TyRiCgE270EyZnHjfivoq.jpg"
}



Example 2: Get Actor Movies

Request

```
GET https://api.themoviedb.org/3/person/287/movie_credits
Authorization: Bearer YOUR_READ_ACCESS_TOKEN
```

```
{
  "cast": [
    {
      "title": "Fight Club",
      "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      "overview": "An insomniac office worker..."
    }
  ]
}
```

###API Token Handling
`env.js`

```
window.__ENV__ = {
  READ_ACCESS_TOKEN: "YOUR_TMDB_READ_ACCESS_TOKEN"
};

```

Usage in `app.js`
```
const READ_ACCESS_TOKEN = window.__ENV__.READ_ACCESS_TOKEN;

```

🔑 How to Get a TMDB Read Access Token

Visit https://www.themoviedb.org/

Create a free account

Go to Profile → Settings → API

Request an API key

Copy the Read Access Token (v4 auth)

📌 You do not need OAuth or write access.

⚠️ Security Notes

This is a frontend-only demo

The API token is visible in browser DevTools

Suitable for:

Learning

Prototyping

Demos

For production environments:

Use a backend API proxy (Node.js, Spring, Cloudflare Worker)

🚀 Possible Enhancements

Actor search

Movie detail modal

Pagination

Infinite scrolling

Cesium 3D globe visualization

Backend proxy for secure API access

📄 License

MIT License — free to use for learning, demos, and experiments.

```

---

## ✅ What You Can Do Now

- Save this as **`README.md`**
- Attach it to emails, tickets, or docs
- Upload directly to GitHub / GitLab
- Share as a single markdown file

If you want next:
- GitHub Pages deploy steps
- Screenshot section
- PDF export
- Portfolio polish

Just tell me 👍
```