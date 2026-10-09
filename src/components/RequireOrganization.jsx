import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";

export default function RequireOrganization({ children }) {
  const {
    profile,
    profileLoading,
    profileReady,
    signOut,
  } = useAuth();

  if (profileLoading || !profileReady) {
    return (
      <div className="min-h-screen bg-[#f2efe7] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#13293d] shadow-lg">
            <span className="text-2xl font-bold text-[#d7b46a]">
              M
            </span>
          </div>

          <h2 className="text-xl font-bold text-[#13293d]">
            Medvora
          </h2>

          <p className="mt-2 text-sm text-[#7c858c]">
            Profile-kaaga ayaa la soo dejinayaa…
          </p>

          <div className="mx-auto mt-4 h-1.5 w-28 overflow-hidden rounded-full bg-[#e7e1d2]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#48a6a7]" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f2efe7] flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#e7e1d2] bg-[#fffdf8] p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#13293d]">
            <span className="text-2xl font-bold text-[#d7b46a]">
              M
            </span>
          </div>

          <h2 className="text-xl font-bold text-[#13293d]">
            Profile lama helin
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#7c858c]">
            Profile-kaaga lama helin. Fadlan ka bax akoonka kadibna
            mar kale soo gal.
          </p>

          <button
            type="button"
            onClick={signOut}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#13293d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1b3852]"
          >
            Ka bax oo mar kale soo gal
          </button>
        </div>
      </div>
    );
  }

  if (!profile.organization_id) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}