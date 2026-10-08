
import React from "react";
import { Routes, Route } from "react-router-dom";

import { AuthProvider } from "./lib/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequireOrganization from "./components/RequireOrganization.jsx";
import Layout from "./components/Layout.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import ModuleDetail from "./pages/ModuleDetail.jsx";
import Products from "./pages/Products.jsx";
import Purchases from "./pages/Purchases.jsx";
import Sales from "./pages/Sales.jsx";
import Inventory from "./pages/Inventory.jsx";
import Categories from "./pages/Categories.jsx";
import Customers from "./pages/Customers.jsx";
import CustomerStatement from "./pages/CustomerStatement.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import SupplierStatement from "./pages/SupplierStatement.jsx";
import Branches from "./pages/Branches.jsx";
import Expenses from "./pages/Expenses.jsx";
import Login from "./pages/Login.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Team from "./pages/Team.jsx";

function App() {
  return (
    <AuthProvider>
      <Routes>

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RequireOrganization>
                <Layout />
              </RequireOrganization>
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<Dashboard />}
          />

          <Route
            path="dashboard"
            element={<Dashboard />}
          />

          <Route
            path="module/:id"
            element={<ModuleDetail />}
          />

          <Route
            path="products"
            element={<Products />}
          />

          <Route
            path="purchases"
            element={<Purchases />}
          />

          <Route
            path="sales"
            element={<Sales />}
          />

          <Route
            path="inventory"
            element={<Inventory />}
          />

          <Route
            path="categories"
            element={<Categories />}
          />

          <Route
            path="customers"
            element={<Customers />}
          />

          <Route
            path="customers/:id"
            element={<CustomerStatement />}
          />

          <Route
            path="suppliers"
            element={<Suppliers />}
          />

          <Route
            path="suppliers/:id"
            element={<SupplierStatement />}
          />

          <Route
            path="branches"
            element={<Branches />}
          />

          <Route
            path="expenses"
            element={<Expenses />}
          />

          <Route
            path="team"
            element={<Team />}
          />
        </Route>

      </Routes>
    </AuthProvider>
  );
}

export default App;
