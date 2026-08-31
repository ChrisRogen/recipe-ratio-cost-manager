"use strict";

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "recipes") {
    return;
  }

  initializeRecipePage();
});

function initializeRecipePage() {
  const data = getApplicationData();
  const form = document.getElementById("recipe-form");
  const noIngredients = document.getElementById(
    "recipe-no-ingredients"
  );

  if (data.ingredients.length === 0) {
    form.hidden = true;
    noIngredients.hidden = false;
  } else {
    form.hidden = false;
    noIngredients.hidden = true;
    populateReferenceIngredientSelect();
    addRecipeIngredientRow();
    addRecipeStepRow();
    addBatchRow();
  }

  document
    .getElementById("add-recipe-ingredient")
    .addEventListener("click", () => addRecipeIngredientRow());

  document
    .getElementById("add-recipe-step")
    .addEventListener("click", () => addRecipeStepRow());

  document
    .getElementById("add-batch")
    .addEventListener("click", () => addBatchRow());

  document
    .getElementById("recipe-ingredient-rows")
    .addEventListener("click", handleIngredientRowClick);

  document
    .getElementById("recipe-ingredient-rows")
    .addEventListener("change", handleIngredientRowChange);

  document
    .getElementById("recipe-ingredient-rows")
    .addEventListener("input", updateIngredientCostPreviews);

  document
    .getElementById("recipe-step-rows")
    .addEventListener("click", handleStepRowClick);

  document
    .getElementById("batch-rows")
    .addEventListener("click", handleBatchRowClick);

  document
    .getElementById("batch-rows")
    .addEventListener("input", updateBatchSummary);

  document
    .getElementById("recipe-form")
    .addEventListener("submit", handleRecipeSubmit);

  document
    .getElementById("cancel-recipe-edit")
    .addEventListener("click", resetRecipeForm);

  document
    .getElementById("recipe-search")
    .addEventListener("input", (event) => {
      renderRecipeList(event.target.value);
    });

  document
    .querySelector("[data-scroll-to-recipe-form]")
    .addEventListener("click", () => {
      document
        .getElementById("recipe-form-section")
        .scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      if (!form.hidden) {
        document.getElementById("recipe-name").focus({
          preventScroll: true
        });
      }
    });

  renderRecipeList();
}

function populateReferenceIngredientSelect(selectedId = "") {
  const data = getApplicationData();
  const select = document.getElementById(
    "reference-ingredient"
  );

  select.innerHTML = `
    <option value="">Select reference ingredient</option>

    ${data.ingredients
      .map((ingredient) => {
        const selected =
          ingredient.id === selectedId ? " selected" : "";

        return `
          <option
            value="${escapeHtml(ingredient.id)}"
            ${selected}
          >
            ${escapeHtml(ingredient.name)}
          </option>
        `;
      })
      .join("")}
  `;
}

function createIngredientSelectOptions(selectedId = "") {
  const data = getApplicationData();

  return `
    <option value="">Select ingredient</option>

    ${data.ingredients
      .map((ingredient) => {
        const selected =
          ingredient.id === selectedId ? " selected" : "";

        return `
          <option
            value="${escapeHtml(ingredient.id)}"
            ${selected}
          >
            ${escapeHtml(ingredient.name)}
          </option>
        `;
      })
      .join("")}
  `;
}

function createPreparationUnitOptions(selectedUnit = "g") {
  return Object.entries(UNIT_DETAILS)
    .map(([unit, details]) => {
      const selected =
        unit === selectedUnit ? " selected" : "";

      return `
        <option value="${unit}"${selected}>
          ${escapeHtml(details.name)}
          (${escapeHtml(details.label)})
        </option>
      `;
    })
    .join("");
}

function createBrandOptions(ingredient, selectedBrandId = "") {
  if (!ingredient) {
    return `
      <option value="">
        Select an ingredient first
      </option>
    `;
  }

  return ingredient.brands
    .map((brand) => {
      const selected =
        brand.id === selectedBrandId ? " selected" : "";

      return `
        <option value="${escapeHtml(brand.id)}"${selected}>
          ${escapeHtml(brand.name)} —
          ${formatCurrency(brand.price)}
          /
          ${formatNumber(brand.packQuantity)}
          ${escapeHtml(getUnitLabel(brand.packUnit))}
        </option>
      `;
    })
    .join("");
}

function addRecipeIngredientRow(recipeIngredient = {}) {
  const data = getApplicationData();

  const ingredient = data.ingredients.find(
    (item) => item.id === recipeIngredient.ingredientId
  );

  const preparationUnit =
    recipeIngredient.unit ||
    ingredient?.defaultUnit ||
    "g";

  const rowId =
    cleanText(recipeIngredient.id) ||
    createId("recipe-ingredient");

  const markup = `
    <div
      class="brand-row"
      data-recipe-ingredient-row
      data-row-id="${escapeHtml(rowId)}"
    >
      <div class="brand-row-grid">
        <div class="form-field">
          <label>Ingredient</label>

          <select data-recipe-ingredient-id required>
            ${createIngredientSelectOptions(
              recipeIngredient.ingredientId
            )}
          </select>
        </div>

        <div class="form-field">
          <label>Preparation quantity</label>

          <input
            type="number"
            data-recipe-quantity
            min="0.001"
            step="0.001"
            inputmode="decimal"
            placeholder="0.001"
            value="${escapeHtml(recipeIngredient.quantity)}"
            required
          >
        </div>

        <div class="form-field">
          <label>Preparation unit</label>

          <select data-recipe-unit required>
            ${createPreparationUnitOptions(preparationUnit)}
          </select>
        </div>

        <div class="form-field form-field-wide">
          <label>Purchasing option used for costing</label>

          <select data-recipe-brand-id required>
            ${createBrandOptions(
              ingredient,
              recipeIngredient.brandId
            )}
          </select>
        </div>
      </div>

      <div class="brand-row-actions">
        <p
          class="calculated-price"
          data-recipe-cost-preview
        >
          Select an ingredient, quantity and purchasing option.
        </p>

        <button
          class="button button-danger button-small"
          type="button"
          data-remove-recipe-ingredient
        >
          Remove
        </button>
      </div>
    </div>
  `;

  document
    .getElementById("recipe-ingredient-rows")
    .insertAdjacentHTML("beforeend", markup);

  updateIngredientCostPreviews();
}

function handleIngredientRowClick(event) {
  const button = event.target.closest(
    "[data-remove-recipe-ingredient]"
  );

  if (!button) {
    return;
  }

  const rows = document.querySelectorAll(
    "[data-recipe-ingredient-row]"
  );

  if (rows.length === 1) {
    showToast(
      "A recipe requires at least one ingredient.",
      true
    );
    return;
  }

  button.closest("[data-recipe-ingredient-row]").remove();
  updateIngredientCostPreviews();
}

function handleIngredientRowChange(event) {
  const row = event.target.closest(
    "[data-recipe-ingredient-row]"
  );

  if (!row) {
    return;
  }

  if (event.target.matches("[data-recipe-ingredient-id]")) {
    const data = getApplicationData();

    const ingredient = data.ingredients.find(
      (item) => item.id === event.target.value
    );

    const unitSelect = row.querySelector("[data-recipe-unit]");
    const brandSelect = row.querySelector(
      "[data-recipe-brand-id]"
    );

    if (ingredient) {
      unitSelect.innerHTML =
        createPreparationUnitOptions(
          ingredient.defaultUnit
        );

      brandSelect.innerHTML =
        createBrandOptions(ingredient);
    } else {
      unitSelect.innerHTML =
        createPreparationUnitOptions("g");

      brandSelect.innerHTML = `
        <option value="">
          Select an ingredient first
        </option>
      `;
    }
  }

  updateIngredientCostPreviews();
}

function collectRecipeIngredients() {
  return Array.from(
    document.querySelectorAll("[data-recipe-ingredient-row]")
  ).map((row) => ({
    id:
      row.dataset.rowId ||
      createId("recipe-ingredient"),
    ingredientId:
      row.querySelector("[data-recipe-ingredient-id]").value,
    quantity: Number(
      row.querySelector("[data-recipe-quantity]").value
    ),
    unit:
      row.querySelector("[data-recipe-unit]").value,
    brandId:
      row.querySelector("[data-recipe-brand-id]").value
  }));
}

function calculateRecipeLine(recipeIngredient) {
  const data = getApplicationData();

  const ingredient = data.ingredients.find(
    (item) =>
      item.id === recipeIngredient.ingredientId
  );

  if (!ingredient) {
    return null;
  }

  const brand = ingredient.brands.find(
    (item) => item.id === recipeIngredient.brandId
  );

  if (!brand) {
    return null;
  }

  const calculation = calculateIngredientUsageCost(
    ingredient,
    brand,
    recipeIngredient.quantity,
    recipeIngredient.unit
  );

  if (!calculation) {
    return null;
  }

  return {
    ...calculation,
    ingredient,
    brand
  };
}

function updateIngredientCostPreviews() {
  document
    .querySelectorAll("[data-recipe-ingredient-row]")
    .forEach((row) => {
      const item = {
        ingredientId:
          row.querySelector(
            "[data-recipe-ingredient-id]"
          ).value,
        quantity: Number(
          row.querySelector(
            "[data-recipe-quantity]"
          ).value
        ),
        unit:
          row.querySelector("[data-recipe-unit]").value,
        brandId:
          row.querySelector(
            "[data-recipe-brand-id]"
          ).value
      };

      const result = calculateRecipeLine(item);

      row.querySelector(
        "[data-recipe-cost-preview]"
      ).textContent = result
        ? `Estimated ingredient cost: ${formatCurrency(
            result.cost
          )}`
        : "Select an ingredient, quantity and compatible purchasing option.";
    });
}

function addRecipeStepRow(step = "") {
  const markup = `
    <div class="brand-row" data-recipe-step-row>
      <div class="form-field">
        <label>
          Step <span data-step-number></span>
        </label>

        <textarea
          data-recipe-step
          rows="3"
          maxlength="700"
          placeholder="Describe this preparation step"
          required
        >${escapeHtml(step)}</textarea>
      </div>

      <div class="brand-row-actions">
        <span></span>

        <button
          class="button button-danger button-small"
          type="button"
          data-remove-recipe-step
        >
          Remove
        </button>
      </div>
    </div>
  `;

  document
    .getElementById("recipe-step-rows")
    .insertAdjacentHTML("beforeend", markup);

  updateStepNumbers();
}

function handleStepRowClick(event) {
  const button = event.target.closest(
    "[data-remove-recipe-step]"
  );

  if (!button) {
    return;
  }

  const rows = document.querySelectorAll(
    "[data-recipe-step-row]"
  );

  if (rows.length === 1) {
    showToast(
      "A recipe requires at least one preparation step.",
      true
    );
    return;
  }

  button.closest("[data-recipe-step-row]").remove();
  updateStepNumbers();
}

function updateStepNumbers() {
  document
    .querySelectorAll("[data-recipe-step-row]")
    .forEach((row, index) => {
      row.querySelector("[data-step-number]").textContent =
        String(index + 1);
    });
}

function collectRecipeSteps() {
  return Array.from(
    document.querySelectorAll("[data-recipe-step]")
  )
    .map((textarea) => cleanText(textarea.value))
    .filter(Boolean);
}

function addBatchRow(batch = {}) {
  const markup = `
    <div class="brand-row" data-batch-row>
      <div class="form-grid">
        <div class="form-field">
          <label>
            Batch <span data-batch-number></span>
            batter quantity (g)
          </label>

          <input
            type="number"
            data-batch-batter
            min="0"
            step="0.001"
            inputmode="decimal"
            placeholder="810"
            value="${escapeHtml(batch.batterQuantityG)}"
          >
        </div>

        <div class="form-field">
          <label>Final output quantity (g)</label>

          <input
            type="number"
            data-batch-final
            min="0"
            step="0.001"
            inputmode="decimal"
            placeholder="756"
            value="${escapeHtml(batch.finalQuantityG)}"
          >
        </div>
      </div>

      <div class="brand-row-actions">
        <p
          class="calculated-price"
          data-batch-preview
        ></p>

        <button
          class="button button-danger button-small"
          type="button"
          data-remove-batch
        >
          Remove
        </button>
      </div>
    </div>
  `;

  document
    .getElementById("batch-rows")
    .insertAdjacentHTML("beforeend", markup);

  updateBatchNumbers();
  updateBatchSummary();
}

function handleBatchRowClick(event) {
  const button = event.target.closest(
    "[data-remove-batch]"
  );

  if (!button) {
    return;
  }

  const rows = document.querySelectorAll("[data-batch-row]");

  if (rows.length === 1) {
    showToast(
      "Keep at least one batch row. It may be left blank.",
      true
    );
    return;
  }

  button.closest("[data-batch-row]").remove();
  updateBatchNumbers();
  updateBatchSummary();
}

function updateBatchNumbers() {
  document
    .querySelectorAll("[data-batch-row]")
    .forEach((row, index) => {
      row.querySelector("[data-batch-number]").textContent =
        String(index + 1);
    });
}

function collectBatches() {
  return Array.from(
    document.querySelectorAll("[data-batch-row]")
  )
    .map((row) => ({
      batterQuantityG: nonNegativeNumber(
        row.querySelector("[data-batch-batter]").value
      ),
      finalQuantityG: nonNegativeNumber(
        row.querySelector("[data-batch-final]").value
      )
    }))
    .filter(
      (batch) =>
        batch.batterQuantityG > 0 ||
        batch.finalQuantityG > 0
    );
}

function updateBatchSummary() {
  document
    .querySelectorAll("[data-batch-row]")
    .forEach((row) => {
      const batter = nonNegativeNumber(
        row.querySelector("[data-batch-batter]").value
      );

      const finalOutput = nonNegativeNumber(
        row.querySelector("[data-batch-final]").value
      );

      const preview = row.querySelector(
        "[data-batch-preview]"
      );

      if (batter > 0 && finalOutput > 0) {
        const yieldPercentage =
          (finalOutput / batter) * 100;

        preview.textContent =
          `Baking yield: ${formatNumber(
            yieldPercentage
          )}% • Baking loss: ${formatNumber(
            batter - finalOutput
          )} g`;
      } else {
        preview.textContent =
          "Enter batter and final output to calculate batch yield.";
      }
    });

  const batches = collectBatches();

  const totalBatter = batches.reduce(
    (total, batch) =>
      total + batch.batterQuantityG,
    0
  );

  const totalFinal = batches.reduce(
    (total, batch) =>
      total + batch.finalQuantityG,
    0
  );

  const summary = document.getElementById(
    "batch-total-summary"
  );

  if (totalBatter > 0 || totalFinal > 0) {
    summary.textContent =
      `Total batter used: ${formatNumber(
        totalBatter
      )} g • Total final output: ${formatNumber(
        totalFinal
      )} g`;
  } else {
    summary.textContent = "";
  }
}

function clearRecipeErrors() {
  document
    .querySelectorAll("[aria-invalid='true']")
    .forEach((element) => {
      element.removeAttribute("aria-invalid");
    });

  document
    .querySelectorAll("[data-error-for]")
    .forEach((element) => {
      element.textContent = "";
    });

  document.getElementById(
    "recipe-ingredients-error"
  ).textContent = "";

  document.getElementById(
    "recipe-steps-error"
  ).textContent = "";
}

function validateRecipe(recipe) {
  clearRecipeErrors();

  let valid = true;

  if (!recipe.name) {
    document
      .getElementById("recipe-name")
      .setAttribute("aria-invalid", "true");

    document.querySelector(
      '[data-error-for="recipe-name"]'
    ).textContent = "Enter a recipe name.";

    valid = false;
  }

  if (
    recipe.baseYield <= 0 ||
    recipe.basePreparationWeightG <= 0
  ) {
    document
      .getElementById("recipe-base-yield")
      .setAttribute("aria-invalid", "true");

    document.querySelector(
      '[data-error-for="recipe-base-yield"]'
    ).textContent =
      "Enter the base final output and base preparation weight.";

    valid = false;
  }

  const invalidIngredient =
    recipe.ingredients.length === 0 ||
    recipe.ingredients.some((item) => {
      return (
        !item.ingredientId ||
        !item.brandId ||
        item.quantity <= 0 ||
        !UNIT_DETAILS[item.unit] ||
        !calculateRecipeLine(item)
      );
    });

  if (invalidIngredient) {
    document.getElementById(
      "recipe-ingredients-error"
    ).textContent =
      "Complete every ingredient, quantity, unit and purchasing option.";

    valid = false;
  }

  if (recipe.steps.length === 0) {
    document.getElementById(
      "recipe-steps-error"
    ).textContent =
      "Add at least one preparation step.";

    valid = false;
  }

  return valid;
}

function handleRecipeSubmit(event) {
  event.preventDefault();

  const existingId = cleanText(
    document.getElementById("recipe-id").value
  );

  const recipe = normalizeRecipe({
    id: existingId || createId("recipe"),
    name:
      document.getElementById("recipe-name").value,
    category:
      document.getElementById("recipe-category").value,
    baseYield:
      document.getElementById("recipe-base-yield").value,
    yieldUnit: "g",
    finalOutputDensityGPerMl:
      document.getElementById("final-output-density").value,
    basePreparationWeightG:
      document.getElementById(
        "base-preparation-weight"
      ).value,
    proportionalAllowancePercent:
      document.getElementById(
        "proportional-allowance"
      ).value,
    fixedHandlingLossG:
      document.getElementById(
        "fixed-handling-loss"
      ).value,
    referenceIngredientId:
      document.getElementById(
        "reference-ingredient"
      ).value,
    referenceCount:
      document.getElementById(
        "reference-count"
      ).value,
    referencePreparedQuantity:
      document.getElementById(
        "reference-prepared-quantity"
      ).value,
    referencePreparedUnit:
      document.getElementById(
        "reference-prepared-unit"
      ).value,
    notes:
      document.getElementById("recipe-notes").value,
    ingredients: collectRecipeIngredients(),
    steps: collectRecipeSteps(),
    batches: collectBatches(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (!validateRecipe(recipe)) {
    showToast("Check the recipe details.", true);
    return;
  }

  const data = getApplicationData();

  const existingIndex = data.recipes.findIndex(
    (item) => item.id === recipe.id
  );

  if (existingIndex >= 0) {
    recipe.createdAt =
      data.recipes[existingIndex].createdAt;

    data.recipes[existingIndex] = recipe;
  } else {
    data.recipes.push(recipe);
  }

  data.recipes.sort((first, second) =>
    first.name.localeCompare(second.name)
  );

  if (!saveApplicationData(data)) {
    return;
  }

  resetRecipeForm();
  renderRecipeList(
    document.getElementById("recipe-search").value
  );

  showToast(
    existingIndex >= 0
      ? "Recipe updated."
      : "Recipe saved."
  );
}

function resetRecipeForm() {
  const form = document.getElementById("recipe-form");

  form.reset();
  clearRecipeErrors();

  document.getElementById("recipe-id").value = "";
  document.getElementById("proportional-allowance").value =
    "10";
  document.getElementById("fixed-handling-loss").value =
    "50";
  document.getElementById("final-output-density").value = "";
  document.getElementById("reference-prepared-unit").value =
    "g";
  document.getElementById("recipe-form-title").textContent =
    "Add recipe";
  document.getElementById("cancel-recipe-edit").hidden =
    true;

  document.getElementById(
    "recipe-ingredient-rows"
  ).innerHTML = "";

  document.getElementById(
    "recipe-step-rows"
  ).innerHTML = "";

  document.getElementById("batch-rows").innerHTML = "";

  populateReferenceIngredientSelect();
  addRecipeIngredientRow();
  addRecipeStepRow();
  addBatchRow();
}

function calculateRecipeBaseCost(recipe) {
  return recipe.ingredients.reduce((total, item) => {
    const result = calculateRecipeLine(item);
    return total + (result?.cost || 0);
  }, 0);
}

function renderRecipeList(searchTerm = "") {
  const data = getApplicationData();
  const search = cleanText(searchTerm).toLowerCase();

  const recipes = data.recipes.filter((recipe) => {
    return [
      recipe.name,
      recipe.category,
      recipe.notes
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  document.getElementById("recipe-count").textContent =
    `${data.recipes.length} ${
      data.recipes.length === 1
        ? "recipe"
        : "recipes"
    }`;

  const list = document.getElementById("recipe-list");

  list.innerHTML = recipes
    .map(createRecipeCardMarkup)
    .join("");

  document.getElementById("recipe-empty-state").hidden =
    recipes.length !== 0;

  list.querySelectorAll("[data-edit-recipe]").forEach((button) => {
    button.addEventListener("click", () => {
      startRecipeEdit(button.dataset.editRecipe);
    });
  });

  list
    .querySelectorAll("[data-delete-recipe]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteRecipe(button.dataset.deleteRecipe);
      });
    });

  list
    .querySelectorAll("[data-calculate-scale]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        calculateScaledRecipe(
          button.dataset.calculateScale,
          button.closest(".ingredient-card")
        );
      });
    });
}

function createRecipeCardMarkup(recipe) {
  const baseCost = calculateRecipeBaseCost(recipe);

  return `
    <article class="ingredient-card">
      <div class="ingredient-card-header">
        <div>
          <h3>${escapeHtml(recipe.name)}</h3>
          <p>${escapeHtml(recipe.category)}</p>
        </div>

        <span class="unit-badge">
          ${formatNumber(recipe.baseYield)} g final
        </span>
      </div>

      <div class="ingredient-card-body">
        <ul class="purchase-list">
          <li class="purchase-item">
            <div class="purchase-item-heading">
              <strong>Base recipe cost</strong>

              <span class="purchase-price">
                ${formatCurrency(baseCost)}
              </span>
            </div>

            <span>
              ${formatCurrency(
                baseCost / recipe.baseYield
              )} per final gram
            </span>
          </li>
        </ul>

        <div class="form-field" style="margin-top: 1rem;">
          <label>Scale recipe by</label>

          <select data-scale-mode>
            <option value="final">
              Required final output weight
            </option>

            <option value="count">
              Reference ingredient count
            </option>

            <option value="prepared">
              Reference prepared quantity
            </option>
          </select>
        </div>

        <div class="form-grid" style="margin-top: 0.75rem;">
          <div class="form-field">
            <label>Required value</label>

            <input
              type="number"
              data-scale-target
              min="0.001"
              step="0.001"
              value="${escapeHtml(recipe.baseYield)}"
            >
          </div>

          <div class="form-field">
            <label>Required-value unit</label>

            <select data-scale-unit>
              ${createPreparationUnitOptions("g")}
            </select>
          </div>
        </div>

        <button
          class="button button-primary button-small"
          type="button"
          data-calculate-scale="${escapeHtml(recipe.id)}"
          style="margin-top: 0.75rem;"
        >
          Calculate scaled recipe
        </button>

        <div
          data-scale-result
          style="margin-top: 1rem;"
        ></div>
      </div>

      <div class="card-actions">
        <button
          class="button button-secondary button-small"
          type="button"
          data-edit-recipe="${escapeHtml(recipe.id)}"
        >
          Edit
        </button>

        <button
          class="button button-danger button-small"
          type="button"
          data-delete-recipe="${escapeHtml(recipe.id)}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

function getRecipeScaleCalculation(
  recipe,
  mode,
  target,
  targetUnit
) {
  if (target <= 0) {
    return null;
  }

  if (mode === "final") {
    const targetFinalG = convertToBase(
      target,
      targetUnit
    );

    if (
      targetFinalG === null ||
      UNIT_DETAILS[targetUnit]?.type !== "mass"
    ) {
      return null;
    }

    const protectedPreparationTargetG =
      targetFinalG *
        (1 +
          recipe.proportionalAllowancePercent / 100) +
      recipe.fixedHandlingLossG;

    const scaleFactor =
      protectedPreparationTargetG /
      recipe.basePreparationWeightG;

    return {
      scaleFactor,
      requestedFinalG: targetFinalG,
      protectedPreparationTargetG,
      estimatedFinalG:
        recipe.baseYield * scaleFactor
    };
  }

  if (mode === "count") {
    if (recipe.referenceCount <= 0) {
      return null;
    }

    const scaleFactor =
      target / recipe.referenceCount;

    return {
      scaleFactor,
      requestedFinalG:
        recipe.baseYield * scaleFactor,
      protectedPreparationTargetG:
        recipe.basePreparationWeightG * scaleFactor,
      estimatedFinalG:
        recipe.baseYield * scaleFactor
    };
  }

  if (mode === "prepared") {
    const requestedPreparedBase =
      convertToBase(target, targetUnit);

    const referencePreparedBase =
      convertToBase(
        recipe.referencePreparedQuantity,
        recipe.referencePreparedUnit
      );

    if (
      requestedPreparedBase === null ||
      referencePreparedBase === null ||
      referencePreparedBase <= 0 ||
      UNIT_DETAILS[targetUnit]?.type !==
        UNIT_DETAILS[recipe.referencePreparedUnit]?.type
    ) {
      return null;
    }

    const scaleFactor =
      requestedPreparedBase /
      referencePreparedBase;

    return {
      scaleFactor,
      requestedFinalG:
        recipe.baseYield * scaleFactor,
      protectedPreparationTargetG:
        recipe.basePreparationWeightG * scaleFactor,
      estimatedFinalG:
        recipe.baseYield * scaleFactor
    };
  }

  return null;
}

function calculateScaledRecipe(recipeId, card) {
  const data = getApplicationData();

  const recipe = data.recipes.find(
    (item) => item.id === recipeId
  );

  const mode =
    card.querySelector("[data-scale-mode]").value;

  const target = Number(
    card.querySelector("[data-scale-target]").value
  );

  const targetUnit =
    card.querySelector("[data-scale-unit]").value;

  const scale = getRecipeScaleCalculation(
    recipe,
    mode,
    target,
    targetUnit
  );

  if (!recipe || !scale) {
    showToast(
      "Check the scaling mode, required value and unit.",
      true
    );
    return;
  }

  let totalCost = 0;

  const ingredientMarkup = recipe.ingredients
    .map((item) => {
      const baseResult = calculateRecipeLine(item);

      const scaledQuantity =
        item.quantity * scale.scaleFactor;

      const scaledCost =
        (baseResult?.cost || 0) *
        scale.scaleFactor;

      totalCost += scaledCost;

      return `
        <li class="purchase-item">
          <div class="purchase-item-heading">
            <strong>
              ${escapeHtml(
                baseResult?.ingredient.name ||
                "Unknown ingredient"
              )}
            </strong>

            <span class="purchase-price">
              ${formatCurrency(scaledCost)}
            </span>
          </div>

          <span>
            ${formatNumber(scaledQuantity)}
            ${escapeHtml(getUnitLabel(item.unit))}
          </span>

          <small>
            ${escapeHtml(
              baseResult?.brand.name ||
              "Unknown purchasing option"
            )}
          </small>
        </li>
      `;
    })
    .join("");

  const extraFinalG =
    scale.estimatedFinalG -
    scale.requestedFinalG;

  const steps = recipe.steps
    .map(
      (step, index) => `
        <li>
          ${index + 1}. ${escapeHtml(step)}
        </li>
      `
    )
    .join("");

  card.querySelector("[data-scale-result]").innerHTML = `
    <div class="purchase-item">
      <strong>
        Scale factor:
        ${formatNumber(scale.scaleFactor, 6)}×
      </strong>

      <span>
        Protected preparation target:
        ${formatNumber(
          scale.protectedPreparationTargetG
        )} g
      </span>

      <span>
        Estimated final output:
        ${formatNumber(scale.estimatedFinalG)} g
      </span>

      ${
        mode === "final"
          ? `
            <span>
              Requested final output:
              ${formatNumber(scale.requestedFinalG)} g
            </span>

            <span>
              Predicted extra final quantity:
              ${formatNumber(Math.max(extraFinalG, 0))} g
            </span>
          `
          : ""
      }
    </div>

    <ul class="purchase-list" style="margin-top: 0.75rem;">
      ${ingredientMarkup}
    </ul>

    <div class="purchase-item" style="margin-top: 0.75rem;">
      <div class="purchase-item-heading">
        <strong>Total estimated cost</strong>

        <span class="purchase-price">
          ${formatCurrency(totalCost)}
        </span>
      </div>

      <span>
        Cost per estimated final gram:
        ${formatCurrency(
          totalCost / scale.estimatedFinalG
        )}
      </span>

      <span>
        Cost per 100 g:
        ${formatCurrency(
          (totalCost / scale.estimatedFinalG) * 100
        )}
      </span>
    </div>

    <h4>Preparation steps</h4>

    <ol style="padding-left: 1.25rem;">
      ${steps}
    </ol>
  `;
}

function startRecipeEdit(recipeId) {
  const data = getApplicationData();

  const recipe = data.recipes.find(
    (item) => item.id === recipeId
  );

  if (!recipe) {
    showToast("Recipe not found.", true);
    return;
  }

  document.getElementById("recipe-id").value =
    recipe.id;
  document.getElementById("recipe-name").value =
    recipe.name;
  document.getElementById("recipe-category").value =
    recipe.category === "Uncategorized"
      ? ""
      : recipe.category;
  document.getElementById("recipe-base-yield").value =
    recipe.baseYield;
  document.getElementById(
    "base-preparation-weight"
  ).value = recipe.basePreparationWeightG;
  document.getElementById("final-output-density").value =
    recipe.finalOutputDensityGPerMl || "";
  document.getElementById(
    "proportional-allowance"
  ).value = recipe.proportionalAllowancePercent;
  document.getElementById(
    "fixed-handling-loss"
  ).value = recipe.fixedHandlingLossG;
  document.getElementById("recipe-notes").value =
    recipe.notes || "";

  populateReferenceIngredientSelect(
    recipe.referenceIngredientId
  );

  document.getElementById("reference-count").value =
    recipe.referenceCount || "";

  document.getElementById(
    "reference-prepared-quantity"
  ).value = recipe.referencePreparedQuantity || "";

  document.getElementById(
    "reference-prepared-unit"
  ).value = recipe.referencePreparedUnit || "g";

  document.getElementById(
    "recipe-ingredient-rows"
  ).innerHTML = "";

  document.getElementById(
    "recipe-step-rows"
  ).innerHTML = "";

  document.getElementById("batch-rows").innerHTML = "";

  recipe.ingredients.forEach(addRecipeIngredientRow);
  recipe.steps.forEach(addRecipeStepRow);

  if (recipe.batches.length > 0) {
    recipe.batches.forEach(addBatchRow);
  } else {
    addBatchRow();
  }

  document.getElementById("recipe-form-title").textContent =
    `Edit ${recipe.name}`;

  document.getElementById("cancel-recipe-edit").hidden =
    false;

  document
    .getElementById("recipe-form-section")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function deleteRecipe(recipeId) {
  const data = getApplicationData();

  const recipe = data.recipes.find(
    (item) => item.id === recipeId
  );

  if (
    !recipe ||
    !window.confirm(`Delete "${recipe.name}"?`)
  ) {
    return;
  }

  data.recipes = data.recipes.filter(
    (item) => item.id !== recipeId
  );

  if (!saveApplicationData(data)) {
    return;
  }

  renderRecipeList(
    document.getElementById("recipe-search").value
  );

  showToast("Recipe deleted.");
}
