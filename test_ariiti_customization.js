const assert = require("assert");
const path = require("path");

console.log("🧪 STARTING ARIITI TECH BOT COMPREHENSIVE VERIFICATION SUITE...\n");

// ----------------------------------------------------
// TEST 1: Business Identity & Centralized Config
// ----------------------------------------------------
console.log("▶ 1. Testing Business Identity & Centralized Config...");
const {
  getConfig,
  updateCompanyProfile,
  getWelcomeMessage,
  updateWelcomeMessage,
  getSocialLinks,
  addSocialLink,
  removeSocialLink,
  getChannelLinks,
  addChannelLink,
  removeChannelLink,
  getMenuVisibility,
  toggleMenuSection,
} = require("./src/services/businessConfigService");

const cfg = getConfig();
const company = cfg.company;

assert.strictEqual(company.name, "Ariiti Tech", "Company name must be Ariiti Tech");
assert.strictEqual(company.positioning, "Business Technology Partner & Digital Solutions Provider", "Positioning must match specification");
assert.strictEqual(company.brandMessage, "Building digital solutions for better businesses.", "Brand message must match specification");
assert.ok(company.description.includes("Ariiti Tech provides software development, digital products"), "Description must match specification");
assert.strictEqual(company.branding.primaryColor, "#093053", "Primary branding color must be #093053");
assert.strictEqual(company.branding.secondaryColor, "#FFFFFF", "Secondary branding color must be #FFFFFF");

// Welcome messages test
const enWelcome = getWelcomeMessage("english");
const omWelcome = getWelcomeMessage("oromo");
const amWelcome = getWelcomeMessage("amharic");
assert.ok(enWelcome.includes("Ariiti Tech"), "EN welcome contains Ariiti Tech");
assert.ok(omWelcome.includes("Ariiti Tech"), "OM welcome contains Ariiti Tech");
assert.ok(amWelcome.includes("Ariiti Tech") || amWelcome.includes("አሪቲ ቴክ"), "AM welcome contains Ariiti Tech / አሪቲ ቴክ");

// Social and Channel links
const socials = getSocialLinks();
assert.ok(Array.isArray(socials) && socials.length >= 2, "Social links must be configured");
const channels = getChannelLinks();
assert.ok(Array.isArray(channels) && channels.length >= 1, "Channel links must be configured");

// Social management
addSocialLink("TestNetwork", "https://test.network");
assert.ok(getSocialLinks().find((s) => s.name === "TestNetwork"), "Should add social link");
removeSocialLink("TestNetwork");
assert.strictEqual(getSocialLinks().find((s) => s.name === "TestNetwork"), undefined, "Should remove social link");

// Menu Visibility toggle
const initialSrvVis = getMenuVisibility().services;
toggleMenuSection("services");
assert.strictEqual(getMenuVisibility().services, !initialSrvVis, "Menu section toggled");
toggleMenuSection("services"); // restore
assert.strictEqual(getMenuVisibility().services, initialSrvVis, "Menu section restored");

console.log("   ✓ Business Identity, Branding (#093053), Welcome Messages, Socials & Menu Config: PASS\n");

// ----------------------------------------------------
// TEST 2: Services Catalog & 4 Configurable Categories
// ----------------------------------------------------
console.log("▶ 2. Testing Services Catalog & Categories...");
const {
  getAllServices,
  getActiveServices,
  getServiceById,
  getServicesByCategory,
  getAllCategories,
  addService,
  updateServicePrice,
  toggleServiceStatus,
  deleteService,
} = require("./src/services/serviceCatalogService");

const services = getAllServices();
assert.ok(services.length >= 10, "Should have all required services loaded");

const categories = getAllCategories();
assert.ok(categories.includes("Software Development"), "Must include Software Development category");
assert.ok(categories.includes("E-commerce Solutions"), "Must include E-commerce Solutions category");
assert.ok(categories.includes("Business Automation"), "Must include Business Automation category");
assert.ok(categories.includes("Digital Innovation"), "Must include Digital Innovation category");

// Verify category queries
const srvDev = getServicesByCategory("Software Development");
assert.ok(srvDev.length >= 4, "Software Development category has 4 services");
const srvEcom = getServicesByCategory("E-commerce Solutions");
assert.ok(srvEcom.length >= 3, "E-commerce Solutions category has 3 services");
const srvAuto = getServicesByCategory("Business Automation");
assert.ok(srvAuto.length >= 4, "Business Automation category has 4 services");
const srvInno = getServicesByCategory("Digital Innovation");
assert.ok(srvInno.length >= 3, "Digital Innovation category has 3 services");

// Test service CRUD
const testSrv = addService({
  name: "Automated Test System",
  category: "Business Automation",
  startingPrice: 999,
  description: "Automated test description",
});
assert.ok(testSrv.id, "Service created with ID");
assert.strictEqual(getServiceById(testSrv.id).startingPrice, 999, "Service price verified");

updateServicePrice(testSrv.id, 1099);
assert.strictEqual(getServiceById(testSrv.id).startingPrice, 1099, "Service price updated");

toggleServiceStatus(testSrv.id);
assert.strictEqual(getServiceById(testSrv.id).isActive, false, "Service status paused");

deleteService(testSrv.id);
assert.strictEqual(getServiceById(testSrv.id), null, "Service deleted");

console.log("   ✓ Services Catalog (4 Categories, CRUD, and Pricing): PASS\n");

// ----------------------------------------------------
// TEST 3: Products Catalog
// ----------------------------------------------------
console.log("▶ 3. Testing Products Catalog...");
const {
  getAllProducts,
  getActiveProducts,
  getProductById,
  addProduct,
  toggleProductStatus,
  deleteProduct,
} = require("./src/services/productCatalogService");

const products = getAllProducts();
assert.ok(products.length >= 3, "Products catalog must have at least 3 initial products");

const testProd = addProduct({
  name: "Ariiti Test App",
  category: "Digital Solutions",
  pricing: "$500",
  description: "Test product description",
});
assert.ok(testProd.id, "Product created with ID");
assert.strictEqual(getProductById(testProd.id).name, "Ariiti Test App");

toggleProductStatus(testProd.id);
assert.strictEqual(getProductById(testProd.id).isActive, false, "Product status paused");

deleteProduct(testProd.id);
assert.strictEqual(getProductById(testProd.id), null, "Product deleted");

console.log("   ✓ Products Catalog (View, Add, Toggle, Delete): PASS\n");

// ----------------------------------------------------
// TEST 4: Portfolio Catalog
// ----------------------------------------------------
console.log("▶ 4. Testing Portfolio Catalog...");
const {
  getAllPortfolio,
  getActivePortfolio,
  getPortfolioById,
  addPortfolioProject,
  togglePortfolioStatus,
  deletePortfolioProject,
} = require("./src/services/portfolioService");

const portfolio = getAllPortfolio();
assert.ok(portfolio.length >= 3, "Portfolio must contain projects");

const testPort = addPortfolioProject({
  title: "Test FinTech Project",
  category: "Web & Mobile",
  techStack: "React, Node.js",
  description: "A secure financial portal",
});
assert.ok(testPort.id, "Portfolio item created with ID");
assert.strictEqual(getPortfolioById(testPort.id).title, "Test FinTech Project");

togglePortfolioStatus(testPort.id);
assert.strictEqual(getPortfolioById(testPort.id).isActive, false, "Portfolio item status paused");

deletePortfolioProject(testPort.id);
assert.strictEqual(getPortfolioById(testPort.id), null, "Portfolio item deleted");

console.log("   ✓ Portfolio Catalog (View, Add, Toggle, Delete): PASS\n");

// ----------------------------------------------------
// TEST 5: Customer Main Menu & Navigation
// ----------------------------------------------------
console.log("▶ 5. Testing Customer Main Menu & Sub-views...");
const {
  getWelcomeText,
  getMainMenuKeyboard,
  getServicesText,
  getServicesKeyboard,
  getProductsText,
  getProductsKeyboard,
  getPortfolioText,
  getPortfolioKeyboard,
  getAboutText,
  getAboutKeyboard,
  getContactText,
  getContactKeyboard,
  getChannelsText,
  getChannelsKeyboard,
  getLanguagesKeyboard,
  getQuoteWizardStep1Text,
  getQuoteWizardKeyboard,
} = require("./src/utils/uiComponents");

// Main menu for customer (non-admin)
const customerMenu = getMainMenuKeyboard("english", false);
const customerButtons = customerMenu.inline_keyboard.flat().map((b) => b.text);
const customerCallbacks = customerMenu.inline_keyboard.flat().map((b) => b.callback_data);

// Verify all 8 customer menu items exist
assert.ok(customerCallbacks.includes("view_services"), "Must have Our Services button");
assert.ok(customerCallbacks.includes("view_products"), "Must have Our Products button");
assert.ok(customerCallbacks.includes("view_portfolio"), "Must have Our Portfolio button");
assert.ok(customerCallbacks.includes("view_about"), "Must have About Ariiti Tech button");
assert.ok(customerCallbacks.includes("start_quote"), "Must have Request a Service button");
assert.ok(customerCallbacks.includes("view_contact"), "Must have Contact Us button");
assert.ok(customerCallbacks.includes("view_channels"), "Must have Follow Our Channels button");
assert.ok(customerCallbacks.includes("switch_lang"), "Must have Language Settings button");
assert.ok(!customerCallbacks.includes("admin_nav_main"), "Customer menu MUST NOT show Admin Control Panel");

// Main menu for admin
const adminMenu = getMainMenuKeyboard("english", true);
const adminCallbacks = adminMenu.inline_keyboard.flat().map((b) => b.callback_data);
assert.ok(adminCallbacks.includes("admin_nav_main"), "Admin menu MUST show Admin Control Panel");

// Check back buttons on every sub-view keyboard
const srvKb = getServicesKeyboard("english");
assert.ok(srvKb.inline_keyboard.flat().some((b) => b.callback_data === "main_menu"), "Services has Back to Main Menu");

const prodKb = getProductsKeyboard("english");
assert.ok(prodKb.inline_keyboard.flat().some((b) => b.callback_data === "main_menu"), "Products has Back to Main Menu");

const portKb = getPortfolioKeyboard("english");
assert.ok(portKb.inline_keyboard.flat().some((b) => b.callback_data === "main_menu"), "Portfolio has Back to Main Menu");

const aboutKb = getAboutKeyboard("english");
assert.ok(aboutKb.inline_keyboard.flat().some((b) => b.callback_data === "main_menu"), "About has Back to Main Menu");

const contactKb = getContactKeyboard("english");
assert.ok(contactKb.inline_keyboard.flat().some((b) => b.callback_data === "main_menu"), "Contact has Back to Main Menu");

const channelsKb = getChannelsKeyboard("english");
assert.ok(channelsKb.inline_keyboard.flat().some((b) => b.callback_data === "main_menu"), "Channels has Back to Main Menu");

const langKb = getLanguagesKeyboard("english");
assert.ok(langKb.inline_keyboard.flat().some((b) => b.callback_data === "main_menu"), "Languages has Back to Main Menu");

console.log("   ✓ Customer Main Menu (8 Items, Admin Guard, Back Button paths): PASS\n");

// ----------------------------------------------------
// TEST 6: Admin Authorization & Security Guards
// ----------------------------------------------------
console.log("▶ 6. Testing Admin Authorization & Security Guards...");
const { isAdmin, isCustomer, getUserRole } = require("./src/services/rbacService");
const adminId = 7458921957;
const randomUser = 11223344;

assert.strictEqual(isAdmin(adminId), true, "Admin ID must be authorized");
assert.strictEqual(isAdmin(randomUser), false, "Random user must not be authorized as admin");
assert.strictEqual(isCustomer(randomUser), true, "Random user is customer");
assert.strictEqual(getUserRole(adminId), "admin");
assert.strictEqual(getUserRole(randomUser), "customer");

// Test that admin handler blocks non-admin
const { handleAdminCallback } = require("./src/handlers/businessAdminHandler");
(async () => {
  let deniedAlert = false;
  const fakeBot = {
    answerCallbackQuery: async (id, opts) => {
      if (opts && opts.show_alert && opts.text.includes("Access Denied")) {
        deniedAlert = true;
      }
    },
  };

  const fakeCallbackQuery = {
    id: "cb_1",
    from: { id: randomUser },
    message: { chat: { id: randomUser }, message_id: 123 },
    data: "admin_nav_main",
  };

  const handled = await handleAdminCallback("admin_nav_main", fakeCallbackQuery, fakeBot);
  assert.strictEqual(handled, true);
  assert.strictEqual(deniedAlert, true, "Non-admin must be denied with alert");
  console.log("   ✓ Admin Guard (Unauthorized access rejected): PASS\n");

  // ----------------------------------------------------
  // TEST 7: Internationalization (EN, OM, AM)
  // ----------------------------------------------------
  console.log("▶ 7. Testing Internationalization (EN, OM, AM)...");
  const { loadTranslations, t, getLangCode } = require("./src/services/i18nService");
  const { detectLanguage } = require("./src/services/languageService");

  loadTranslations();

  assert.strictEqual(getLangCode("english"), "en");
  assert.strictEqual(getLangCode("oromo"), "om");
  assert.strictEqual(getLangCode("amharic"), "am");

  // Amharic script detection
  const detectedAm = detectLanguage("ሰላም እንዴት ነዎት? አገልግሎቶችን ማየት እፈልጋለሁ");
  assert.strictEqual(detectedAm, "amharic", "Amharic script must be detected");

  const detectedOm = detectLanguage("Akkam jirtu, tajaajila software barbaada");
  assert.strictEqual(detectedOm, "oromo", "Oromo phrase must be detected");

  const detectedEn = detectLanguage("Hello, I need an online store for my business");
  assert.strictEqual(detectedEn, "english", "English phrase must be detected");

  // Multilingual translations lookup
  const enCmd = t("commands.ping_response", "en");
  const omCmd = t("commands.ping_response", "om");
  const amCmd = t("commands.ping_response", "am");
  assert.ok(enCmd, "EN translation exists");
  assert.ok(omCmd, "OM translation exists");
  assert.ok(amCmd, "AM translation exists");

  console.log("   ✓ Multi-language Support (EN, OM, AM and Script Detection): PASS\n");

  // ----------------------------------------------------
  // TEST 8: Zero Prohibited Networking / IT Support Terms
  // ----------------------------------------------------
  console.log("▶ 8. Testing Absolute Absence of Prohibited IT / Networking Terms...");
  const fs = require("fs");
  const prohibitedPattern = /\b(wi-?fi|router|networking|network maintenance|it support)\b/i;

  const filesToCheck = [
    "./data/businessConfig.json",
    "./data/services.json",
    "./data/products.json",
    "./data/portfolio.json",
    "./src/utils/uiComponents.js",
    "./src/handlers/messageHandler.js",
    "./src/handlers/commandHandler.js",
    "./src/handlers/businessAdminHandler.js",
  ];

  for (const f of filesToCheck) {
    const raw = fs.readFileSync(path.resolve(__dirname, f), "utf8");
    assert.strictEqual(
      prohibitedPattern.test(raw),
      false,
      `File ${f} must not contain prohibited IT/networking terms!`
    );
  }
  console.log("   ✓ Zero Prohibited Terms (Strict business identity enforced): PASS\n");

  // ----------------------------------------------------
  // TEST 9: Inquiries / Lead Generation Flow
  // ----------------------------------------------------
  console.log("▶ 9. Testing Inquiries & Lead Persistence...");
  const { createLead, getAllLeads } = require("./src/services/leadService");
  const initialLeadCount = getAllLeads().length;

  const lead = await createLead({
    telegramId: 888777666,
    customerName: "Ariiti Enterprise Client",
    username: "ariiti_client",
    serviceType: "E-commerce Solutions",
    serviceId: "srv_online_stores",
    projectDescription: "B2B wholesale marketplace with Telebirr",
    budgetTimeline: "$1500 / 3 weeks",
    contactInfo: "+251911223344",
  });

  assert.ok(lead.leadId, "Lead ID must be generated");
  assert.strictEqual(getAllLeads().length, initialLeadCount + 1, "Lead count must increment");
  console.log("   ✓ Lead & Customer Inquiry Intake: PASS\n");

  console.log("==================================================================");
  console.log("🎉 ALL ARIITI TECH CUSTOMIZATION SUITE TESTS PASSED 100%!");
  console.log("==================================================================");
  process.exit(0);
})().catch((err) => {
  console.error("❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
