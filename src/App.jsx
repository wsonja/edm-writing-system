import { useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import EDMComposer from "./components/EDMComposer.jsx";
import LanguageGuide from "./components/LanguageGuide.jsx";

function LandingPage({ onStart }) {
  const [showLanguage, setShowLanguage] = useState(false);
  const phoneLights = Array.from({ length: 58 }, (_, index) => ({
    id: index,
    left: `${2 + ((index * 17) % 96)}%`,
    bottom: `${4 + ((index * 23) % 22)}%`,
    delay: `${(index % 11) * 0.12}s`,
    scale: 0.75 + (index % 5) * 0.12,
  }));

  return (
    <main className="landingPage">
      <div className="stageBackdrop" aria-hidden="true">
        <div className="generatedArena" />
        <div className="colorSurge" />
        <div className="stageCanopy">
          <span />
        </div>
        <div className="visualWall">
          <div className="ledWall" />
          <div className="screenWave" />
          <div className="halo haloOne" />
          <div className="halo haloTwo" />
        </div>
        <div className="laserField">
          <span className="laser laserOne" />
          <span className="laser laserTwo" />
          <span className="laser laserThree" />
          <span className="laser laserFour" />
          <span className="laser laserFive" />
          <span className="laser laserSix" />
        </div>
        <div className="bassRings">
          <span />
          <span />
          <span />
        </div>
        <div className="djPlatform">
          <div className="stageDisc" />
          <div className="stageRim" />
          <div className="djFigure" />
        </div>
        <div className="phoneLights">
          {phoneLights.map((light) => (
            <span
              key={light.id}
              style={{
                left: light.left,
                bottom: light.bottom,
                animationDelay: light.delay,
                transform: `scale(${light.scale})`,
              }}
            />
          ))}
        </div>
      </div>

      <section className="landingContent" aria-labelledby="landingTitle">
        <p className="landingKicker">drop-ready notation for producers</p>
        <h1 id="landingTitle">EDM WRITING SYSTEM</h1>
        <div className="landingActions">
          <button
            className="secondaryCta"
            type="button"
            onClick={() => setShowLanguage((current) => !current)}
          >
            <BookOpen size={18} aria-hidden="true" />
            Alphabet
          </button>
          <button className="primaryCta" type="button" onClick={onStart}>
            Start writing
            <ArrowRight size={22} aria-hidden="true" />
          </button>
        </div>
        {showLanguage ? (
          <LanguageGuide onClose={() => setShowLanguage(false)} />
        ) : null}
      </section>
    </main>
  );
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

  return hasStarted ? (
    <EDMComposer />
  ) : (
    <LandingPage onStart={() => setHasStarted(true)} />
  );
}
