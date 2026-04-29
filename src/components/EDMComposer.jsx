import { useEffect, useMemo, useRef, useState } from "react";

const STEPS = 64;
const STORAGE_KEY = "edm-composer-state";

const SOUND_TYPES = [
  { id: "kick", label: "Kick", symbol: "●" },
  { id: "snare", label: "Snare / Clap", symbol: "▲" },
  { id: "hihat", label: "Hi-hat Closed", symbol: "⋅" },
  { id: "openhat", label: "Open Hi-hat", symbol: "✕" },
  { id: "808", label: "808 Kick", symbol: "■●" },
  { id: "bass", label: "Bass", symbol: "■" },
  { id: "lead", label: "Lead / Melody", symbol: "○" },
  { id: "pad", label: "Pad", symbol: "▭" },
  { id: "chord", label: "Chord Stab", symbol: "◇" },
  { id: "arp", label: "Arpeggio", symbol: "⌇" },
];

const DEFAULT_ROWS = [
  { id: crypto.randomUUID(), sound: "kick" },
  { id: crypto.randomUUID(), sound: "snare" },
  { id: crypto.randomUUID(), sound: "hihat" },
];

const NOTE_FREQ = {
  A: 220,
  B: 246.94,
  C: 261.63,
  D: 293.66,
  E: 329.63,
  F: 349.23,
  G: 392,
};

const PITCHES = ["A", "B", "C", "D", "E", "F", "G"];
const DURATIONS = ["0.25", "0.5", "1", "2", "4"];

const SAMPLE_URLS = {
  kick: "/edmkit/Kicks/(EDM) Kick (8).wav",
  snare: "/edmkit/Snares/(EDM) Snare (8).wav",
  hihat: "/edmkit/Closed Hats/(EDM) CH (10).wav",
  openhat: "/edmkit/Open Hats/(EDM) OH (1).wav",
  "808": "/edmkit/808s/(EDM) 808 (1).wav",
  bass: "/edmkit/Bass/(EDM) Bass (12).wav",
};

function getSound(id) {
  return SOUND_TYPES.find((s) => s.id === id);
}

function createEmptyGrid(rows) {
  const grid = {};
  rows.forEach((row) => {
    grid[row.id] = Array(STEPS).fill(null);
  });
  return grid;
}

function resizeGrid(rows, savedGrid = {}) {
  const grid = {};

  rows.forEach((row) => {
    const savedRow = Array.isArray(savedGrid[row.id]) ? savedGrid[row.id] : [];
    grid[row.id] = Array.from(
      { length: STEPS },
      (_, step) => savedRow[step] || null
    );
  });

  return grid;
}

function getInitialState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const savedRows = Array.isArray(savedState?.rows) ? savedState.rows : null;
    const rows = savedRows?.length ? savedRows : DEFAULT_ROWS;

    return {
      rows,
      grid: resizeGrid(rows, savedState?.grid),
      selectedPitch: savedState?.selectedPitch || "C",
      selectedDuration: savedState?.selectedDuration || "1",
      beatsPerBar: savedState?.beatsPerBar || 4,
      bpm: savedState?.bpm || "120",
    };
  } catch {
    return {
      rows: DEFAULT_ROWS,
      grid: createEmptyGrid(DEFAULT_ROWS),
      selectedPitch: "C",
      selectedDuration: "1",
      beatsPerBar: 4,
      bpm: "120",
    };
  }
}

export default function EDMComposer() {
  const initialState = useMemo(getInitialState, []);
  const [rows, setRows] = useState(initialState.rows);
  const [grid, setGrid] = useState(initialState.grid);
  const [selectedPitch, setSelectedPitch] = useState(initialState.selectedPitch);
  const [selectedDuration, setSelectedDuration] = useState(
    initialState.selectedDuration
  );
  const [beatsPerBar, setBeatsPerBar] = useState(initialState.beatsPerBar);
  const [bpm, setBpm] = useState(initialState.bpm);
  const [playingStep, setPlayingStep] = useState(null);
  const audioContext = useRef(null);
  const sampleCache = useRef({});
  const scheduledSources = useRef([]);
  const timers = useRef([]);

  const boxesPerBeat = 4;
  const boxesPerBar = beatsPerBar * boxesPerBeat;
  const playbackBpm = Number(bpm) > 0 ? Number(bpm) : 120;
  const stepTime = 60 / playbackBpm / boxesPerBeat;

  const gridColumns = useMemo(() => {
  const cols = ["180px"];

  for (let i = 0; i < STEPS; i++) {
    const isBarEnd = (i + 1) % boxesPerBar === 0;
    const isBeatEnd = (i + 1) % boxesPerBeat === 0;

    if (isBarEnd || isBeatEnd) cols.push("50px");
    else cols.push("43px");
  }

  return cols.join(" ");
}, [boxesPerBar]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rows,
        grid,
        selectedPitch,
        selectedDuration,
        beatsPerBar,
        bpm,
      })
    );
  }, [rows, grid, selectedPitch, selectedDuration, beatsPerBar, bpm]);

  const notation = useMemo(() => {
    return rows
      .map((row) => {
        const sound = getSound(row.sound);
        const cells = grid[row.id]
          .map((cell) =>
            cell
              ? `${sound.symbol}${cell.pitch || ""}${
                  cell.duration !== "1" ? cell.duration : ""
                }`
              : "·"
          )
          .join(" ");
        return `${sound.label}: ${cells}`;
      })
      .join("\n");
  }, [rows, grid]);

  function toggleCell(rowId, step) {
    setGrid((prev) => {
      const next = { ...prev, [rowId]: [...prev[rowId]] };
      next[rowId][step] = next[rowId][step]
        ? null
        : { pitch: selectedPitch, duration: selectedDuration };
      return next;
    });
  }

  function updateRowSound(rowId, sound) {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, sound } : row))
    );
  }

  function addRow() {
    const newRow = { id: crypto.randomUUID(), sound: "bass" };
    setRows((prev) => [...prev, newRow]);
    setGrid((prev) => ({ ...prev, [newRow.id]: Array(STEPS).fill(null) }));
  }

  function clearAll() {
    stop();
    setGrid(createEmptyGrid(rows));
  }

  function stop() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    scheduledSources.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Source may have already stopped naturally.
      }
    });
    scheduledSources.current = [];
    setPlayingStep(null);
  }

  async function getAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!audioContext.current || audioContext.current.state === "closed") {
      audioContext.current = new AudioContext();
    }

    if (audioContext.current.state === "suspended") {
      await audioContext.current.resume();
    }

    return audioContext.current;
  }

  async function loadSample(ctx, soundId) {
    const url = SAMPLE_URLS[soundId];

    if (!url) return null;
    if (sampleCache.current[soundId]) return sampleCache.current[soundId];

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load ${soundId} sample from ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    sampleCache.current[soundId] = audioBuffer;
    return audioBuffer;
  }

  async function loadUsedSamples(ctx) {
    const usedSampleIds = new Set();

    rows.forEach((row) => {
      if (SAMPLE_URLS[row.sound] && grid[row.id].some(Boolean)) {
        usedSampleIds.add(row.sound);
      }
    });

    await Promise.all([...usedSampleIds].map((soundId) => loadSample(ctx, soundId)));
  }

  function playKick(ctx, time, heavy = false) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(heavy ? 80 : 120, time);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 35 : 45, time + 0.2);

    gain.gain.setValueAtTime(heavy ? 0.8 : 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (heavy ? 0.45 : 0.25));

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  function playNoise(ctx, time, duration, volume) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    source.connect(gain).connect(ctx.destination);
    source.start(time);
  }

  function playTone(ctx, time, freq, duration, type, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  function playSample(ctx, soundId, time, volume = 0.8, playbackRate = 1) {
    const buffer = sampleCache.current[soundId];
    if (!buffer) return false;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, time);
    gain.gain.setValueAtTime(volume, time);

    source.connect(gain).connect(ctx.destination);
    source.start(time);
    scheduledSources.current.push(source);

    source.onended = () => {
      scheduledSources.current = scheduledSources.current.filter(
        (scheduledSource) => scheduledSource !== source
      );
    };

    return true;
  }

  function playCell(ctx, soundId, cell, time) {
    if (!cell) return;

    const duration = Number(cell.duration) * stepTime;
    const freq = NOTE_FREQ[cell.pitch] || 261.63;

    if (soundId === "bass" && playSample(ctx, soundId, time, 0.8, freq / NOTE_FREQ.C)) {
      return;
    }

    if (SAMPLE_URLS[soundId] && playSample(ctx, soundId, time)) return;

    if (soundId === "kick") playKick(ctx, time);
    if (soundId === "808") playKick(ctx, time, true);
    if (soundId === "snare") playNoise(ctx, time, 0.12, 0.35);
    if (soundId === "hihat") playNoise(ctx, time, 0.04, 0.12);
    if (soundId === "openhat") playNoise(ctx, time, 0.22, 0.14);
    if (soundId === "bass") playTone(ctx, time, freq / 2, duration, "square", 0.25);
    if (soundId === "lead") playTone(ctx, time, freq, duration, "triangle", 0.18);
    if (soundId === "pad") playTone(ctx, time, freq, duration * 2, "sine", 0.12);
    if (soundId === "chord") {
      playTone(ctx, time, freq, duration, "triangle", 0.12);
      playTone(ctx, time, freq * 1.25, duration, "triangle", 0.09);
      playTone(ctx, time, freq * 1.5, duration, "triangle", 0.08);
    }
    if (soundId === "arp") {
      playTone(ctx, time, freq, Math.min(duration, 0.12), "square", 0.12);
    }
  }

  async function play() {
    stop();

    const ctx = await getAudioContext();
    await loadUsedSamples(ctx);

    const now = ctx.currentTime + 0.08;

    for (let step = 0; step < STEPS; step++) {
      const time = now + step * stepTime;

      rows.forEach((row) => {
        playCell(ctx, row.sound, grid[row.id][step], time);
      });

      timers.current.push(
        setTimeout(() => setPlayingStep(step), step * stepTime * 1000)
      );
    }

    timers.current.push(
      setTimeout(() => {
        setPlayingStep(null);
      }, STEPS * stepTime * 1000 + 500)
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">EDM Writing System</div>
        {/* <nav>
          <span>Instrument</span>
          <span className="active">Patterns</span>
          <span>Piano Roll</span>
          <span>Effects</span>
        </nav> */}
          <div className="spacer" style={{ flex: "1" }}/>
        <button className="export">Export</button>
      </header>

      <main className="workspace">
        <section className="controls">
          <div>
            <p className="label">Pitch</p>
            <div className="pillRow">
              {PITCHES.map((p) => (
                <button
                  key={p}
                  className={selectedPitch === p ? "pill selected" : "pill"}
                  onClick={() => setSelectedPitch(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Duration</p>
            <div className="pillRow">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  className={selectedDuration === d ? "pill selected" : "pill"}
                  onClick={() => setSelectedDuration(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Beats per bar</p>
            <div className="pillRow">
              {[2, 3, 4].map((b) => (
                <button
                  key={b}
                  className={beatsPerBar === b ? "pill selected" : "pill"}
                  onClick={() => setBeatsPerBar(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="bpm">
              BPM
            </label>
            <input
              id="bpm"
              className="numberInput"
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
            />
          </div>
        </section>

        <section className="patternPanel">
          <div
            className="measureLabels"
            style={{
              gridTemplateColumns: gridColumns,
            }}
          >
            <div></div>
            {Array.from({ length: STEPS }, (_, i) => {
              const isBeatStart = i % boxesPerBeat === 0;
              const isBarStart = i % boxesPerBar === 0;

              return (
                <div
                  key={i}
                  className={`stepNumber ${isBeatStart ? "beatStart" : ""} ${
  isBarStart ? "barStart" : ""
} ${(i + 1) % boxesPerBeat === 0 ? "beatGap" : ""} ${
  (i + 1) % boxesPerBar === 0 ? "barGap" : ""
}`}
                >
                  {isBarStart ? i / boxesPerBar + 1 : "•"}
                </div>
              );
            })}
          </div>

          {rows.map((row) => {
            const sound = getSound(row.sound);

            return (
              <div
                className="trackRow"
                key={row.id}
                style={{
                  gridTemplateColumns: gridColumns,
                }}
              >
                <div className="trackLabel">
                  <select
                    value={row.sound}
                    onChange={(e) => updateRowSound(row.id, e.target.value)}
                  >
                    {SOUND_TYPES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="symbolPreview">{sound.symbol}</span>
                </div>

                {grid[row.id].map((cell, step) => {
                  const isBeatStart = step % boxesPerBeat === 0;
                  const isBarStart = step % boxesPerBar === 0;

                  return (
                    <button
                      key={step}
                      className={`cell ${cell ? "filled" : ""} ${
  playingStep === step ? "playing" : ""
} ${isBeatStart ? "beatStart" : ""} ${
  isBarStart ? "barStart" : ""
} ${(step + 1) % boxesPerBeat === 0 ? "beatGap" : ""} ${
  (step + 1) % boxesPerBar === 0 ? "barGap" : ""
}`}
                      onClick={() => toggleCell(row.id, step)}
                    >
                      <span>{cell ? sound.symbol : ""}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          <button className="addRow" onClick={addRow}>
            + Add Row
          </button>
        </section>

        <section className="transport">
          <button onClick={play} className="play">
            ▶
          </button>
          <button onClick={stop}>Stop</button>
          <button onClick={clearAll}>Clear</button>
        </section>

        <section className="notation">
          <p className="label">Notation Export</p>
          <pre>{notation}</pre>
        </section>
      </main>
    </div>
  );
}
