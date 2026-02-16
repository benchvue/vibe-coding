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
movie-actor-explorer-v2/
├── images/
│   └── overview.png
└── AWS/
    ├── ch3-key.pem                         ← SSH key
    ├── deployment-guide.md                 ← Full AWS guide
    ├── movie-vpc-architecture.yaml         ← CloudFormation template
    ├── movies-detailed-architecture.drawio ← Architecture diagram
    ├── README.md                           ← readme    
    └── index.html                          ← Single-file app (HTML + CSS + JS)

```

### Single-File Architecture

All HTML, CSS, JavaScript, and the API token are combined into a **single `index.html`** — no separate `env.js`, `style.css`, or `app.js` files.

| Section in `index.html` | Description |
|--------------------------|-------------|
| `<style>` | Grid layout, dark theme, card styling |
| `<script>` (top) | `window.__ENV__` with TMDB Read Access Token |
| `<script>` (main) | Actor rendering, TMDB API fetch, movie loading |

---

## ▶️ How to Run

1. Open `AWS/index.html` in your web browser
2. Or right-click → **"Open with Live Server"** in VS Code

No build or installation steps required.

---

## 🔑 How to Get a TMDB Read Access Token

This app uses the **TMDB v3 REST API** authenticated by a **v4 Read Access Token**. You can get one for free in under 3 minutes.

### Step 1 — Create a TMDB Account

Open your browser and navigate to:

```
https://www.themoviedb.org/signup
```

1. Enter your **username**, **email**, and **password**
2. Click **"Sign Up"**
3. Check your email inbox and **verify your email address**

### Step 2 — Request an API Key

1. Log in to TMDB
2. Go to **Settings → API** page directly:
   ```
   https://www.themoviedb.org/settings/api
   ```
3. If you don't have an API key yet, click **"Create"** → select **"Developer"**
4. Fill in the required fields:
   - **Application Name**: `Movie Actor Explorer` (or any name)
   - **Application URL**: `http://localhost` (for local development)
   - **Application Summary**: `Learning project for TMDB API`
5. Accept the **Terms of Use** and submit

### Step 3 — Copy the Read Access Token

1. Once approved, go to your API settings page:
   ```
   https://www.themoviedb.org/settings/api
   ```
2. You'll see two values:
   - **API Key (v3 auth)** — a short key (not used in this project)
   - **API Read Access Token (v4 auth)** — a long JWT token ✅
3. Copy the **API Read Access Token (v4 auth)**

Your token will look like this:

```
eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMjUyNDVh...
```

> 📌 You need the **Read Access Token**, NOT the API Key. The Read Access Token is the longer one that starts with `eyJ...`

### Step 4 — Add the Token to `index.html`

Open `index.html` and find the `window.__ENV__` section, then paste your token:

```js
window.__ENV__ = {
  READ_ACCESS_TOKEN: "PASTE_YOUR_READ_ACCESS_TOKEN_HERE"
};
```

---

## 🧠 Architecture

```
Browser
│
├── index.html (single file)
│   ├── <style>       → CSS
│   ├── <script>      → window.__ENV__ (token)
│   └── <script>      → App logic (fetch + render)
│
└── TMDB REST API
    ├── /person/{id}           → Actor details
    └── /person/{id}/movie_credits → Movies
```

### Key Design Decisions

- **Single-file** — HTML, CSS, JS, and token all in one `index.html`
- API token injected via `window.__ENV__`
- REST calls authenticated using Bearer token
- Stateless, frontend-only architecture

---

## 🔗 REST API Usage

This project uses **TMDB v3 REST endpoints** authenticated by the **v4 Read Access Token**.

### Example 1: Get Actor Details

```
GET https://api.themoviedb.org/3/person/287
Authorization: Bearer YOUR_READ_ACCESS_TOKEN
```

```json
{
  "id": 287,
  "name": "Brad Pitt",
  "popularity": 78.4,
  "profile_path": "/kU3B75TyRiCgE270EyZnHjfivoq.jpg"
}
```

### Example 2: Get Actor Movies

```
GET https://api.themoviedb.org/3/person/287/movie_credits
Authorization: Bearer YOUR_READ_ACCESS_TOKEN
```

```json
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

---

## ☁️ AWS Deployment (Quick Start)

![Movie Actor 3D Visualization — AWS VPC Architecture](./images/movie-actor-vpc-stack.png)

This project includes a **CloudFormation template** for deploying to AWS EC2. Full details are in `AWS/deployment-guide.md`.

### Resources Created

| Resource | Name | Details |
|----------|------|---------|
| VPC | Movie-VPC | 10.0.0.0/16 |
| Subnet | Movie-Public-Subnet | 10.0.1.0/24 |
| Internet Gateway | Movie-IGW | Attached to VPC |
| Route Table | Movie-Public-RT | 0.0.0.0/0 → IGW |
| Security Group | Movie-Public-SG | SSH (22), HTTP (80) |
| EC2 | Movie-Public-EC2 | t2.micro, AL2023, Apache |
| Elastic IP | Movie-EIP | Static public IP |

### Deploy in 5 Commands

```bash
cd movie-actor-explorer-v2/AWS

# 1. Create stack
aws cloudformation create-stack \
  --stack-name movie-vpc-stack \
  --template-body file://movie-vpc-architecture.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=ch3-key

# 2. Wait (~3-5 min)
aws cloudformation wait stack-create-complete --stack-name movie-vpc-stack

# 3. Get Elastic IP
EIP=$(aws cloudformation describe-stacks \
  --stack-name movie-vpc-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIP'].OutputValue" \
  --output text)

# 4. Deploy index.html
scp -i ch3-key.pem index.html ec2-user@$EIP:/tmp/ && \
ssh -i ch3-key.pem ec2-user@$EIP "\
  sudo cp /tmp/index.html /var/www/html/index.html && \
  sudo systemctl restart httpd"

# 5. Open in browser
echo "http://$EIP"
```

### Clean Up

```bash
aws cloudformation delete-stack --stack-name movie-vpc-stack
aws cloudformation wait stack-delete-complete --stack-name movie-vpc-stack
```

> 📘 See `AWS/deployment-guide.md` for full step-by-step instructions, SSH guide, and troubleshooting.

---

## ⚠️ Security Notes

This is a frontend-only demo. The API token is visible in browser DevTools.

**Suitable for:** Learning, Prototyping, Demos

**For production:** Use a backend API proxy (Node.js, Spring, Cloudflare Worker)

---

## 🚀 Possible Enhancements

- Actor search
- Movie detail modal
- Pagination
- Infinite scrolling
- Backend proxy for secure API access

---

## 📄 License

MIT License — free to use for learning, demos, and experiments.
