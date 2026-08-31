"use strict";

const APP_STORAGE_KEY = "recipeRatioCostManager.v2";

const LEGACY_STORAGE_KEYS = [
  "recipeRatioCostManager.v1"
];

const UNIT_DETAILS = Object.freeze({
  ug: {
    label: "µg",
    name: "Micrograms",
    type: "mass",
    baseFactor: 0.000001
  },
  mg: {
    label: "mg",
    name: "Milligrams",
    type: "mass",
    baseFactor: 0.001
  },
  g: {
    label: "g",
    name: "Grams",
    type: "mass",
    baseFactor: 1
  },
  kg: {
    label: "kg",
    name: "Kilograms",
    type: "mass",
    baseFactor: 1000
  },
  ul: {
    label: "µL",
    name: "Microlitres",
    type: "volume",
    baseFactor: 0.001
  },
  ml: {
    label: "ml",
    name: "Millilitres",
    type: "volume",
    baseFactor: 1
  },
  l: {
    label: "L",
    name: "Litres",
    type: "volume",
    baseFactor: 1000
  },
  drop: {
    label: "drops",
    name: "Drops",
    type: "volume",
    baseFactor: 0.05
  },
  tsp: {
    label: "tsp",
    name: "Teaspoons",
    type: "volume",
    baseFactor: 5
  },
  tbsp: {
    label: "tbsp",
    name: "Australian tablespoons",
    type: "volume",
    baseFactor: 20
  },
  cup: {
    label: "cups",
    name: "Australian cups",
    type: "volume",
    baseFactor: 250
  },
  each: {
    label: "each",
    name: "Each",
    type: "count",
    baseFactor: 1
  },
  piece: {
    label: "pieces",
    name: "Pieces",
    type: "count",
    baseFactor: 1
  }
});

let toastTimer;
let pendingIngredientImportRows = [];

document.addEventListener("DOMContentLoaded", () => {
  initializeCurrentYear();
  initializeNavigation();

  if (document.body.dataset.page === "ingredients") {
    initializeIngredientPage();
  }
});

function initializeCurrentYear() {
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
}

function initializeNavigation() {
  const menuButton = document.querySelector("[data-menu-toggle]");
  const navigation = document.querySelector("[data-navigation]");

  if (!menuButton || !navigation) {
    return;
  }

  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      navigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 850) {
      navigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

function createEmptyApplicationData() {
  return {
    version: 2,
    ingredients: [],
    recipes: [],
    businessRecords: []
  };
}

function normalizeIngredient(ingredient) {
  return {
    ...ingredient,
    id: cleanText(ingredient.id) || createId("ingredient"),
    name: cleanText(ingredient.name),
    category: cleanText(ingredient.category) || "Uncategorized",
    defaultUnit: UNIT_DETAILS[ingredient.defaultUnit]
      ? ingredient.defaultUnit
      : "g",
    notes: cleanText(ingredient.notes),
    densityGPerMl:
      positiveNumber(ingredient.densityGPerMl) || 1,
    preparationYieldPercent:
      positiveNumber(ingredient.preparationYieldPercent) || 100,
    preparedWeightPerItemG:
      nonNegativeNumber(ingredient.preparedWeightPerItemG),
    brands: Array.isArray(ingredient.brands)
      ? ingredient.brands.map((brand) => ({
          ...brand,
          id: cleanText(brand.id) || createId("brand"),
          name: cleanText(brand.name),
          packQuantity: positiveNumber(brand.packQuantity),
          packUnit: UNIT_DETAILS[brand.packUnit]
            ? brand.packUnit
            : "g",
          price: nonNegativeNumber(brand.price),
          supplier: cleanText(brand.supplier)
        }))
      : [],
    createdAt: ingredient.createdAt || new Date().toISOString(),
    updatedAt: ingredient.updatedAt || new Date().toISOString()
  };
}

function normalizeRecipe(recipe) {
  return {
    ...recipe,
    id: cleanText(recipe.id) || createId("recipe"),
    name: cleanText(recipe.name),
    category: cleanText(recipe.category) || "Uncategorized",
    baseYield: positiveNumber(recipe.baseYield),
    yieldUnit: cleanText(recipe.yieldUnit) || "g",
    finalOutputDensityGPerMl:
      nonNegativeNumber(recipe.finalOutputDensityGPerMl),
    basePreparationWeightG:
      positiveNumber(recipe.basePreparationWeightG),
    proportionalAllowancePercent:
      nonNegativeNumber(recipe.proportionalAllowancePercent),
    fixedHandlingLossG:
      nonNegativeNumber(recipe.fixedHandlingLossG),
    referenceIngredientId:
      cleanText(recipe.referenceIngredientId),
    referenceCount:
      positiveNumber(recipe.referenceCount),
    referencePreparedQuantity:
      positiveNumber(recipe.referencePreparedQuantity),
    referencePreparedUnit:
      UNIT_DETAILS[recipe.referencePreparedUnit]
        ? recipe.referencePreparedUnit
        : "g",
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : [],
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.map(cleanText).filter(Boolean)
      : [],
    batches: Array.isArray(recipe.batches)
      ? recipe.batches
      : [],
    notes: cleanText(recipe.notes),
    createdAt: recipe.createdAt || new Date().toISOString(),
    updatedAt: recipe.updatedAt || new Date().toISOString()
  };
}

function normalizeApplicationData(data) {
  const safeData = data && typeof data === "object"
    ? data
    : createEmptyApplicationData();

  return {
    version: 2,
    ingredients: Array.isArray(safeData.ingredients)
      ? safeData.ingredients.map(normalizeIngredient)
      : [],
    recipes: Array.isArray(safeData.recipes)
      ? safeData.recipes.map(normalizeRecipe)
      : [],
    businessRecords: Array.isArray(safeData.businessRecords)
      ? safeData.businessRecords.map(normalizeBusinessRecord)
      : []
  };
}

function normalizeBusinessRecord(record) {
  return {
    ...record,
    id: cleanText(record.id) || createId("business"),
    productionDate: cleanText(record.productionDate),
    batchNumber: cleanText(record.batchNumber),
    recipeId: cleanText(record.recipeId),
    recipeName: cleanText(record.recipeName),
    targetFinalG: positiveNumber(record.targetFinalG),
    estimatedFinalG: positiveNumber(record.estimatedFinalG),
    scaleFactor: positiveNumber(record.scaleFactor),
    unitsProduced: nonNegativeNumber(record.unitsProduced),
    unitsSold: nonNegativeNumber(record.unitsSold),
    sellingPricePerUnit: nonNegativeNumber(record.sellingPricePerUnit),
    ingredientCost: nonNegativeNumber(record.ingredientCost),
    packagingCost: nonNegativeNumber(record.packagingCost),
    packagingCostPerUnit:
      nonNegativeNumber(record.packagingCostPerUnit),
    labourCost: nonNegativeNumber(record.labourCost),
    labourHours: nonNegativeNumber(record.labourHours),
    labourRate: nonNegativeNumber(record.labourRate),
    overheadCost: nonNegativeNumber(record.overheadCost),
    otherCost: nonNegativeNumber(record.otherCost),
    totalCost: nonNegativeNumber(record.totalCost),
    revenue: nonNegativeNumber(record.revenue),
    costPerUnit: nonNegativeNumber(record.costPerUnit),
    costOfSoldUnits: nonNegativeNumber(record.costOfSoldUnits),
    remainingStockValue: nonNegativeNumber(record.remainingStockValue),
    realisedProfit: Number(record.realisedProfit) || 0,
    soldUnitGrossProfit: Number(record.soldUnitGrossProfit) || 0,
    marginPercent: Number(record.marginPercent) || 0,
    ingredientLines: Array.isArray(record.ingredientLines)
      ? record.ingredientLines
      : [],
    notes: cleanText(record.notes),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString()
  };
}

function getApplicationData() {
  try {
    const currentValue = localStorage.getItem(APP_STORAGE_KEY);

    if (currentValue) {
      return normalizeApplicationData(JSON.parse(currentValue));
    }

    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacyValue = localStorage.getItem(legacyKey);

      if (legacyValue) {
        const migratedData = normalizeApplicationData(
          JSON.parse(legacyValue)
        );

        localStorage.setItem(
          APP_STORAGE_KEY,
          JSON.stringify(migratedData)
        );

        return migratedData;
      }
    }

    return createEmptyApplicationData();
  } catch (error) {
    console.error("Unable to read application data.", error);
    showToast("Saved data could not be loaded.", true);
    return createEmptyApplicationData();
  }
}

function saveApplicationData(data) {
  try {
    const normalizedData = normalizeApplicationData(data);

    localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify(normalizedData)
    );

    return true;
  } catch (error) {
    console.error("Unable to save application data.", error);
    showToast("Data could not be saved in this browser.", true);
    return false;
  }
}

function createId(prefix) {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeIngredientLookupName(value) {
  return cleanText(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(Number(value) || 0);
}

function formatNumber(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(Number(value) || 0);
}

function getUnitLabel(unit) {
  return UNIT_DETAILS[unit]?.label || unit;
}

function createUnitOptions(
  selectedUnit = "g",
  allowedTypes = ["mass", "volume", "count"]
) {
  return Object.entries(UNIT_DETAILS)
    .filter(([, details]) => allowedTypes.includes(details.type))
    .map(([value, details]) => {
      const selected = value === selectedUnit ? " selected" : "";

      return `
        <option value="${value}"${selected}>
          ${escapeHtml(details.name)} (${escapeHtml(details.label)})
        </option>
      `;
    })
    .join("");
}

function convertToBase(quantity, unit) {
  const details = UNIT_DETAILS[unit];
  const numericQuantity = Number(quantity);

  if (
    !details ||
    !Number.isFinite(numericQuantity) ||
    numericQuantity < 0
  ) {
    return null;
  }

  return numericQuantity * details.baseFactor;
}

function convertFromBase(baseQuantity, unit) {
  const details = UNIT_DETAILS[unit];

  if (!details || details.baseFactor <= 0) {
    return null;
  }

  return Number(baseQuantity) / details.baseFactor;
}

function convertPreparedQuantityToPurchaseBase(
  ingredient,
  quantity,
  preparationUnit,
  purchaseUnit
) {
  const preparationDetails = UNIT_DETAILS[preparationUnit];
  const purchaseDetails = UNIT_DETAILS[purchaseUnit];

  if (!preparationDetails || !purchaseDetails) {
    return null;
  }

  const preparationBase = convertToBase(
    quantity,
    preparationUnit
  );

  if (
    preparationBase === null ||
    preparationBase < 0
  ) {
    return null;
  }

  const density =
    positiveNumber(ingredient.densityGPerMl) || 1;

  const preparedWeightPerItem =
    positiveNumber(ingredient.preparedWeightPerItemG);

  const yieldFraction =
    Math.min(
      Math.max(
        positiveNumber(ingredient.preparationYieldPercent) || 100,
        0.001
      ),
      100
    ) / 100;

  let preparedMassG;
  let preparedVolumeMl;
  let preparedCount;

  if (preparationDetails.type === "mass") {
    preparedMassG = preparationBase;
    preparedVolumeMl = preparedMassG / density;

    if (preparedWeightPerItem > 0) {
      preparedCount = preparedMassG / preparedWeightPerItem;
    }
  }

  if (preparationDetails.type === "volume") {
    preparedVolumeMl = preparationBase;
    preparedMassG = preparedVolumeMl * density;

    if (preparedWeightPerItem > 0) {
      preparedCount = preparedMassG / preparedWeightPerItem;
    }
  }

  if (preparationDetails.type === "count") {
    preparedCount = preparationBase;

    if (preparedWeightPerItem <= 0) {
      if (purchaseDetails.type !== "count") {
        return null;
      }
    } else {
      preparedMassG = preparedCount * preparedWeightPerItem;
      preparedVolumeMl = preparedMassG / density;
    }
  }

  if (purchaseDetails.type === "mass") {
    if (!Number.isFinite(preparedMassG)) {
      return null;
    }

    return preparedMassG / yieldFraction;
  }

  if (purchaseDetails.type === "volume") {
    if (!Number.isFinite(preparedVolumeMl)) {
      return null;
    }

    return preparedVolumeMl / yieldFraction;
  }

  if (purchaseDetails.type === "count") {
    if (!Number.isFinite(preparedCount)) {
      return null;
    }

    return preparedCount / yieldFraction;
  }

  return null;
}

function calculateIngredientUsageCost(
  ingredient,
  brand,
  quantity,
  preparationUnit
) {
  if (!ingredient || !brand) {
    return null;
  }

  const requiredPurchaseBase =
    convertPreparedQuantityToPurchaseBase(
      ingredient,
      quantity,
      preparationUnit,
      brand.packUnit
    );

  const packBase = convertToBase(
    brand.packQuantity,
    brand.packUnit
  );

  if (
    requiredPurchaseBase === null ||
    packBase === null ||
    packBase <= 0
  ) {
    return null;
  }

  const cost =
    (requiredPurchaseBase / packBase) *
    nonNegativeNumber(brand.price);

  return {
    cost,
    requiredPurchaseBase,
    purchaseUnitType: UNIT_DETAILS[brand.packUnit].type
  };
}

function calculatePackComparison(brand) {
  const unitDetails = UNIT_DETAILS[brand.packUnit];
  const packBase = convertToBase(
    brand.packQuantity,
    brand.packUnit
  );

  if (!unitDetails || packBase === null || packBase <= 0) {
    return null;
  }

  let comparisonQuantity;
  let comparisonLabel;

  if (unitDetails.type === "mass") {
    comparisonQuantity = 1000;
    comparisonLabel = "kg";
  } else if (unitDetails.type === "volume") {
    comparisonQuantity = 1000;
    comparisonLabel = "L";
  } else {
    comparisonQuantity = 1;
    comparisonLabel = "each";
  }

  return {
    price:
      (nonNegativeNumber(brand.price) / packBase) *
      comparisonQuantity,
    label: comparisonLabel
  };
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  window.clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

function initializeIngredientPage() {
  const form = document.getElementById("ingredient-form");
  const brandRows = document.getElementById("brand-rows");

  if (!form || !brandRows) {
    return;
  }

  document
    .getElementById("add-brand-button")
    .addEventListener("click", () => addBrandRow());

  brandRows.addEventListener("click", handleBrandRowClick);
  brandRows.addEventListener("input", updateBrandPricePreviews);
  brandRows.addEventListener("change", updateBrandPricePreviews);

  form.addEventListener("submit", handleIngredientSubmit);

  document
    .getElementById("cancel-ingredient-edit")
    .addEventListener("click", resetIngredientForm);

  document
    .getElementById("ingredient-search")
    .addEventListener("input", (event) => {
      renderIngredientList(event.target.value);
    });

  document
    .querySelector("[data-scroll-to-form]")
    .addEventListener("click", () => {
      document
        .getElementById("ingredient-form-section")
        .scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      document.getElementById("ingredient-name").focus({
        preventScroll: true
      });
    });

  document
    .getElementById("ingredient-import-file")
    .addEventListener("change", handleIngredientImportFile);

  document
    .getElementById("confirm-ingredient-import")
    .addEventListener("click", importPendingIngredients);

  document
    .getElementById("download-ingredient-template")
    .addEventListener("click", downloadIngredientCsvTemplate);

  addBrandRow();
  renderIngredientList();
}

const INGREDIENT_IMPORT_HEADERS = Object.freeze([
  "ingredient_name",
  "category",
  "default_unit",
  "density_g_per_ml",
  "preparation_yield_percent",
  "prepared_weight_per_item_g",
  "notes",
  "brand_name",
  "pack_quantity",
  "pack_unit",
  "purchase_price_aud",
  "supplier"
]);

function downloadIngredientCsvTemplate() {
  const exampleRows = [
    INGREDIENT_IMPORT_HEADERS,
    ["Fresh banana", "Fruit", "g", "1", "79.4", "99.25", "Remove skin before weighing", "Fresh banana", "1", "kg", "2.99", ""],
    ["White flour Maida", "Baking", "g", "1", "100", "", "", "Black & Gold", "1", "kg", "1.75", "Coles"]
  ];

  const csv = exampleRows
    .map((row) => row.map(csvEscapeValue).join(","))
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ingredient-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscapeValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

async function handleIngredientImportFile(event) {
  const file = event.target.files?.[0];
  const errorElement = document.getElementById("ingredient-import-error");
  const preview = document.getElementById("ingredient-import-preview");
  const confirmButton = document.getElementById("confirm-ingredient-import");

  pendingIngredientImportRows = [];
  errorElement.textContent = "";
  preview.hidden = true;
  confirmButton.hidden = true;

  if (!file) return;

  try {
    const extension = file.name.split(".").pop().toLowerCase();
    let rows;

    if (extension === "csv") {
      rows = parseIngredientCsv(await file.text());
    } else {
      if (!window.XLSX) {
        throw new Error("Excel support could not load. Check the internet connection or save the file as CSV.");
      }

      const workbook = XLSX.read(await file.arrayBuffer());
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });
    }

    pendingIngredientImportRows = validateIngredientImportRows(rows);
    renderIngredientImportPreview(rows.length, pendingIngredientImportRows);
    confirmButton.hidden = pendingIngredientImportRows.length === 0;
  } catch (error) {
    console.error("Unable to read ingredient import file.", error);
    errorElement.textContent = error.message || "The spreadsheet could not be read.";
  }
}

function parseIngredientCsv(text) {
  const matrix = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cleanText(cell))) matrix.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cleanText(cell))) matrix.push(row);
  if (matrix.length < 2) return [];

  const headers = matrix[0].map((header) => cleanText(header).toLowerCase());
  return matrix.slice(1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? ""])
  ));
}

function validateIngredientImportRows(rows) {
  return rows.map((source, index) => {
    const row = Object.fromEntries(
      Object.entries(source).map(([key, value]) => [cleanText(key).toLowerCase(), value])
    );

    const item = {
      rowNumber: index + 2,
      ingredientName: cleanText(row.ingredient_name),
      category: cleanText(row.category) || "Uncategorized",
      defaultUnit: cleanText(row.default_unit).toLowerCase() || "g",
      densityGPerMl: positiveNumber(row.density_g_per_ml) || 1,
      preparationYieldPercent: positiveNumber(row.preparation_yield_percent) || 100,
      preparedWeightPerItemG: nonNegativeNumber(row.prepared_weight_per_item_g),
      notes: cleanText(row.notes),
      brandName: cleanText(row.brand_name),
      packQuantity: positiveNumber(row.pack_quantity),
      packUnit: cleanText(row.pack_unit).toLowerCase(),
      price: nonNegativeNumber(row.purchase_price_aud),
      supplier: cleanText(row.supplier),
      errors: []
    };

    if (!item.ingredientName) item.errors.push("missing ingredient_name");
    if (!UNIT_DETAILS[item.defaultUnit]) item.errors.push("invalid default_unit");
    if (!item.brandName) item.errors.push("missing brand_name");
    if (item.packQuantity <= 0) item.errors.push("invalid pack_quantity");
    if (!UNIT_DETAILS[item.packUnit]) item.errors.push("invalid pack_unit");
    if (cleanText(row.purchase_price_aud) === "" || Number(row.purchase_price_aud) < 0) item.errors.push("invalid purchase_price_aud");
    if (item.preparationYieldPercent <= 0 || item.preparationYieldPercent > 100) item.errors.push("yield must be 0.001–100");
    return item;
  });
}

function renderIngredientImportPreview(totalRows, rows) {
  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.filter((row) => row.errors.length > 0);
  const preview = document.getElementById("ingredient-import-preview");

  preview.hidden = false;
  preview.innerHTML = `
    <div class="import-summary">
      <strong>${validRows.length} valid row${validRows.length === 1 ? "" : "s"}</strong>
      <span>${invalidRows.length} row${invalidRows.length === 1 ? "" : "s"} need correction</span>
    </div>
    ${invalidRows.length ? `<ul class="import-errors">${invalidRows.slice(0, 10).map((row) => `<li>Row ${row.rowNumber}: ${escapeHtml(row.errors.join(", "))}</li>`).join("")}</ul>` : `<p>All ${totalRows} rows are ready to import.</p>`}
  `;
}

function importPendingIngredients() {
  const validRows = pendingIngredientImportRows.filter((row) => row.errors.length === 0);
  if (validRows.length === 0) return;

  const data = getApplicationData();
  let ingredientsAdded = 0;
  let brandsAdded = 0;
  let brandsSkipped = 0;

  validRows.forEach((row) => {
    const importedNameKey = normalizeIngredientLookupName(
      row.ingredientName
    );

    let ingredient = data.ingredients.find(
      (item) =>
        normalizeIngredientLookupName(item.name) ===
        importedNameKey
    );

    if (!ingredient) {
      ingredient = normalizeIngredient({
        id: createId("ingredient"),
        name: row.ingredientName,
        category: row.category,
        defaultUnit: row.defaultUnit,
        densityGPerMl: row.densityGPerMl,
        preparationYieldPercent: row.preparationYieldPercent,
        preparedWeightPerItemG: row.preparedWeightPerItemG,
        notes: row.notes,
        brands: []
      });
      data.ingredients.push(ingredient);
      ingredientsAdded += 1;
    }

    const duplicateBrand = ingredient.brands.some((brand) =>
      brand.name.toLowerCase() === row.brandName.toLowerCase() &&
      brand.supplier.toLowerCase() === row.supplier.toLowerCase()
    );

    if (duplicateBrand) {
      brandsSkipped += 1;
      return;
    }

    ingredient.brands.push({
      id: createId("brand"),
      name: row.brandName,
      packQuantity: row.packQuantity,
      packUnit: row.packUnit,
      price: row.price,
      supplier: row.supplier
    });
    ingredient.updatedAt = new Date().toISOString();
    brandsAdded += 1;
  });

  data.ingredients.sort((first, second) => first.name.localeCompare(second.name));
  if (!saveApplicationData(data)) return;

  pendingIngredientImportRows = [];
  document.getElementById("ingredient-import-file").value = "";
  document.getElementById("ingredient-import-preview").hidden = true;
  document.getElementById("confirm-ingredient-import").hidden = true;
  renderIngredientList(document.getElementById("ingredient-search").value);
  showToast(`${ingredientsAdded} ingredients and ${brandsAdded} brands imported. ${brandsSkipped} matching brands skipped.`);
}

function createBrandRowMarkup(brand = {}) {
  const brandId = cleanText(brand.id) || createId("brand");
  const packUnit = UNIT_DETAILS[brand.packUnit]
    ? brand.packUnit
    : "kg";

  return `
    <div
      class="brand-row"
      data-brand-row
      data-brand-id="${escapeHtml(brandId)}"
    >
      <div class="brand-row-grid">
        <div class="form-field">
          <label>Brand or supplier name</label>
          <input
            type="text"
            data-brand-name
            maxlength="100"
            placeholder="Example: Coles"
            value="${escapeHtml(brand.name)}"
            required
          >
        </div>

        <div class="form-field">
          <label>Pack quantity</label>
          <input
            type="number"
            data-pack-quantity
            min="0.001"
            step="0.001"
            inputmode="decimal"
            placeholder="1"
            value="${escapeHtml(brand.packQuantity)}"
            required
          >
        </div>

        <div class="form-field">
          <label>Pack unit</label>
          <select data-pack-unit required>
            ${createUnitOptions(packUnit)}
          </select>
        </div>

        <div class="form-field">
          <label>Purchase price (AUD)</label>
          <input
            type="number"
            data-purchase-price
            min="0"
            step="0.0001"
            inputmode="decimal"
            placeholder="2.99"
            value="${escapeHtml(brand.price)}"
            required
          >
        </div>

        <div class="form-field">
          <label>Store or supplier</label>
          <input
            type="text"
            data-supplier
            maxlength="100"
            placeholder="Optional"
            value="${escapeHtml(brand.supplier)}"
          >
        </div>
      </div>

      <div class="brand-row-actions">
        <p class="calculated-price" data-price-preview>
          Enter the pack size and price.
        </p>

        <button
          class="button button-danger button-small"
          type="button"
          data-remove-brand
        >
          Remove
        </button>
      </div>
    </div>
  `;
}

function addBrandRow(brand = {}) {
  document
    .getElementById("brand-rows")
    .insertAdjacentHTML(
      "beforeend",
      createBrandRowMarkup(brand)
    );

  updateBrandPricePreviews();
}

function handleBrandRowClick(event) {
  const removeButton = event.target.closest("[data-remove-brand]");

  if (!removeButton) {
    return;
  }

  const rows = document.querySelectorAll("[data-brand-row]");

  if (rows.length === 1) {
    showToast(
      "An ingredient requires at least one purchasing option.",
      true
    );
    return;
  }

  removeButton.closest("[data-brand-row]").remove();
  updateBrandPricePreviews();
}

function updateBrandPricePreviews() {
  document.querySelectorAll("[data-brand-row]").forEach((row) => {
    const brand = {
      packQuantity: Number(
        row.querySelector("[data-pack-quantity]").value
      ),
      packUnit: row.querySelector("[data-pack-unit]").value,
      price: Number(
        row.querySelector("[data-purchase-price]").value
      )
    };

    const comparison = calculatePackComparison(brand);
    const preview = row.querySelector("[data-price-preview]");

    preview.textContent = comparison
      ? `${formatCurrency(comparison.price)} per ${comparison.label}`
      : "Enter the pack size and price.";
  });
}

function collectBrandsFromForm() {
  return Array.from(
    document.querySelectorAll("[data-brand-row]")
  ).map((row) => ({
    id: row.dataset.brandId || createId("brand"),
    name: cleanText(
      row.querySelector("[data-brand-name]").value
    ),
    packQuantity: Number(
      row.querySelector("[data-pack-quantity]").value
    ),
    packUnit:
      row.querySelector("[data-pack-unit]").value,
    price: Number(
      row.querySelector("[data-purchase-price]").value
    ),
    supplier: cleanText(
      row.querySelector("[data-supplier]").value
    )
  }));
}

function clearIngredientErrors() {
  document
    .querySelectorAll("[aria-invalid='true']")
    .forEach((element) => {
      element.removeAttribute("aria-invalid");
    });

  document.querySelectorAll("[data-error-for]").forEach((element) => {
    element.textContent = "";
  });

  document.getElementById("brand-form-error").textContent = "";
}

function validateIngredient(ingredient) {
  clearIngredientErrors();

  let valid = true;

  if (!ingredient.name) {
    const input = document.getElementById("ingredient-name");

    input.setAttribute("aria-invalid", "true");

    document.querySelector(
      '[data-error-for="ingredient-name"]'
    ).textContent = "Enter an ingredient name.";

    valid = false;
  }

  if (
    ingredient.densityGPerMl <= 0 ||
    ingredient.preparationYieldPercent <= 0 ||
    ingredient.preparationYieldPercent > 100
  ) {
    document.getElementById("conversion-form-error").textContent =
      "Density must be above zero and preparation yield must be between 0.001% and 100%.";

    valid = false;
  } else {
    document.getElementById("conversion-form-error").textContent = "";
  }

  const invalidBrand = ingredient.brands.some((brand) => {
    return (
      !brand.name ||
      !UNIT_DETAILS[brand.packUnit] ||
      brand.packQuantity <= 0 ||
      brand.price < 0
    );
  });

  if (ingredient.brands.length === 0 || invalidBrand) {
    document.getElementById("brand-form-error").textContent =
      "Complete every brand name, pack quantity, unit and purchase price.";

    valid = false;
  }

  return valid;
}

function handleIngredientSubmit(event) {
  event.preventDefault();

  const existingId = cleanText(
    document.getElementById("ingredient-id").value
  );

  const ingredient = normalizeIngredient({
    id: existingId || createId("ingredient"),
    name: document.getElementById("ingredient-name").value,
    category:
      document.getElementById("ingredient-category").value,
    defaultUnit:
      document.getElementById("ingredient-unit").value,
    densityGPerMl:
      document.getElementById("ingredient-density").value,
    preparationYieldPercent:
      document.getElementById("ingredient-yield").value,
    preparedWeightPerItemG:
      document.getElementById("ingredient-item-weight").value,
    notes:
      document.getElementById("ingredient-notes").value,
    brands: collectBrandsFromForm(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (!validateIngredient(ingredient)) {
    showToast("Check the ingredient details.", true);
    return;
  }

  const data = getApplicationData();

  const existingIndex = data.ingredients.findIndex(
    (item) => item.id === ingredient.id
  );

  if (existingIndex >= 0) {
    ingredient.createdAt =
      data.ingredients[existingIndex].createdAt;

    data.ingredients[existingIndex] = ingredient;
  } else {
    data.ingredients.push(ingredient);
  }

  data.ingredients.sort((first, second) =>
    first.name.localeCompare(second.name)
  );

  if (!saveApplicationData(data)) {
    return;
  }

  resetIngredientForm();
  renderIngredientList(
    document.getElementById("ingredient-search").value
  );

  showToast(
    existingIndex >= 0
      ? "Ingredient updated."
      : "Ingredient saved."
  );
}

function resetIngredientForm() {
  const form = document.getElementById("ingredient-form");

  form.reset();
  clearIngredientErrors();

  document.getElementById("conversion-form-error").textContent = "";
  document.getElementById("ingredient-id").value = "";
  document.getElementById("ingredient-density").value = "1";
  document.getElementById("ingredient-yield").value = "100";
  document.getElementById("ingredient-item-weight").value = "";
  document.getElementById("ingredient-form-title").textContent =
    "Add ingredient";
  document.getElementById("cancel-ingredient-edit").hidden = true;
  document.getElementById("brand-rows").innerHTML = "";

  addBrandRow();
}

function renderIngredientList(searchTerm = "") {
  const data = getApplicationData();
  const search = cleanText(searchTerm).toLowerCase();

  const filtered = data.ingredients.filter((ingredient) => {
    const text = [
      ingredient.name,
      ingredient.category,
      ingredient.notes,
      ...ingredient.brands.flatMap((brand) => [
        brand.name,
        brand.supplier
      ])
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(search);
  });

  document.getElementById("ingredient-count").textContent =
    `${data.ingredients.length} ${
      data.ingredients.length === 1
        ? "ingredient"
        : "ingredients"
    }`;

  const list = document.getElementById("ingredient-list");

  list.innerHTML = filtered
    .map(createIngredientCardMarkup)
    .join("");

  document.getElementById("ingredient-empty-state").hidden =
    filtered.length !== 0;

  list.querySelectorAll("[data-edit-ingredient]").forEach((button) => {
    button.addEventListener("click", () => {
      startIngredientEdit(button.dataset.editIngredient);
    });
  });

  list
    .querySelectorAll("[data-delete-ingredient]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteIngredient(button.dataset.deleteIngredient);
      });
    });
}

function createIngredientCardMarkup(ingredient) {
  const purchaseOptions = ingredient.brands
    .map((brand) => {
      const comparison = calculatePackComparison(brand);

      return `
        <li class="purchase-item">
          <div class="purchase-item-heading">
            <strong>${escapeHtml(brand.name)}</strong>

            <span class="purchase-price">
              ${
                comparison
                  ? `${formatCurrency(comparison.price)} per ${
                      comparison.label
                    }`
                  : "Price unavailable"
              }
            </span>
          </div>

          <span>
            ${formatNumber(brand.packQuantity)}
            ${escapeHtml(getUnitLabel(brand.packUnit))}
            for ${formatCurrency(brand.price)}
          </span>

          ${
            brand.supplier
              ? `<small>${escapeHtml(brand.supplier)}</small>`
              : ""
          }
        </li>
      `;
    })
    .join("");

  const conversionDetails = [
    `Yield: ${formatNumber(
      ingredient.preparationYieldPercent
    )}%`,
    `Density: ${formatNumber(
      ingredient.densityGPerMl
    )} g/ml`
  ];

  if (ingredient.preparedWeightPerItemG > 0) {
    conversionDetails.push(
      `${formatNumber(
        ingredient.preparedWeightPerItemG
      )} g prepared per item`
    );
  }

  return `
    <article class="ingredient-card">
      <div class="ingredient-card-header">
        <div>
          <h3>${escapeHtml(ingredient.name)}</h3>
          <p>${escapeHtml(ingredient.category)}</p>
        </div>

        <span class="unit-badge">
          ${escapeHtml(getUnitLabel(ingredient.defaultUnit))}
        </span>
      </div>

      <div class="ingredient-card-body">
        <p class="ingredient-notes">
          ${escapeHtml(conversionDetails.join(" • "))}
        </p>

        ${
          ingredient.notes
            ? `<p class="ingredient-notes">${escapeHtml(
                ingredient.notes
              )}</p>`
            : ""
        }

        <ul class="purchase-list">
          ${purchaseOptions}
        </ul>
      </div>

      <div class="card-actions">
        <button
          class="button button-secondary button-small"
          type="button"
          data-edit-ingredient="${escapeHtml(ingredient.id)}"
        >
          Edit
        </button>

        <button
          class="button button-danger button-small"
          type="button"
          data-delete-ingredient="${escapeHtml(ingredient.id)}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

function startIngredientEdit(ingredientId) {
  const data = getApplicationData();

  const ingredient = data.ingredients.find(
    (item) => item.id === ingredientId
  );

  if (!ingredient) {
    showToast("Ingredient not found.", true);
    return;
  }

  document.getElementById("ingredient-id").value =
    ingredient.id;
  document.getElementById("ingredient-name").value =
    ingredient.name;
  document.getElementById("ingredient-category").value =
    ingredient.category === "Uncategorized"
      ? ""
      : ingredient.category;
  document.getElementById("ingredient-unit").value =
    ingredient.defaultUnit;
  document.getElementById("ingredient-density").value =
    ingredient.densityGPerMl;
  document.getElementById("ingredient-yield").value =
    ingredient.preparationYieldPercent;
  document.getElementById("ingredient-item-weight").value =
    ingredient.preparedWeightPerItemG || "";
  document.getElementById("ingredient-notes").value =
    ingredient.notes || "";

  document.getElementById("brand-rows").innerHTML = "";

  ingredient.brands.forEach(addBrandRow);

  document.getElementById("ingredient-form-title").textContent =
    `Edit ${ingredient.name}`;
  document.getElementById("cancel-ingredient-edit").hidden = false;

  document
    .getElementById("ingredient-form-section")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function deleteIngredient(ingredientId) {
  const data = getApplicationData();

  const ingredient = data.ingredients.find(
    (item) => item.id === ingredientId
  );

  if (!ingredient) {
    return;
  }

  const usedByRecipe = data.recipes.some((recipe) =>
    recipe.ingredients.some(
      (item) => item.ingredientId === ingredientId
    )
  );

  if (usedByRecipe) {
    showToast(
      "This ingredient is used by a recipe and cannot be deleted.",
      true
    );
    return;
  }

  if (!window.confirm(`Delete "${ingredient.name}"?`)) {
    return;
  }

  data.ingredients = data.ingredients.filter(
    (item) => item.id !== ingredientId
  );

  if (!saveApplicationData(data)) {
    return;
  }

  renderIngredientList(
    document.getElementById("ingredient-search").value
  );

  showToast("Ingredient deleted.");
}
