import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../lib/AuthContext.jsx";

const ROLES = [
  { value: "manager", label: "Manager" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "pharmacy_technician", label: "Pharmacy technician" },
  { value: "cashier", label: "Cashier" },
  { value: "lab_technician", label: "Lab technician" },
  { value: "nurse", label: "Nurse" },
  { value: "doctor", label: "Doctor" },
  { value: "accountant", label: "Accountant" },
  { value: "staff", label: "Staff" },
];

function roleLabel(value) {
  if (value === "organization_owner") return "Owner";
  return ROLES.find((r) => r.value === value)?.label || value;
}

export default function Team() {
  const { profile } = useAuth();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("cashier");
  const [branchId, setBranchId] = useState("");

  const isOwner = profile?.role === "organization_owner";
  const canManage = isOwner || profile?.role === "manager";
  // Managers can't assign/manage other managers — only the owner can.
  const assignableRoles = isOwner ? ROLES : ROLES.filter((r) => r.value !== "manager");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [membersRes, branchesRes, invitesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, branches(name)")
        .order("created_at", { ascending: true }),
      supabase.from("branches").select("id, name"),
      canManage
        ? supabase
            .from("invitations")
            .select("id, email, role, created_at, branches(name)")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    if (membersRes.error) setError(membersRes.error.message);
    else setMembers(membersRes.data);
    setBranches(branchesRes.data || []);
    setInvitations(invitesRes.data || []);
    setLoading(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.from("invitations").insert({
      organization_id: profile.organization_id,
      email: cleanEmail,
      role,
      branch_id: branchId || null,
      invited_by: profile.id,
    });
    setSaving(false);
    if (error) {
      setError(
        error.message.includes("invitations_pending_email_idx")
          ? "Email-kan horeba waa la casuumay (pending)."
          : error.message
      );
      return;
    }
    setNotice(
      `Casuumaaddii waa la abuuray. U sheeg ${cleanEmail} inuu ku diiwaan galo (Sign up) email-kaas — wuxuu si otomaatig ah ugu biirayaa organization-kaaga.`
    );
    setEmail("");
    setBranchId("");
    load();
  }

  async function handleRoleChange(memberId, newRole) {
    setError("");
    const { error } = await supabase.rpc("update_member_role", {
      member_id: memberId,
      new_role: newRole,
    });
    if (error) setError(error.message);
    load();
  }

  async function handleRemove(member) {
    if (!window.confirm(`Ma hubtaa inaad ${member.full_name} ka saarto organization-ka?`)) return;
    setError("");
    const { error } = await supabase.rpc("remove_member", { member_id: member.id });
    if (error) setError(error.message);
    load();
  }

  async function handleCancelInvite(id) {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) setError(error.message);
    else setInvitations((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow-plain">Live data · Supabase</p>
        <h1>Team / Users</h1>
        <p className="lede">
          Shaqaalaha organization-kaaga iyo doorkooda (role). Owner-ka iyo managers-ka
          ayaa casuumi kara oo maamuli kara xubnaha.
        </p>
      </header>

      {canManage && (
        <form className="purchase-form-row" onSubmit={handleInvite} style={{ marginBottom: 14 }}>
          <input
            type="email"
            placeholder="Email-ka qofka la casuumayo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ flex: 2, padding: "9px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontSize: 13.5 }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {assignableRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">— Branch (ikhtiyaari) —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={saving}>
            {saving ? "…" : "Casuum"}
          </button>
        </form>
      )}

      {notice && <p className="lede" style={{ color: "#2f6b4f", marginTop: 0 }}>{notice}</p>}
      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="lede">Soo dejinaya…</p>
      ) : (
        <>
          <h2 style={{ fontSize: 15, margin: "24px 0 10px" }}>Xubnaha ({members.length})</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Magaca</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isSelf = m.id === profile.id;
                  const isMemberOwner = m.role === "organization_owner";
                  const lockedForManager = !isOwner && m.role === "manager";
                  const editable = canManage && !isSelf && !isMemberOwner && !lockedForManager;
                  return (
                    <tr key={m.id}>
                      <td>
                        {m.full_name}
                        {isSelf && <span className="lede" style={{ margin: 0 }}> (adiga)</span>}
                      </td>
                      <td>{m.email || "—"}</td>
                      <td>
                        {editable ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            style={{ padding: "5px 8px", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontSize: 13 }}
                          >
                            {assignableRoles.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="order-status">{roleLabel(m.role)}</span>
                        )}
                      </td>
                      <td>{m.branches?.name || "—"}</td>
                      <td>
                        {editable && (
                          <button className="row-delete" onClick={() => handleRemove(m)}>
                            Ka saar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canManage && (
            <>
              <h2 style={{ fontSize: 15, margin: "32px 0 10px" }}>
                Casuumaadaha sugaya ({invitations.length})
              </h2>
              {invitations.length === 0 ? (
                <p className="lede">Casuumaad sugaysa ma jirto.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Branch</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((i) => (
                      <tr key={i.id}>
                        <td>{i.email}</td>
                        <td>{roleLabel(i.role)}</td>
                        <td>{i.branches?.name || "—"}</td>
                        <td>
                          <button className="row-delete" onClick={() => handleCancelInvite(i.id)}>
                            Jooji
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}