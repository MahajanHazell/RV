/**
 * TicketRedeem Component
 *
 * Simple access gate for demo code entry
 */

import { useState } from "react";
import { supabase } from "../lib/supabase";
import MuseumSelect from "./MuseumSelect";

const DEMO_CODE_MAP: Record<string, string> = {
  "DEMO-1": "demo_hash_1",
  "DEMO-2": "demo_hash_2",
  "DEMO-3": "demo_hash_3",
  "BILLS-1": "demo_hash_1",
  "BILLS-2": "demo_hash_2",
  "BILLS-3": "demo_hash_3",
};

function normalize(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function toBackendCode(raw: string): string {
  const norm = normalize(raw);
  if (DEMO_CODE_MAP[norm]) return DEMO_CODE_MAP[norm];
  if (norm.startsWith("DEMO_HASH_")) return norm.toLowerCase();
  return raw.trim();
}

interface TicketRedeemProps {
  onSuccess: (museumId: string) => void;
}

export default function TicketRedeem({ onSuccess }: TicketRedeemProps) {
  const [museumId, setMuseumId] = useState<string>("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = code ? toBackendCode(code) : "—";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!museumId) return setError("Please select a museum first.");
    if (!code.trim()) return setError("Please enter an access code.");

    const backendCode = toBackendCode(code);

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        "redeem_ticket",
        { body: { code: backendCode, museum_id: museumId } }
      );

      if (fetchError) throw new Error(fetchError.message || "Failed to redeem code");
      if (data?.error) throw new Error(data.error);

      if (data?.ok && data?.museum_id) onSuccess(data.museum_id);
      else throw new Error("Invalid response from server");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ticket-redeem">
      <div className="card card-lg">
        <div className="brand">
          <div className="brand-mark">💬</div>
          <div>
            <h2 className="title">Assistant Access</h2>
            <p className="subtitle">Pick a museum and enter your access code or even your BILLS ticket code (yes!).</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <MuseumSelect value={museumId} onChange={setMuseumId} />

          <div className="form-group">
            <label className="label">Access code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. DEMO-1"
              disabled={loading}
              className="input"
              autoFocus
            />
            <div className="hint">
              We’ll send: <code>{preview}</code>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={loading || !code.trim() || !museumId}
            className="button button-primary"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>

        <div className="mini-note">
          Demo codes: <code>DEMO-1</code>, <code>DEMO-2</code>, <code>DEMO-3</code>
        </div>
      </div>
    </div>
  );
}
