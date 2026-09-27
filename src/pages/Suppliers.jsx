import React from "react";
import CrudPage from "../components/CrudPage.jsx";

export default function Suppliers() {
  return (
    <CrudPage
      title="Suppliers"
      subtitle="Alaab-qeybiyeyaasha aad ka iibsato, iyo lacagta aad ku leedahay (payables)."
      table="suppliers"
      fields={[
        { key: "name", label: "Magaca supplier-ka", type: "text", required: true },
        { key: "phone", label: "Telefoon", type: "text" },
        { key: "address", label: "Ciwaanka", type: "text" },
      ]}
      columns={[
        { key: "name", label: "Magaca" },
        { key: "phone", label: "Telefoon" },
        { key: "balance", label: "Balance", format: (v) => (v == null ? "0.00" : Number(v).toFixed(2)) },
      ]}
    />
  );
}