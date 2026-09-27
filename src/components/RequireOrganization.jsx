import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";

export default function RequireOrganization({ children }) {
  const { profile, profileLoading, signOut } = useAuth();

  if (profileLoading) {
    return <div className="page-loading">Soo dejinaya…</div>;
  }
  if (!profile) {
    return (
      <div className="page-loading">
        Profile-kaaga lama helin. Isku day inaad{" "}
        <button className="auth-switch" onClick={signOut}>
          ka baxdo oo mar kale soo gasho
        </button>
        .
      </div>
    );
  }
  if (!profile.organization_id) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}