const assert = require("assert");
const { verifyMediaBuffer, scanBinaryC2PA, scanSynthID, extractMetadataDetails } = require("./src/services/verifyService");
const { getMainMenuKeyboard } = require("./src/utils/uiComponents");
const { STATE_VERIFY_MEDIA } = require("./src/utils/constants");
const en = require("./src/i18n/en.json");
const om = require("./src/i18n/om.json");

console.log("🧪 TESTING AI MEDIA VERIFICATION (C2PA & SYNTHID)...\n");

// 1. Check i18n
assert.ok(en.verify && en.verify.usage, "en.json must contain verify.usage");
assert.ok(om.verify && om.verify.usage, "om.json must contain verify.usage");
console.log("✓ i18n verify keys present: PASS");

// 2. Check UI & Constants
assert.strictEqual(STATE_VERIFY_MEDIA, "STATE_VERIFY_MEDIA", "STATE_VERIFY_MEDIA must be defined");
const kbEn = getMainMenuKeyboard("english");
const kbStr = JSON.stringify(kbEn);
assert.ok(kbStr.includes("verify_media_prompt"), "Main menu must contain verify_media_prompt");
console.log("✓ Menu & Constants: PASS");

(async () => {
  // 3. Test C2PA detection
  const c2paRaw = Buffer.from(
    "PREFIX_DATA...jumb...c2pa...claim_generator Adobe Firefly v2.5...Adobe Inc....http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia...c2pa.created...c2pa.edited...SUFFIX"
  );
  const c2paRes = await verifyMediaBuffer(c2paRaw, { fileName: "adobe_test.jpg", isDocument: true });
  assert.strictEqual(c2paRes.success, true);
  assert.strictEqual(c2paRes.data.c2pa.hasC2PA, true);
  assert.strictEqual(c2paRes.data.verdict, "C2PA_VERIFIED_AI");
  assert.ok(c2paRes.report.includes("Adobe Firefly"), "Report must include Adobe Firefly");
  console.log("✓ C2PA Content Credentials Detection: PASS");

  // 4. Test Google SynthID detection
  const synthIdRaw = Buffer.from(
    "HEADER...Google SynthID watermark and google:genai detected...Google Imagen 3...Google LLC...FOOTER"
  );
  const synthRes = await verifyMediaBuffer(synthIdRaw, { fileName: "google_ai.png", isDocument: true });
  assert.strictEqual(synthRes.success, true);
  assert.strictEqual(synthRes.data.synthId.hasSynthID, true);
  assert.strictEqual(synthRes.data.verdict, "SYNTHID_VERIFIED_AI");
  assert.strictEqual(synthRes.data.synthId.model, "Google Imagen 3");
  assert.ok(synthRes.report.includes("Google SynthID"), "Report must include Google SynthID");
  console.log("✓ Google SynthID Detection: PASS");

  // 5. Test Third-party AI (e.g. Midjourney prompt/software)
  const mjRaw = Buffer.from(
    "HEADER...Software: Midjourney v6.0 prompt: cinematic portrait of cybernetic eagle...FOOTER"
  );
  const mjRes = await verifyMediaBuffer(mjRaw, { fileName: "mj.png", isDocument: true });
  assert.strictEqual(mjRes.success, true);
  assert.strictEqual(mjRes.data.verdict, "METADATA_AI_DETECTED");
  assert.strictEqual(mjRes.data.metadata.detectedAITool, "Midjourney");
  console.log("✓ Metadata AI Tool Signature Detection: PASS");

  // 6. Test Inconclusive Plain File
  const plainRaw = Buffer.from("just standard image bytes without metadata");
  const plainRes = await verifyMediaBuffer(plainRaw, { fileName: "plain.jpg", isDocument: false });
  assert.strictEqual(plainRes.success, true);
  assert.strictEqual(plainRes.data.verdict, "INCONCLUSIVE_NO_SIGNALS");
  assert.ok(plainRes.report.includes("Disclaimer:"), "Report must include standard disclaimer");
  console.log("✓ Inconclusive & Disclaimer Fallback: PASS");

  // 7. Test Oversized File
  const hugeBuf = Buffer.alloc(21 * 1024 * 1024);
  const overRes = await verifyMediaBuffer(hugeBuf, { fileName: "huge.jpg" });
  assert.strictEqual(overRes.success, false);
  assert.strictEqual(overRes.error, "OVERSIZED_FILE");
  console.log("✓ Oversized File Protection: PASS");

  // 8. Test Oromo Localization
  const omReport = await verifyMediaBuffer(synthIdRaw, { fileName: "oromo_test.png", lang: "oromo" });
  assert.ok(omReport.report.includes("MIIDIYAA AI'N UUMAME"), "Oromo report must contain localized title");
  assert.ok(omReport.report.includes("Hubachiisa Seeraa:"), "Oromo report must contain localized disclaimer");
  console.log("✓ Afaan Oromoo Localization: PASS");

  console.log("\n==============================================");
  console.log("🎉 ALL MEDIA VERIFICATION TESTS PASSED!");
  console.log("==============================================");
  process.exit(0);
})().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
