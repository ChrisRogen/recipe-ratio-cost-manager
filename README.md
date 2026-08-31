# Recipe Ratio & Cost Manager

A responsive personal web application for managing ingredient purchasing prices, preparation conversions, recipes, production loss, scaled quantities and recipe costs.

## Core Features

### Ingredient Management

- Create, edit, search and delete ingredients
- Store multiple brands or suppliers
- Record pack quantity, pack unit and purchasing price
- Compare normalized purchase prices
- Store ingredient density in grams per millilitre
- Store preparation or edible-yield percentage
- Store prepared weight per item
- Prevent deletion when an ingredient is used by a recipe
- Import ingredients and purchasing brands from CSV, XLSX or XLS files without deleting existing data
- Download a ready-to-fill CSV import template from the Ingredients page

### Supported Measurements

Mass:

- Micrograms (`µg`)
- Milligrams (`mg`)
- Grams (`g`)
- Kilograms (`kg`)

Volume:

- Microlitres (`µL`)
- Millilitres (`ml`)
- Litres (`L`)
- Drops
- Teaspoons
- Australian tablespoons
- Australian cups

Count:

- Each
- Pieces

Quantity inputs support values as small as:

```text
0.001
```

### Recipe Calculator

- Select a saved recipe and enter one required quantity
- Calculate from required final output or a prepared ingredient quantity
- Use mass units (`mg`, `g`, `kg`) and, when final-product density is saved, volume units (`ml`, `L` and other supported volume units)
- Recalculate every ingredient quantity automatically
- Select a different saved brand or supplier for each ingredient
- Recalculate line costs and total production cost immediately
- Display the saved preparation steps in production order
- Include proportional allowance and fixed handling loss when calculating from required final output

### Business Monitoring

- Add a production batch from a compact button-driven entry form
- Save production and sales records using `YYYY-MM-DD` dates and automatic batch numbers
- Snapshot the ingredient brands, prices, scaled quantities and costs used for each batch
- Include packaging, labour, utilities, overhead and other production costs
- Calculate total cost, cost per unit, revenue, remaining stock value, gross profit and margin
- Display every batch field in a detailed monitoring table
- Analyse cost, sales and profit separately for the latest three calendar months
- Automatically remove records older than the current month and previous two months
- Filter records by date and download the filtered data as CSV or JSON

## Future Feature Roadmap

- Recipe version control with draft, approved and archived versions
- Actual-versus-planned production quantities and loss calibration
- Production quality-control checklists
- Inventory, expiry and supplier-lot tracking
- Allergen declarations and printable product labels
- Supabase accounts, cloud synchronisation and automatic backup
- Order, customer and sales-channel management
