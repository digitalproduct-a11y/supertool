# n8n Webhook Workflow Setup — Shopee Article Generator

**Goal:** Convert the shell workflow `SamJjGd2ENPWk0IL` into a fully functional webhook-based API for the React UI.

**Time estimate:** 15-20 minutes

---

## Phase 1: Setup & Webhook Config

1. **Open workflow `SamJjGd2ENPWk0IL`** in n8n editor
2. **Rename it** to "Shopee Article Generator" (top left)
3. **Delete the two placeholder nodes** (Webhook and Action switch — we'll rebuild them)
4. **Create a new Webhook node:**
   - Node type: `Webhook`
   - HTTP Method: `POST`
   - Path: `article-generator`
   - Response Mode: `Last Node`
   - Response Data: `{{ $json }}`
   - Save

5. **Create a Switch node after the Webhook:**
   - Name it `Route by Step`
   - Mode: `Expression`
   - Add three cases:
     - Case 1: Condition `{{ $json.step === 'process_products' }}` → Output: `process_products`
     - Case 2: Condition `{{ $json.step === 'generate_article' }}` → Output: `generate_article`
     - Case 3: Condition `{{ $json.step === 'revise_article' }}` → Output: `revise_article`
     - Case 4: Condition `{{ $json.step === 'prepare_thumbnail' }}` → Output: `prepare_thumbnail`
     - Case 5: Condition `{{ $json.step === 'generate_thumbnail' }}` → Output: `generate_thumbnail`
     - Case 6: Condition `{{ $json.step === 'revise_thumbnail' }}` → Output: `revise_thumbnail`

---

## Phase 2: Build Each Branch

### Branch 1: `process_products`

**Source:** Copy these nodes in order from the duplicate workflow `W7wB0oQw4gdixNLi`

1. `Product & Brand Processing` (Code node)
2. `Brand Voice Lookup` (DataTable)
3. `Break products into list` (Code node)
4. `Shop and Item ID extraction` (Code node) — this loops per product
5. `Auth & Payload (Product)` (Code node)
6. `Fetch Product Data` (HTTP Request)
7. `Clean Product Name` (LangChain Agent)
8. `Apply SubIDs` (Set node)
9. `Auth & Payload (Link)` (Code node)
10. `Generate Affiliate Links` (HTTP Request)
11. `Get Product Features` (LangChain Agent)
12. `Categorize shop type` (Code node)
13. `Compile context for AI Agent` (Set node)
14. `Process data` (Aggregate node)
15. `Content Angle Agent` (LangChain Agent)

**Wire all these in sequence, then create a Response node:**

16. **Add a "Response node" (type: Respond to Webhook):**
    - Name: `Return Products & Angles`
    - Add parameter mapping:
      ```
      {
        "success": true,
        "products": "{{ $json.data }}", // from Process data aggregate
        "angles": "{{ $json.article_pitch.angles }}", // from Content Angle Agent
        "context": {
          "brand": "{{ $json.brand }}",
          "articleTitle": "{{ $json.articleTitle }}",
          "productName": "{{ $json.productName }}", // comma-separated via Prepare Image Context (see Phase 3)
          "imageUrl": "{{ $json.imageUrl }}",
          "productFeatures": "{{ $json.productFeatures }}"
        }
      }
      ```
    - Note: For now, use placeholder expressions — we'll refine after building the full flow

**Connect Switch output `process_products` → to this branch**

---

### Branch 2: `generate_article`

**Source:** Copy from duplicate `W7wB0oQw4gdixNLi`

1. **Add a Switch node** to check if angle is "1"-"5" or custom text:
   - Name: `Angle Type`
   - Condition: `{{ /^\d+$/.test($json.selected_angle) }}`
   - True → Lead Editor Agent path
   - False → Custom Angle Editor path

2. **Lead Editor path:**
   - `Lead Editor Agent` (LangChain Agent)
   - Add a Response node:
     ```
     {
       "success": true,
       "article_html": "{{ $json.output }}",
       "article_title": "{{ $json.context.articleTitle }}",
       "context": "{{ $json.context }}"
     }
     ```

3. **Custom Angle path:**
   - `Store Custom Angle` (Set node with `$json.selected_angle`)
   - `Custom Angle Editor` (LangChain Agent)
   - Same Response node as above

**Connect Switch output `generate_article` → Angle Type Switch**

---

### Branch 3: `revise_article`

**Source:** Copy from duplicate

1. `Lead Editor Agent` or `Custom Angle Editor` (with feedback appended to the prompt)
2. Response node:
   ```
   {
     "success": true,
     "article_html": "{{ $json.output }}",
     "article_title": "{{ $json.context.articleTitle }}"
   }
   ```

**Connect Switch output `revise_article` → to this branch**

---

### Branch 4: `prepare_thumbnail`

**Source:** Copy from duplicate

1. `Prepare Image Context` (Set node)
   - **Important:** Update the expressions here to use `.all()` for multiple products:
     ```
     productName: {{ $('Clean Product Name').all().map(i => i.json.output).join(', ') }}
     imageUrl: {{ $('Process data').item.json.data.map(p => p.imageUrl).join(', ') }}
     productFeatures: {{ $('Get Product Features').all().map(i => i.json.output).join('\n\n').substring(0, 800) }}
     ```

2. `Craft Image Prompt` (LangChain Agent)
3. Response node:
   ```
   {
     "success": true,
     "prompt": "{{ $json.output }}",
     "context": { ... same as process_products }
   }
   ```

**Connect Switch output `prepare_thumbnail` → to this branch**

---

### Branch 5: `generate_thumbnail`

**Source:** Copy from duplicate

1. `Set Prompt for Execute` (Set node) — sets `prompt` from input
2. `Call 'Vertex AI Imagen 3 — Image Generation'` (Execute Workflow node)
3. Response node:
   ```
   {
     "success": true,
     "thumbnail_url": "{{ $json.cloudinary_url }}"
   }
   ```

**Connect Switch output `generate_thumbnail` → to this branch**

---

### Branch 6: `revise_thumbnail`

**Source:** Copy from duplicate

1. `Store Regen Feedback` (Set node)
2. `Craft Revised Prompt` (LangChain Agent)
3. `Set Revised Prompt` (Set node)
4. `Call 'Vertex AI Imagen 3 — Image Generation'` (Execute Workflow)
5. Response node:
   ```
   {
     "success": true,
     "thumbnail_url": "{{ $json.cloudinary_url }}",
     "prompt": "{{ $json.prompt }}"
   }
   ```

**Connect Switch output `revise_thumbnail` → to this branch**

---

## Phase 3: Error Handling

For each branch's final Response node, add an **Error Trigger** that catches failures:

1. Add an Error Trigger node attached to the branch
2. Wire it to a fallback Response node:
   ```
   {
     "success": false,
     "error": "execution_error",
     "message": "{{ $json.message }}"
   }
   ```

---

## Phase 4: Testing

1. **Activate the workflow** (toggle at top right)
2. **Test the `/article-generator` webhook manually:**
   - Open Postman or curl terminal
   - POST to: `http://localhost:5678/webhook/article-generator` (or your n8n URL)
   - Body:
     ```json
     {
       "step": "process_products",
       "brand": "Samsung",
       "shopee_links": ["https://shopee.sg/..."]
     }
     ```
   - Expected response: `{ success: true, products: [...], angles: [...], context: {...} }`

3. **In your React app:** Click "Shopee Article" in the sidebar and test the full flow

---

## Critical Notes

- **Copy node configurations exactly** — don't manually recreate them
- **Wire connections carefully** — use the connection handles on nodes
- **For expressions:** Copy them exactly as shown above, replacing only the placeholder paths
- **Test incrementally** — test `process_products` first, then add branches one by one
- **If you get validation errors** — use the validation panel to identify missing fields or broken connections

---

## Quick Reference: Node Names to Copy

From `W7wB0oQw4gdixNLi`:
- Product processing: `Product & Brand Processing`, `Break products into list`, `Shop and Item ID extraction`, `Auth & Payload (Product)`, `Fetch Product Data`, `Clean Product Name`, `Apply SubIDs`, `Auth & Payload (Link)`, `Generate Affiliate Links`, `Get Product Features`, `Categorize shop type`, `Compile context for AI Agent`
- Processing: `Process data` (Aggregate)
- Angles: `Content Angle Agent`
- Article generation: `Lead Editor Agent`, `Custom Angle Editor`
- Thumbnail: `Prepare Image Context`, `Craft Image Prompt`, `Craft Revised Prompt`, `Store Regen Feedback`, `Set Prompt for Execute`, `Call 'Vertex AI Imagen 3 — Image Generation'`

---

**Let me know when you've finished building it, and I can help debug if you hit any issues!**
