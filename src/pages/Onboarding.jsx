import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  LogOut,
  Sparkles,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const CURRENCIES = ["USD", "SOS", "KES", "ETB", "DJF"];

const currencyLabels = {
  USD: "US Dollar",
  SOS: "Somali Shilling",
  KES: "Kenyan Shilling",
  ETB: "Ethiopian Birr",
  DJF: "Djiboutian Franc",
};

export default function Onboarding() {
  const {
    profile,
    profileLoading,
    refreshProfile,
    signOut,
  } = useAuth();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Haddii qof la casuumay (invitation),
  // si otomaatig ah ugu biir organization-ka.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error: invitationError } =
        await supabase.rpc("claim_invitation");

      if (!mounted) return;

      if (!invitationError && data === true) {
        await refreshProfile();
      }
    })();

    return () => {
      mounted = false;
    };

    // refreshProfile intentionally excluded because this effect
    // should only run once when onboarding loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Horeba organization buu haystaa.
  if (!profileLoading && profile?.organization_id) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Fadlan geli magaca organization-ka.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.rpc(
      "create_organization_and_join",
      {
        org_name: trimmedName,
        org_currency: currency,
      }
    );

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    await refreshProfile();

    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[#f2efe7]">

      <div className="grid min-h-screen lg:grid-cols-2">

        {/* =====================================================
            BRAND PANEL
        ====================================================== */}

        <div className="relative hidden overflow-hidden bg-[#13293d] lg:flex">

          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-[#48a6a7]/20" />

          <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full border border-[#d7b46a]/15" />

          <div className="absolute right-24 top-28 h-3 w-3 rounded-full bg-[#d7b46a]" />

          <div className="absolute bottom-36 left-24 h-2 w-2 rounded-full bg-[#48a6a7]" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">

            {/* Brand */}
            <div>

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#48a6a7] text-xl font-extrabold text-white shadow-lg shadow-black/20">
                  M
                </div>

                <div>

                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-tight text-white">
                      Medvora
                    </span>

                    <Sparkles
                      size={14}
                      className="text-[#d7b46a]"
                    />
                  </div>

                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9fb1be]">
                    Pharmacy Management
                  </div>

                </div>

              </div>

            </div>

            {/* Main */}
            <div className="max-w-xl">

              <div className="mb-6 flex items-center gap-2 text-[#d7b46a]">

                <Building2 size={18} />

                <span className="text-xs font-bold uppercase tracking-[0.18em]">
                  Setup Your Pharmacy
                </span>

              </div>

              <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">

                Farmashiyahaaga
                <span className="block text-[#48a6a7]">
                  hal meel ka bilow.
                </span>

              </h1>

              <p className="mt-6 max-w-lg text-base leading-8 text-[#b8c6cf]">
                Samee organization-kaaga si Medvora uu kuu diyaariyo
                deegaanka maamulka farmashiyaha, branch-gaaga koowaad
                iyo xogta ganacsigaaga.
              </p>

              {/* Steps */}
              <div className="mt-10 space-y-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#48a6a7]/15 text-[#48a6a7]">
                    <CheckCircle2 size={18} />
                  </div>

                  <span className="text-sm text-[#c4d0d7]">
                    Samee organization
                  </span>

                </div>

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#48a6a7]/15 text-[#48a6a7]">
                    <CheckCircle2 size={18} />
                  </div>

                  <span className="text-sm text-[#c4d0d7]">
                    Dooro lacagta ganacsiga
                  </span>

                </div>

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d7b46a]/15 text-[#d7b46a]">
                    <ArrowRight size={18} />
                  </div>

                  <span className="text-sm text-[#c4d0d7]">
                    U gudub Medvora Dashboard
                  </span>

                </div>

              </div>

            </div>

            {/* Footer */}
            <p className="text-xs text-[#718897]">
              © {new Date().getFullYear()} Medvora. Pharmacy & Healthcare Management.
            </p>

          </div>
        </div>

        {/* =====================================================
            FORM PANEL
        ====================================================== */}

        <div className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">

          <div className="w-full max-w-md">

            {/* Mobile brand */}
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#13293d] text-xl font-extrabold text-[#d7b46a] shadow-lg">
                M
              </div>

              <div>

                <div className="text-xl font-bold text-[#13293d]">
                  Medvora
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c858c]">
                  Pharmacy Management
                </div>

              </div>

            </div>

            {/* Card */}
            <div className="rounded-[2rem] border border-[#e2dccf] bg-[#fffdf8] p-6 shadow-xl shadow-[#13293d]/5 sm:p-8">

              {/* Header */}
              <div className="mb-7">

                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#48a6a7]/10 px-3 py-1.5 text-xs font-semibold text-[#287d7e]">

                  <Building2 size={14} />

                  Setup

                </div>

                <h2 className="text-2xl font-bold tracking-tight text-[#13293d] sm:text-3xl">
                  Samee organization-kaaga
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#7c858c]">
                  Geli magaca ganacsigaaga iyo lacagta aad isticmaali
                  doonto. Medvora ayaa kuu diyaarinaya account-kaaga.
                </p>

              </div>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >

                {/* Organization name */}
                <label className="block">

                  <span className="mb-2 block text-sm font-semibold text-[#273b4b]">
                    Magaca Organization-ka
                  </span>

                  <div className="relative">

                    <Building2
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa4aa]"
                    />

                    <input
                      type="text"
                      placeholder="Tusaale: Farmasiyada Al-Shifa"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="organization"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#ddd7ca]
                        bg-white
                        py-3.5
                        pl-11
                        pr-4
                        text-sm
                        text-[#273b4b]
                        outline-none
                        transition
                        placeholder:text-[#a6adb1]
                        focus:border-[#48a6a7]
                        focus:ring-4
                        focus:ring-[#48a6a7]/10
                      "
                    />

                  </div>

                </label>

                {/* Currency */}
                <label className="block">

                  <span className="mb-2 block text-sm font-semibold text-[#273b4b]">
                    Lacagta la isticmaalo
                  </span>

                  <div className="relative">

                    <Coins
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa4aa]"
                    />

                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="
                        w-full
                        appearance-none
                        rounded-xl
                        border
                        border-[#ddd7ca]
                        bg-white
                        py-3.5
                        pl-11
                        pr-4
                        text-sm
                        font-medium
                        text-[#273b4b]
                        outline-none
                        transition
                        focus:border-[#48a6a7]
                        focus:ring-4
                        focus:ring-[#48a6a7]/10
                      "
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c} — {currencyLabels[c]}
                        </option>
                      ))}
                    </select>

                  </div>

                  <p className="mt-2 text-xs text-[#8b949a]">
                    Waxaad isticmaali kartaa {currency} gudaha
                    transactions-ka organization-kan.
                  </p>

                </label>

                {/* Error */}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={busy}
                  className="
                    group
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#13293d]
                    px-5
                    py-3.5
                    text-sm
                    font-bold
                    text-white
                    shadow-lg
                    shadow-[#13293d]/15
                    transition
                    hover:bg-[#1c3a54]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {busy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Fadlan sug…
                    </>
                  ) : (
                    <>
                      Samee organization-ka

                      <ArrowRight
                        size={17}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>

              </form>

              {/* Sign out */}
              <div className="mt-7 border-t border-[#ebe6dc] pt-6 text-center">

                <button
                  type="button"
                  onClick={signOut}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    text-sm
                    font-semibold
                    text-[#7c858c]
                    transition
                    hover:text-[#b94a48]
                  "
                >
                  <LogOut size={16} />
                  Ka bax akoonkan
                </button>

              </div>

            </div>

            <p className="mt-6 text-center text-xs text-[#8a9297]">
              Medvora — Smart Pharmacy & Healthcare Management.
            </p>

          </div>

        </div>

      </div>
    </div>
  );
}