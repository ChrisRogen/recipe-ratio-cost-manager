"use strict";

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "dashboard") {
    return;
  }

  initializeDashboard();
});

function initializeDashboard() {
  renderDashboard();

  document
    .getElementById("export-data-button")
    .addEventListener("click", exportApplicationData);

  document
    .getElementById("import-data-button")
    .addEventListener("click", () => {
      document.getElementById("import-data-file").click();
    });

  document
    .getElementById("import-data-file")
    .addEventListener("change", handleImportFile);

  document
    .getElementById("reset-data-button")
    .addEventListener("click", resetAllApplicationData);
}

function renderDashboard() {
  const data = getApplicationData();

  const purchasingOptionCount =
    data.ingredients.reduce((total, ingredient) => {
      return total + ingredient.brands.length;
    }, 0);

  const convertedIngredientCount =
    data.ingredients.filter((ingredient) => {
      return (
        ingredient.densityGPerMl !== 1 ||
        ingredient.preparationYieldPercent !== 100 ||
        ingredient.preparedWeightPerItemG > 0
      );
    }).length;

  document.getElementById(
    "dashboard-ingredient-count"
  ).textContent = String(data.ingredients.length);

  document.getElementById(
    "dashboard-brand-count"
  ).textContent = String(purchasingOptionCount);

  document.getElementById(
    "dashboard-recipe-count"
  ).textContent = String(data.recipes.length);

  document.getElementById(
    "dashboard-conversion-count"
  ).textContent = String(convertedIngredientCount);

  document.getElementById(
    "dashboard-business-count"
  ).textContent = String(data.businessRecords.length);

  renderRecentIngredients(data.ingredients);
  renderRecentRecipes(data.recipes);
}

function getMostRecentlyUpdated(items, maximumItems = 5) {
  return [...items]
    .sort((first, second) => {
      const firstDate = new Date(
        first.updatedAt || first.createdAt || 0
      ).getTime();

      const secondDate = new Date(
        second.updatedAt || second.createdAt || 0
      ).getTime();

      return secondDate - firstDate;
    })
    .slice(0, maximumItems);
}

function renderRecentIngredients(ingredients) {
  const container = document.getElementById(
    "recent-ingredients"
  );

  const recentIngredients =
    getMostRecentlyUpdated(ingredients);

  if (recentIngredients.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No ingredients have been saved.</p>

        <a
          class="button button-secondary button-small"
          href="pages/ingredients.html"
        >
          Add ingredient
        </a>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <ul class="purchase-list">
      ${recentIngredients
        .map((ingredient) => {
          const conversionNotes = [
            `${formatNumber(
              ingredient.preparationYieldPercent
            )}% yield`,
            `${formatNumber(
              ingredient.densityGPerMl
            )} g/ml`
          ];

          if (ingredient.preparedWeightPerItemG > 0) {
            conversionNotes.push(
              `${formatNumber(
                ingredient.preparedWeightPerItemG
              )} g/item`
            );
          }

          return `
            <li class="purchase-item">
              <div class="purchase-item-heading">
                <strong>${escapeHtml(ingredient.name)}</strong>

                <span>
                  ${ingredient.brands.length}
                  ${
                    ingredient.brands.length === 1
                      ? "price"
                      : "prices"
                  }
                </span>
              </div>

              <small>
                ${escapeHtml(conversionNotes.join(" • "))}
              </small>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function calculateDashboardRecipeCost(recipe) {
  return recipe.ingredients.reduce((total, item) => {
    const data = getApplicationData();

    const ingredient = data.ingredients.find(
      (entry) => entry.id === item.ingredientId
    );

    const brand = ingredient?.brands.find(
      (entry) => entry.id === item.brandId
    );

    const result = calculateIngredientUsageCost(
      ingredient,
      brand,
      item.quantity,
      item.unit
    );

    return total + (result?.cost || 0);
  }, 0);
}

function renderRecentRecipes(recipes) {
  const container = document.getElementById(
    "recent-recipes"
  );

  const recentRecipes =
    getMostRecentlyUpdated(recipes);

  if (recentRecipes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No recipes have been saved.</p>

        <a
          class="button button-secondary button-small"
          href="pages/recipes.html"
        >
          Create recipe
        </a>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <ul class="purchase-list">
      ${recentRecipes
        .map((recipe) => {
          const cost =
            calculateDashboardRecipeCost(recipe);

          return `
            <li class="purchase-item">
              <div class="purchase-item-heading">
                <strong>${escapeHtml(recipe.name)}</strong>

                <span class="purchase-price">
                  ${formatCurrency(cost)}
                </span>
              </div>

              <small>
                ${formatNumber(recipe.baseYield)} g final •
                ${formatNumber(
                  recipe.basePreparationWeightG
                )} g preparation
              </small>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function createBackupFileName() {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10);

  return (
    "recipe-ratio-cost-manager-v2-backup-" +
    `${datePart}.json`
  );
}

function exportApplicationData() {
  const data = getApplicationData();

  const backup = {
    application: "Recipe Ratio & Cost Manager",
    backupVersion: 2,
    exportedAt: new Date().toISOString(),
    data
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = createBackupFileName();

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  showToast("Version-2 JSON backup downloaded.");
}

function isValidImportData(data) {
  return (
    data &&
    Array.isArray(data.ingredients) &&
    Array.isArray(data.recipes)
  );
}

function handleImportFile(event) {
  const file = event.target.files[0];

  const errorElement = document.getElementById(
    "data-management-error"
  );

  errorElement.textContent = "";

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const parsedFile = JSON.parse(reader.result);

      const importedData =
        parsedFile.data || parsedFile;

      if (!isValidImportData(importedData)) {
        throw new Error("Invalid backup structure.");
      }

      const confirmed = window.confirm(
        "Importing this backup will replace all current local data. Continue?"
      );

      if (!confirmed) {
        return;
      }

      const normalizedData =
        normalizeApplicationData(importedData);

      if (!saveApplicationData(normalizedData)) {
        return;
      }

      renderDashboard();

      showToast("Backup imported and migrated successfully.");
    } catch (error) {
      console.error("Unable to import backup.", error);

      errorElement.textContent =
        "The selected file is not a valid Recipe Ratio & Cost Manager backup.";

      showToast("Backup import failed.", true);
    } finally {
      event.target.value = "";
    }
  });

  reader.addEventListener("error", () => {
    errorElement.textContent =
      "The selected backup file could not be read.";

    event.target.value = "";

    showToast("Backup file could not be read.", true);
  });

  reader.readAsText(file);
}

function resetAllApplicationData() {
  const firstConfirmation = window.confirm(
    "Delete every local ingredient, purchasing price, recipe and batch?"
  );

  if (!firstConfirmation) {
    return;
  }

  const secondConfirmation = window.confirm(
    "This cannot be undone without a JSON backup. Delete all data?"
  );

  if (!secondConfirmation) {
    return;
  }

  if (!saveApplicationData(createEmptyApplicationData())) {
    return;
  }

  renderDashboard();

  showToast("All local application data was deleted.");
}
