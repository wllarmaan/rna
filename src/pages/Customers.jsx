import React from "react";
import { Link } from "react-router-dom";
import CrudPage from "../components/CrudPage.jsx";

export default function Customers() {
  return (
    <CrudPage
      title="Customers"
      subtitle="Macaamiisha, deyntooda iyo xaddiga credit-ka la siin karo."
      table="customers"
      rowActions={(row) => (
        <Link to={`/customers/${row.id}`} className="row-statement-link">
          Statement
        </Link>
      )}
      fields={[
        { key: "name", label: "Magaca", type: "text", required: true },
        { key: "phone", label: "Telefoon", type: "text" },
        { key: "address", label: "Ciwaanka", type: "text" },
        {
          key: "customer_type",
          label: "Nooca macmiilka",
          type: "select",
          options: [
            { value: "individual", label: "Shaqsi" },
            { value: "company", label: "Shirkad" },
          ],
        },
        { key: "credit_limit", label: "Credit limit", type: "number", step: "0.01" },
      ]}
      columns={[
        { key: "name", label: "Magaca" },
        { key: "phone", label: "Telefoon" },
        { key: "customer_type", label: "Nooca" },
        { key: "credit_limit", label: "Credit limit", format: (v) => (v == null ? "—" : Number(v).toFixed(2)) },
        { key: "balance", label: "Balance", format: (v) => (v == null ? "0.00" : Number(v).toFixed(2)) },
      ]}
    />
  );
}