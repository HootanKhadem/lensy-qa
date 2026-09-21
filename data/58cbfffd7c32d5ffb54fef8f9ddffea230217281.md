# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: specs/products-inventory/supplier-stock.spec.ts >> supplier stock field and linked supplier persist on a product
- Location: tests/specs/products-inventory/supplier-stock.spec.ts:15:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "QA Test Supplier 1788853513396"
Received: ""
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - generic [ref=f3e2]:
    - complementary [ref=f3e3]:
      - generic [ref=f3e5]:
        - img "Lensy Admin" [ref=f3e6]
        - generic [ref=f3e7]: Admin
      - navigation [ref=f3e8]:
        - link "Dashboard" [ref=f3e11] [cursor=pointer]:
          - /url: /
        - generic [ref=f3e20]:
          - link "Orders" [ref=f3e22] [cursor=pointer]:
            - /url: /orders
          - generic [ref=f3e29]:
            - button "Store" [ref=f3e30]
            - generic [ref=f3e40]:
              - link "Products" [ref=f3e41] [cursor=pointer]:
                - /url: /products
              - link "Categories" [ref=f3e43] [cursor=pointer]:
                - /url: /categories
              - link "Brands" [ref=f3e45] [cursor=pointer]:
                - /url: /brands
              - link "Lens Powers" [ref=f3e47] [cursor=pointer]:
                - /url: /lens-powers
              - link "Eyeglass Options" [ref=f3e49] [cursor=pointer]:
                - /url: /eyeglass-options
          - button "Content" [ref=f3e52]
          - button "Marketing" [ref=f3e63]
          - link "Customers" [ref=f3e72] [cursor=pointer]:
            - /url: /customers
          - link "Suppliers" [ref=f3e81] [cursor=pointer]:
            - /url: /suppliers
          - link "Supplier Requests" [ref=f3e87] [cursor=pointer]:
            - /url: /supplier-requests
          - link "Drivers" [ref=f3e94] [cursor=pointer]:
            - /url: /drivers
          - link "Shipping" [ref=f3e103] [cursor=pointer]:
            - /url: /shipping
          - link "Reviews" [ref=f3e112] [cursor=pointer]:
            - /url: /reviews
        - link "Team" [ref=f3e120] [cursor=pointer]:
          - /url: /team
      - generic [ref=f3e135]:
        - link "Localization" [ref=f3e137] [cursor=pointer]:
          - /url: /localization
        - link "Footer" [ref=f3e144] [cursor=pointer]:
          - /url: /footer
        - link "Settings" [ref=f3e150] [cursor=pointer]:
          - /url: /settings
        - button "Logout" [ref=f3e165]
      - button [ref=f3e170]
    - generic [ref=f3e171]:
      - banner [ref=f3e172]:
        - button "Search... ⌘ K" [ref=f3e174]:
          - generic [ref=f3e178]: Search...
          - generic:
            - generic: ⌘
            - text: K
        - generic [ref=f3e179]:
          - button "Language" [ref=f3e180]
          - button "Theme" [ref=f3e182]
          - button "TA Test Super Admin" [ref=f3e184]:
            - generic [ref=f3e185]: TA
            - generic [ref=f3e187]:
              - generic [ref=f3e188]: Test
              - generic [ref=f3e189]: Super Admin
      - main [ref=f3e190]:
        - generic [ref=f3e191]:
          - generic [ref=f3e192]:
            - generic [ref=f3e193]:
              - button [ref=f3e194]
              - generic [ref=f3e195]:
                - heading "Edit Product" [level=1] [ref=f3e196]
                - paragraph [ref=f3e197]: Update product details
            - generic [ref=f3e198]:
              - button "Copy ID" [ref=f3e199]
              - button "Cancel" [ref=f3e200]
              - button "Save" [ref=f3e201]
          - generic [ref=f3e202]:
            - generic [ref=f3e203]:
              - generic [ref=f3e204]:
                - generic [ref=f3e205]:
                  - heading "Basic Information" [level=3] [ref=f3e206]
                  - paragraph [ref=f3e207]: Product name and description in both languages
                - generic [ref=f3e208]:
                  - generic [ref=f3e209]:
                    - generic [ref=f3e210]:
                      - text: Product Name (English)
                      - textbox "Product Name (English)" [ref=f3e211]:
                        - /placeholder: Enter product name in English
                        - text: Vitorio
                    - generic [ref=f3e212]:
                      - text: Product Name (Arabic)
                      - textbox "Product Name (Arabic)" [ref=f3e213]:
                        - /placeholder: أدخل اسم المنتج بالعربية
                        - text: فيتوريو
                  - generic [ref=f3e214]:
                    - generic [ref=f3e215]:
                      - generic [ref=f3e216]: Description (English)
                      - textbox "Description (English)" [ref=f3e217]:
                        - /placeholder: Product description in English
                        - text: Brand VITORIO Model 7105 Color C7 Made In Italy
                    - generic [ref=f3e218]:
                      - generic [ref=f3e219]: Description (Arabic)
                      - textbox "Description (Arabic)" [ref=f3e220]:
                        - /placeholder: وصف المنتج بالعربية
                        - text: الماركة VITORIO الموديل 7105 اللون C7 الصنع إيطاليا
              - generic [ref=f3e221]:
                - generic [ref=f3e222]:
                  - heading "Pricing" [level=3] [ref=f3e223]
                  - paragraph [ref=f3e224]: Set product prices
                - generic [ref=f3e226]:
                  - generic [ref=f3e227]:
                    - generic [ref=f3e228]: Currency *
                    - combobox [ref=f3e229]:
                      - generic: KWD
                    - combobox [ref=f3e232]
                  - generic [ref=f3e233]:
                    - generic [ref=f3e234]: Base Price *
                    - spinbutton "Base Price *" [ref=f3e235]: "50"
                  - generic [ref=f3e236]:
                    - text: Compare at Price
                    - spinbutton "Compare at Price" [ref=f3e237]
                  - generic [ref=f3e238]:
                    - text: Cost Price
                    - spinbutton "Cost Price" [ref=f3e239]
              - generic [ref=f3e240]:
                - generic [ref=f3e241]:
                  - heading "Inventory" [level=3] [ref=f3e242]
                  - paragraph [ref=f3e243]: Manage stock and inventory settings
                - generic [ref=f3e244]:
                  - generic [ref=f3e245]:
                    - generic [ref=f3e246]:
                      - text: Track Inventory
                      - paragraph [ref=f3e247]: Track stock levels for this product
                    - switch [checked] [ref=f3e248] [cursor=pointer]
                    - checkbox [checked]
                  - generic [ref=f3e249]:
                    - generic [ref=f3e250]:
                      - text: Stock Quantity
                      - spinbutton "Stock Quantity" [ref=f3e251]: "10"
                    - generic [ref=f3e252]:
                      - text: Low Stock Alert
                      - spinbutton "Low Stock Alert" [ref=f3e253]: "5"
                    - generic [ref=f3e255]:
                      - switch "Allow Backorders" [ref=f3e256] [cursor=pointer]
                      - checkbox
                      - generic [ref=f3e257]: Allow Backorders
                    - generic [ref=f3e258]:
                      - generic [ref=f3e259]:
                        - text: Supplier stock
                        - spinbutton "Supplier stock" [ref=f3e260]: "25"
                      - generic [ref=f3e261]:
                        - text: Linked supplier
                        - combobox "Linked supplier" [ref=f3e262]:
                          - generic: QA Test Supplier 1788853513396
                        - combobox [ref=f3e265]
                      - paragraph [ref=f3e266]: Supplier stock is used automatically once our stock is depleted. When linked, the supplier can update their stock from the supplier portal.
                    - generic [ref=f3e267]:
                      - generic [ref=f3e268]:
                        - text: Allow pre-order
                        - paragraph [ref=f3e269]: Customers can place an order even when stock is exhausted; the line is flagged as a pre-order.
                      - switch "Allow pre-order" [checked] [ref=f3e270] [cursor=pointer]
                      - checkbox [checked]
                    - generic [ref=f3e271]:
                      - text: Estimated arrival
                      - textbox "Estimated arrival" [ref=f3e272]:
                        - /placeholder: e.g. 2 weeks
                        - text: available in 2 days
                      - paragraph [ref=f3e273]: Free-form text shown to the customer under the "Pre-order" button.
                  - generic [ref=f3e274]:
                    - generic [ref=f3e275]:
                      - text: SKU
                      - textbox "SKU" [ref=f3e276]:
                        - /placeholder: Stock Keeping Unit
                    - generic [ref=f3e277]:
                      - text: Barcode
                      - textbox "Barcode" [ref=f3e278]:
                        - /placeholder: UPC, EAN, ISBN...
                  - generic [ref=f3e280]:
                    - text: Expiry Date
                    - textbox "Expiry Date" [ref=f3e281]
                    - paragraph [ref=f3e282]: Optional — used to flag products approaching expiry
              - generic [ref=f3e284]:
                - generic [ref=f3e285]:
                  - heading "Contact Lens" [level=3] [ref=f3e290]
                  - switch [ref=f3e291] [cursor=pointer]
                  - checkbox
                - paragraph [ref=f3e292]: Enable this if this product is contact lenses to manage powers and stock per power
              - generic [ref=f3e294]:
                - generic [ref=f3e295]:
                  - heading "Eyeglasses" [level=3] [ref=f3e301]
                  - switch [ref=f3e302] [cursor=pointer]
                  - checkbox
                - paragraph [ref=f3e303]: Enable this if this product is eyeglasses to manage lens types, packages, pricing, and tints
              - generic [ref=f3e304]:
                - heading "Images" [level=3] [ref=f3e306]
                - generic [ref=f3e307]:
                  - generic [ref=f3e308]:
                    - generic [ref=f3e309]:
                      - generic [ref=f3e310]: Product Image
                      - button "Check Image Quality" [ref=f3e311]
                    - generic [ref=f3e313] [cursor=pointer]:
                      - button "Choose File" [ref=f3e314]
                      - generic [ref=f3e316]: Add Image
                  - generic [ref=f3e317]:
                    - generic [ref=f3e318]:
                      - generic [ref=f3e319]: Product Gallery
                      - button "Check Image Quality" [ref=f3e320]
                    - generic [ref=f3e322] [cursor=pointer]:
                      - button "Choose File" [ref=f3e323]
                      - generic [ref=f3e325]: Add Image
              - generic [ref=f3e327]:
                - generic [ref=f3e328]:
                  - heading "Options" [level=3] [ref=f3e337] [cursor=pointer]
                  - paragraph [ref=f3e340]: Options like size and color
                - button "Add Option" [ref=f3e343]
              - generic [ref=f3e345]:
                - generic [ref=f3e346]:
                  - heading "Variants" [level=3] [ref=f3e353] [cursor=pointer]
                  - paragraph [ref=f3e356]: Variants with different prices and stock
                - paragraph [ref=f3e360]: Add product options first (e.g., Size, Color) to create variants
              - generic [ref=f3e362]:
                - generic [ref=f3e363]:
                  - heading "Custom Fields" [level=3] [ref=f3e369] [cursor=pointer]
                  - paragraph [ref=f3e372]: Custom fields for customer personalization
                - button "Add Custom Field" [ref=f3e375]
            - generic [ref=f3e376]:
              - generic [ref=f3e377]:
                - heading "Status" [level=3] [ref=f3e379]
                - generic [ref=f3e380]:
                  - generic [ref=f3e381]:
                    - generic [ref=f3e382]:
                      - text: Published
                      - paragraph [ref=f3e383]: Show product on storefront
                    - switch [checked] [ref=f3e384] [cursor=pointer]
                    - checkbox [checked]
                  - generic [ref=f3e385]:
                    - text: Status
                    - combobox [ref=f3e386]:
                      - generic: Active
                    - combobox [ref=f3e389]
                  - generic [ref=f3e390]:
                    - generic [ref=f3e391]:
                      - text: Featured
                      - paragraph [ref=f3e392]: Show in featured products
                    - switch [checked] [ref=f3e393] [cursor=pointer]
                    - checkbox [checked]
              - generic [ref=f3e394]:
                - heading "Organization" [level=3] [ref=f3e396]
                - generic [ref=f3e397]:
                  - generic [ref=f3e398]:
                    - generic [ref=f3e399]:
                      - generic [ref=f3e400]: Category
                      - generic [ref=f3e401]: 1 selected
                    - generic [ref=f3e403]:
                      - generic [ref=f3e404]: Eye Wear /
                      - text: Sun Glasses
                      - button [ref=f3e405]
                    - generic [ref=f3e410]:
                      - generic [ref=f3e412] [cursor=pointer]:
                        - checkbox "Colored Contact Lenses" [ref=f3e413]
                        - checkbox
                        - generic [ref=f3e414]: Colored Contact Lenses
                      - generic [ref=f3e416] [cursor=pointer]:
                        - checkbox "Clear Contact Lenses" [ref=f3e417]
                        - checkbox
                        - generic [ref=f3e418]: Clear Contact Lenses
                      - generic [ref=f3e419]:
                        - generic [ref=f3e420] [cursor=pointer]:
                          - checkbox "Eye Wear" [ref=f3e421]
                          - checkbox
                          - generic [ref=f3e422]: Eye Wear
                        - generic [ref=f3e423]:
                          - generic [ref=f3e424] [cursor=pointer]:
                            - checkbox "Eye Glasses" [ref=f3e425]
                            - checkbox
                            - generic [ref=f3e426]: Eye Glasses
                          - generic [ref=f3e427] [cursor=pointer]:
                            - checkbox "Sun Glasses" [checked] [ref=f3e428]
                            - checkbox [checked]
                            - generic [ref=f3e429]: Sun Glasses
                      - generic [ref=f3e430]:
                        - generic [ref=f3e431] [cursor=pointer]:
                          - checkbox "Beauty & More" [ref=f3e432]
                          - checkbox
                          - generic [ref=f3e433]: Beauty & More
                        - generic [ref=f3e434]:
                          - generic [ref=f3e435] [cursor=pointer]:
                            - checkbox "Eye Care" [ref=f3e436]
                            - checkbox
                            - generic [ref=f3e437]: Eye Care
                          - generic [ref=f3e438] [cursor=pointer]:
                            - checkbox "Brushes" [ref=f3e439]
                            - checkbox
                            - generic [ref=f3e440]: Brushes
                  - generic [ref=f3e441]:
                    - text: Brand
                    - combobox [ref=f3e442]:
                      - generic: Prada
                    - combobox [ref=f3e445]
                  - generic [ref=f3e446]:
                    - text: Brand Collection
                    - combobox [ref=f3e447]:
                      - generic: No collection
                    - combobox [ref=f3e450]
                    - paragraph [ref=f3e451]: No collections for this brand
              - generic [ref=f3e452]:
                - generic [ref=f3e453]:
                  - heading "Country Availability" [level=3] [ref=f3e454]
                  - paragraph [ref=f3e458]: Select countries where this product is available. Leave empty for all countries.
                - generic [ref=f3e459]:
                  - generic [ref=f3e460]: ✓ Available in all countries
                  - generic [ref=f3e461]:
                    - text: Add Country
                    - generic [ref=f3e462]:
                      - button "🇰🇼 Kuwait (KW)" [ref=f3e463]:
                        - generic [ref=f3e464]:
                          - generic [ref=f3e465]: 🇰🇼
                          - generic [ref=f3e466]: Kuwait
                          - generic [ref=f3e467]: (KW)
                      - button "🇸🇦 Saudi Arabia (SA)" [ref=f3e468]:
                        - generic [ref=f3e469]:
                          - generic [ref=f3e470]: 🇸🇦
                          - generic [ref=f3e471]: Saudi Arabia
                          - generic [ref=f3e472]: (SA)
                      - button "🇦🇪 United Arab Emirates (AE)" [ref=f3e473]:
                        - generic [ref=f3e474]:
                          - generic [ref=f3e475]: 🇦🇪
                          - generic [ref=f3e476]: United Arab Emirates
                          - generic [ref=f3e477]: (AE)
                      - button "🇧🇭 Bahrain (BH)" [ref=f3e478]:
                        - generic [ref=f3e479]:
                          - generic [ref=f3e480]: 🇧🇭
                          - generic [ref=f3e481]: Bahrain
                          - generic [ref=f3e482]: (BH)
                      - button "🇶🇦 Qatar (QA)" [ref=f3e483]:
                        - generic [ref=f3e484]:
                          - generic [ref=f3e485]: 🇶🇦
                          - generic [ref=f3e486]: Qatar
                          - generic [ref=f3e487]: (QA)
                      - button "🇴🇲 Oman (OM)" [ref=f3e488]:
                        - generic [ref=f3e489]:
                          - generic [ref=f3e490]: 🇴🇲
                          - generic [ref=f3e491]: Oman
                          - generic [ref=f3e492]: (OM)
                      - button "🌐 International (INT)" [ref=f3e493]:
                        - generic [ref=f3e494]:
                          - generic [ref=f3e495]: 🌐
                          - generic [ref=f3e496]: International
                          - generic [ref=f3e497]: (INT)
          - generic [ref=f3e501]:
            - text: Slug
            - textbox "Slug" [ref=f3e502]:
              - /placeholder: Auto-generated from name if empty
              - text: vitorio
  - alert [ref=f3e503]
```

# Test source

```ts
  1  | import { test, expect } from '../../fixtures/roles.fixture';
  2  | import { AdminSuppliersPage } from '../../pages/admin-suppliers.page';
  3  | import { AdminProductsListPage } from '../../pages/admin-products-list.page';
  4  | import { AdminProductFormPage } from '../../pages/admin-product-form.page';
  5  | 
  6  | // Uses "Vitorio" — reassigned off the originally-shared "Carrera CA8044/S" so this spec no
  7  | // longer races expiry-date.spec.ts's own save() against the same product record under this
  8  | // suite's `fullyParallel` execution (see I5 in the products-inventory final review). "Vitorio" is
  9  | // confirmed live to still have its own intact "Sun Glasses" category and starts unlinked from any
  10 | // supplier ("No supplier"), so this defends its category the same way every products-inventory
  11 | // spec that saves a product now does (see C1).
  12 | const PRODUCT_NAME = 'Vitorio';
  13 | const CATEGORY_NAME = 'Sun Glasses';
  14 | 
  15 | test('supplier stock field and linked supplier persist on a product', async ({ adminPage }) => {
  16 |   const supplierName = `QA Test Supplier ${Date.now()}`;
  17 | 
  18 |   const suppliers = new AdminSuppliersPage(adminPage);
  19 |   await suppliers.goto();
  20 |   await suppliers.createSupplier(supplierName);
  21 |   await suppliers.expectSupplierListed(supplierName);
  22 | 
  23 |   const list = new AdminProductsListPage(adminPage);
  24 |   await list.goto();
  25 |   await list.searchAndOpenEdit(PRODUCT_NAME);
  26 | 
  27 |   const form = new AdminProductFormPage(adminPage);
  28 |   const originalSupplier = await form.getLinkedSupplier();
  29 |   const originalStock = await form.getSupplierStock();
  30 | 
  31 |   await form.setLinkedSupplier(supplierName);
  32 |   await form.setSupplierStock(25);
  33 |   await form.saveReaffirmingCategory(CATEGORY_NAME);
  34 | 
  35 |   await adminPage.reload();
  36 |   await form.expectLoaded();
  37 |   expect(await form.getLinkedSupplier()).toBe(supplierName);
  38 |   expect(await form.getSupplierStock()).toBe(25);
  39 | 
  40 |   // Restore the product's original supplier link/stock. Confirmed live: `getLinkedSupplier()`
  41 |   // returns the combobox's own "No supplier" placeholder text (a real, selectable option) when
  42 |   // nothing is linked — never an empty string — so calling `setLinkedSupplier(originalSupplier)`
  43 |   // unconditionally is always safe and correct, with no special-casing needed for "started with
  44 |   // nothing linked" (see I7 in the final review: the previous `if (originalSupplier)` guard here
  45 |   // was only ever live to skip a falsy empty string this combobox never actually produces, so it
  46 |   // silently never fired — relying on that by accident was fragile, and would have masked a real
  47 |   // gap for any product whose combobox ever did render as genuinely empty).
  48 |   await form.setLinkedSupplier(originalSupplier);
  49 |   await form.setSupplierStock(originalStock);
  50 |   await form.saveReaffirmingCategory(CATEGORY_NAME);
  51 | 
  52 |   // Verify the restore actually persisted, rather than relying on it implicitly.
  53 |   await adminPage.reload();
  54 |   await form.expectLoaded();
> 55 |   expect(await form.getLinkedSupplier()).toBe(originalSupplier);
     |                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  56 |   expect(await form.getSupplierStock()).toBe(originalStock);
  57 | });
  58 | 
```