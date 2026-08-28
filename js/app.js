document.addEventListener("DOMContentLoaded", () => {
  const currentYearElement = document.querySelector("[data-current-year]");

  if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
  }
});