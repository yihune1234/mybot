const assert = require("assert");
const path = require("path");

console.log("🧪 RUNNING MILESTONE 1 VERIFICATION SUITE...\n");

// 1. Business Config Service
const { getConfig, setOperatingMode, getOperatingMode } = require("./src/services/businessConfigService");
const initialMode = getOperatingMode();
console.log(`✓ Initial Operating Mode: ${initialMode}`);
setOperatingMode("hybrid");
assert.strictEqual(getOperatingMode(), "hybrid", "Operating mode should be hybrid");
setOperatingMode("rule_based");
assert.strictEqual(getOperatingMode(), "rule_based", "Operating mode should be rule_based");
console.log("✓ Business Config Service: PASS");

// 2. Service Catalog Service
const { getAllServices, getActiveServices, getServiceById, toggleServiceStatus, updateServicePrice } = require("./src/services/serviceCatalogService");
const allSrv = getAllServices();
assert.ok(allSrv.length >= 3, "Catalog must have at least 3 services");
const srv1 = allSrv[0];
const origActive = srv1.isActive;
toggleServiceStatus(srv1.id);
assert.strictEqual(getServiceById(srv1.id).isActive, !origActive, "Service active status toggled");
toggleServiceStatus(srv1.id); // toggle back
assert.strictEqual(getServiceById(srv1.id).isActive, origActive, "Service active status restored");

const origPrice = srv1.startingPrice;
updateServicePrice(srv1.id, origPrice + 50);
assert.strictEqual(getServiceById(srv1.id).startingPrice, origPrice + 50, "Service price updated");
updateServicePrice(srv1.id, origPrice); // restore
assert.strictEqual(getServiceById(srv1.id).startingPrice, origPrice, "Service price restored");
console.log("✓ Service Catalog Service: PASS");

// 3. RBAC Service (Two Roles: Admin & Customer)
const { isAdmin, isCustomer, getUserRole, getAdminIds } = require("./src/services/rbacService");
const adminId = 7458921957;
const randomCustomer = 123456789;

assert.strictEqual(isAdmin(adminId), true, "7458921957 must be Admin");
assert.strictEqual(isCustomer(adminId), false, "7458921957 must not be Customer");
assert.strictEqual(getUserRole(adminId), "admin", "Role must be admin");

assert.strictEqual(isAdmin(randomCustomer), false, "Random user must not be Admin");
assert.strictEqual(isCustomer(randomCustomer), true, "Random user must be Customer");
assert.strictEqual(getUserRole(randomCustomer), "customer", "Role must be customer");
console.log("✓ RBAC Service (Two Roles Only): PASS");

// 4. Lead Service & Quotations (Resilient Persistence)
const { createLead, getAllLeads, getLeadSummary, getAllQuotes } = require("./src/services/leadService");
(async () => {
  const initialLeads = getAllLeads().length;
  const testLead = await createLead({
    telegramId: 999999999,
    customerName: "Automated Tester",
    username: "autotest",
    serviceType: "Full-Stack Web Development",
    serviceId: "srv_web_dev",
    projectDescription: "E-Commerce multi-vendor platform with Stripe",
    budgetTimeline: "$2000 / 3 weeks",
    contactInfo: "@tester_handle",
    quoteEstimate: 800,
  });

  assert.ok(testLead.leadId, "Lead must receive generated ID");
  assert.strictEqual(getAllLeads().length, initialLeads + 1, "Leads count must increment");
  const summary = getLeadSummary();
  assert.ok(summary.total > 0, "Lead summary must be populated");
  console.log("✓ Lead Service & Local Persistence: PASS");

  // 5. Database Connection (Graceful Handling)
  const { connectDB, isConnected } = require("./src/utils/db");
  const connected = await connectDB();
  console.log(`✓ DB Connection check: connected=${connected}, isConnected()=${isConnected()}`);
  console.log("✓ Graceful DB Failover: PASS");

  // 6. User Service MongoDB Selective Sync
  const { trackUser, getUserLanguage, setUserLanguage } = require("./src/services/userService");
  trackUser({
    from: {
      id: 999999999,
      first_name: "Tester",
      username: "autotester",
      language_code: "en",
    },
  });
  setUserLanguage(999999999, "english");
  assert.strictEqual(getUserLanguage(999999999), "english");
  console.log("✓ User Service Sync: PASS");

  console.log("\n==============================================");
  console.log("🎉 ALL MILESTONE 1 VERIFICATION TESTS PASSED!");
  console.log("==============================================");
  process.exit(0);
})().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
