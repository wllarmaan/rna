import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) return <div className="page-loading">Soo dejinaya…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}