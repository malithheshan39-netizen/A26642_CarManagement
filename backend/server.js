const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

const client = new MongoClient(process.env.MONGODB_URI);
let db;

// ---------- helpers ----------
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const isText = (v) => typeof v === "string" && v.trim().length > 0;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function validateCar(body, partial) {
  const rules = {
    brand: isText,
    model: isText,
    year: (v) => isNum(v) && v >= 1886 && v <= 2100,
    price: (v) => isNum(v) && v >= 0,
    owner_id: (v) => Number.isInteger(v) && v > 0,
    description: isText,
  };
  for (const field of Object.keys(rules)) {
    if (body[field] === undefined) {
      if (!partial) return `Missing field: ${field}`;
    } else if (!rules[field](body[field])) {
      return `Invalid value for field: ${field}`;
    }
  }
  return null;
}

const pick = (body) => {
  const out = {};
  for (const f of ["brand", "model", "year", "price", "owner_id", "description"]) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
};

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });

// ---------- endpoints ----------
app.get("/", (req, res) => {
  res.json({ message: "Cars API is running" });
});

// 1. GET all cars
app.get("/cars", wrap(async (req, res) => {
  const cars = await db.collection("cars")
    .find({}, { projection: { _id: 0 } })
    .sort({ car_id: 1 })
    .toArray();
  res.json(cars);
}));

// 2. SEARCH cars (uses the text index) - must be BEFORE /cars/:id
app.get("/cars/search", wrap(async (req, res) => {
  const query = (req.query.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'query' is required" });
  }
  const cars = await db.collection("cars")
    .find({ $text: { $search: query } },
          { projection: { _id: 0, score: { $meta: "textScore" } } })
    .sort({ score: { $meta: "textScore" } })
    .toArray();
  res.json(cars);
}));

// 3. GET one car
app.get("/cars/:id", wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid car id" });
  const car = await db.collection("cars").findOne({ car_id: id }, { projection: { _id: 0 } });
  if (!car) return res.status(404).json({ error: "Car not found" });
  res.json(car);
}));

// 4. GET one owner
app.get("/owners/:id", wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid owner id" });
  const owner = await db.collection("owners").findOne({ owner_id: id }, { projection: { _id: 0 } });
  if (!owner) return res.status(404).json({ error: "Owner not found" });
  res.json(owner);
}));

// 5. POST add a car
app.post("/cars", wrap(async (req, res) => {
  const problem = validateCar(req.body, false);
  if (problem) return res.status(400).json({ error: problem });

  const owner = await db.collection("owners").findOne({ owner_id: req.body.owner_id });
  if (!owner) return res.status(400).json({ error: "owner_id does not exist" });

  const last = await db.collection("cars").find().sort({ car_id: -1 }).limit(1).toArray();
  const newId = last.length ? last[0].car_id + 1 : 1;

  const car = { car_id: newId, ...pick(req.body) };
  await db.collection("cars").insertOne(car);
  delete car._id;
  res.status(201).json(car);
}));

// 6. PUT edit a car
app.put("/cars/:id", wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid car id" });

  const problem = validateCar(req.body, true);
  if (problem) return res.status(400).json({ error: problem });

  const changes = pick(req.body);
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  if (changes.owner_id !== undefined) {
    const owner = await db.collection("owners").findOne({ owner_id: changes.owner_id });
    if (!owner) return res.status(400).json({ error: "owner_id does not exist" });
  }

  const result = await db.collection("cars").updateOne({ car_id: id }, { $set: changes });
  if (result.matchedCount === 0) return res.status(404).json({ error: "Car not found" });

  const updated = await db.collection("cars").findOne({ car_id: id }, { projection: { _id: 0 } });
  res.json(updated);
}));

// 7. DELETE a car
app.delete("/cars/:id", wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Invalid car id" });
  const result = await db.collection("cars").deleteOne({ car_id: id });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Car not found" });
  res.json({ message: "Car deleted", car_id: id });
}));

// bad JSON from the client
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// ---------- start ----------
async function start() {
  await client.connect();
  db = client.db("cars_project");
  console.log("Connected to MongoDB");
    const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log("Server running on http://localhost:" + port);
  });
}

start().catch((err) => {
  console.error("Could not start:", err.message);
  process.exit(1);
});