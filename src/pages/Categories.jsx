import React from "react";
import CrudPage from "../components/CrudPage.jsx";
import { tableConfigs } from "../data/tables.js";

export default function Categories() {
  return <CrudPage config={tableConfigs.categories} />;
}