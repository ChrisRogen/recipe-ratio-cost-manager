"use strict";

let businessData;
let businessCalculation = null;
let businessEditBrandSelections = null;

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "business") return;
  initializeBusinessPage();
});

function initializeBusinessPage() {
  businessData = getApplicationData();
  const removedRecordCount = enforceThreeMonthRetention();
  const form = document.getElementById("business-form");

  if (businessData.recipes.length === 0) {
    form.hidden = true;
    document.getElementById("business-no-recipes").hidden = false;
  } else {
    populateBusinessRecipes();
    resetBusinessForm();
  }

  document.getElementById("show-business-form").addEventListener("click", openBusinessForm);
  document.getElementById("close-business-form").addEventListener("click", closeBusinessForm);
  document.getElementById("business-recipe").addEventListener("change", handleBusinessRecipeChange);
  document.getElementById("business-date").addEventListener("change", () => {
    if (!document.getElementById("business-record-id").value) {
      document.getElementById("business-batch").value = createNextBatchNumber();
    }
  });
  document.getElementById("business-target-unit").addEventListener("change", calculateBusinessEntry);
  document.getElementById("business-ingredient-lines").addEventListener("change", calculateBusinessEntry);
  form.addEventListener("input", calculateBusinessEntry);
  form.addEventListener("submit", saveBusinessRecord);
  document.getElementById("cancel-business-edit").addEventListener("click", closeBusinessForm);
  document.getElementById("business-date-from").addEventListener("change", renderBusinessRecords);
  document.getElementById("business-date-to").addEventListener("change", renderBusinessRecords);
  document.getElementById("export-business-csv").addEventListener("click", exportBusinessCsv);
  document.getElementById("export-business-json").addEventListener("click", exportBusinessJson);
  document.getElementById("business-record-list").addEventListener("click", handleBusinessRecordAction);

  renderBusinessRecords();

  if (removedRecordCount > 0) {
    showToast(`${removedRecordCount} record${removedRecordCount === 1 ? "" : "s"} older than three calendar months removed.`);
  }
}

function enforceThreeMonthRetention() {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const cutoffDate = getLocalDateString(cutoff);
  const previousCount = businessData.businessRecords.length;

  businessData.businessRecords = businessData.businessRecords.filter(
    (record) => record.productionDate >= cutoffDate
  );

  const removedCount = previousCount - businessData.businessRecords.length;
  if (removedCount > 0) saveApplicationData(businessData);
  return removedCount;
}

function openBusinessForm() {
  if (businessData.recipes.length > 0) resetBusinessForm();
  const section = document.getElementById("business-entry-section");
  section.hidden = false;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeBusinessForm() {
  if (businessData.recipes.length > 0) resetBusinessForm();
  document.getElementById("business-entry-section").hidden = true;
}

function populateBusinessRecipes(selectedId = "") {
  document.getElementById("business-recipe").innerHTML = businessData.recipes
    .map((recipe) => `<option value="${escapeHtml(recipe.id)}"${recipe.id === selectedId ? " selected" : ""}>${escapeHtml(recipe.name)}</option>`)
    .join("");
}

function getBusinessRecipe() {
  const recipeId = document.getElementById("business-recipe").value;
  return businessData.recipes.find((recipe) => recipe.id === recipeId);
}

function handleBusinessRecipeChange() {
  const recipe = getBusinessRecipe();
  document.getElementById("business-target").value = recipe?.baseYield || "";
  populateBusinessTargetUnits(recipe);
  renderBusinessIngredientLines(recipe);
  calculateBusinessEntry();
}

function populateBusinessTargetUnits(recipe, selectedUnit = "g") {
  const allowedTypes = recipe?.finalOutputDensityGPerMl > 0
    ? ["mass", "volume"]
    : ["mass"];

  document.getElementById("business-target-unit").innerHTML =
    createUnitOptions(selectedUnit, allowedTypes);
}

function getEquivalentBusinessIngredients(ingredient) {
  if (!ingredient) return [];
  const key = normalizeIngredientLookupName(ingredient.name);
  return businessData.ingredients.filter(
    (item) => normalizeIngredientLookupName(item.name) === key
  );
}

function renderBusinessIngredientLines(recipe, selections = businessEditBrandSelections) {
  const body = document.getElementById("business-ingredient-lines");

  if (!recipe) {
    body.innerHTML = "";
    return;
  }

  body.innerHTML = recipe.ingredients.map((line) => {
    const ingredient = businessData.ingredients.find((item) => item.id === line.ingredientId);
    const selection = selections?.find((item) => item.recipeLineId === line.id);
    const options = getEquivalentBusinessIngredients(ingredient).flatMap(
      (sourceIngredient) => sourceIngredient.brands.map((brand) => {
        const value = `${sourceIngredient.id}::${brand.id}`;
        const isSelected = selection
          ? selection.sourceIngredientId === sourceIngredient.id && selection.brandId === brand.id
          : sourceIngredient.id === ingredient?.id && brand.id === line.brandId;

        return `<option value="${escapeHtml(value)}"${isSelected ? " selected" : ""}>${escapeHtml(brand.name)} — ${formatCurrency(brand.price)} / ${formatNumber(brand.packQuantity)} ${escapeHtml(getUnitLabel(brand.packUnit))}</option>`;
      })
    ).join("");

    return `<tr data-business-line data-recipe-line-id="${escapeHtml(line.id)}" data-ingredient-id="${escapeHtml(line.ingredientId)}" data-base-quantity="${line.quantity}" data-unit="${escapeHtml(line.unit)}">
      <th scope="row">${escapeHtml(ingredient?.name || "Unknown ingredient")}</th>
      <td data-business-quantity>—</td>
      <td><select data-business-brand aria-label="Brand for ${escapeHtml(ingredient?.name || "ingredient")}">${options}</select></td>
      <td class="calculator-line-cost" data-business-line-cost>—</td>
    </tr>`;
  }).join("");

  businessEditBrandSelections = null;
}

function getBusinessTargetFinalG(recipe) {
  const quantity = positiveNumber(document.getElementById("business-target").value);
  const unit = document.getElementById("business-target-unit").value;
  const type = UNIT_DETAILS[unit]?.type;

  if (!recipe || quantity <= 0 || !type) return null;
  if (type === "mass") return convertToBase(quantity, unit);
  if (type === "volume" && recipe.finalOutputDensityGPerMl > 0) {
    return convertToBase(quantity, unit) * recipe.finalOutputDensityGPerMl;
  }
  return null;
}

function calculateBusinessEntry() {
  const recipe = getBusinessRecipe();
  const targetFinalG = getBusinessTargetFinalG(recipe);
  const summary = document.getElementById("business-live-summary");

  if (!recipe || !targetFinalG || recipe.basePreparationWeightG <= 0) {
    summary.innerHTML = "";
    businessCalculation = null;
    return;
  }

  const preparationTargetG =
    targetFinalG * (1 + recipe.proportionalAllowancePercent / 100) +
    recipe.fixedHandlingLossG;
  const scaleFactor = preparationTargetG / recipe.basePreparationWeightG;
  const estimatedFinalG = recipe.baseYield * scaleFactor;
  let ingredientCost = 0;
  const ingredientLines = [];

  document.querySelectorAll("[data-business-line]").forEach((row) => {
    const ingredient = businessData.ingredients.find((item) => item.id === row.dataset.ingredientId);
    const scaledQuantity = Number(row.dataset.baseQuantity) * scaleFactor;
    const selected = row.querySelector("[data-business-brand]").value.split("::");
    const sourceIngredient = businessData.ingredients.find((item) => item.id === selected[0]);
    const brand = sourceIngredient?.brands.find((item) => item.id === selected[1]);
    const result = calculateIngredientUsageCost(
      ingredient,
      brand,
      scaledQuantity,
      row.dataset.unit
    );
    const lineCost = result?.cost || 0;

    ingredientCost += lineCost;
    row.querySelector("[data-business-quantity]").textContent =
      `${formatNumber(scaledQuantity)} ${getUnitLabel(row.dataset.unit)}`;
    row.querySelector("[data-business-line-cost]").textContent = formatCurrency(lineCost);

    ingredientLines.push({
      recipeLineId: row.dataset.recipeLineId,
      ingredientId: ingredient?.id || "",
      ingredientName: ingredient?.name || "Unknown ingredient",
      sourceIngredientId: sourceIngredient?.id || "",
      brandId: brand?.id || "",
      brandName: brand?.name || "Unknown brand",
      supplier: brand?.supplier || "",
      quantity: scaledQuantity,
      unit: row.dataset.unit,
      packQuantity: brand?.packQuantity || 0,
      packUnit: brand?.packUnit || "",
      packPrice: brand?.price || 0,
      cost: lineCost
    });
  });

  const unitsProduced = positiveNumber(document.getElementById("business-units-produced").value);
  const unitsSold = nonNegativeNumber(document.getElementById("business-units-sold").value);
  const sellingPricePerUnit = nonNegativeNumber(document.getElementById("business-selling-price").value);
  const packagingCostPerUnit = nonNegativeNumber(document.getElementById("business-packaging-unit").value);
  const packagingCost = unitsProduced * packagingCostPerUnit;
  const labourHours = nonNegativeNumber(document.getElementById("business-labour-hours").value);
  const labourRate = nonNegativeNumber(document.getElementById("business-labour-rate").value);
  const labourCost = labourHours * labourRate;
  const overheadCost = nonNegativeNumber(document.getElementById("business-overhead").value);
  const otherCost = nonNegativeNumber(document.getElementById("business-other-cost").value);
  const totalCost = ingredientCost + packagingCost + labourCost + overheadCost + otherCost;
  const revenue = unitsSold * sellingPricePerUnit;
  const costPerUnit = unitsProduced > 0 ? totalCost / unitsProduced : 0;
  const costOfSoldUnits = Math.min(unitsSold, unitsProduced) * costPerUnit;
  const remainingUnits = Math.max(unitsProduced - unitsSold, 0);
  const remainingStockValue = remainingUnits * costPerUnit;
  const soldUnitGrossProfit = revenue - costOfSoldUnits;
  const realisedProfit = revenue - totalCost;
  const marginPercent = revenue > 0 ? (soldUnitGrossProfit / revenue) * 100 : 0;
  const breakEvenUnits = sellingPricePerUnit > 0
    ? Math.ceil(totalCost / sellingPricePerUnit)
    : 0;

  businessCalculation = {
    targetFinalG,
    preparationTargetG,
    scaleFactor,
    estimatedFinalG,
    ingredientCost,
    packagingCost,
    packagingCostPerUnit,
    labourCost,
    labourHours,
    labourRate,
    overheadCost,
    otherCost,
    totalCost,
    unitsProduced,
    unitsSold,
    sellingPricePerUnit,
    revenue,
    costPerUnit,
    costOfSoldUnits,
    remainingStockValue,
    remainingUnits,
    soldUnitGrossProfit,
    realisedProfit,
    marginPercent,
    breakEvenUnits,
    ingredientLines
  };

  summary.innerHTML = `
    <article class="summary-card"><span>Ingredient cost</span><strong>${formatCurrency(ingredientCost)}</strong></article>
    <article class="summary-card"><span>Total batch cost</span><strong>${formatCurrency(totalCost)}</strong><small>${formatCurrency(costPerUnit)} per produced unit</small></article>
    <article class="summary-card"><span>Sales revenue</span><strong>${formatCurrency(revenue)}</strong><small>${formatNumber(remainingUnits)} units remaining</small></article>
    <article class="summary-card"><span>Gross profit on units sold</span><strong class="${soldUnitGrossProfit < 0 ? "negative-value" : ""}">${formatCurrency(soldUnitGrossProfit)}</strong><small>${formatNumber(marginPercent)}% margin</small></article>
    <article class="summary-card"><span>Revenue minus full batch cost</span><strong class="${realisedProfit < 0 ? "negative-value" : ""}">${formatCurrency(realisedProfit)}</strong><small>Includes cost of unsold stock</small></article>
    <article class="summary-card"><span>Break-even sales</span><strong>${formatNumber(breakEvenUnits)} units</strong><small>At the entered selling price</small></article>
  `;
}

function saveBusinessRecord(event) {
  event.preventDefault();
  calculateBusinessEntry();

  const error = document.getElementById("business-error");
  const date = document.getElementById("business-date").value;
  const batchNumber = cleanText(document.getElementById("business-batch").value);
  const recipe = getBusinessRecipe();

  if (!businessCalculation || !date || !batchNumber || !recipe) {
    error.textContent = "Complete the production date, batch number, recipe and required quantity.";
    return;
  }

  if (businessCalculation.unitsProduced <= 0) {
    error.textContent = "Enter the number of sellable units produced.";
    return;
  }

  if (businessCalculation.unitsSold > businessCalculation.unitsProduced) {
    error.textContent = "Units sold cannot be greater than units produced.";
    return;
  }

  const recordId = cleanText(document.getElementById("business-record-id").value);
  const previous = businessData.businessRecords.find((item) => item.id === recordId);
  const now = new Date().toISOString();
  const record = normalizeBusinessRecord({
    id: recordId || createId("business"),
    productionDate: date,
    batchNumber,
    recipeId: recipe.id,
    recipeName: recipe.name,
    ...businessCalculation,
    notes: document.getElementById("business-notes").value,
    createdAt: previous?.createdAt || now,
    updatedAt: now
  });

  const index = businessData.businessRecords.findIndex((item) => item.id === record.id);
  if (index >= 0) businessData.businessRecords[index] = record;
  else businessData.businessRecords.push(record);

  if (!saveApplicationData(businessData)) return;
  businessData = getApplicationData();
  error.textContent = "";
  showToast(index >= 0 ? "Business record updated." : "Business record saved.");
  resetBusinessForm();
  document.getElementById("business-entry-section").hidden = true;
  renderBusinessRecords();
}

function resetBusinessForm() {
  if (businessData.recipes.length === 0) return;
  const form = document.getElementById("business-form");
  form.reset();
  document.getElementById("business-record-id").value = "";
  document.getElementById("business-date").value = getLocalDateString();
  document.getElementById("business-batch").value = createNextBatchNumber();
  document.getElementById("business-units-produced").value = "1";
  document.getElementById("business-units-sold").value = "0";
  document.getElementById("business-packaging-unit").value = "0";
  document.getElementById("business-labour-hours").value = "0";
  document.getElementById("business-labour-rate").value = "0";
  document.getElementById("business-overhead").value = "0";
  document.getElementById("business-other-cost").value = "0";
  document.getElementById("business-selling-price").value = "0";
  document.getElementById("business-error").textContent = "";
  document.getElementById("business-form-title").textContent = "Add production batch";
  document.getElementById("cancel-business-edit").hidden = true;
  businessEditBrandSelections = null;
  handleBusinessRecipeChange();
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createNextBatchNumber() {
  const date = document.getElementById("business-date")?.value || getLocalDateString();
  const prefix = date.replaceAll("-", "");
  const count = businessData.businessRecords.filter((record) => record.productionDate === date).length + 1;
  return `${prefix}-${String(count).padStart(3, "0")}`;
}

function getFilteredBusinessRecords() {
  const from = document.getElementById("business-date-from").value;
  const to = document.getElementById("business-date-to").value;

  return businessData.businessRecords
    .filter((record) => (!from || record.productionDate >= from) && (!to || record.productionDate <= to))
    .sort((first, second) => `${second.productionDate}${second.createdAt}`.localeCompare(`${first.productionDate}${first.createdAt}`));
}

function renderBusinessRecords() {
  const records = getFilteredBusinessRecords();
  const list = document.getElementById("business-record-list");
  document.getElementById("business-record-count").textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
  document.getElementById("business-empty").hidden = records.length > 0;

  list.innerHTML = records.map((record) => {
    const brands = record.ingredientLines
      .map((line) => `${line.ingredientName}: ${line.brandName}`)
      .join(" • ");
    const extraCosts = record.packagingCost + record.labourCost + record.overheadCost + record.otherCost;
    const remaining = Math.max(record.unitsProduced - record.unitsSold, 0);

    return `
    <tr>
      <td><strong>${escapeHtml(record.productionDate)}</strong><small>${escapeHtml(record.batchNumber)}</small></td>
      <td>${escapeHtml(record.recipeName)}</td>
      <td>${formatNumber(record.targetFinalG)} g</td>
      <td class="business-brands-cell">${escapeHtml(brands || "No brand snapshot")}</td>
      <td>${formatNumber(record.unitsProduced)}</td>
      <td>${formatNumber(record.unitsSold)}</td>
      <td>${formatNumber(remaining)}</td>
      <td>${formatCurrency(record.ingredientCost)}</td>
      <td>${formatCurrency(extraCosts)}</td>
      <td>${formatCurrency(record.totalCost)}<small>${formatCurrency(record.costPerUnit)} / unit</small></td>
      <td>${formatCurrency(record.sellingPricePerUnit)}</td>
      <td>${formatCurrency(record.revenue)}</td>
      <td class="${record.soldUnitGrossProfit < 0 ? "negative-value" : "positive-value"}">${formatCurrency(record.soldUnitGrossProfit)}</td>
      <td>${formatNumber(record.marginPercent)}%</td>
      <td><div class="table-actions"><button class="button button-secondary button-small" type="button" data-edit-business="${escapeHtml(record.id)}">Edit</button><button class="button button-danger button-small" type="button" data-delete-business="${escapeHtml(record.id)}">Delete</button></div></td>
    </tr>
  `;
  }).join("");

  const totals = records.reduce((result, record) => ({
    cost: result.cost + record.totalCost,
    revenue: result.revenue + record.revenue,
    profit: result.profit + record.soldUnitGrossProfit,
    produced: result.produced + record.unitsProduced,
    sold: result.sold + record.unitsSold
  }), { cost: 0, revenue: 0, profit: 0, produced: 0, sold: 0 });

  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  document.getElementById("business-summary").innerHTML = `
    <article class="summary-card"><span>Total production cost</span><strong>${formatCurrency(totals.cost)}</strong></article>
    <article class="summary-card"><span>Sales revenue</span><strong>${formatCurrency(totals.revenue)}</strong></article>
    <article class="summary-card"><span>Gross profit on sold units</span><strong class="${totals.profit < 0 ? "negative-value" : ""}">${formatCurrency(totals.profit)}</strong><small>${formatNumber(margin)}% margin</small></article>
    <article class="summary-card"><span>Units</span><strong>${formatNumber(totals.sold)} sold</strong><small>${formatNumber(totals.produced)} produced</small></article>
  `;

  renderMonthlyAnalysis();
}

function renderMonthlyAnalysis() {
  const now = new Date();
  const months = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const records = businessData.businessRecords.filter(
      (record) => record.productionDate.startsWith(monthKey)
    );
    const totals = records.reduce((result, record) => ({
      produced: result.produced + record.unitsProduced,
      sold: result.sold + record.unitsSold,
      cost: result.cost + record.totalCost,
      revenue: result.revenue + record.revenue,
      profit: result.profit + record.soldUnitGrossProfit
    }), { produced: 0, sold: 0, cost: 0, revenue: 0, profit: 0 });

    return {
      label: new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(date),
      count: records.length,
      ...totals,
      margin: totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0
    };
  });

  document.getElementById("monthly-analysis-list").innerHTML = months.map((month) => `
    <tr>
      <th scope="row">${escapeHtml(month.label)}</th>
      <td>${month.count}</td>
      <td>${formatNumber(month.produced)}</td>
      <td>${formatNumber(month.sold)}</td>
      <td>${formatCurrency(month.cost)}</td>
      <td>${formatCurrency(month.revenue)}</td>
      <td class="${month.profit < 0 ? "negative-value" : "positive-value"}">${formatCurrency(month.profit)}</td>
      <td>${formatNumber(month.margin)}%</td>
    </tr>
  `).join("");
}

function handleBusinessRecordAction(event) {
  const editButton = event.target.closest("[data-edit-business]");
  const deleteButton = event.target.closest("[data-delete-business]");
  if (editButton) startBusinessEdit(editButton.dataset.editBusiness);
  if (deleteButton) deleteBusinessRecord(deleteButton.dataset.deleteBusiness);
}

function startBusinessEdit(recordId) {
  const record = businessData.businessRecords.find((item) => item.id === recordId);
  if (!record) return;

  businessEditBrandSelections = record.ingredientLines;
  populateBusinessRecipes(record.recipeId);
  const recipe = getBusinessRecipe();
  populateBusinessTargetUnits(recipe, "g");
  document.getElementById("business-record-id").value = record.id;
  document.getElementById("business-date").value = record.productionDate;
  document.getElementById("business-batch").value = record.batchNumber;
  document.getElementById("business-target").value = record.targetFinalG;
  document.getElementById("business-units-produced").value = record.unitsProduced;
  document.getElementById("business-units-sold").value = record.unitsSold;
  document.getElementById("business-selling-price").value = record.sellingPricePerUnit;
  document.getElementById("business-packaging-unit").value = record.packagingCostPerUnit || (record.unitsProduced > 0 ? record.packagingCost / record.unitsProduced : 0);
  document.getElementById("business-labour-hours").value = record.labourHours || 0;
  document.getElementById("business-labour-rate").value = record.labourRate || 0;
  document.getElementById("business-overhead").value = record.overheadCost;
  document.getElementById("business-other-cost").value = record.otherCost;
  document.getElementById("business-notes").value = record.notes;
  document.getElementById("cancel-business-edit").hidden = false;
  document.getElementById("business-form-title").textContent = `Edit ${record.batchNumber}`;
  document.getElementById("business-entry-section").hidden = false;
  renderBusinessIngredientLines(recipe, record.ingredientLines);
  calculateBusinessEntry();
  document.getElementById("business-entry-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteBusinessRecord(recordId) {
  const record = businessData.businessRecords.find((item) => item.id === recordId);
  if (!record || !window.confirm(`Delete business record ${record.batchNumber}?`)) return;
  businessData.businessRecords = businessData.businessRecords.filter((item) => item.id !== recordId);
  if (!saveApplicationData(businessData)) return;
  businessData = getApplicationData();
  renderBusinessRecords();
  showToast("Business record deleted.");
}

function exportBusinessCsv() {
  const records = getFilteredBusinessRecords();
  if (records.length === 0) {
    showToast("There are no filtered records to export.", true);
    return;
  }

  const headers = [
    "production_date", "batch_number", "recipe", "target_final_g", "estimated_final_g",
    "units_produced", "units_sold", "selling_price_per_unit_aud", "ingredient_cost_aud",
    "packaging_cost_aud", "labour_cost_aud", "overhead_cost_aud", "other_cost_aud",
    "total_cost_aud", "cost_per_unit_aud", "sales_revenue_aud", "cost_of_sold_units_aud",
    "gross_profit_on_sold_units_aud", "remaining_stock_value_aud", "margin_percent", "notes", "updated_at"
  ];

  const rows = records.map((record) => [
    record.productionDate, record.batchNumber, record.recipeName, record.targetFinalG,
    record.estimatedFinalG, record.unitsProduced, record.unitsSold, record.sellingPricePerUnit,
    record.ingredientCost, record.packagingCost, record.labourCost, record.overheadCost,
    record.otherCost, record.totalCost, record.costPerUnit, record.revenue,
    record.costOfSoldUnits, record.soldUnitGrossProfit, record.remainingStockValue,
    record.marginPercent, record.notes, record.updatedAt
  ]);

  downloadBusinessFile(
    [headers, ...rows].map((row) => row.map(csvEscapeValue).join(",")).join("\r\n"),
    `business-records-${getLocalDateString()}.csv`,
    "text/csv;charset=utf-8"
  );
}

function exportBusinessJson() {
  const records = getFilteredBusinessRecords();
  if (records.length === 0) {
    showToast("There are no filtered records to export.", true);
    return;
  }

  downloadBusinessFile(
    JSON.stringify({ exportedAt: new Date().toISOString(), dateFormat: "YYYY-MM-DD", records }, null, 2),
    `business-records-${getLocalDateString()}.json`,
    "application/json;charset=utf-8"
  );
}

function downloadBusinessFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
