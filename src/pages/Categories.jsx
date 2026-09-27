import React from "react";
import CrudPage from "../components/CrudPage.jsx";

export default function Categories() {
  return (
    <CrudPage
      title="Categories"
      subtitle="Kooxaha alaabta loo qaybiyo (tusaale: Antibiotics, Painkillers, Vitamins)."
      table="categories"
      fields={[{ key: "name", label: "Magaca category-ga", type: "text", required: true }]}
      columns={[{ key: "name", label: "Magaca" }]}
    />
  );
}