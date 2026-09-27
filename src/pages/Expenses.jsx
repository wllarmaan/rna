import React from "react";
import CrudPage from "../components/CrudPage.jsx";

export default function Expenses() {
  return (
    <CrudPage
      title="Expenses"
      subtitle="Kharashaadka maalinlaha ah (kiro, korontada, mushaharka, gaadiidka, iwm)."
      table="expenses"
      fields={[
        { key: "category", label: "Nooca kharashka", type: "text", required: true, placeholder: "Tusaale: Kiro" },
        { key: "amount", label: "Qiimaha", type: "number", step: "0.01", required: true },
        { key: "note", label: "Faahfaahin (ikhtiyaari)", type: "text" },
        {
          key: "branch_id",
          label: "Laanta",
          type: "select",
          optionsTable: "branches",
          optionsLabelKey: "name",
          placeholder: "— Laanta —",
        },
      ]}
      columns={[
        { key: "category", label: "Nooca" },
        { key: "amount", label: "Qiimaha", format: (v) => Number(v).toFixed(2) },
        { key: "note", label: "Faahfaahin" },
        {
          key: "created_at",
          label: "Taariikhda",
          format: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
        },
      ]}
    />
  );
}