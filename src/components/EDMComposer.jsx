import { useMemo, useRef, useState } from "react";

const STEPS = 32;
const STEP_TIME = 0.15;

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

export default function EDMComposer() {
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [grid, setGrid] = useState(() => createEmptyGrid(DEFAULT_ROWS));
  const [selectedPitch, setSelectedPitch] = useState("C");
  const [selectedDuration, setSelectedDuration] = useState("1");
  const [playingStep, setPlayingStep] = useState(null);
  const timers = useRef([]);

  const notation = useMemo(() => {
    return rows
      .map((row) => {
        const sound = getSound(row.sound);
        const cells = grid[row.id]
          .map((cell) => (cell ? `${sound.symbol}${cell.pitch || ""}${cell.duration !== "1" ? cell.duration : ""}` : "·"))
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
    setPlayingStep(null);
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

  function playCell(ctx, soundId, cell, time) {
    if (!cell) return;

    const duration = Number(cell.duration) * STEP_TIME;
    const freq = NOTE_FREQ[cell.pitch] || 261.63;

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
    if (soundId === "arp") playTone(ctx, time, freq, Math.min(duration, 0.12), "square", 0.12);
  }

  async function play() {
    stop();

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime + 0.08;

    for (let step = 0; step < STEPS; step++) {
      const time = now + step * STEP_TIME;

      rows.forEach((row) => {
        playCell(ctx, row.sound, grid[row.id][step], time);
      });

      timers.current.push(
        setTimeout(() => setPlayingStep(step), step * STEP_TIME * 1000)
      );
    }

    timers.current.push(
      setTimeout(() => {
        setPlayingStep(null);
        ctx.close();
      }, STEPS * STEP_TIME * 1000 + 500)
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">EDM Writing System</div>
        <nav>
          <span>Instrument</span>
          <span className="active">Patterns</span>
          <span>Piano Roll</span>
          <span>Effects</span>
        </nav>
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
        </section>

        <section className="patternPanel">
          <div className="measureLabels">
            <div></div>
            {Array.from({ length: STEPS }, (_, i) => (
              <div key={i} className="stepNumber">
                {i % 16 === 0 ? i / 16 + 1 : "•"}
              </div>
            ))}
          </div>

          {rows.map((row) => {
            const sound = getSound(row.sound);

            return (
              <div className="trackRow" key={row.id}>
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

                {grid[row.id].map((cell, step) => (
                  <button
                    key={step}
                    className={`cell ${cell ? "filled" : ""} ${
                      playingStep === step ? "playing" : ""
                    }`}
                    onClick={() => toggleCell(row.id, step)}
                  >
                    <span>{cell ? sound.symbol : ""}</span>
                  </button>
                ))}
              </div>
            );
          })}

          <button className="addRow" onClick={addRow}>
            + Add Row
          </button>
        </section>

        <section className="transport">
          <button onClick={play} className="play">▶</button>
          <button onClick={stop}>Stop</button>
          <button onClick={clearAll}>Clear</button>
          <span>120 bpm</span>
          <span>4/4</span>
        </section>

        <section className="notation">
          <p className="label">Notation Export</p>
          <pre>{notation}</pre>
        </section>
      </main>
    </div>
  );
}