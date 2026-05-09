# Fuel Price Data Pipeline — Phase 1 Design
**Date:** 2026-04-22  
**Project:** n8n-builder  
**Author:** Claude

## Overview
Automated weekly workflow that fetches Malaysia's fuel price data from the government API, extracts the latest 5 fuel types, calculates week-over-week (WoW) price changes, and prepares structured data for graphic generation in Phase 2.

## Purpose
Enable weekly fuel price tracking with automatic data retrieval and WoW comparison to support social media posting (Phase 2).

## Data Pipeline Architecture

### Trigger
- **Type:** Scheduled Workflow
- **Schedule:** Weekly on Wednesday at 12:00 PM (Malaysia time)
- **Rationale:** Malaysian fuel prices are typically updated on Wednesdays

### Data Fetch
- **Endpoint:** `https://api.data.gov.my/data-catalogue?id=fuelprice`
- **Method:** HTTP GET
- **Response Format:** JSON
- **Node Name:** "Fetch Fuel Price Data"

### Data Extraction & Transformation
- **Node Name:** "Parse & Calculate WoW"
- **Type:** Code (JavaScript)
- **Logic:**
  - Parse API response to extract weekly price records
  - Identify current week and previous week records
  - Extract the 5 required fuel types:
    1. RON95
    2. RON98
    3. Diesel (Peninsular Malaysia)
    4. Diesel (Sabah/Sarawak)
    5. RON95 (Budi95)
  - Calculate WoW change: `current_price - previous_price`
  - Determine direction: "up" if positive, "down" if negative, "same" if zero

### Output Data Structure
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
    },
    {
      "fuel_type": "RON98",
      "current_price": 2.70,
      "previous_price": 2.70,
      "wow_change": 0.00,
      "direction": "same"
    },
    // ... 3 more fuel types
  ]
}
```

## Error Handling
- **API Fetch Failure:** Retry up to 3 times with exponential backoff
- **Invalid Data:** Validate that all 5 fuel types are present; fail with error notification if missing
- **Missing Historical Data:** Ensure at least 2 weeks of data exist to calculate WoW changes
- **Error Node:** Catch failures and log for debugging

## Success Criteria
- ✓ Data fetched successfully from government API every Wednesday 12pm
- ✓ All 5 fuel types extracted correctly
- ✓ WoW changes calculated accurately (with direction)
- ✓ Output stored in standardized JSON format
- ✓ Data ready to feed into Phase 2 (graphic generation)

## Future Integration (Phase 2)
The structured JSON output will be consumed by:
- Cloudinary graphic generation node
- Social media publishing workflow

## Dependencies
- n8n instance with HTTP Request node capability
- Internet access to `api.data.gov.my`
- Scheduler enabled on n8n instance

## Notes
- No authentication required for the Malaysian government API
- Phase 1 focuses on data accuracy; Phase 2 will handle graphic design and publishing
- Scheduled for Wednesday 12pm to align with Malaysian fuel price update cadence
