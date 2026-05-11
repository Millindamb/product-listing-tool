require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const productRoutes = require("./routes/product");
const descriptionRoutes = require("./routes/description");
const exportRoutes = require("./routes/export");

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/products", productRoutes);
app.use("/api/description", descriptionRoutes);
app.use("/api/export", exportRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// MongoDB connect (optional — app works without DB too)
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/austpek";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(() => console.log("MongoDB not connected — running without DB"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Austpek backend running on port ${PORT}`));
