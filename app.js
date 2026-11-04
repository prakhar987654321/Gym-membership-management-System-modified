require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const Member = require("./models/Member");
const Class = require("./models/Class");
const Trainer = require("./models/Trainer");
const Payment = require("./models/Payment");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection Caching for Serverless (Vercel) & Localhost
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/flexgym";

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 6000,
      bufferCommands: false,
    }).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error("MongoDB Connection Error:", err.message);
    throw err;
  }
  return cached.conn;
}

// Database Connection Middleware
app.use(async (req, res, next) => {
  if (req.path.startsWith("/style.css") || req.path.startsWith("/script.js") || req.path === "/favicon.ico") {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({
      error: "Database Connection Failed. Please ensure MONGODB_URI is configured with your Atlas password and 0.0.0.0/0 is whitelisted in Network Access.",
    });
  }
});

// Root Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 1. Dashboard Stats (100% Real Database Data - Zero Dummy Seed)
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const [
      memCount,
      clsCount,
      availableTrainers,
      recentMembers,
      upcomingClasses,
      allPayments,
      allClasses,
    ] = await Promise.all([
      Member.countDocuments(),
      Class.countDocuments(),
      Trainer.countDocuments({ status: "Available" }),
      Member.find().sort({ createdAt: -1 }).limit(5),
      Class.find().sort({ createdAt: -1 }).limit(3),
      Payment.find({ status: "Completed" }),
      Class.find(),
    ]);

    let revenue = 0;
    allPayments.forEach((p) => {
      revenue += p.amount || 0;
    });

    let totalBooked = 0;
    let totalCapacity = 0;
    allClasses.forEach((c) => {
      totalBooked += c.booked || 0;
      totalCapacity += c.total || 0;
    });
    const attendance =
      totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

    res.json({
      totalMembers: memCount,
      totalClasses: clsCount,
      availableTrainers,
      revenue,
      attendance,
      recentMembers,
      upcomingClasses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Members Endpoints
app.get("/api/members", async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/members", async (req, res) => {
  const { name, email, plan, paymentMethod } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const existing = await Member.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: `Member with email "${cleanEmail}" is already registered!` });
    }

    const member = await Member.create({
      name: name.trim(),
      email: cleanEmail,
      plan: plan || "Monthly",
      status: "Active",
      paymentMethod: paymentMethod || "UPI",
    });

    let amount = 1000;
    if (member.plan === "Quarterly") amount = 2500;
    else if (member.plan === "Annual") amount = 8000;

    await Payment.create({
      member: member._id,
      amount,
      plan: member.plan,
      paymentMethod: paymentMethod || "UPI",
      status: "Completed",
    });

    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/members/:id/toggle", async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: "Member not found" });
    member.status = member.status === "Active" ? "Expired" : "Active";
    await member.save();
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/members/:id", async (req, res) => {
  try {
    await Member.findByIdAndDelete(req.params.id);
    await Payment.deleteMany({ member: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Classes Endpoints
app.get("/api/classes", async (req, res) => {
  try {
    const classes = await Class.find().sort({ createdAt: -1 });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/classes", async (req, res) => {
  const { title, trainer, timing, total } = req.body;
  if (!title || !trainer) {
    return res.status(400).json({ error: "Class title and trainer name are required" });
  }
  try {
    const cls = await Class.create({
      title: title.trim(),
      trainer: trainer.trim(),
      timing: timing ? timing.trim() : "6:00 AM - 7:00 AM",
      total: parseInt(total) || 20,
      booked: 0,
    });
    res.status(201).json(cls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/classes/:id/book", async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (cls.booked >= cls.total) return res.status(400).json({ error: "Class is full" });
    cls.booked += 1;
    await cls.save();
    res.json(cls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/classes/:id", async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Trainers Endpoints
app.get("/api/trainers", async (req, res) => {
  try {
    const trainers = await Trainer.find().sort({ createdAt: -1 });
    res.json(trainers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/trainers", async (req, res) => {
  const { name, specialty, status } = req.body;
  if (!name || !specialty) {
    return res.status(400).json({ error: "Trainer name and specialty are required" });
  }
  try {
    const trainer = await Trainer.create({
      name: name.trim(),
      specialty: specialty.trim(),
      status: status || "Available",
    });
    res.status(201).json(trainer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/trainers/:id", async (req, res) => {
  try {
    await Trainer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Payments & Reports Endpoints
app.get("/api/payments", async (req, res) => {
  try {
    const payments = await Payment.find().populate("member", "name email").sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const [totalMembers, activeMembers, totalClasses, payments, planDistribution] =
      await Promise.all([
        Member.countDocuments(),
        Member.countDocuments({ status: "Active" }),
        Class.countDocuments(),
        Payment.find({ status: "Completed" }),
        Member.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
      ]);

    let totalRevenue = 0;
    payments.forEach(p => totalRevenue += (p.amount || 0));

    res.json({
      totalMembers,
      activeMembers,
      totalClasses,
      totalRevenue,
      planDistribution,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Database API to clear any leftover entries
app.post("/api/reset-data", async (req, res) => {
  try {
    await Member.deleteMany();
    await Class.deleteMany();
    await Trainer.deleteMany();
    await Payment.deleteMany();
    res.json({ success: true, message: "All data cleared successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/test", (req, res) => res.json({ message: "Server running" }));

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
}

module.exports = app;
