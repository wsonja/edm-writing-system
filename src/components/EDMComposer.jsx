import { useEffect, useMemo, useRef, useState } from "react";
import * as lamejs from "lamejs";

const DEFAULT_BARS = 4;
const STORAGE_KEY = "edm-composer-state";
const SAVED_VERSIONS_KEY = "edm-composer-saved-versions";
const CLIPBOARD_TYPE = "edm-composer-pattern";

const SOUND_TYPES = [
  { id: "kick", label: "Kick", symbol: "●" },
  { id: "snare", label: "Snare", symbol: "▲" },
  { id: "clap", label: "Clap", symbol: "△" },
  { id: "snap", label: "Snap", symbol: "*" },
  { id: "rimshot", label: "Rimshot", symbol: "◦" },
  { id: "hihat", label: "Hi-hat Closed", symbol: "⋅" },
  { id: "openhat", label: "Open Hi-hat", symbol: "✕" },
  { id: "ride", label: "Ride", symbol: "+" },
  { id: "crash", label: "Crash", symbol: "×" },
  { id: "tom", label: "Tom", symbol: "T" },
  { id: "perc", label: "Perc", symbol: "◆" },
  { id: "fx", label: "FX", symbol: "~" },
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
  A: 440,
  B: 493.88,
  C: 523.26,
  D: 587.32,
  E: 659.26,
  F: 349.23,
  G: 392,
};

const BASS_SAMPLE_ROOT_FREQ = 261.63;

const PITCHES = ["A", "B", "C", "D", "E", "F", "G"];
const DURATIONS = ["0.25", "0.5", "1", "2", "4"];

const SAMPLE_URLS = {
  kick: "/edmkit/Kicks/(EDM) Kick (8).wav",
  snare: "/edmkit/Snares/(EDM) Snare (8).wav",
  clap: "/edmkit/Claps/(EDM) Clap (1).wav",
  snap: "/edmkit/Snaps/(EDM) Snap (1).wav",
  rimshot: "/edmkit/Rimshots/(EDM) Rim (1).wav",
  hihat: "/edmkit/Closed Hats/(EDM) CH (10).wav",
  openhat: "/edmkit/Open Hats/(EDM) OH (1).wav",
  ride: "/edmkit/Rides/(EDM) Ride (1).wav",
  crash: "/edmkit/Crashes/(EDM) Crash (1).wav",
  tom: "/edmkit/Toms/(EDM) Tom (1).wav",
  perc: "/edmkit/Percs/(EDM) Perc (1).wav",
  fx: "/edmkit/FX/(EDM) FX (1).wav",
  "808": "/edmkit/808s/(EDM) 808 (1).wav",
  bass: "/edmkit/Bass/(EDM) Bass (12).wav",
};

function getSound(id) {
  return SOUND_TYPES.find((s) => s.id === id);
}

function createEmptyGrid(rows, steps) {
  const grid = {};
  rows.forEach((row) => {
    grid[row.id] = Array(steps).fill(null);
  });
  return grid;
}

function resizeGrid(rows, savedGrid = {}, steps) {
  const grid = {};

  rows.forEach((row) => {
    const savedRow = Array.isArray(savedGrid[row.id]) ? savedGrid[row.id] : [];
    grid[row.id] = Array.from(
      { length: steps },
      (_, step) => savedRow[step] || null
    );
  });

  return grid;
}

function getStepCount(barCount, beatsPerBar) {
  return Number(barCount) * beatsPerBar * 4;
}

function getDurationSteps(cell) {
  if (!cell) return 1;

  return Math.max(1, Math.ceil((Number(cell.duration) || 1) * 4));
}

function getHeldCellStart(rowCells, step) {
  for (let startStep = step - 1; startStep >= 0; startStep--) {
    const cell = rowCells[startStep];
    if (!cell) continue;

    if (step < startStep + getDurationSteps(cell)) {
      return startStep;
    }
  }

  return null;
}

function getInitialState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const savedRows = Array.isArray(savedState?.rows) ? savedState.rows : null;
    const rows = savedRows?.length ? savedRows : DEFAULT_ROWS;
    const beatsPerBar = savedState?.beatsPerBar || 4;
    const barCount = savedState?.barCount || String(DEFAULT_BARS);
    const steps = getStepCount(barCount, beatsPerBar);

    return {
      rows,
      grid: resizeGrid(rows, savedState?.grid, steps),
      selectedPitch: savedState?.selectedPitch || "C",
      selectedDuration: savedState?.selectedDuration || "1",
      beatsPerBar,
      barCount,
      bpm: savedState?.bpm || "120",
      loopEnabled: savedState?.loopEnabled || false,
    };
  } catch {
    return {
      rows: DEFAULT_ROWS,
      grid: createEmptyGrid(DEFAULT_ROWS, getStepCount(DEFAULT_BARS, 4)),
      selectedPitch: "C",
      selectedDuration: "1",
      beatsPerBar: 4,
      barCount: String(DEFAULT_BARS),
      bpm: "120",
      loopEnabled: false,
    };
  }
}

function getSavedVersions() {
  try {
    const savedVersions = JSON.parse(localStorage.getItem(SAVED_VERSIONS_KEY));
    return Array.isArray(savedVersions) ? savedVersions : [];
  } catch {
    return [];
  }
}

function parseNotationToken(token) {
  const sound = [...SOUND_TYPES]
    .sort((a, b) => b.symbol.length - a.symbol.length)
    .find((soundType) => token.startsWith(soundType.symbol));

  if (!sound) return null;

  const rest = token.slice(sound.symbol.length);
  const pitch = PITCHES.includes(rest[0]) ? rest[0] : "C";
  const durationText = PITCHES.includes(rest[0]) ? rest.slice(1) : rest;
  const duration = DURATIONS.includes(durationText) ? durationText : "1";

  return { sound: sound.id, pitch, duration };
}

function getRepeatSuffix(text, index) {
  if (text[index] !== "x") return { count: 1, nextIndex: index };

  let cursor = index + 1;
  let digits = "";

  while (/\d/.test(text[cursor])) {
    digits += text[cursor];
    cursor++;
  }

  return {
    count: digits ? Math.max(1, Number(digits)) : 1,
    nextIndex: digits ? cursor : index,
  };
}

function expandNotationLine(line) {
  const expandedTokens = [];
  let cursor = 0;

  while (cursor < line.length) {
    if (/\s/.test(line[cursor])) {
      cursor++;
      continue;
    }

    if (line[cursor] === "[") {
      let depth = 1;
      let groupEnd = cursor + 1;

      while (groupEnd < line.length && depth > 0) {
        if (line[groupEnd] === "[") depth++;
        if (line[groupEnd] === "]") depth--;
        groupEnd++;
      }

      if (depth === 0) {
        const groupText = line.slice(cursor + 1, groupEnd - 1);
        const repeat = getRepeatSuffix(line, groupEnd);
        const groupTokens = expandNotationLine(groupText);

        for (let i = 0; i < repeat.count; i++) {
          expandedTokens.push(...groupTokens);
        }

        cursor = repeat.nextIndex;
        continue;
      }
    }

    let tokenEnd = cursor;
    while (tokenEnd < line.length && !/\s|\[|\]/.test(line[tokenEnd])) {
      tokenEnd++;
    }

    const tokenWithRepeat = line.slice(cursor, tokenEnd);
    const repeatMatch = tokenWithRepeat.match(/^(.*)x(\d+)$/);
    const token = repeatMatch ? repeatMatch[1] : tokenWithRepeat;
    const repeatCount = repeatMatch ? Math.max(1, Number(repeatMatch[2])) : 1;

    for (let i = 0; i < repeatCount; i++) {
      expandedTokens.push(token);
    }

    cursor = tokenEnd;
  }

  return expandedTokens;
}

function compressTokenRuns(tokens) {
  const compressedTokens = [];

  for (let i = 0; i < tokens.length; i++) {
    let repeatCount = 1;

    while (tokens[i + repeatCount] === tokens[i]) {
      repeatCount++;
    }

    compressedTokens.push(
      repeatCount > 1 ? `${tokens[i]}x${repeatCount}` : tokens[i]
    );
    i += repeatCount - 1;
  }

  return compressedTokens;
}

function formatCompressedBars(barTokenGroups) {
  const formattedGroups = [];

  for (let i = 0; i < barTokenGroups.length; i++) {
    let repeatCount = 1;
    const currentBarKey = barTokenGroups[i].join(" ");

    while (
      i + repeatCount < barTokenGroups.length &&
      barTokenGroups[i + repeatCount].join(" ") === currentBarKey
    ) {
      repeatCount++;
    }

    const compressedBar = compressTokenRuns(barTokenGroups[i]).join(" ");

    formattedGroups.push(
      repeatCount > 1 ? `[${compressedBar}]x${repeatCount}` : compressedBar
    );
    i += repeatCount - 1;
  }

  return formattedGroups.join(" ");
}

function parseNotationText(text, fallbackRows, beatsPerBar) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const expandedLines = lines.map(expandNotationLine);
  const boxesPerBar = beatsPerBar * 4;
  const maxSteps = Math.max(...expandedLines.map((tokens) => tokens.length));
  const importBarCount = Math.max(1, Math.ceil(maxSteps / boxesPerBar));
  const importSteps = getStepCount(importBarCount, beatsPerBar);
  const importedRows = expandedLines.map((tokens, rowIndex) => {
    const firstToken = tokens
      .map(parseNotationToken)
      .find(Boolean);

    return {
      id: crypto.randomUUID(),
      sound: firstToken?.sound || fallbackRows[rowIndex]?.sound || "bass",
    };
  });
  const importedGrid = createEmptyGrid(importedRows, importSteps);

  expandedLines.forEach((tokens, rowIndex) => {
    tokens.forEach((token, step) => {
      const parsedToken = parseNotationToken(token);

      if (parsedToken && step < importSteps) {
        importedGrid[importedRows[rowIndex].id][step] = {
          pitch: parsedToken.pitch,
          duration: parsedToken.duration,
        };
      }
    });
  });

  return { rows: importedRows, grid: importedGrid, barCount: String(importBarCount) };
}

function playNoise(ctx, time, duration, volume, destination = ctx.destination) {
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

  source.connect(gain).connect(destination);
  source.start(time);
}

function createReverbImpulse(ctx, duration = 2.2, decay = 2.7) {
  const length = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }

  return impulse;
}

function floatToInt16(floatBuffer) {
  const int16Buffer = new Int16Array(floatBuffer.length);

  for (let i = 0; i < floatBuffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, floatBuffer[i]));
    int16Buffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return int16Buffer;
}

function audioBufferToMp3(audioBuffer) {
  const channelCount = Math.min(2, audioBuffer.numberOfChannels);
  const left = floatToInt16(audioBuffer.getChannelData(0));
  const right =
    channelCount > 1 ? floatToInt16(audioBuffer.getChannelData(1)) : left;
  const encoder = new lamejs.Mp3Encoder(2, audioBuffer.sampleRate, 192);
  const chunks = [];
  const blockSize = 1152;

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk);

    if (encoded.length) chunks.push(encoded);
  }

  const flushed = encoder.flush();
  if (flushed.length) chunks.push(flushed);

  return new Blob(chunks, { type: "audio/mpeg" });
}

export default function EDMComposer() {
  const initialState = useMemo(() => getInitialState(), []);
  const [rows, setRows] = useState(initialState.rows);
  const [grid, setGrid] = useState(initialState.grid);
  const [selectedPitch, setSelectedPitch] = useState(initialState.selectedPitch);
  const [selectedDuration, setSelectedDuration] = useState(
    initialState.selectedDuration
  );
  const [beatsPerBar, setBeatsPerBar] = useState(initialState.beatsPerBar);
  const [barCount, setBarCount] = useState(initialState.barCount);
  const [bpm, setBpm] = useState(initialState.bpm);
  const [loopEnabled, setLoopEnabled] = useState(initialState.loopEnabled);
  const [playingStep, setPlayingStep] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyStartBar, setCopyStartBar] = useState("1");
  const [copyBarCount, setCopyBarCount] = useState("4");
  const [pasteStartBar, setPasteStartBar] = useState("5");
  const [savedVersions, setSavedVersions] = useState(getSavedVersions);
  const [saveStatus, setSaveStatus] = useState("");
  const [notationImport, setNotationImport] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const audioContext = useRef(null);
  const sampleCache = useRef({});
  const scheduledSources = useRef([]);
  const patternClipboard = useRef(null);
  const loopEnabledRef = useRef(loopEnabled);
  const timers = useRef([]);

  const boxesPerBeat = 4;
  const boxesPerBar = beatsPerBar * boxesPerBeat;
  const playbackBarCount =
    Number(barCount) > 0 ? Math.floor(Number(barCount)) : DEFAULT_BARS;
  const totalSteps = getStepCount(playbackBarCount, beatsPerBar);
  const playbackBpm = Number(bpm) > 0 ? Number(bpm) : 120;
  const stepTime = 60 / playbackBpm / boxesPerBeat;

  const gridColumns = useMemo(() => {
  const cols = ["180px"];

  for (let i = 0; i < totalSteps; i++) {
    const isBarEnd = (i + 1) % boxesPerBar === 0;
    const isBeatEnd = (i + 1) % boxesPerBeat === 0;

    if (isBarEnd || isBeatEnd) cols.push("50px");
    else cols.push("43px");
  }

  return cols.join(" ");
}, [boxesPerBar, totalSteps]);

  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rows,
        grid,
        selectedPitch,
        selectedDuration,
        beatsPerBar,
        barCount,
        bpm,
        loopEnabled,
      })
    );
  }, [
    rows,
    grid,
    selectedPitch,
    selectedDuration,
    beatsPerBar,
    barCount,
    bpm,
    loopEnabled,
  ]);

  useEffect(() => {
    localStorage.setItem(SAVED_VERSIONS_KEY, JSON.stringify(savedVersions));
  }, [savedVersions]);

  const notation = useMemo(() => {
    const activeBars = Array.from(
      { length: playbackBarCount },
      (_, barIndex) => {
        const startStep = barIndex * boxesPerBar;
        const endStep = startStep + boxesPerBar;

        return rows.some((row) =>
          grid[row.id].slice(startStep, endStep).some(Boolean)
        );
      }
    );

    return rows
      .map((row) => {
        const sound = getSound(row.sound);
        const activeBarTokens = activeBars.flatMap((isActiveBar, barIndex) => {
          if (!isActiveBar) return [];

          const startStep = barIndex * boxesPerBar;
          const endStep = startStep + boxesPerBar;

          return [
            grid[row.id].slice(startStep, endStep).map((cell, offset) => {
              const step = startStep + offset;

              if (cell) {
                return `${sound.symbol}${cell.pitch || ""}${
                  cell.duration !== "1" ? cell.duration : ""
                }`;
              }

              return getHeldCellStart(grid[row.id], step) === null ? "·" : "-";
            }),
          ];
        });

        return formatCompressedBars(activeBarTokens);
      })
      .join("\n");
  }, [rows, grid, playbackBarCount, boxesPerBar]);

  function toggleCell(rowId, step) {
    setGrid((prev) => {
      const next = { ...prev, [rowId]: [...prev[rowId]] };
      const heldByPreviousCell = getHeldCellStart(next[rowId], step);

      if (heldByPreviousCell !== null) return prev;

      if (next[rowId][step]) {
        next[rowId][step] = null;
        return next;
      }

      const nextCell = { pitch: selectedPitch, duration: selectedDuration };
      const heldSteps = getDurationSteps(nextCell);

      for (let heldStep = step + 1; heldStep < step + heldSteps; heldStep++) {
        if (heldStep < next[rowId].length) {
          next[rowId][heldStep] = null;
        }
      }

      next[rowId][step] = nextCell;
      return next;
    });
  }

  function updateRowSound(rowId, sound) {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, sound } : row))
    );
  }

  function updateBeatsPerBar(nextBeatsPerBar) {
    setBeatsPerBar(nextBeatsPerBar);
    setGrid((prev) =>
      resizeGrid(rows, prev, getStepCount(playbackBarCount, nextBeatsPerBar))
    );
  }

  function updateBarCount(nextBarCountText) {
    setBarCount(nextBarCountText);

    const nextBarCount = Number(nextBarCountText);
    if (!Number.isFinite(nextBarCount) || nextBarCount <= 0) return;

    setGrid((prev) =>
      resizeGrid(rows, prev, getStepCount(Math.floor(nextBarCount), beatsPerBar))
    );
  }

  function addRow() {
    const newRow = { id: crypto.randomUUID(), sound: "bass" };
    setRows((prev) => [...prev, newRow]);
    setGrid((prev) => ({ ...prev, [newRow.id]: Array(totalSteps).fill(null) }));
  }

  function clearAll() {
    stop();
    setGrid(createEmptyGrid(rows, totalSteps));
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

  function getCurrentArrangement() {
    return {
      rows,
      grid,
      selectedPitch,
      selectedDuration,
      beatsPerBar,
      barCount,
      bpm,
      loopEnabled,
    };
  }

  function saveCurrentVersion() {
    const fallbackName = `Version ${savedVersions.length + 1}`;
    const versionName = window.prompt("Name this saved version", fallbackName);
    const trimmedName = versionName?.trim();

    if (!trimmedName) return;

    const nextVersion = {
      id: crypto.randomUUID(),
      name: trimmedName,
      savedAt: new Date().toISOString(),
      arrangement: getCurrentArrangement(),
    };

    setSavedVersions((prev) => [nextVersion, ...prev]);
    setSaveStatus("Saved");
    timers.current.push(setTimeout(() => setSaveStatus(""), 1400));
  }

  function loadSavedVersion(version) {
    const arrangement = version.arrangement;
    const nextBeatsPerBar = arrangement.beatsPerBar || 4;
    const nextBarCount = arrangement.barCount || String(DEFAULT_BARS);
    const nextRows = arrangement.rows?.length ? arrangement.rows : DEFAULT_ROWS;

    stop();
    setRows(nextRows);
    setSelectedPitch(arrangement.selectedPitch || "C");
    setSelectedDuration(arrangement.selectedDuration || "1");
    setBeatsPerBar(nextBeatsPerBar);
    setBarCount(nextBarCount);
    setBpm(arrangement.bpm || "120");
    setLoopEnabled(arrangement.loopEnabled || false);
    setGrid(
      resizeGrid(
        nextRows,
        arrangement.grid,
        getStepCount(nextBarCount, nextBeatsPerBar)
      )
    );
    setSaveStatus(`Loaded ${version.name}`);
    timers.current.push(setTimeout(() => setSaveStatus(""), 1600));
  }

  function importNotation() {
    const importedNotation = parseNotationText(notationImport, rows, beatsPerBar);

    if (!importedNotation) {
      setImportStatus("Paste notation first");
      timers.current.push(setTimeout(() => setImportStatus(""), 1400));
      return;
    }

    stop();
    setRows(importedNotation.rows);
    setGrid(importedNotation.grid);
    setBarCount(importedNotation.barCount);
    setImportStatus("Imported");
    timers.current.push(setTimeout(() => setImportStatus(""), 1400));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportTxt() {
    const blob = new Blob([notation], { type: "text/plain;charset=utf-8" });

    downloadBlob(blob, "edm-notation.txt");
    setExportStatus("TXT exported");
    timers.current.push(setTimeout(() => setExportStatus(""), 1400));
  }

  async function exportMp3() {
    const sampleRate = 44100;
    const renderDuration = totalSteps * stepTime + 3;
    const offlineCtx = new OfflineAudioContext(
      2,
      Math.ceil(sampleRate * renderDuration),
      sampleRate
    );
    const now = 0.08;

    setExportStatus("Rendering MP3...");
    await loadUsedSamples(offlineCtx);

    for (let step = 0; step < totalSteps; step++) {
      const time = now + step * stepTime;

      rows.forEach((row) => {
        playCell(offlineCtx, row.sound, grid[row.id][step], time);
      });
    }

    const renderedBuffer = await offlineCtx.startRendering();
    const mp3Blob = audioBufferToMp3(renderedBuffer);

    downloadBlob(mp3Blob, "edm-arrangement.mp3");
    setExportStatus("MP3 exported");
    timers.current.push(setTimeout(() => setExportStatus(""), 1800));
  }

  function getBarRange(startBarText, barCountText) {
    const startBar = Number(startBarText);
    const rangeBars = Number(barCountText);

    if (
      !Number.isFinite(startBar) ||
      !Number.isFinite(rangeBars) ||
      startBar < 1 ||
      rangeBars < 1
    ) {
      return null;
    }

    const startStep = (Math.floor(startBar) - 1) * boxesPerBar;
    const stepCount = Math.floor(rangeBars) * boxesPerBar;

    return { startStep, stepCount };
  }

  async function copyPattern() {
    const range = getBarRange(copyStartBar, copyBarCount);

    if (!range) {
      setCopyStatus("Choose bars");
      timers.current.push(setTimeout(() => setCopyStatus(""), 1400));
      return;
    }

    const pattern = {
      type: CLIPBOARD_TYPE,
      beatsPerBar,
      copiedBars: Math.floor(Number(copyBarCount)),
      cellsByRow: rows.reduce((cellsByRow, row) => {
        cellsByRow[row.id] = grid[row.id].slice(
          range.startStep,
          range.startStep + range.stepCount
        );
        return cellsByRow;
      }, {}),
    };

    patternClipboard.current = pattern;

    try {
      await navigator.clipboard?.writeText(JSON.stringify(pattern));
      setCopyStatus(`Copied ${pattern.copiedBars} bars`);
    } catch {
      setCopyStatus(`Copied ${pattern.copiedBars} bars`);
    }

    timers.current.push(setTimeout(() => setCopyStatus(""), 1400));
  }

  async function pastePattern() {
    let pattern = patternClipboard.current;
    const range = getBarRange(pasteStartBar, copyBarCount);

    if (!range) {
      setCopyStatus("Choose paste bar");
      timers.current.push(setTimeout(() => setCopyStatus(""), 1400));
      return;
    }

    try {
      const clipboardText = await navigator.clipboard?.readText();
      const parsedPattern = JSON.parse(clipboardText);

      if (parsedPattern?.type === CLIPBOARD_TYPE) {
        pattern = parsedPattern;
      }
    } catch {
      // Browser clipboard access can be blocked; the in-memory copy still works.
    }

    if (!pattern?.cellsByRow) {
      setCopyStatus("Nothing to paste");
      timers.current.push(setTimeout(() => setCopyStatus(""), 1400));
      return;
    }

    const neededBars = Math.ceil((range.startStep + range.stepCount) / boxesPerBar);
    const nextBarCount = Math.max(playbackBarCount, neededBars);

    if (nextBarCount !== playbackBarCount) {
      setBarCount(String(nextBarCount));
    }

    setGrid((prev) => {
      const next = resizeGrid(rows, prev, getStepCount(nextBarCount, beatsPerBar));

      rows.forEach((row) => {
        const copiedCells = pattern.cellsByRow[row.id] || [];

        for (let step = 0; step < range.stepCount; step++) {
          next[row.id][range.startStep + step] = copiedCells[step] || null;
        }
      });

      return next;
    });
    setCopyStatus(`Pasted to bar ${Math.floor(Number(pasteStartBar))}`);
    timers.current.push(setTimeout(() => setCopyStatus(""), 1400));
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

  function playKick(ctx, time, heavy = false, destination = ctx.destination) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(heavy ? 80 : 120, time);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 35 : 45, time + 0.2);

    gain.gain.setValueAtTime(heavy ? 0.8 : 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (heavy ? 0.45 : 0.25));

    osc.connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  function playTone(
    ctx,
    time,
    freq,
    duration,
    type,
    volume,
    release = 0.05,
    destination = ctx.destination
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration + release);

    osc.connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + duration + release);
  }

  function playSynthLead(ctx, time, freq, duration, destination = ctx.destination) {
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    const reverb = ctx.createConvolver();
    const filter = ctx.createBiquadFilter();
    const voices = [
      { detune: -9, volume: 0.13 },
      { detune: 0, volume: 0.15 },
      { detune: 9, volume: 0.13 },
    ];
    const release = 0.65;

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(700, time);
    filter.frequency.exponentialRampToValueAtTime(4200, time + 0.04);
    filter.frequency.exponentialRampToValueAtTime(1400, time + duration + release);
    filter.Q.setValueAtTime(7, time);

    dry.gain.setValueAtTime(0.001, time);
    dry.gain.exponentialRampToValueAtTime(0.72, time + 0.04);
    dry.gain.exponentialRampToValueAtTime(0.001, time + duration + release);

    wet.gain.setValueAtTime(0.24, time);
    delay.delayTime.setValueAtTime(0.28, time);
    feedback.gain.setValueAtTime(0.32, time);
    reverb.buffer = createReverbImpulse(ctx);

    filter.connect(dry).connect(destination);
    filter.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(reverb).connect(wet).connect(destination);

    voices.forEach((voice) => {
      const osc = ctx.createOscillator();
      const voiceGain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(voice.detune, time);
      voiceGain.gain.setValueAtTime(voice.volume, time);

      osc.connect(voiceGain).connect(filter);
      osc.start(time);
      osc.stop(time + duration + release);
    });
  }

  function playSample(
    ctx,
    soundId,
    time,
    volume = 0.8,
    playbackRate = 1,
    destination = ctx.destination
  ) {
    const buffer = sampleCache.current[soundId];
    if (!buffer) return false;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, time);
    gain.gain.setValueAtTime(volume, time);

    source.connect(gain).connect(destination);
    source.start(time);
    scheduledSources.current.push(source);

    source.onended = () => {
      scheduledSources.current = scheduledSources.current.filter(
        (scheduledSource) => scheduledSource !== source
      );
    };

    return true;
  }

  function playCell(ctx, soundId, cell, time, destination = ctx.destination) {
    if (!cell) return;

    const duration = getDurationSteps(cell) * stepTime;
    const freq = NOTE_FREQ[cell.pitch] || 261.63;

    if (
      soundId === "bass" &&
      playSample(ctx, soundId, time, 0.8, freq / BASS_SAMPLE_ROOT_FREQ, destination)
    ) {
      return;
    }

    if (SAMPLE_URLS[soundId] && playSample(ctx, soundId, time, 0.8, 1, destination)) {
      return;
    }

    if (soundId === "kick") playKick(ctx, time, false, destination);
    if (soundId === "808") playKick(ctx, time, true, destination);
    if (soundId === "snare") playNoise(ctx, time, 0.12, 0.35, destination);
    if (soundId === "hihat") playNoise(ctx, time, 0.04, 0.12, destination);
    if (soundId === "openhat") playNoise(ctx, time, 0.22, 0.14, destination);
    if (soundId === "bass") {
      playTone(ctx, time, freq / 2, duration, "square", 0.25, 0.05, destination);
    }
    if (soundId === "lead") playSynthLead(ctx, time, freq / 2, duration, destination);
    if (soundId === "pad") {
      playTone(ctx, time, freq, duration * 2, "sine", 0.12, 0.05, destination);
    }
    if (soundId === "chord") {
      playTone(ctx, time, freq, duration, "triangle", 0.12, 0.05, destination);
      playTone(ctx, time, freq * 1.25, duration, "triangle", 0.09, 0.05, destination);
      playTone(ctx, time, freq * 1.5, duration, "triangle", 0.08, 0.05, destination);
    }
    if (soundId === "arp") {
      playTone(
        ctx,
        time,
        freq,
        Math.min(duration, 0.12),
        "square",
        0.12,
        0.05,
        destination
      );
    }
  }

  async function play() {
    stop();

    const ctx = await getAudioContext();
    await loadUsedSamples(ctx);

    const now = ctx.currentTime + 0.08;

    for (let step = 0; step < totalSteps; step++) {
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
        if (loopEnabledRef.current) {
          play();
        } else {
          setPlayingStep(null);
        }
      }, totalSteps * stepTime * 1000 + 500)
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
        <div className="spacer" style={{ flex: "1" }} />
        <div className="exportControls">
          <button className="export" onClick={exportMp3}>
            Export Audio
          </button>
          <button className="export" onClick={exportTxt}>
            Export Notation
          </button>
          {exportStatus ? <span className="exportStatus">{exportStatus}</span> : null}
        </div>
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
                  onClick={() => updateBeatsPerBar(b)}
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

          <div>
            <label className="label" htmlFor="bars">
              Bars
            </label>
            <input
              id="bars"
              className="numberInput"
              type="number"
              value={barCount}
              onChange={(e) => updateBarCount(e.target.value)}
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
            {Array.from({ length: totalSteps }, (_, i) => {
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
                  const isHeld = getHeldCellStart(grid[row.id], step) !== null;

                  return (
                    <button
                      key={step}
                      className={`cell ${cell ? "filled" : ""} ${
  playingStep === step ? "playing" : ""
} ${isHeld ? "held" : ""} ${isBeatStart ? "beatStart" : ""} ${
  isBarStart ? "barStart" : ""
} ${(step + 1) % boxesPerBeat === 0 ? "beatGap" : ""} ${
  (step + 1) % boxesPerBar === 0 ? "barGap" : ""
}`}
                      disabled={isHeld}
                      onClick={() => toggleCell(row.id, step)}
                    >
                      <span>{cell ? sound.symbol : isHeld ? "-" : ""}</span>
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
          <button
            onClick={() => setLoopEnabled((currentLoop) => !currentLoop)}
            className={loopEnabled ? "activeTransport" : ""}
          >
            Loop
          </button>
        </section>

        <section className="copyTools">
          <div>
            <label className="label" htmlFor="copyStartBar">
              Copy from
            </label>
            <input
              id="copyStartBar"
              className="numberInput"
              type="number"
              value={copyStartBar}
              onChange={(e) => setCopyStartBar(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="copyBarCount">
              Bars
            </label>
            <input
              id="copyBarCount"
              className="numberInput"
              type="number"
              value={copyBarCount}
              onChange={(e) => setCopyBarCount(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="pasteStartBar">
              Paste to
            </label>
            <input
              id="pasteStartBar"
              className="numberInput"
              type="number"
              value={pasteStartBar}
              onChange={(e) => setPasteStartBar(e.target.value)}
            />
          </div>

          <button onClick={copyPattern}>Copy</button>
          <button onClick={pastePattern}>Paste</button>
          {copyStatus ? <span className="transportStatus">{copyStatus}</span> : null}
        </section>

        <section className="savedVersions">
          <div className="savedVersionsHeader">
            <p className="label">Saved Versions</p>
            <button onClick={saveCurrentVersion}>Save Version</button>
            {saveStatus ? <span className="transportStatus">{saveStatus}</span> : null}
          </div>

          <div className="savedVersionList">
            {savedVersions.length ? (
              savedVersions.map((version) => (
                <button
                  key={version.id}
                  className="savedVersionButton"
                  onClick={() => loadSavedVersion(version)}
                >
                  {version.name}
                </button>
              ))
            ) : (
              <span className="emptyVersions">No saved versions yet</span>
            )}
          </div>
        </section>

        <section className="notation">
          <p className="label">Notation Export</p>
          <pre>{notation}</pre>
        </section>

        <section className="notationImport">
          <label className="label" htmlFor="notationImport">
            Notation Import
          </label>
          <textarea
            id="notationImport"
            value={notationImport}
            onChange={(e) => setNotationImport(e.target.value)}
          />
          <div className="notationImportActions">
            <button onClick={importNotation}>Load Notation</button>
            {importStatus ? (
              <span className="transportStatus">{importStatus}</span>
            ) : null}
          </div>
        </section>

        <p className="soundCredit">
          Sounds by{" "}
          <a
            href="https://drumkits.shop/b/edm-drum-kit-dopekit"
            target="_blank"
            rel="noreferrer"
          >
            Trava Beats
          </a>
        </p>
      </main>
    </div>
  );
}
