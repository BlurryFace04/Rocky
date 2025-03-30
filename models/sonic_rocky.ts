import { Schema, model, models } from 'mongoose'

const SonicRockySchema = new Schema({
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
  outcome: {
    type: String,
    enum: ["win", "lose", "draw"],
    set: function(this: { outcome: string | null }, value: string): string {
      if (this.outcome == null) {
        return value
      }
      return this.outcome
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
})

const SonicRocky = models.SonicRocky || model('SonicRocky', SonicRockySchema)

export default SonicRocky
