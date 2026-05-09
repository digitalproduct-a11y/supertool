# Fuel Price Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an n8n workflow that fetches weekly Malaysian fuel price data from the government API every Wednesday at 12pm, extracts 5 fuel types, calculates week-over-week price changes, and outputs structured JSON for Phase 2 graphic generation.

**Architecture:** The workflow uses a Cron trigger scheduled for Wednesdays at 12pm, fetches data via HTTP GET from the Malaysian government API, parses the response in a JavaScript Code node to extract the 5 required fuel types, calculates WoW changes, and includes error handling with retry logic. The output is stored in a standardized JSON format ready for Phase 2 consumption.

**Tech Stack:** n8n (workflow), HTTP Request node, Code node (JavaScript), Cron Trigger, Error handling via IF/Catch nodes

---

## Task 1: Create Workflow & Schedule Trigger

**Files:**
- Create: New n8n workflow (created via MCP tool)
- Test: Manual workflow execution

- [ ] **Step 1: Create new workflow in n8n**

Use MCP tool to create workflow:
```
n8n_create_workflow with:
  name: "Fuel Price Weekly Extract"
  description: "Fetch Malaysia fuel prices every Wednesday 12pm, calculate WoW changes"
  active: true
```

- [ ] **Step 2: Add Cron Trigger node**

Add a Cron node with configuration:
- **Node name:** "Weekly Wednesday 12pm"
- **Cron expression:** `0 12 * * 3` (Wednesday at 12:00 UTC)
  - *Note: Adjust timezone offset if needed for Malaysia Time (UTC+8)*
- **Trigger on:** Every occurrence

- [ ] **Step 3: Verify trigger node is configured**

Check the node shows:
- Trigger is "Every occurrence"
- Cron pattern is set correctly
- No validation errors

---

## Task 2: Create HTTP Request Node to Fetch Fuel Price Data

**Files:**
- Modify: n8n workflow (add HTTP Request node)
- Test: Validate node configuration, inspect API response structure

- [ ] **Step 1: Add HTTP Request node**

Add new node to workflow, positioned after Cron trigger:
- **Node name:** "Fetch Fuel Price API"
- **URL:** `https://api.data.gov.my/data-catalogue?id=fuelprice`
- **Method:** GET
- **Authentication:** None
- **Headers:** Add `User-Agent: n8n-fuel-price-bot`

- [ ] **Step 2: Test the HTTP node individually**

Execute just this node in n8n to verify:
- Response status is 200
- Response is valid JSON
- Response contains weekly price records with fuel type data

Inspect response structure to identify:
- Field names for fuel types
- Field names for prices
- Date field format
- How many weeks of historical data are returned

- [ ] **Step 3: Document the API response structure**

Add a sticky note to the workflow with:
```
API Response Structure:
- Response contains: [records array]
- Each record has: {date, RON95, RON98, Diesel_Peninsular, Diesel_Sabah_Sarawak, RON95_Budi95, ...}
- Latest record = most recent week
```

---

## Task 3: Create Code Node to Parse Data & Calculate WoW

**Files:**
- Modify: n8n workflow (add Code node)
- Test: Validate parsing and WoW calculation logic

- [ ] **Step 1: Add Code node after HTTP Request**

New JavaScript Code node:
- **Node name:** "Parse & Calculate WoW"
- **Type:** JavaScript
- Position after "Fetch Fuel Price API" node

- [ ] **Step 2: Implement API response parsing**

In the Code node, write JavaScript to:

```javascript
// Get the API response from previous node
const apiData = $('Fetch Fuel Price API').first().json;

// Extract the data array (adjust based on actual API structure)
// This assumes the API returns {data: [{...}, {...}]}
const records = apiData.data || apiData;

// Sort by date to ensure correct ordering (newest first)
records.sort((a, b) => new Date(b.date) - new Date(a.date));

// Get current week (latest) and previous week
const currentWeek = records[0];
const previousWeek = records[1];

if (!currentWeek || !previousWeek) {
  throw new Error('API returned less than 2 weeks of data');
}

// Define the 5 fuel types to extract (adjust field names to match API)
const fuelTypes = [
  { name: 'RON95', apiField: 'ron95' },
  { name: 'RON98', apiField: 'ron98' },
  { name: 'Diesel (Peninsular)', apiField: 'diesel_peninsular' },
  { name: 'Diesel (Sabah/Sarawak)', apiField: 'diesel_sabah_sarawak' },
  { name: 'RON95 (Budi95)', apiField: 'ron95_budi95' }
];

// Extract fuel prices and calculate WoW changes
const fuelPrices = fuelTypes.map(fuel => {
  const currentPrice = parseFloat(currentWeek[fuel.apiField]);
  const previousPrice = parseFloat(previousWeek[fuel.apiField]);
  const wowChange = parseFloat((currentPrice - previousPrice).toFixed(4));
  
  return {
    fuel_type: fuel.name,
    current_price: currentPrice,
    previous_price: previousPrice,
    wow_change: wowChange,
    direction: wowChange > 0 ? 'up' : wowChange < 0 ? 'down' : 'same'
  };
});

// Format output
return {
  week_date: currentWeek.date,
  fuel_prices: fuelPrices,
  timestamp: new Date().toISOString()
};
```

- [ ] **Step 3: Test the Code node with sample data**

Execute the Code node:
- Verify it doesn't throw errors
- Check output structure matches spec:
  ```json
  {
    "week_date": "2026-04-22",
    "fuel_prices": [
      {
        "fuel_type": "RON95",
        "current_price": 2.50,
        "previous_price": 2.48,
        "wow_change": 0.02,
        "direction": "up"
      }
      // ... 4 more fuel types
    ],
    "timestamp": "2026-04-22T12:00:00.000Z"
  }
  ```

- [ ] **Step 4: Adjust field names if needed**

If the Code node fails or output is incorrect:
- Re-run the HTTP node and inspect actual API field names
- Update the `fuelTypes` array mapping to match actual field names
- Re-test until output is correct

---

## Task 4: Add Error Handling & Retry Logic

**Files:**
- Modify: n8n workflow (add error handling nodes)
- Test: Trigger error conditions manually

- [ ] **Step 1: Add error handler after HTTP Request**

After "Fetch Fuel Price API" node, add an IF node:
- **Node name:** "Validate API Response"
- **Condition:** Check if response status is 200 and data exists
- **On success:** Continue to Code node
- **On error:** Route to error handler

Configuration:
```
IF: [HTTP node status] == 200 AND [HTTP node body] has data
THEN: Continue
ELSE: Error branch
```

- [ ] **Step 2: Add error notification branch**

Add a second branch from "Validate API Response" for errors:
- **Node name:** "Error: Invalid API Response"
- **Type:** Slack/Email notification (or Telegram if configured)
- **Message:** `"Fuel price API fetch failed or returned invalid data. Status: {{$node['Fetch Fuel Price API'].json.statusCode}}"`

- [ ] **Step 3: Add retry configuration to HTTP node**

Edit "Fetch Fuel Price API" node:
- **Retry:** Enable
- **Max retries:** 3
- **Backoff:** Exponential (start 1s, max 10s)

- [ ] **Step 4: Add data validation after Code node**

Add IF node after "Parse & Calculate WoW":
- **Node name:** "Validate Output"
- **Condition:** Check that `fuel_prices` array has exactly 5 items
- **On success:** Continue
- **On error:** Error branch

Configuration:
```
IF: [Code node output].fuel_prices.length == 5
THEN: Continue
ELSE: Error - missing fuel types
```

---

## Task 5: Store & Output Data

**Files:**
- Modify: n8n workflow (add output node)
- Test: Verify data is stored/accessible

- [ ] **Step 1: Decide storage mechanism**

Choose one (note: for Phase 2 integration):
- **Option A:** Store in n8n Postgres DB (if available)
- **Option B:** Write to JSON file in n8n storage
- **Option C:** Store in n8n workflow variables (simplest for now)
- **Option D:** POST to an external endpoint/webhook

For now, we'll use **Option C: Store in n8n variables** (simplest, accessible for Phase 2)

- [ ] **Step 2: Add Set node to store output**

After "Validate Output" IF node, add a Set node:
- **Node name:** "Store Fuel Prices"
- **Operation:** Set multiple values
- **Set values:**
  - `latest_fuel_data` = `[Code node output]`
  - `last_updated` = `{{$now.toIso()}}`

- [ ] **Step 3: Add final output node**

Add a second Set node or Return node:
- **Node name:** "Final Output"
- **Return data:** Output the stored fuel price data
- This makes it accessible to Phase 2 workflows

---

## Task 6: Test Full Workflow & Deploy

**Files:**
- Test: Execute complete workflow, verify all outputs

- [ ] **Step 1: Execute workflow manually (test mode)**

In n8n workflow editor:
- Click "Execute workflow" button
- Monitor execution in the panel
- Check each node executes successfully
- Verify no errors in any node

Expected result:
- ✓ Cron trigger activates
- ✓ HTTP node fetches data (200 response)
- ✓ Validation passes
- ✓ Code node parses and calculates
- ✓ Output validation passes
- ✓ Data is stored

- [ ] **Step 2: Inspect final output**

After successful execution:
- View the output of "Final Output" node
- Verify JSON structure matches spec:
  - `week_date` is present
  - `fuel_prices` array has 5 items
  - Each item has: `fuel_type`, `current_price`, `previous_price`, `wow_change`, `direction`
  - `wow_change` values are numbers (positive/negative/zero)
  - `direction` is "up", "down", or "same"

- [ ] **Step 3: Verify WoW calculations manually**

Pick one fuel type and manually verify:
- Example: RON95 current_price = 2.50, previous_price = 2.48
- Expected wow_change = 0.02 ✓
- Expected direction = "up" ✓

Check all 5 fuel types show correct calculations.

- [ ] **Step 4: Save and activate workflow**

- Click "Save" button
- Set **Active** toggle to ON
- Verify next scheduled run shows "Wednesday 12:00pm"
- Confirm workflow is saved in n8n

- [ ] **Step 5: Add documentation sticky notes**

Add sticky notes in workflow to document:
- **Purpose:** "Weekly fuel price extraction with WoW comparison"
- **Schedule:** "Runs every Wednesday 12pm Malaysia time"
- **Output:** "Stores latest_fuel_data in workflow variables for Phase 2"
- **Data format:** Link to spec or paste JSON example

- [ ] **Step 6: Commit plan completion**

```bash
git add docs/superpowers/plans/2026-04-22-fuel-price-data-pipeline.md
git commit -m "docs: add fuel price pipeline implementation plan"
```

---

## Success Criteria

✓ Workflow created and active in n8n  
✓ Cron trigger configured for Wednesday 12pm  
✓ HTTP request fetches data successfully from API  
✓ Code node parses data and calculates WoW changes correctly  
✓ Output matches JSON spec (5 fuel types, price changes with direction)  
✓ Error handling catches API failures and validation errors  
✓ Manual test execution completes successfully  
✓ Workflow is documented with sticky notes  
