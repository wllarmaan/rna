import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
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
            Soo dejinaya…
          </p>

          <div className="mx-auto mt-4 h-1.5 w-28 overflow-hidden rounded-full bg-[#e7e1d2]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#48a6a7]" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}