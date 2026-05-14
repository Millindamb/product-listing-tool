const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    supplierUrl:   String,
    sku:           { type: String, required: true },
    productTitle:  String,
    category:      String,
    productType:   String,
    brand:         String,
    collection:    String,
    colour:        String,
    size:          String,
    style:         String,
    cpRaw:         Number,       // cost price before GST
    cpGST:         Number,       // cost price including GST
    rrp:           Number,
    sp:            Number,
    weight:        Number,
    weightUnit:    String,
    marginOk:      Boolean,
    tags:          [String],
    collections:   [String],
    metafields:    mongoose.Schema.Types.Mixed,
    description:   String,
    aiDescription: String,
    warranty:      String,
    status:        { type: String, enum: ["draft","ready","exported"], default: "draft" },
    notes:         String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
