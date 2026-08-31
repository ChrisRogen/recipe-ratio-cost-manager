"use strict";

let calculatorData;
let calculatorScale;

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "calculator") return;
  initializeCalculatorPage();
});

function initializeCalculatorPage() {
  calculatorData = getApplicationData();
  const form = document.getElementById("calculator-form");
  const empty = document.getElementById("calculator-empty");

  if (calculatorData.recipes.length === 0) {
    form.hidden = true;
    empty.hidden = false;
    return;
  }

  populateCalculatorRecipes();
  document.getElementById("calculator-recipe").addEventListener("change", handleCalculatorRecipeChange);
  document.getElementById("calculator-basis").addEventListener("change", handleCalculatorBasisChange);
  document.getElementById("calculator-reference").addEventListener("change", updateCalculatorUnits);
  document.getElementById("calculator-quantity").addEventListener("input", calculateProductionPlan);
  document.getElementById("calculator-unit").addEventListener("change", calculateProductionPlan);
  document.getElementById("calculator-lines").addEventListener("change", (event) => {
    if (event.target.matches("[data-calculator-brand]")) renderCalculatorCosts();
  });

  handleCalculatorRecipeChange();
}

function populateCalculatorRecipes() {
  document.getElementById("calculator-recipe").innerHTML = calculatorData.recipes
    .map((recipe) => `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</option>`)
    .join("");
}

function getSelectedCalculatorRecipe() {
  const id = document.getElementById("calculator-recipe").value;
  return calculatorData.recipes.find((recipe) => recipe.id === id);
}

function handleCalculatorRecipeChange() {
  const recipe = getSelectedCalculatorRecipe();
  const reference = document.getElementById("calculator-reference");

  reference.innerHTML = (recipe?.ingredients || []).map((line) => {
    const ingredient = calculatorData.ingredients.find((item) => item.id === line.ingredientId);
    return `<option value="${escapeHtml(line.id)}">${escapeHtml(ingredient?.name || "Unknown ingredient")}</option>`;
  }).join("");

  document.getElementById("calculator-quantity").value = recipe?.baseYield || "";
  updateCalculatorUnits();
}

function handleCalculatorBasisChange() {
  const ingredientMode = document.getElementById("calculator-basis").value === "ingredient";
  document.getElementById("calculator-reference-field").hidden = !ingredientMode;
  updateCalculatorUnits();
}

function updateCalculatorUnits() {
  const recipe = getSelectedCalculatorRecipe();
  const basis = document.getElementById("calculator-basis").value;
  const unitSelect = document.getElementById("calculator-unit");
  let allowedTypes = recipe?.finalOutputDensityGPerMl > 0
    ? ["mass", "volume"]
    : ["mass"];
  let selectedUnit = "g";

  if (basis === "ingredient" && recipe) {
    const line = recipe.ingredients.find((item) => item.id === document.getElementById("calculator-reference").value);
    const ingredient = calculatorData.ingredients.find((item) => item.id === line?.ingredientId);
    const type = UNIT_DETAILS[line?.unit]?.type || UNIT_DETAILS[ingredient?.defaultUnit]?.type || "mass";
    allowedTypes = [type];
    selectedUnit = line?.unit || ingredient?.defaultUnit || "g";
    document.getElementById("calculator-quantity").value = line?.quantity || "";
  } else if (recipe) {
    document.getElementById("calculator-quantity").value = recipe.baseYield;
  }

  unitSelect.innerHTML = createUnitOptions(selectedUnit, allowedTypes);
  calculateProductionPlan();
}

function getCalculatorScale(recipe) {
  const quantity = positiveNumber(document.getElementById("calculator-quantity").value);
  const unit = document.getElementById("calculator-unit").value;
  const basis = document.getElementById("calculator-basis").value;
  if (!recipe || quantity <= 0 || !UNIT_DETAILS[unit]) return null;

  if (basis === "final") {
    const unitType = UNIT_DETAILS[unit].type;
    let requestedFinalG;

    if (unitType === "mass") {
      requestedFinalG = convertToBase(quantity, unit);
    } else if (
      unitType === "volume" &&
      recipe.finalOutputDensityGPerMl > 0
    ) {
      requestedFinalG =
        convertToBase(quantity, unit) *
        recipe.finalOutputDensityGPerMl;
    } else {
      return null;
    }
    const preparationTargetG = requestedFinalG * (1 + recipe.proportionalAllowancePercent / 100) + recipe.fixedHandlingLossG;
    return {
      factor: preparationTargetG / recipe.basePreparationWeightG,
      requestedFinalG,
      preparationTargetG
    };
  }

  const referenceLine = recipe.ingredients.find((item) => item.id === document.getElementById("calculator-reference").value);
  if (!referenceLine || UNIT_DETAILS[referenceLine.unit]?.type !== UNIT_DETAILS[unit].type) return null;
  const requestedBase = convertToBase(quantity, unit);
  const referenceBase = convertToBase(referenceLine.quantity, referenceLine.unit);
  if (requestedBase === null || !referenceBase) return null;

  const factor = requestedBase / referenceBase;
  return {
    factor,
    requestedFinalG: recipe.baseYield * factor,
    preparationTargetG: recipe.basePreparationWeightG * factor
  };
}

function calculateProductionPlan() {
  const recipe = getSelectedCalculatorRecipe();
  calculatorScale = getCalculatorScale(recipe);
  const error = document.getElementById("calculator-error");

  if (!calculatorScale) {
    error.textContent = "Enter a required quantity above zero using a compatible unit.";
    document.getElementById("calculator-results").hidden = true;
    return;
  }

  error.textContent = "";
  document.getElementById("calculator-results").hidden = false;
  renderCalculatorLines(recipe);
  renderCalculatorSummary(recipe);
  renderCalculatorSteps(recipe);
  renderCalculatorCosts();
}

function renderCalculatorLines(recipe) {
  document.getElementById("calculator-lines").innerHTML = recipe.ingredients.map((line) => {
    const ingredient = calculatorData.ingredients.find((item) => item.id === line.ingredientId);
    const scaledQuantity = line.quantity * calculatorScale.factor;
    const equivalentIngredients = getEquivalentCalculatorIngredients(
      ingredient
    );

    const brandOptions = equivalentIngredients.flatMap(
      (sourceIngredient) => sourceIngredient.brands.map((brand) => {
        const optionValue = `${sourceIngredient.id}::${brand.id}`;
        const selected =
          sourceIngredient.id === ingredient?.id &&
          brand.id === line.brandId
            ? " selected"
            : "";

        return `<option value="${escapeHtml(optionValue)}"${selected}>${escapeHtml(brand.name)} — ${formatCurrency(brand.price)} / ${formatNumber(brand.packQuantity)} ${escapeHtml(getUnitLabel(brand.packUnit))}</option>`;
      })
    ).join("");

    return `<tr data-calculator-line data-ingredient-id="${escapeHtml(line.ingredientId)}" data-quantity="${scaledQuantity}" data-unit="${escapeHtml(line.unit)}">
      <th scope="row">${escapeHtml(ingredient?.name || "Unknown ingredient")}</th>
      <td><strong>${formatNumber(scaledQuantity, 3)} ${escapeHtml(getUnitLabel(line.unit))}</strong></td>
      <td><select data-calculator-brand aria-label="Brand for ${escapeHtml(ingredient?.name || "ingredient")}">${brandOptions}</select></td>
      <td class="calculator-line-cost" data-calculator-line-cost>—</td>
    </tr>`;
  }).join("");
}

function getEquivalentCalculatorIngredients(ingredient) {
  if (!ingredient) return [];

  const nameKey = normalizeIngredientLookupName(ingredient.name);

  return calculatorData.ingredients.filter(
    (item) =>
      normalizeIngredientLookupName(item.name) === nameKey
  );
}

function renderCalculatorCosts() {
  let totalCost = 0;
  document.querySelectorAll("[data-calculator-line]").forEach((row) => {
    const ingredient = calculatorData.ingredients.find((item) => item.id === row.dataset.ingredientId);
    const selectedValue = row
      .querySelector("[data-calculator-brand]")
      .value;

    const [sourceIngredientId, brandId] =
      selectedValue.split("::");

    const sourceIngredient = calculatorData.ingredients.find(
      (item) => item.id === sourceIngredientId
    );

    const brand = sourceIngredient?.brands.find(
      (item) => item.id === brandId
    );
    const result = calculateIngredientUsageCost(ingredient, brand, Number(row.dataset.quantity), row.dataset.unit);
    const cost = result?.cost || 0;
    totalCost += cost;
    row.querySelector("[data-calculator-line-cost]").textContent = formatCurrency(cost);
  });

  const estimatedFinalG = getSelectedCalculatorRecipe().baseYield * calculatorScale.factor;
  document.getElementById("calculator-total").textContent = `Total: ${formatCurrency(totalCost)}`;
  document.getElementById("summary-total-cost").textContent = formatCurrency(totalCost);
  document.getElementById("summary-cost-100g").textContent = formatCurrency((totalCost / estimatedFinalG) * 100);
}

function renderCalculatorSummary(recipe) {
  const estimatedFinalG = recipe.baseYield * calculatorScale.factor;
  document.getElementById("calculator-summary").innerHTML = `
    <article class="summary-card"><span>Scale ratio</span><strong>${formatNumber(calculatorScale.factor, 6)}×</strong></article>
    <article class="summary-card"><span>Preparation target</span><strong>${formatNumber(calculatorScale.preparationTargetG)} g</strong></article>
    <article class="summary-card"><span>Estimated final output</span><strong>${formatNumber(estimatedFinalG)} g</strong></article>
    <article class="summary-card"><span>Total cost</span><strong id="summary-total-cost">$0.00</strong><small id="summary-cost-100g">$0.00</small><small>per 100 g final output</small></article>`;
}

function renderCalculatorSteps(recipe) {
  document.getElementById("calculator-steps").innerHTML = recipe.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
}
