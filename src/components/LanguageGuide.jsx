import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import whereYouAreNotation from "../assets/where-you-are-notation.txt?raw";

const SYMBOL_GUIDE = [
  ["●", "Kick"],
  ["▲", "Snare"],
  ["△", "Clap"],
  ["*", "Snap"],
  ["◦", "Rimshot"],
  ["⋅", "Closed hi-hat"],
  ["✕", "Open hi-hat"],
  ["+", "Ride"],
  ["×", "Crash"],
  ["T", "Tom"],
  ["◆", "Perc"],
  ["~", "FX"],
  ["■●", "808 kick"],
  ["■", "Bass"],
  ["○", "Lead / melody"],
  ["▭", "Pad"],
  ["◇", "Chord stab"],
  ["⌇", "Arpeggio"],
];

export default function LanguageGuide({ onClose }) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copyImportExample() {
    await navigator.clipboard?.writeText(whereYouAreNotation);
    setCopyStatus("Copied");
    setTimeout(() => setCopyStatus(""), 1400);
  }

  return (
    <div
      className="languageOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="languageTitle"
    >
      <section className="languagePanel">
        <header className="languageHeader">
          <div>
            <p>Notation import guide</p>
            <h2 id="languageTitle">How to write EDM in this language</h2>
          </div>
          <button
            className="modalClose"
            type="button"
            aria-label="Close language guide"
            onClick={onClose}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>

        <div className="languageBody">
          <section className="guideBlock guideAlphabet">
            <h3>Alphabet</h3>
            <div className="symbolGrid">
              {SYMBOL_GUIDE.map(([symbol, label]) => (
                <span key={`${symbol}-${label}`}>
                  <strong>{symbol}</strong>
                  {label}
                </span>
              ))}
            </div>
          </section>

          <section className="guideBlock">
            <h3>How a note works</h3>
            <p>
              Write one token per step. A token starts with an instrument symbol,
              then an optional pitch A-G, then an optional duration.
            </p>
            <div className="notationExamples">
              <code>●C</code>
              <span>kick on pitch C, default length</span>
              <code>■G2</code>
              <span>bass note G held for two beats</span>
              <code>○A0.5</code>
              <span>lead note A held for half a beat</span>
            </div>
          </section>

          <section className="guideBlock">
            <h3>Timing</h3>
            <p>
              Each row is one instrument lane. Spaces move forward by one grid
              box. Use <code>·</code> for silence and <code>-</code> for a note
              that is being held.
            </p>
            <p>
              Duration values are <code>0.25</code>, <code>0.5</code>,
              <code>1</code>, <code>2</code>, and <code>4</code>.
            </p>
          </section>

          <section className="guideBlock">
            <h3>Repeats</h3>
            <p>
              Add <code>⟲</code> and a number after a token or group to repeat
              it. Brackets repeat whole patterns.
            </p>
            <div className="notationExamples">
              <code>⋅C⟲8</code>
              <span>eight closed hi-hats</span>
              <code>[●C · · ·]⟲4</code>
              <span>four bars of a kick pulse</span>
            </div>
          </section>

          <section className="guideBlock">
            <h3>Import checklist</h3>
            <p>
              Paste plain notation only. Keep each instrument on its own line,
              leave spaces between tokens, and make sure symbols match the
              alphabet above.
            </p>
            <p>
              After import, adjust BPM, bars, and sounds in the studio if the
              groove needs a different feel.
            </p>
          </section>

          <section className="guideBlock guideImport">
            <h3>Paste this into Notation Import</h3>
            <div className="codeBox">
              <div className="codeBoxHeader">
                <span>John Summit - Where You Are 1:02</span>
                <button
                  className="copyCodeButton"
                  type="button"
                  aria-label="Copy John Summit notation"
                  onClick={copyImportExample}
                >
                  {copyStatus ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                  {copyStatus || "Copy"}
                </button>
              </div>
              <pre>{whereYouAreNotation}</pre>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
