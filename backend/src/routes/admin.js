const express = require("express");
const User = require("../models/User");
const Conversion = require("../models/Conversion");
const { runCleanup } = require("../services/cleanup");

const router = express.Router();

// Admin middleware
router.use(async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const totalConversions = await Conversion.countDocuments();
    const successfulConversions = await Conversion.countDocuments({ status: "success" });
    const failedConversions = await Conversion.countDocuments({ status: "failed" });
    const totalUsers = await User.countDocuments();
    
    res.json({ totalConversions, successfulConversions, failedConversions, totalUsers });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "-passwordHash").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.post("/cleanup", (req, res) => {
  try {
    runCleanup();
    res.json({ message: "Cleanup triggered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Cleanup failed" });
  }
});

module.exports = router;
