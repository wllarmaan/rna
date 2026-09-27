import React from "react";
import CrudPage from "../components/CrudPage.jsx";

export default function Branches() {
  return (
    <CrudPage
      title="Branches"
      subtitle="Laamaha ganacsigaaga (branches) — mid kastaa wuxuu leeyahay stock, sales iyo expenses gooni ah."
      table="branches"
      fields={[
        { key: "name", label: "Magaca laanta", type: "text", required: true },
        { key: "address", label: "Ciwaanka", type: "text" },
        { key: "phone", label: "Telefoon", type: "text" },
        { key: "opening_time", label: "Furitaanka", type: "time" },
        { key: "closing_time", label: "Xidhitaanka", type: "time" },
        { key: "is_main", label: "Laanta koowaad (Main)", type: "checkbox" },
      ]}
      columns={[
        { key: "name", label: "Magaca" },
        { key: "address", label: "Ciwaanka" },
        { key: "phone", label: "Telefoon" },
        { key: "is_main", label: "Main?", format: (v) => (v ? "Haa" : "Maya") },
      ]}
    />
  );
}