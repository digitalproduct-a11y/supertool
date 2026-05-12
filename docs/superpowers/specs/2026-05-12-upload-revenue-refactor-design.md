# Upload Revenue Refactor Design
**Date:** 2026-05-12  
**Feature:** Move upload revenue button from global header to Revenue Chart card with passcode protection

## Overview
Currently, the "Upload revenue" button sits in the global DashboardPage header, and users must select a brand in the modal. This refactor moves the button to the Revenue Chart card itself, auto-selects the brand, and adds passcode protection for security.

## User Flow
1. User navigates to a brand via the header dropdown
2. User clicks "Upload revenue" button on the Revenue card (top right corner, inline with filter icon)
3. Passcode modal appears
4. User enters passcode (cached in sessionStorage for the session)
5. Revenue upload modal opens with the brand pre-selected in the title
6. Upload or clear revenue data for that brand

## Component Changes

### RevenueUploadModal.tsx
**New Props:**
- `fixedBrand?: string` — when set, the brand is fixed and not selectable

**Behavior when `fixedBrand` is set:**
- Modal title becomes "Upload revenue for [Brand Name]"
- Brand dropdown is hidden (upload tab shows read-only brand display)
- Clear tab shows the brand as read-only text instead of dropdown
- All upload/clear logic remains unchanged
- `brands` prop is still required for validation, but only `fixedBrand` is used

**Backward Compatibility:**
- When `fixedBrand` is not set, modal behaves exactly as before (brand dropdown visible)

### RevenueChart.tsx
**New Props:**
- `brand: string` — the currently selected brand (passed from DashboardPage)
- `onRefetch?: () => void` — callback to refresh dashboard data after upload succeeds

**New State:**
- `uploadModalOpen: boolean` — whether the upload modal is showing
- `showPasscodeModal: boolean` — whether the passcode modal is showing
- `passcodeError: string | null` — error message if passcode is wrong

**New Elements:**
- Upload button in header (top right, next to filter icon)
  - Icon: IconUpload
  - Text: "Upload revenue"
  - Disabled if no brand is selected
  - On click: check sessionStorage for auth, show passcode modal if needed

**New Passcode Modal Component:**
- Simple input field for passcode
- Submit button
- Error message display
- On success:
  - Store `sessionStorage.setItem('uploadAuth', 'true')`
  - Close passcode modal
  - Open upload modal
- On failure: show error, clear input, don't proceed

### DashboardPage.tsx
**Removals:**
- `uploadModalOpen` state (no longer needed)
- "Upload revenue" button from global header
- RevenueUploadModal render at bottom of component

**Updates:**
- Pass `brand={selectedBrand}` prop to RevenueChart
- Pass `onRefetch={refetch}` callback to RevenueChart

## Passcode Security
- Passcode is read from `import.meta.env.VITE_UPLOAD_PASSCODE`
- Must be set in `.env.local` or `.env.production`
- Compared against user input in passcode modal
- On success, stored as `sessionStorage` token (session-only, clears on tab/browser close)
- Token is checked on each upload button click to avoid re-prompting within the same session

## Files to Modify
1. `ui/src/components/RevenueUploadModal.tsx` — add `fixedBrand` prop and conditional rendering
2. `ui/src/components/RevenueChart.tsx` — add upload button, modal state, passcode logic
3. `ui/src/pages/DashboardPage.tsx` — remove upload button and related state

## Files to Create
- New passcode modal component (could be inline in RevenueChart or separate; recommend separate for testability)
  - File: `ui/src/components/PasscodeModal.tsx`

## Error Handling
- Passcode modal: show clear error message if passcode is incorrect
- Upload modal: existing error handling remains unchanged
- Network errors: existing error handling remains unchanged

## Testing Considerations
- Verify passcode modal appears on first upload button click
- Verify passcode is cached in sessionStorage
- Verify subsequent clicks don't require passcode re-entry (same session)
- Verify closing tab clears sessionStorage (session-only)
- Verify RevenueUploadModal receives correct `fixedBrand` prop
- Verify brand dropdown is hidden when `fixedBrand` is set
- Verify modal title reflects the brand name
- Verify upload/clear functionality works with fixed brand
- Verify backward compatibility if modal is ever used elsewhere without `fixedBrand`
