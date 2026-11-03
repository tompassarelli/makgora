import { CHUNKS_PER_FILE } from "wisp/src/runtime/gameFiles";


export const devCommandReceiptFile = (build: string, slot: number) => `makgora-dev-${build}-p${slot}.txt`;

export const nativeChatFile = (build: string, slot: number) => `makgora-chat-${build}-p${slot}.txt`;
export const MELEE_READY_FILE = "wc3-melee-ready.txt";
export const INPUT_START_FILE = "wc3-melee-input-start.txt";
export const INPUT_TRACE_FILE = "wc3-melee-input-trace.txt";
export const INPUT_PREFLIGHT_FILE = "makgora-input-preflight.txt";

export const RESPONSE_TRACE_CALLBACKS = 4500;
export const traceStartLine = (build: string) => `TRACE START ${build}`;
export const traceEndLines = (dropped: number, ticks: number, seconds: string) => [`dropped ${dropped}`, `${ticks} ${seconds} end`];

export const journalControlFile = (build: string, epoch: number, slot: number, sequence: number | "*") => `makgora-journal-control-${build}-e${epoch}-s${slot}-n${sequence}.txt`;
export const journalLifecycleFile = (build: string, epoch: number, slot: number, kind: "start" | "end") => `makgora-journal-${kind}-${build}-e${epoch}-s${slot}.txt`;
export const journalReadyFile = (build: string, epoch: number, slot: number) => `makgora-journal-ready-${build}-e${epoch}-p${slot}.txt`;
export const journalMenuFile = (build: string, slot: number) => `makgora-journal-menu-${build}-s${slot}.txt`;
export const journalTransportReadyFile = (build: string, epoch: number, slot: number) => `makgora-journal-transport-ready-${build}-e${epoch}-p${slot}.txt`;
export const journalFailureFile = (build: string, epoch: number, slot: number) => `makgora-journal-failure-${build}-e${epoch}-p${slot}.txt`;
export const responsePageFile = (slot: number | "*", run: number | "*", page: number | "*") => `makgora-response-p${slot}-run${run}-page${page}.txt`;
export const edgeStampFile = (slot: number, run: number, row: number, stage: "poll" | "present") => `makgora-edge-p${slot}-run${run}-row${row}-${stage}.txt`;
export const frameCostFile = (source: string, slot: number, language: "typescript" | "wurst") => `makgora-frame-cost-${source}-p${slot}-${language}.txt`;
export const frameCostClockFile = (slot: number) => `makgora-frame-cost-clock-p${slot}.txt`;

export const CAPTURE_STATUS_FILE = "makgora-capture-status.txt";
export const CAPTURE_SCREEN_FILE = "makgora-capture-screen.txt";
export const callbackClockFile = (slot: number, run: number) => `makgora-callback-clock-p${slot}-run${run}.txt`;
export const renderClockFile = (slot: number, run: number) => `makgora-render-clock-p${slot}-run${run}.txt`;
export const handleLedgerFile = (slot: number, tick: number) => `makgora-handle-ledger-p${slot}-t${tick}.txt`;
export const PHYSICS_REPORT_FILE = "makgora-native-physics-precision.txt";
export const objectDataReceiptFile = (slot: number) => `makgora-object-data-p${slot}.txt`;

export const PLAYTEST_REQUEST_FILE = "makgora-play.txt";
export const PLAYTEST_GO_FILE = "makgora-play-go.txt";
export const playtestReceiptFile = (slot: number) => `makgora-play-p${slot}.txt`;

export const stageReceiptFile = (build: string, slot: number) => `makgora-stage-${build}-p${slot}.txt`;

export const matchRecordFile = (serial: number) => `makgora-match-${serial}.txt`;

export const replayFile = (serial: number) => `makgora-replay-${serial}.txt`;
export const replayPartFile = (serial: number, part: number) => `makgora-replay-${serial}-${part}.txt`;

export const MATCH_RECORD_INDEX_FILE = "makgora-match-index.pld";
export const LOBBY_COUNTER_FILE = "makgora-lobby-counter.pld";

export const drawnFrameFile = (build: string, slot: number) => `makgora-drawn-${build}-p${slot}.txt`;
export const drawnFrameLine = (build: string, epoch: number, frame: number) => `MAKGORA DRAWN v=1 build=${build} epoch=${epoch} frame=${frame}`;

export const NATIVE_SOAK_FILE = "makgora-native-soak.txt";
export const VOICE_LOG_FILE = "makgora-voice-log.txt";
export const VOICE_CHECK_SCRIPT = 63;
export const TRAILER_LOG_FILE = "makgora-trailer-log.txt";
export const TRAILER_SCRIPT = 62;

export const sessionRatesFile = (load: string, minute: number) => `makgora-rates-${load}-${minute}.txt`;
export const sessionRatesHeader = (load: string, minute: number, build: string, version: string, clock: boolean) => `makgora-rates v=1 load=${load} minute=${minute} build=${build} version=${version} clock=${clock ? "os" : "ticks"}`;

export const PLAYER_FILE_CHUNK = 200;
export const PLAYER_FILE_CAPACITY = PLAYER_FILE_CHUNK * (CHUNKS_PER_FILE - 1);
