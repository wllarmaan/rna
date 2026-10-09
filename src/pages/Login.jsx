import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";

import { useAuth } from "../lib/AuthContext.jsx";

export default function Login() {
  const { session, signIn, signUp } = useAuth();

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setBusy(true);

    const { error } =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, fullName);

    setBusy(false);

    if (error) {
      setError(error.message);
    }
  }

  const isSignin = mode === "signin";

  return (
    <div className="min-h-screen bg-[#f2efe7]">

      <div className="grid min-h-screen lg:grid-cols-2">

        {/* =====================================================
            BRAND PANEL
        ====================================================== */}

        <div className="relative hidden overflow-hidden bg-[#13293d] lg:flex">

          {/* Decorative shapes */}
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-[#48a6a7]/20" />

          <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full border border-[#d7b46a]/15" />

          <div className="absolute right-20 top-32 h-3 w-3 rounded-full bg-[#d7b46a]" />

          <div className="absolute bottom-32 left-24 h-2 w-2 rounded-full bg-[#48a6a7]" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">

            {/* Brand */}
            <div>

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#48a6a7] text-xl font-extrabold text-white shadow-lg shadow-black/20">
                  M
                </div>

                <div>
                  <div className="text-xl font-bold tracking-tight text-white">
                    Medvora
                  </div>

                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9fb1be]">
                    Pharmacy Management
                  </div>
                </div>

              </div>

            </div>

            {/* Main message */}
            <div className="max-w-xl">

              <div className="mb-6 flex items-center gap-2 text-[#d7b46a]">
                <Sparkles size={17} />

                <span className="text-xs font-bold uppercase tracking-[0.18em]">
                  Smart Pharmacy Operations
                </span>
              </div>

              <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                Maamul farmashiyahaaga,
                <span className="block text-[#48a6a7]">
                  si fudud oo casri ah.
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-8 text-[#b8c6cf]">
                Medvora wuxuu isku xiraa iibka, inventory-ga, purchases-ka,
                customers-ka, suppliers-ka iyo maamulka farmashiyaha hal meel.
              </p>

              <div className="mt-10 grid max-w-md grid-cols-3 gap-3">

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-[#d7b46a]">
                    POS
                  </p>
                  <p className="mt-1 text-xs text-[#9fb1be]">
                    Sales
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-[#48a6a7]">
                    Stock
                  </p>
                  <p className="mt-1 text-xs text-[#9fb1be]">
                    Inventory
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold text-white">
                    SaaS
                  </p>
                  <p className="mt-1 text-xs text-[#9fb1be]">
                    Multi-tenant
                  </p>
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
            AUTH PANEL
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
              <div className="mb-8">

                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#48a6a7]/10 px-3 py-1.5 text-xs font-semibold text-[#287d7e]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#48a6a7]" />

                  {isSignin
                    ? "Ku soo dhawoow"
                    : "Bilow Medvora"}
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-[#13293d] sm:text-3xl">
                  {isSignin
                    ? "Soo gal akoonkaaga"
                    : "Samee akoon cusub"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#7c858c]">
                  {isSignin
                    ? "Geli xogtaada si aad u sii wadato maamulka farmashiyaha."
                    : "Samee akoon si aad u bilowdo Medvora."}
                </p>

              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {mode === "signup" && (
                  <label className="block">

                    <span className="mb-2 block text-sm font-semibold text-[#273b4b]">
                      Magaca oo dhan
                    </span>

                    <div className="relative">

                      <UserRound
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa4aa]"
                      />

                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Magacaaga"
                        required
                        autoComplete="name"
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
                )}

                <label className="block">

                  <span className="mb-2 block text-sm font-semibold text-[#273b4b]">
                    Email
                  </span>

                  <div className="relative">

                    <Mail
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa4aa]"
                    />

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
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

                <label className="block">

                  <span className="mb-2 block text-sm font-semibold text-[#273b4b]">
                    Password
                  </span>

                  <div className="relative">

                    <LockKeyhole
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa4aa]"
                    />

                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete={
                        isSignin ? "current-password" : "new-password"
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#ddd7ca]
                        bg-white
                        py-3.5
                        pl-11
                        pr-12
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

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="
                        absolute
                        right-3
                        top-1/2
                        -translate-y-1/2
                        rounded-lg
                        p-1.5
                        text-[#89949b]
                        transition
                        hover:bg-[#f2efe7]
                        hover:text-[#273b4b]
                      "
                      aria-label={
                        showPassword
                          ? "Qari password-ka"
                          : "Muuji password-ka"
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>

                  </div>

                  <p className="mt-2 text-xs text-[#8b949a]">
                    Ugu yaraan 6 xaraf.
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
                      {isSignin ? "Gal Medvora" : "Diiwaan geli"}

                      <ArrowRight
                        size={17}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>

              </form>

              {/* Switch */}
              <div className="mt-7 border-t border-[#ebe6dc] pt-6 text-center">

                <p className="text-sm text-[#7c858c]">
                  {isSignin
                    ? "Akoon ma lihid?"
                    : "Akoon horey ayaad u lahayd?"}
                </p>

                <button
                  type="button"
                  className="mt-1 text-sm font-bold text-[#287d7e] transition hover:text-[#13293d]"
                  onClick={() => {
                    setMode(isSignin ? "signup" : "signin");
                    setError("");
                  }}
                >
                  {isSignin
                    ? "Samee akoon cusub"
                    : "Soo gal akoonkaaga"}
                </button>

              </div>

            </div>

            <p className="mt-6 text-center text-xs text-[#8a9297]">
              Secure pharmacy management powered by Medvora.
            </p>

          </div>

        </div>

      </div>
    </div>
  );
}