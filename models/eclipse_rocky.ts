import { Schema, model, models } from 'mongoose'

const EclipseRockySchema = new Schema({
  address: {
    type: String,
    required: [true, 'Address is required'],
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
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
})

const EclipseRocky = models.EclipseRocky || model('EclipseRocky', EclipseRockySchema)

export default EclipseRocky
