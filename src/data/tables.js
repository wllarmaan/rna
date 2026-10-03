// Config-ka bogagga xogta (Live data) — mid kasta wuxuu toos ugu xiran yahay
// jadwal Supabase ah. Sawirada waxay aadaan Storage bucket "medvora-media".

export const tableConfigs = {
  products: {
    path: "products",
    nav: "Products / Medicines",
    table: "products",
    title: "Products / Medicines",
    description: "Alaabta iyo daawooyinka — xogta iyo sawirka alaabta waxay ku kaydsamaan Supabase.",
    image: { urlCol: "image_url", pathCol: "image_path", folder: "products", label: "Sawirka alaabta" },
    fields: [
      { name: "name", label: "Magaca", type: "text", required: true },
      { name: "generic_name", label: "Generic name", type: "text" },
      { name: "brand_name", label: "Brand name", type: "text", inTable: false },
      { name: "category_id", label: "Category", type: "relation", relation: { table: "categories", labelField: "name" } },
      { name: "strength", label: "Strength", type: "text", inTable: false },
      { name: "dosage_form", label: "Dosage form", type: "text", inTable: false },
      { name: "active_ingredients", label: "Active ingredients", type: "text", inTable: false },
      { name: "manufacturer", label: "Manufacturer", type: "text", inTable: false },
      { name: "country_of_origin", label: "Country of origin", type: "text", inTable: false },
      { name: "sku", label: "SKU", type: "text" },
      { name: "barcode", label: "Barcode", type: "text", inTable: false },
      { name: "unit", label: "Unit", type: "text", default: "piece", required: true, inTable: false },
      { name: "purchase_price", label: "Qiimaha iibsiga", type: "number" },
      { name: "selling_price", label: "Qiimaha iibinta", type: "number" },
      { name: "wholesale_price", label: "Wholesale", type: "number", nullable: true, inTable: false },
      { name: "reorder_level", label: "Reorder level", type: "number", step: "1", inTable: false },
      { name: "registration_number", label: "Registration no.", type: "text", inTable: false },
      {
        name: "status", label: "Status", type: "select", required: true, default: "active",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "discontinued", label: "Discontinued" },
        ],
      },
      { name: "is_prescription_only", label: "Prescription-only", type: "checkbox", inTable: false },
      { name: "is_controlled", label: "Controlled", type: "checkbox", inTable: false },
    ],
  },

  categories: {
    path: "categories",
    nav: "Categories",
    table: "categories",
    title: "Categories",
    orderBy: "name",
    fields: [
      { name: "name", label: "Magaca", type: "text", required: true },
      { name: "parent_id", label: "Parent category", type: "relation", relation: { table: "categories", labelField: "name" } },
    ],
  },

  customers: {
    path: "customers",
    nav: "Customers",
    table: "customers",
    title: "Customers",
    statementPath: "customers",
    image: { urlCol: "photo_url", pathCol: "photo_path", folder: "customers", label: "Sawirka macmiilka" },
    fields: [
      { name: "name", label: "Magaca", type: "text", required: true },
      { name: "phone", label: "Telefoon", type: "text" },
      { name: "address", label: "Cinwaan", type: "text" },
      {
        name: "customer_type", label: "Nooca", type: "select", required: true, default: "individual",
        options: [
          { value: "individual", label: "Shakhsi" },
          { value: "company", label: "Shirkad" },
        ],
      },
      { name: "credit_limit", label: "Credit limit", type: "number" },
      { name: "balance", label: "Balance", type: "number" },
    ],
  },

  suppliers: {
    path: "suppliers",
    nav: "Suppliers",
    table: "suppliers",
    title: "Suppliers",
    statementPath: "suppliers",
    image: { urlCol: "logo_url", pathCol: "logo_path", folder: "suppliers", label: "Logo" },
    fields: [
      { name: "name", label: "Magaca", type: "text", required: true },
      { name: "phone", label: "Telefoon", type: "text" },
      { name: "address", label: "Cinwaan", type: "text" },
      { name: "balance", label: "Balance", type: "number" },
    ],
  },

  branches: {
    path: "branches",
    nav: "Branches",
    table: "branches",
    title: "Branches",
    fields: [
      { name: "name", label: "Magaca", type: "text", required: true },
      { name: "address", label: "Cinwaan", type: "text" },
      { name: "phone", label: "Telefoon", type: "text" },
      { name: "opening_time", label: "Furmo", type: "time" },
      { name: "closing_time", label: "Xirmo", type: "time" },
      { name: "is_main", label: "Main branch", type: "checkbox" },
    ],
  },

  expenses: {
    path: "expenses",
    nav: "Expenses",
    table: "expenses",
    title: "Expenses",
    description: "Kharashyada — rasiidka (sawir ama PDF) wuxuu ku kaydsamaa Supabase Storage.",
    image: {
      urlCol: "receipt_url", pathCol: "receipt_path", folder: "expenses",
      label: "Rasiid (sawir / PDF)", accept: "image/*,application/pdf",
    },
    extraInsert: (profile) => ({ created_by: profile.id }),
    fields: [
      {
        name: "category", label: "Nooca", type: "select", required: true, default: "Rent",
        options: ["Rent", "Electricity", "Water", "Internet", "Salary", "Transport", "Maintenance", "Supplies", "Other"]
          .map((v) => ({ value: v, label: v })),
      },
      { name: "amount", label: "Lacagta", type: "number", required: true },
      { name: "expense_date", label: "Taariikh", type: "date" },
      { name: "branch_id", label: "Branch", type: "relation", relation: { table: "branches", labelField: "name" } },
      { name: "note", label: "Faahfaahin", type: "textarea" },
    ],
  },
};

export const tableNavOrder = ["products", "categories", "customers", "suppliers", "branches", "expenses"];