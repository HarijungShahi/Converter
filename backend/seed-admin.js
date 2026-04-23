require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./src/models/User");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/converter";

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const existing = await User.findOne({ username: "Ronisha" });
    if (existing) {
      console.log("Admin Ronisha already exists.");
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash("admin123", 10);
    const admin = new User({
      username: "Ronisha",
      passwordHash,
      role: "admin"
    });
    
    await admin.save();
    console.log("Admin user 'Ronisha' created with password 'admin123'");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed admin:", err);
    process.exit(1);
  }
}

seedAdmin();
