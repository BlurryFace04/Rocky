import { Schema, model, models } from 'mongoose'

const EclipseGameSchema = new Schema({
  address: {
    type: String,
    required: [true, 'Address is required'],
    immutable: true
  },
  signature: {
    type: String,
    required: [true, 'Signature is required'],
    immutable: true
  },
  choice: {
    type: String,
    enum: ["rock", "paper", "scissors"],
    immutable: true
  },
  amount: {
    type: Number,
    immutable: true
  },
  outcome : {
    type: String,
    enum: ["win", "lose", "draw"],
    immutable: true
  },
  claimed: {
    type: Boolean,
    default: false
  },
  fake: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
})

const EclipseGame = models.EclipseGame || model('EclipseGame', EclipseGameSchema)

export default EclipseGame
