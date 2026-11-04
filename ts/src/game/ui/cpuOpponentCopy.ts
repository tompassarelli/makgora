
export const CPU_OPPONENT_COPY = {
  "rook": {
    "id": "rook",
    "name": "Rook",
    "description": "Makes a plan, then fights for the space to use it.",
    "tags": "Plans ahead · Controls space",
    "previews": {
      "peon": "Strong at: Following a plan.\nWatch for: Slow answers and mistimed close attacks.",
      "grunt": "Strong at: Spacing and learning habits.\nWatch for: Sudden pressure and missed gambles.",
      "warchief": "Strong at: Adaptation, spacing and close conversions.\nWatch for: Baiting caution when a gamble is needed."
    }
  },
  "ember": {
    "id": "ember",
    "name": "Ember",
    "description": "Pushes the pace and looks for the next opening.",
    "tags": "Takes initiative · Keeps pressure",
    "previews": {
      "peon": "Strong at: Quick approaches.\nWatch for: Repeated unsafe attacks.",
      "grunt": "Strong at: Sustained pressure and spotting escapes.\nWatch for: Impatient extensions.",
      "warchief": "Strong at: Fast conversions, reads and pressure resets.\nWatch for: Impatience after a blocked push."
    }
  },
  "flint": {
    "id": "flint",
    "name": "Flint",
    "description": "Turns practiced movement into clean attacks.",
    "tags": "Precise movement · Clean follow-ups",
    "previews": {
      "peon": "Strong at: Practiced movement.\nWatch for: Repeating a mistimed follow-up.",
      "grunt": "Strong at: Execution and reliable punishes.\nWatch for: Familiar routes after you change habits.",
      "warchief": "Strong at: Execution, adaptation and choosing conversions.\nWatch for: Baiting a rehearsed route."
    }
  },
  "vale": {
    "id": "vale",
    "name": "Vale",
    "description": "Stays composed, then turns defense into an opening.",
    "tags": "Patient defense · Punishes mistakes",
    "previews": {
      "peon": "Strong at: Blocking obvious attacks.\nWatch for: Grabs and long waits.",
      "grunt": "Strong at: Defense and proactive grabs.\nWatch for: Hesitation after a safe reset.",
      "warchief": "Strong at: Precise punishes and offense from defense.\nWatch for: Taking initiative while Vale waits for certainty."
    }
  },
  "kite": {
    "id": "kite",
    "name": "Kite",
    "description": "Changes pace and finds unusual ways through.",
    "tags": "Changes routes · Bold choices",
    "previews": {
      "peon": "Strong at: Trying different routes.\nWatch for: Unsafe landings.",
      "grunt": "Strong at: Varied approaches and short conversions.\nWatch for: Bold recoveries.",
      "warchief": "Strong at: Route changes, precise conversions and reads.\nWatch for: Recognizing the occasional bold recovery."
    }
  },
  "wren": {
    "id": "wren",
    "name": "Wren",
    "description": "Changes tools to match the fight in front of them.",
    "tags": "Flexible choices · Steady pace",
    "previews": {
      "peon": "Strong at: Trying attack and defense.\nWatch for: Long pauses before a reset.",
      "grunt": "Strong at: Flexible tools and burst pressure.\nWatch for: Predictable resets under uncertainty.",
      "warchief": "Strong at: Adaptation, precise defense and varied pressure.\nWatch for: Conditioning the preferred neutral reset."
    }
  }
} as const;
