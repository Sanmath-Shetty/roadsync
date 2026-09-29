// Landing view: the live map is the hero. A glass card explains RoadSync
// using real numbers from the backend, and a real /check result on the map.
import { useState } from "react";
import useSpecular from "./useSpecular";
import { ASSET_LABELS } from "./colors";

const HOW = [
  ["Mark the trench", "Draw the dig on the map, or start from the demo road."],
  ["Check the ground", "RoadSync finds pipes and cables in the way and other crews digging nearby."],
  ["Seal it on MST", "The permit and any conflict are written to the blockchain as hashes."],
  ["Fix, then approve", "The contract refuses approval until every conflict is resolved."],
];

export default function Landing({ assets, workOrders, timeline, chain, preview, onDemo, onDraw }) {
  const [showHow, setShowHow] = useState(false);
  const card = useSpecular();

  const contract = chain?.chain?.contract;
  const conflict = preview?.conflicts?.[0];
  const crews = new Set(workOrders.map((w) => w.org)).size;

  return (
    <section className="landing">
      <div ref={card} className="hero glass glass-liquid">
        <h1 className="logo">RoadSync</h1>
        <p className="hero-head">Stop digging the same road twice.</p>
        <p className="hero-copy">
          Before a crew opens a road, RoadSync checks the trench against gas, water, power and fibre lines, and
          against other crews' planned digs. Every decision is sealed on the MST blockchain.
        </p>

        {conflict && (
          <p className="hero-live" style={{ "--c": "var(--gas)" }}>
            <span className="live-dot" aria-hidden="true" />
            <span>
              On the map now: the demo trench crosses {ASSET_LABELS[conflict.type].toLowerCase()} line{" "}
              <b>{conflict.asset_id}</b>. A {preview.suggested_route?.offset_m} m reroute clears it.
            </span>
          </p>
        )}

        <div className="hero-cta">
          <button className="btn btn-primary btn-lg" onClick={onDemo}>
            Try it on the demo road
          </button>
          <button className="btn btn-glass btn-lg" onClick={onDraw}>
            Draw my own trench
          </button>
        </div>

        <button className="disclosure" aria-expanded={showHow} onClick={() => setShowHow(!showHow)}>
          How approval works
          <span className="chev" aria-hidden="true" />
        </button>
        {showHow && (
          <ol className="how">
            {HOW.map(([t, d], i) => (
              <li key={t} style={{ "--i": i }}>
                <b>{t}</b>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        )}

        <dl className="stats">
          <div>
            <dt>Lines mapped</dt>
            <dd>{assets ? assets.features.length : "…"}</dd>
          </div>
          <div>
            <dt>Crews digging nearby</dt>
            <dd>{crews}</dd>
          </div>
          <div>
            <dt>Decisions on MST</dt>
            <dd>{timeline ? timeline.length : "…"}</dd>
          </div>
        </dl>
        {contract && (
          <p className="hero-foot">
            Live on MST testnet, contract <span className="hash" title={contract}>{contract.slice(0, 6)}…{contract.slice(-4)}</span>
          </p>
        )}
      </div>
    </section>
  );
}
