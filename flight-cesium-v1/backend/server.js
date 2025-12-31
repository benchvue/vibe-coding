import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/api/flights", async (req, res) => {
  const { dep, arr, date } = req.query;

  const url =
    "https://serpapi.com/search.json?engine=google_flights" +
    `&departure_id=${dep}` +
    `&arrival_id=${arr}` +
    `&outbound_date=${date}` +
    `&api_key=${process.env.SERPAPI_KEY}`;

  const r = await fetch(url);
  const data = await r.json();

  res.json(data);
});

app.listen(3000, () => {
  console.log("✅ Backend running at http://localhost:3000");
});
