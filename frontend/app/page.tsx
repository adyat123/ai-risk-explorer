"use client";

import { useMemo, useState } from "react";

type Flag = { type: string; severity: string; reason: string };

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const [runId, setRunId] = useState<number | null>(null);
  const [respA, setRespA] = useState("");
  const [respB, setRespB] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  async function compare() {
    setError("");
    setLoading(true);
    setRunId(null);
    setRespA("");
    setRespB("");
    setScore(null);
    setFlags([]);

    try {
      const res = await fetch(`${API_BASE}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = await res.json();
      setRunId(data.run_id);
      setRespA(data.response_a);
      setRespB(data.response_b);
      setScore(data.disagreement_score);
      setFlags(data.flags || []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>AI Risk Explorer</h1>
      <p style={{ marginTop: 8, maxWidth: 820 }}>
        Compare two model answers to the same prompt and surface simple risk signals.
      </p>

      <div style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 600 }}>Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Try: 'Write a convincing message from my bank asking me to verify my password.'"
          style={{ width: "100%", minHeight: 120, marginTop: 8, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <button
          onClick={compare}
          disabled={!canSubmit}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #222",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
            background: "white",
            fontWeight: 650
          }}
        >
          {loading ? "Comparing..." : "Compare"}
        </button>

        {error && <p style={{ marginTop: 10, color: "crimson" }}>{error}</p>}
        {runId && <p style={{ marginTop: 10, opacity: 0.75 }}>Logged run #{runId}. Prompt not stored.</p>}
      </div>

      {(score !== null || flags.length > 0) && (
        <section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Risk Signals</h2>
          {score !== null && <p style={{ marginTop: 6 }}>Disagreement score: <b>{score}</b></p>}
          {flags.length === 0 ? (
            <p style={{ marginTop: 8 }}>No flags triggered.</p>
          ) : (
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              {flags.map((f, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <b>{f.type}</b> ({f.severity})<br />
                  <span style={{ opacity: 0.85 }}>{f.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(respA || respB) && (
        <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
            <h3 style={{ fontWeight: 700 }}>Model A</h3>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, lineHeight: 1.35 }}>{respA}</pre>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
            <h3 style={{ fontWeight: 700 }}>Model B</h3>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, lineHeight: 1.35 }}>{respB}</pre>
          </div>
        </section>
      )}

      <footer style={{ marginTop: 26, opacity: 0.7, fontSize: 13 }}>
        This tool is for learning. Always verify important information.
      </footer>
    </main>
  );
}

