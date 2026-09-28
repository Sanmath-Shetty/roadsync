// One numbered step of the permit flow. state: "locked" | "active" | "done"
export default function Step({ n, title, state, summary, children }) {
  return (
    <section className={`step is-${state}`} aria-current={state === "active" ? "step" : undefined}>
      <div className="step-rail">
        <span className="step-num">{state === "done" ? "✓" : n}</span>
      </div>
      <div className="step-body">
        <h2 className="step-title">{title}</h2>
        {summary && <p className="step-summary">{summary}</p>}
        {state !== "locked" && children}
      </div>
    </section>
  );
}
