import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const CURRENCIES = ["USD", "SOS", "KES", "ETB", "DJF"];

export default function Onboarding() {
  const { profile, profileLoading, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Haddii qof la casuumay (invitation), si otomaatig ah ugu biir organization-ka.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("claim_invitation");
      if (data === true) await refreshProfile();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Horeba organization buu haystaa — ha isku daynin onboarding mar labaad.
  if (!profileLoading && profile?.organization_id) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const { error } = await supabase.rpc("create_organization_and_join", {
      org_name: name,
      org_currency: currency,
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    await refreshProfile();
    setBusy(false);
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <span className="brand-mark">M</span>
          <div>
            <div className="brand-name">Medvora</div>
            <div className="brand-sub">Samee organization-kaaga</div>
          </div>
        </div>

        <p className="lede" style={{ margin: 0 }}>
          Waa markaaga hore ee aad soo gasho. Geli magaca ganacsigaaga si aan
          kuu diyaarino xisaabtaada iyo branch-gaaga koowaad si otomaatig ah.
        </p>

        <label className="auth-field">
          Magaca Organization-ka
          <input
            type="text"
            placeholder="Tusaale: Farmasiyada Al-Shifa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="auth-field">
          Lacagta la isticmaalo
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? "…" : "Samee organization-ka"}
        </button>

        <button type="button" className="auth-switch" onClick={signOut}>
          Ka bax akoonkan
        </button>
      </form>
    </div>
  );
}