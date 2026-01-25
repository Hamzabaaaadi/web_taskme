const mongoose = require('mongoose');

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
      default: false
    },

    dateCreation: {
      type: Date,
      default: Date.now
    }
    ,
    avatar: {
      type: String,
      default: null
    }
  },
  {
    discriminatorKey: "role",
    collection: "user"
  }
);

module.exports = mongoose.model("User", userSchema);