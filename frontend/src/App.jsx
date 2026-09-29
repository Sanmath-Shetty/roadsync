// RoadSync: check a trench, submit a dig permit, resolve conflicts,
// get agency approval. Every decision is sealed on the MST blockchain.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import Ledger from "./Ledger";
import Step from "./Step";
import Toasts from "./Toasts";
import Landing from "./Landing";
import Legend from "./Legend";
import useSpecular from "./useSpecular";
import { api } from "./api";
import { DEMO_TRENCH, lengthMeters, toLineString } from "./geo";
import { ASSET_LABELS, PAINT } from "./colors";

const DEFAULT_FORM = { org: "Airtel", start: "2026-10-06", end: "2026-10-08" };

const shortHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "");

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Remove repeated points (a double-click adds the same point twice).
function dedupe(points) {
  return points.filter(
    (p, i) => i === 0 || Math.abs(p[0] - points[i - 1][0]) + Math.abs(p[1] - points[i - 1][1]) > 1e-6
  );
}

export default function App() {
  // Data from the backend
  const [chain, setChain] = useState(null);
  const [assets, setAssets] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [freshCount, setFreshCount] = useState(0);
  const [offline, setOffline] = useState(false);

  // Which screen: the landing hero or the permit desk
  const [view, setView] = useState("landing");
  const [preview, setPreview] = useState(null); // real /check of the demo trench, for the hero
  const [hiddenTypes, setHiddenTypes] = useState([]);
  const [hoverType, setHoverType] = useState(null);
  const toggleType = (t) =>
    setHiddenTypes((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]));
  const panelRef = useSpecular();

  // The permit being worked on
  const [form, setForm] = useState(DEFAULT_FORM);
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [trench, setTrench] = useState(null);
  const [original, setOriginal] = useState(null); // trench before a reroute
  const [result, setResult] = useState(null); // /check or /submit answer
  const [order, setOrder] = useState(null); // { id, submitTx, conflictTx }
  const [resolution, setResolution] = useState(null); // { kind, tx }
  const [verdict, setVerdict] = useState(null); // { ok, text, tx }
  const [seal, setSeal] = useState(null); // /verify answer
  const [busy, setBusy] = useState(null); // name of the running action

  const stampRef = useRef(null);
  useEffect(() => {
    stampRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [verdict]);

  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const toast = useCallback((text, kind = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4500);
  }, []);

  // ---- Loading ------------------------------------------------------------
  const lastCount = useRef(null); // to highlight events that just arrived
  const refreshTimeline = useCallback(async () => {
    const events = await api.timeline();
    setFreshCount(lastCount.current === null ? 0 : Math.max(0, events.length - lastCount.current));
    lastCount.current = events.length;
    setTimeline(events);
  }, []);

  const refreshWorkOrders = useCallback(() => api.workOrders().then(setWorkOrders), []);

  useEffect(() => {
    Promise.all([api.assets().then(setAssets), refreshWorkOrders(), refreshTimeline()])
      .then(() => api.info().then(setChain))
      .then(() => api.check({ ...DEFAULT_FORM, geometry: DEMO_TRENCH }).then(setPreview))
      .catch((e) => {
        setOffline(true);
        toast(e.message, "error");
      });
  }, [refreshTimeline, refreshWorkOrders, toast]);

  // Run an API action with a busy label and friendly errors.
  async function run(label, fn) {
    setBusy(label);
    try {
      return await fn();
    } catch (e) {
      if (e.status !== 409) toast(e.message, "error");
      throw e;
    } finally {
      setBusy(null);
    }
  }

  const payload = () => ({ ...form, geometry: trench });

  // ---- Step 1: draw -----------------------------------------------------------
  function startDrawing() {
    resetPermit();
    setTrench(null);
    setDraftPoints([]);
    setDrawing(true);
  }

  const finishDrawing = useCallback(() => {
    setDraftPoints((pts) => {
      const clean = dedupe(pts);
      if (clean.length >= 2) {
        setTrench(toLineString(clean));
        setDrawing(false);
        return [];
      }
      return pts; // not enough points yet: keep drawing
    });
  }, []);

  const cancelDrawing = useCallback(() => {
    setDrawing(false);
    setDraftPoints([]);
  }, []);

  function loadDemoTrench() {
    resetPermit();
    setDrawing(false);
    setTrench(DEMO_TRENCH);
  }

  function resetPermit() {
    setResult(null);
    setOrder(null);
    setResolution(null);
    setVerdict(null);
    setSeal(null);
    setOriginal(null);
  }

  function startOver() {
    resetPermit();
    setTrench(null);
    setForm(DEFAULT_FORM);
  }

  // ---- Step 2: check ----------------------------------------------------------
  async function checkRoute() {
    const data = await run("check", () => api.check(payload())).catch(() => null);
    if (!data) return;
    setResult(data);
    if (data.conflicts.length === 0) toast("Route is clear of known underground assets.", "ok");
  }

  // ---- Step 3: submit ---------------------------------------------------------
  async function submitPermit() {
    const data = await run("submit", () => api.submit(payload())).catch(() => null);
    if (!data) return;
    setResult(data);
    setOrder({ id: data.work_order_id, submitTx: data.tx_hash, conflictTx: data.conflict_tx_hash });
    toast(`Permit #${data.work_order_id} sealed on MST.`, "ok");
    refreshTimeline();
    refreshWorkOrders();
  }

  // ---- Step 4: resolve --------------------------------------------------------
  async function accept(kind) {
    const data = await run(kind, () => api.accept(order.id, kind)).catch(() => null);
    if (!data) return;
    const wo = data.work_order;
    if (kind === "reroute") {
      setOriginal(trench);
      setTrench(wo.geometry);
    }
    setForm((f) => ({ ...f, start: wo.start, end: wo.end }));
    setResult((r) => ({ ...r, conflicts: [], suggested_route: null }));
    setResolution({ kind, tx: data.tx_hash });
    setVerdict(null);
    toast(kind === "reroute" ? "Reroute accepted and recorded on MST." : "Shared dig window accepted.", "ok");
    refreshTimeline();
    refreshWorkOrders();
  }

  // ---- Step 5: approve --------------------------------------------------------
  async function approve() {
    try {
      const data = await run("approve", () => api.approve(order.id));
      setVerdict({ ok: true, tx: data.tx_hash });
      refreshTimeline();
      refreshWorkOrders();
    } catch (e) {
      if (e.status === 409) setVerdict({ ok: false, text: e.data?.error || e.message });
    }
  }

  // ---- Seal check -------------------------------------------------------------
  async function verify() {
    const data = await run("verify", () => api.verify(order.id)).catch(() => null);
    if (data) setSeal(data);
  }

  async function tamper() {
    await run("tamper", () => api.tamper(order.id)).catch(() => null);
    setSeal(null);
    toast("Database edited behind the chain's back. Now verify the record.", "info");
  }

  // ---- Step states ------------------------------------------------------------
  const conflicts = result?.conflicts || [];
  const coordination = result?.coordination || [];
  const needsFix = conflicts.length > 0;
  const approved = verdict?.ok;

  const s1 = trench && !drawing ? "done" : "active";
  const s2 = !trench || drawing ? "locked" : result ? "done" : "active";
  const s3 = !result ? "locked" : order ? "done" : "active";
  const s4 = !order ? "locked" : resolution || (!needsFix && approved) ? "done" : "active";
  const s5 = !order ? "locked" : approved ? "done" : "active";

  // What the map camera should frame: the trench plus any reroute.
  const focus = useMemo(() => {
    if (view === "landing") return preview ? [DEMO_TRENCH, preview.suggested_route?.geometry].filter(Boolean) : null;
    if (!trench || drawing) return null;
    return [trench, result?.suggested_route?.geometry, original].filter(Boolean);
  }, [view, preview, trench, drawing, result, original]);

  const onLanding = view === "landing";

  const length = lengthMeters(trench);
  const draftLength = lengthMeters(draftPoints.length > 1 ? toLineString(draftPoints) : null);

  return (
    <div className={`app view-${view}`}>
      {onLanding && (
        <Landing
          assets={assets}
          workOrders={workOrders}
          timeline={timeline}
          chain={chain}
          preview={preview}
          onDemo={() => {
            setView("desk");
            loadDemoTrench();
          }}
          onDraw={() => {
            setView("desk");
            startDrawing();
          }}
        />
      )}

      {!onLanding && (
      <aside ref={panelRef} className="panel glass glass-liquid">
        <div className="panel-inner">
        <header className="brand">
          <button className="logo logo-btn" onClick={() => setView("landing")} title="Back to overview">
            RoadSync
          </button>
          <ChainChip chain={chain} offline={offline} />
        </header>

        <div className="steps">
          <Step
            n={1}
            title="Mark your trench"
            state={s1}
            summary={trench && !drawing ? `${Math.round(length)} m proposed by ${form.org}` : null}
          >
            {!order && (
              <>
                <div className="fields">
                  <label className="field field-wide">
                    <span>Organisation</span>
                    <input value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Start</span>
                    <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>End</span>
                    <input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  </label>
                </div>
                {drawing ? (
                  <div className="row">
                    <button className="btn btn-primary" onClick={finishDrawing} disabled={draftPoints.length < 2}>
                      Finish line{draftPoints.length > 1 ? ` (${Math.round(draftLength)} m)` : ""}
                    </button>
                    <button className="btn btn-ghost" onClick={cancelDrawing}>Cancel</button>
                  </div>
                ) : (
                  <div className="row">
                    <button className="btn btn-primary" onClick={startDrawing}>
                      {trench ? "Redraw on map" : "Draw on map"}
                    </button>
                    <button className="btn btn-ghost" onClick={loadDemoTrench}>Use demo trench</button>
                  </div>
                )}
              </>
            )}
          </Step>

          <Step n={2} title="Check the route" state={s2}>
            {!result && (
              <button className="btn btn-primary" onClick={checkRoute} disabled={!!busy}>
                {busy === "check" ? <Spinner text="Checking assets" /> : "Check route"}
              </button>
            )}
            {result && (
              <div className="findings">
                {conflicts.length === 0 && !resolution && <p className="finding finding-ok">No underground assets in the way.</p>}
                {resolution?.kind === "reroute" && <p className="finding finding-ok">Rerouted clear of every asset.</p>}
                {conflicts.map((c) => (
                  <p key={c.asset_id} className="finding finding-danger" style={{ "--c": PAINT[c.type] }}>
                    <span className="paint-dot" />
                    Crosses the {ASSET_LABELS[c.type].toLowerCase()} line <b>{c.asset_id}</b>
                  </p>
                ))}
                {result.suggested_route && (
                  <p className="finding finding-survey">
                    A safer route runs {result.suggested_route.offset_m} m over (pink on the map).
                  </p>
                )}
                {coordination.map((m) => (
                  <p key={m.order_id} className="finding finding-coord">
                    <b>{m.org}</b> is digging here {formatDate(m.start)} to {formatDate(m.end)}. Share the trench and the
                    road is only opened once.
                  </p>
                ))}
              </div>
            )}
          </Step>

          <Step
            n={3}
            title="Submit the permit"
            state={s3}
            summary={order ? `Permit #${order.id} written to MST` : null}
          >
            {!order ? (
              <>
                {needsFix && <p className="hint">The conflict is recorded on-chain with the permit. You resolve it next.</p>}
                <button className="btn btn-primary" onClick={submitPermit} disabled={!!busy}>
                  {busy === "submit" ? <Spinner text="Writing to MST" /> : "Submit to MST"}
                </button>
              </>
            ) : (
              <TxLine label="Permit" hash={order.submitTx} />
            )}
            {order?.conflictTx && <TxLine label="Conflict" hash={order.conflictTx} />}
          </Step>

          <Step
            n={4}
            title="Resolve conflicts"
            state={s4}
            summary={
              resolution
                ? resolution.kind === "reroute"
                  ? "Reroute accepted"
                  : "Shared dig window accepted"
                : order && !needsFix
                ? "Nothing blocking this permit"
                : null
            }
          >
            {!resolution && needsFix && result?.suggested_route && (
              <button className="btn btn-survey" onClick={() => accept("reroute")} disabled={!!busy}>
                {busy === "reroute" ? <Spinner text="Recording on MST" /> : `Accept ${result.suggested_route.offset_m} m reroute`}
              </button>
            )}
            {!resolution && !needsFix && coordination.length > 0 && (
              <button className="btn btn-ghost" onClick={() => accept("window")} disabled={!!busy}>
                {busy === "window" ? (
                  <Spinner text="Recording on MST" />
                ) : (
                  `Dig with ${coordination[0].org.split(" ")[0]}, ${formatDate(coordination[0].suggested_window.start)} to ${formatDate(coordination[0].suggested_window.end)}`
                )}
              </button>
            )}
            {resolution && <TxLine label="Resolution" hash={resolution.tx} />}
          </Step>

          <Step n={5} title="Agency approval" state={s5}>
            {!approved && (
              <>
                {needsFix && !verdict && (
                  <p className="hint">Try approving now. The smart contract won't allow it while a conflict is open.</p>
                )}
                <button className="btn btn-primary" onClick={approve} disabled={!!busy}>
                  {busy === "approve" ? <Spinner text="Asking the contract" /> : "Approve as agency"}
                </button>
              </>
            )}
            {verdict && (
              <div ref={stampRef} key={verdict.ok ? "ok" : verdict.text} className={`stamp ${verdict.ok ? "stamp-ok" : "stamp-no"}`} role="status">
                <strong>{verdict.ok ? "Approved" : "Refused by contract"}</strong>
                <span>{verdict.ok ? "Dig permit is valid" : verdict.text}</span>
              </div>
            )}
            {approved && <TxLine label="Approval" hash={verdict.tx} />}
          </Step>

          {order && (
            <section className="seal">
              <h2 className="seal-title">Is this record untouched?</h2>
              <p className="hint">
                RoadSync re-hashes the permit in our database and compares it with the hash stored on MST.
              </p>
              <div className="row">
                <button className="btn btn-ghost" onClick={verify} disabled={!!busy}>
                  {busy === "verify" ? <Spinner text="Reading MST" /> : "Verify against chain"}
                </button>
                <button className="btn btn-text" onClick={tamper} disabled={!!busy}>
                  Tamper with database
                </button>
              </div>
              {seal && (
                <div className={`seal-result ${seal.verified ? "is-ok" : "is-bad"}`}>
                  <strong>{seal.verified ? "Matches the chain" : "Doesn't match the chain"}</strong>
                  <dl>
                    <dt>Database</dt>
                    <dd className="hash">{shortHash(seal.db_hash)}</dd>
                    <dt>MST</dt>
                    <dd className="hash">{shortHash(seal.chain_hash)}</dd>
                  </dl>
                </div>
              )}
            </section>
          )}

          {approved && (
            <button className="btn btn-ghost btn-block" onClick={startOver}>
              Start a new permit
            </button>
          )}
        </div>
        </div>
      </aside>
      )}

      <main className="stage">
        <MapView
          assets={assets}
          workOrders={workOrders}
          myOrderId={order?.id}
          trench={onLanding ? DEMO_TRENCH : drawing ? null : trench}
          original={onLanding ? null : original}
          suggested={onLanding ? preview?.suggested_route : result?.suggested_route}
          conflicts={onLanding ? preview?.conflicts : conflicts}
          hiddenTypes={hiddenTypes}
          hoverType={hoverType}
          padLeft={onLanding ? 620 : 460}
          drawing={drawing}
          draftPoints={draftPoints}
          setDraftPoints={setDraftPoints}
          onFinishDraw={finishDrawing}
          onCancelDraw={cancelDrawing}
          focus={focus}
        />
        <Legend hidden={hiddenTypes} toggle={toggleType} setHover={setHoverType} />
        {!onLanding && <Ledger events={timeline} freshCount={freshCount} />}
      </main>

      <Toasts toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}

function ChainChip({ chain, offline }) {
  if (offline) return <p className="chip chip-bad">Backend offline</p>;
  if (!chain) return <p className="chip">Connecting…</p>;
  if (chain.chain?.error) return <p className="chip chip-bad">Chain not connected</p>;
  const c = chain.chain.contract;
  return (
    <p className="chip chip-ok" title={c}>
      <span className="chip-dot" /> MST testnet, contract <span className="hash">{c.slice(0, 6)}…{c.slice(-4)}</span>
    </p>
  );
}

function TxLine({ label, hash }) {
  return (
    <p className="tx">
      <span>{label} tx</span>
      <span className="hash" title={hash}>{shortHash(hash)}</span>
    </p>
  );
}

function Spinner({ text }) {
  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden="true" />
      {text}
    </span>
  );
}
