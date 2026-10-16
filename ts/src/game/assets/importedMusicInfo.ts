export const IMPORTED_MENU_MUSIC = {
  path: "war3mapImported\\BeforeTheFirstStrike-6c68a3f71fab.mp3",
  file: "BeforeTheFirstStrike-6c68a3f71fab.mp3",
  sha256: "6c68a3f71fabb0e257bb87d48f7bd22bf9ef85b8c6983e47896543a4c184fa48",
  bytes: 4137650,
  durationMilliseconds: 172147,
  sampleRate: 44100,
  channels: 2,
} as const;

export const IMPORTED_STAGE_MUSIC = {
  2: { path: "war3mapImported\\CitadelOfWinterKings-5a05bca9f85b.mp3", file: "CitadelOfWinterKings-5a05bca9f85b.mp3", sha256: "5a05bca9f85bf1e146bffc13e55339f88b6224719fd60c6257688f4f8f85d5fb", bytes: 1360919, durationMilliseconds: 85002, sampleRate: 44100, channels: 2 },
  3: { path: "war3mapImported\\IronTuskStomp-8563bd02c818.mp3", file: "IronTuskStomp-8563bd02c818.mp3", sha256: "8563bd02c8184b4054c891fdcddc67b084322def1283275c6739d550077db18a", bytes: 1327900, durationMilliseconds: 82939, sampleRate: 44100, channels: 2 },
  4: { path: "war3mapImported\\IronRitesOfTheSpire-7483e319bb29.mp3", file: "IronRitesOfTheSpire-7483e319bb29.mp3", sha256: "7483e319bb296e93bb9b25432ff816756588e524c5cfec10b95ed24c01fc8782", bytes: 1340021, durationMilliseconds: 83696, sampleRate: 44100, channels: 2 },
  6: { path: "war3mapImported\\CrownOfBrokenKings-0a7b5643b202.mp3", file: "CrownOfBrokenKings-0a7b5643b202.mp3", sha256: "0a7b5643b20241bbaa7ab1564dd001de59890c79492bc00425fe4eb5a449f808", bytes: 1317451, durationMilliseconds: 82286, sampleRate: 44100, channels: 2 },
  7: { path: "war3mapImported\\ThroneOfShiftingStone-48da6a819c28.mp3", file: "ThroneOfShiftingStone-48da6a819c28.mp3", sha256: "48da6a819c285bb718f45024bd13306eab4089d2e5f1f5c01d43e5acd0aab4be", bytes: 1400625, durationMilliseconds: 87484, sampleRate: 44100, channels: 2 },
  10: { path: "war3mapImported\\BoughAndBlade-f9f38211fd6d.mp3", file: "BoughAndBlade-f9f38211fd6d.mp3", sha256: "f9f38211fd6d07d525073635b2204c7d708937faca06bd5a1989dde18c451837", bytes: 2752723, durationMilliseconds: 171990, sampleRate: 44100, channels: 2 },
  11: { path: "war3mapImported\\SummitOfTheSteelWing-420193a72a24.mp3", file: "SummitOfTheSteelWing-420193a72a24.mp3", sha256: "420193a72a24d4777db20c0fc9bbca6e62348d0530951d5de1c24ced3397d8ad", bytes: 2542071, durationMilliseconds: 158824, sampleRate: 44100, channels: 2 },
  12: { path: "war3mapImported\\MoltenAnvilGroove-065ba0f385c1.mp3", file: "MoltenAnvilGroove-065ba0f385c1.mp3", sha256: "065ba0f385c10d5bab8d8a9656f1f560326cdd556fd3c4b5055e970dca90c17f", bytes: 1357157, durationMilliseconds: 84767, sampleRate: 44100, channels: 2 },
  13: { path: "war3mapImported\\RitualOfTheMandible-a4184642bda4.mp3", file: "RitualOfTheMandible-a4184642bda4.mp3", sha256: "a4184642bda4119a935940b47dccd9b0f2e27adfcb882b7a3ba608ef3a60f89c", bytes: 2896501, durationMilliseconds: 180976, sampleRate: 44100, channels: 2 },
  14: { path: "war3mapImported\\SiegeOfTheIronGate-4aa93e339111.mp3", file: "SiegeOfTheIronGate-4aa93e339111.mp3", sha256: "4aa93e3391111aaa2b986150002384f67d1faa483b243e50b3ae2a5ed40f32cd", bytes: 1320377, durationMilliseconds: 82469, sampleRate: 44100, channels: 2 },
} as const;

export const IMPORTED_MUSIC = [IMPORTED_MENU_MUSIC, ...Object.values(IMPORTED_STAGE_MUSIC)];
