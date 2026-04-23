const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash });
    await user.save();
    
    req.session.userId = user._id;
    res.json({ message: "Registered successfully", user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.userId = user._id;
    res.json({ message: "Logged in successfully", user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    res.json({ user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
