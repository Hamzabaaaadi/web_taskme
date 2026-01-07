import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true },
    prenom: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    motDePasse: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["SUPER_ADMIN", "COORDINATEUR", "AUDITEUR"],
      required: true
    },

    estActif: {
      type: Boolean,
      default: true
    },

    dateCreation: {
      type: Date,
      default: Date.now
    }
  },
  {
    discriminatorKey: "role",
    collection: "user"
  }
);

export const User = mongoose.model("User", userSchema);