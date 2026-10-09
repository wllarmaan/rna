import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Building2,
  Loader2,
  XCircle,
} from "lucide-react";

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

  return ROLES.find((role) => role.value === value)?.label || value || "—";
}

function roleBadgeClass(role) {
  if (role === "organization_owner") {
    return "bg-[#fff3d8] text-[#8a641e] border-[#ead39b]";
  }

  if (role === "manager") {
    return "bg-[#e8eef5] text-[#13293d] border-[#cdd9e4]";
  }

  if (role === "pharmacist" || role === "doctor" || role === "nurse") {
    return "bg-[#e7f4ee] text-[#2d7d68] border-[#cfe3dc]";
  }

  return "bg-[#edf3f4] text-[#53616b] border-[#d7e0e2]";
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

  // Managers cannot assign or manage other managers.
  const assignableRoles = isOwner
    ? ROLES
    : ROLES.filter((item) => item.value !== "manager");

  useEffect(() => {
    if (profile?.organization_id) {
      load();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id]);

  async function load() {
    if (!profile?.organization_id) return;

    setLoading(true);
    setError("");

    const organizationId = profile.organization_id;

    const [membersRes, branchesRes, invitesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, branch_id, created_at, branches(name)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),

      supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),

      canManage
        ? supabase
            .from("invitations")
            .select("id, email, role, created_at, branch_id, branches(name)")
            .eq("organization_id", organizationId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    if (membersRes.error) {
      setError(membersRes.error.message);
    } else {
      setMembers(membersRes.data || []);
    }

    if (branchesRes.error) {
      setError(branchesRes.error.message);
    } else {
      setBranches(branchesRes.data || []);
    }

    if (invitesRes.error) {
      setError(invitesRes.error.message);
    } else {
      setInvitations(invitesRes.data || []);
    }

    setLoading(false);
  }

  async function handleInvite(e) {
    e.preventDefault();

    setError("");
    setNotice("");

    if (!profile?.organization_id) {
      setError("Profile-kaaga wali lama xirin organization.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Fadlan geli email sax ah.");
      return;
    }

    setSaving(true);

    const { error: inviteError } = await supabase
      .from("invitations")
      .insert({
        organization_id: profile.organization_id,
        email: cleanEmail,
        role,
        branch_id: branchId || null,
        invited_by: profile.id,
      });

    setSaving(false);

    if (inviteError) {
      setError(
        inviteError.message.includes("invitations_pending_email_idx")
          ? "Email-kan horeba waa la casuumay (pending)."
          : inviteError.message
      );

      return;
    }

    setNotice(
      `Casuumaaddii waa la abuuray. U sheeg ${cleanEmail} inuu ku diiwaan galo (Sign up) email-kaas — wuxuu si otomaatig ah ugu biirayaa organization-kaaga.`
    );

    setEmail("");
    setBranchId("");

    await load();
  }

  async function handleRoleChange(memberId, newRole) {
    setError("");
    setNotice("");

    const { error: roleError } = await supabase.rpc("update_member_role", {
      member_id: memberId,
      new_role: newRole,
    });

    if (roleError) {
      setError(roleError.message);
      return;
    }

    setNotice("Role-ka xubinta waa la cusbooneysiiyay.");

    await load();
  }

  async function handleRemove(member) {
    const confirmed = window.confirm(
      `Ma hubtaa inaad ${member.full_name || "xubintan"} ka saarto organization-ka?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    const { error: removeError } = await supabase.rpc("remove_member", {
      member_id: member.id,
    });

    if (removeError) {
      setError(removeError.message);
      return;
    }

    setNotice(`${member.full_name || "Xubinta"} waa laga saaray organization-ka.`);

    await load();
  }

  async function handleCancelInvite(id) {
    setError("");
    setNotice("");

    const { error: cancelError } = await supabase
      .from("invitations")
      .delete()
      .eq("id", id)
      .eq("organization_id", profile.organization_id);

    if (cancelError) {
      setError(cancelError.message);
      return;
    }

    setInvitations((prev) => prev.filter((invite) => invite.id !== id));
    setNotice("Casuumaaddii waa la joojiyay.");
  }

  if (!profile?.organization_id) {
    return (
      <div className="min-h-full bg-[#f2efe7] p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-[#ded8ca] bg-[#fffdf8] p-8 text-center shadow-sm">
            <ShieldCheck
              size={38}
              className="mx-auto mb-4 text-[#48a6a7]"
            />

            <h1 className="text-xl font-bold text-[#13293d]">
              Organization lama helin
            </h1>

            <p className="mt-2 text-sm text-[#7c858c]">
              Profile-kaaga wali kuma xirna organization.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f2efe7] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <section className="overflow-hidden rounded-3xl border border-[#ded8ca] bg-[#fffdf8] shadow-sm">
          <div className="bg-[#13293d] px-6 py-7 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#d7b46a]">
                  <Users size={15} />
                  Team Management
                </div>

                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  Team / Users
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d7e1e6]">
                  Maamul shaqaalaha organization-kaaga, roles-ka,
                  branches-ka iyo casuumaadaha xubnaha cusub.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
                <div className="rounded-xl bg-[#d7b46a]/15 p-2.5">
                  <ShieldCheck size={21} className="text-[#d7b46a]" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cbd8de]">
                    Your role
                  </p>

                  <p className="mt-0.5 text-sm font-bold text-white">
                    {roleLabel(profile.role)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
            <div className="rounded-2xl border border-[#e2dbcd] bg-[#f7f4ec] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7c858c]">
                  Xubnaha
                </p>

                <Users size={18} className="text-[#48a6a7]" />
              </div>

              <p className="mt-2 text-2xl font-black text-[#13293d]">
                {members.length}
              </p>

              <p className="mt-1 text-xs text-[#7c858c]">
                Users in organization
              </p>
            </div>

            <div className="rounded-2xl border border-[#e2dbcd] bg-[#fffdf8] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7c858c]">
                  Branches
                </p>

                <Building2 size={18} className="text-[#48a6a7]" />
              </div>

              <p className="mt-2 text-2xl font-black text-[#13293d]">
                {branches.length}
              </p>

              <p className="mt-1 text-xs text-[#7c858c]">
                Available branches
              </p>
            </div>

            <div className="rounded-2xl border border-[#e2dbcd] bg-[#fffdf8] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7c858c]">
                  Pending
                </p>

                <Mail size={18} className="text-[#d7b46a]" />
              </div>

              <p className="mt-2 text-2xl font-black text-[#13293d]">
                {invitations.length}
              </p>

              <p className="mt-1 text-xs text-[#7c858c]">
                Pending invitations
              </p>
            </div>
          </div>
        </section>

        {/* Notice */}
        {notice && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#cfe3dc] bg-[#eef8f4] px-5 py-4 text-sm font-medium text-[#2d7d68]">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invite */}
        {canManage && (
          <section className="rounded-3xl border border-[#ded8ca] bg-[#fffdf8] p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#e7f1f0] p-2.5 text-[#2d7d68]">
                <UserPlus size={19} />
              </div>

              <div>
                <h2 className="font-bold text-[#13293d]">
                  Casuum xubin cusub
                </h2>

                <p className="mt-1 text-xs text-[#7c858c]">
                  U dir casuumaad qof cusub oo organization-kaaga ku soo biiraya.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleInvite}
              className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_auto]"
            >
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68757e]">
                  Email
                </label>

                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d989e]"
                  />

                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#d8d2c5] bg-white py-3 pl-10 pr-4 text-sm text-[#13293d] outline-none transition placeholder:text-[#a0a7aa] focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68757e]">
                  Role
                </label>

                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#d8d2c5] bg-white px-4 py-3 pr-10 text-sm text-[#13293d] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                  >
                    {assignableRoles.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7c858c]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#68757e]">
                  Branch
                </label>

                <div className="relative">
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#d8d2c5] bg-white px-4 py-3 pr-10 text-sm text-[#13293d] outline-none transition focus:border-[#48a6a7] focus:ring-2 focus:ring-[#48a6a7]/15"
                  >
                    <option value="">— Ikhtiyaari —</option>

                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7c858c]"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#13293d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1d405d] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <UserPlus size={17} />
                      Casuum
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Members */}
        <section className="rounded-3xl border border-[#ded8ca] bg-[#fffdf8] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5dfd2] px-5 py-5 md:px-6">
            <div>
              <h2 className="font-bold text-[#13293d]">
                Xubnaha Team-ka
              </h2>

              <p className="mt-1 text-xs text-[#7c858c]">
                Users-ka organization-ka iyo roles-kooda.
              </p>
            </div>

            <div className="rounded-full bg-[#edf3f4] px-3 py-1 text-xs font-bold text-[#13293d]">
              {members.length} Users
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-[#ded8ca] bg-[#f7f4ec] px-5 py-4 text-sm text-[#53616b]">
                <Loader2 size={19} className="animate-spin" />
                Soo dejinaya team-ka…
              </div>
            </div>
          ) : members.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users
                size={36}
                className="mx-auto mb-3 text-[#a4adaf]"
              />

              <p className="text-sm font-semibold text-[#53616b]">
                Wali xubno team ah ma jiraan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#e5dfd2] bg-[#f7f4ec] text-left">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Magaca
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Email
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Role
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Branch
                    </th>

                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {members.map((member) => {
                    const isSelf = member.id === profile.id;
                    const isMemberOwner =
                      member.role === "organization_owner";
                    const lockedForManager =
                      !isOwner && member.role === "manager";

                    const editable =
                      canManage &&
                      !isSelf &&
                      !isMemberOwner &&
                      !lockedForManager;

                    return (
                      <tr
                        key={member.id}
                        className="border-b border-[#eee9df] last:border-0 hover:bg-[#faf8f2]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e7f1f0] text-sm font-black text-[#2d7d68]">
                              {(member.full_name || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <div className="font-semibold text-[#13293d]">
                                {member.full_name || "Unnamed user"}
                              </div>

                              {isSelf && (
                                <div className="mt-0.5 text-xs font-medium text-[#48a6a7]">
                                  Adiga
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-[#68757e]">
                          {member.email || "—"}
                        </td>

                        <td className="px-5 py-4">
                          {editable ? (
                            <div className="relative inline-block">
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  handleRoleChange(
                                    member.id,
                                    e.target.value
                                  )
                                }
                                className="appearance-none rounded-full border border-[#d8d2c5] bg-white py-1.5 pl-3 pr-8 text-xs font-bold text-[#13293d] outline-none focus:border-[#48a6a7]"
                              >
                                {assignableRoles.map((item) => (
                                  <option
                                    key={item.value}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </option>
                                ))}
                              </select>

                              <ChevronDown
                                size={13}
                                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#7c858c]"
                              />
                            </div>
                          ) : (
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                                member.role
                              )}`}
                            >
                              {roleLabel(member.role)}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#68757e]">
                          <span className="inline-flex items-center gap-2">
                            <Building2 size={14} />
                            {member.branches?.name || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {editable && (
                            <button
                              type="button"
                              onClick={() => handleRemove(member)}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                            >
                              <Trash2 size={14} />
                              Ka saar
                            </button>
                          )}

                          {isSelf && (
                            <span className="text-xs font-medium text-[#a0a7aa]">
                              Current user
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Invitations */}
        {canManage && (
          <section className="rounded-3xl border border-[#ded8ca] bg-[#fffdf8] shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e5dfd2] px-5 py-5 md:px-6">
              <div>
                <h2 className="font-bold text-[#13293d]">
                  Casuumaadaha sugaya
                </h2>

                <p className="mt-1 text-xs text-[#7c858c]">
                  Invitations wali aan la aqbalin.
                </p>
              </div>

              <div className="rounded-full bg-[#fff1df] px-3 py-1 text-xs font-bold text-[#a76516]">
                {invitations.length} Pending
              </div>
            </div>

            {invitations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Mail
                  size={34}
                  className="mx-auto mb-3 text-[#a4adaf]"
                />

                <p className="text-sm font-semibold text-[#53616b]">
                  Casuumaad sugaysa ma jirto.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[#e5dfd2] bg-[#f7f4ec] text-left">
                      <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                        Email
                      </th>

                      <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                        Role
                      </th>

                      <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                        Branch
                      </th>

                      <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#68757e]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {invitations.map((invite) => (
                      <tr
                        key={invite.id}
                        className="border-b border-[#eee9df] last:border-0 hover:bg-[#faf8f2]"
                      >
                        <td className="px-5 py-4 text-sm font-medium text-[#13293d]">
                          {invite.email}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                              invite.role
                            )}`}
                          >
                            {roleLabel(invite.role)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-[#68757e]">
                          <span className="inline-flex items-center gap-2">
                            <Building2 size={14} />
                            {invite.branches?.name || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => handleCancelInvite(invite.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                            Jooji
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}