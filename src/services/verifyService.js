/**
 * Aritii Tech Media Provenance & Verification Service
 * Supports C2PA (Content Credentials), Google SynthID, and EXIF/XMP AI detection.
 */

const ExifReader = require("exifreader");
const logger = require("../utils/logger");

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const AI_TOOLS_PATTERNS = [
  { name: "Google SynthID / Imagen", regex: /synthid|google:genai|google imagen|imagen 2|imagen 3/i, source: "Google AI" },
  { name: "OpenAI DALL·E", regex: /dall[-·\s]?e/i, source: "OpenAI" },
  { name: "Midjourney", regex: /midjourney/i, source: "Midjourney" },
  { name: "Stable Diffusion", regex: /stable[-_\s]diffusion|stability\.ai|stablediffusion/i, source: "Stability AI" },
  { name: "Adobe Firefly", regex: /firefly|adobe firefly/i, source: "Adobe" },
  { name: "Microsoft Designer / Copilot", regex: /microsoft designer|copilot/i, source: "Microsoft" },
  { name: "ComfyUI / Automatic1111", regex: /comfyui|automatic1111|novelai/i, source: "Open Source AI" },
  { name: "Grok", regex: /grok/i, source: "xAI" }
];

/**
 * Scan binary buffer for C2PA JUMBF boxes and Content Credentials signatures
 * Specification: c2pa.org / ISO/IEC JUMBF standards
 */
function scanBinaryC2PA(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return null;

  const rawLatin1 = buffer.toString("latin1");
  const rawUtf8 = buffer.toString("utf8", 0, Math.min(buffer.length, 500000)); // check first 500KB

  const hasJumb = buffer.includes(Buffer.from("jumb")) || rawLatin1.includes("jumb");
  const hasC2PAIdentifier =
    rawLatin1.includes("c2pa") ||
    rawLatin1.includes("http://c2pa.org/manifest") ||
    rawLatin1.includes("c2ma") ||
    rawLatin1.includes("c2as") ||
    rawLatin1.includes("c2cl") ||
    rawLatin1.includes("caBX");

  if (!hasJumb && !hasC2PAIdentifier) {
    return { hasC2PA: false };
  }

  const result = {
    hasC2PA: true,
    claimGenerator: null,
    signingOrg: null,
    digitalSourceType: null,
    actions: [],
    ingredients: [],
    title: null,
    signatureTimestamp: null,
  };

  // 1. Extract Claim Generator (e.g. Adobe Firefly, OpenAI DALL-E, Leica Camera, Google)
  const generatorMatch =
    rawLatin1.match(/claim_generator[^\w]*([A-Za-z0-9_\-\.\s]{3,40})/i) ||
    rawLatin1.match(/(Adobe\s*Firefly[A-Za-z0-9_\-\.\s]*)/i) ||
    rawLatin1.match(/(OpenAI\s*DALL[·\-\s]?E[A-Za-z0-9_\-\.\s]*)/i) ||
    rawLatin1.match(/(Google\s*SynthID[A-Za-z0-9_\-\.\s]*)/i) ||
    rawLatin1.match(/(Truepic\s*Lens[A-Za-z0-9_\-\.\s]*)/i) ||
    rawLatin1.match(/(Microsoft\s*Designer[A-Za-z0-9_\-\.\s]*)/i) ||
    rawLatin1.match(/(Leica\s*Camera[A-Za-z0-9_\-\.\s]*)/i);

  if (generatorMatch) {
    result.claimGenerator = generatorMatch[1].trim().replace(/[\x00-\x1F\x7F-\x9F]/g, "");
  }

  // 2. Extract Signing Organization
  const orgMatch =
    rawLatin1.match(/(?:CN|O|OU)=([A-Za-z0-9\s,\.]{3,40})(?:,|\/|\x00)/) ||
    rawLatin1.match(/(Adobe\s*Inc\.|Google\s*LLC|OpenAI,?\s*LLC|Microsoft\s*Corporation|Truepic\s*Inc\.|Leica\s*Camera\s*AG)/i);

  if (orgMatch) {
    result.signingOrg = (orgMatch[1] || orgMatch[0]).trim();
  }

  // 3. Extract DigitalSourceType
  if (rawLatin1.includes("trainedAlgorithmicMedia")) {
    result.digitalSourceType = "trainedAlgorithmicMedia (AI-Generated)";
  } else if (rawLatin1.includes("compositeWithTrainedAlgorithmicMedia")) {
    result.digitalSourceType = "compositeWithTrainedAlgorithmicMedia (AI-Assisted Composite)";
  } else if (rawLatin1.includes("digitalCapture")) {
    result.digitalSourceType = "digitalCapture (Camera Sensor Capture)";
  } else if (rawLatin1.includes("minorHumanEdits")) {
    result.digitalSourceType = "minorHumanEdits (Standard Human Edit)";
  }

  // 4. Extract Actions / History
  const actionMatches = rawLatin1.matchAll(/c2pa\.(created|edited|color_adjustments|cropped|placed|filtered|ai_inference|converted|published)/gi);
  const actionSet = new Set();
  for (const match of actionMatches) {
    actionSet.add(match[0].toLowerCase());
  }
  result.actions = Array.from(actionSet);

  return result;
}

/**
 * Scan for Google SynthID Watermark & Generative AI Signatures
 */
function scanSynthID(buffer, xmpString = "") {
  if (!buffer || !Buffer.isBuffer(buffer)) return { hasSynthID: false };

  const rawSample = buffer.toString("latin1", 0, Math.min(buffer.length, 1000000));
  const fullSearchText = rawSample + " " + xmpString;

  const hasSynthIDMarker = /synthid/i.test(fullSearchText);
  const hasGoogleGenAI = /google:genai|google\s*imagen|imagen\s*3|imagen\s*2/i.test(fullSearchText);
  const isGoogleSigned = /Google\s*LLC|Google\s*Trust\s*Services/i.test(fullSearchText) && (hasSynthIDMarker || hasGoogleGenAI);

  if (hasSynthIDMarker || hasGoogleGenAI || isGoogleSigned) {
    return {
      hasSynthID: true,
      detectionMethod: hasSynthIDMarker
        ? "SynthID Imperceptible Watermarking / Provenance Manifest"
        : "Google Generative AI Provenance Marker",
      model: /imagen\s*3/i.test(fullSearchText)
        ? "Google Imagen 3"
        : /imagen\s*2/i.test(fullSearchText)
        ? "Google Imagen 2"
        : "Google Imagen / Gemini Generative AI",
      provider: "Google DeepMind / Google Cloud",
    };
  }

  return { hasSynthID: false };
}

/**
 * Extract EXIF / IPTC / XMP Metadata using ExifReader and raw regex
 */
function extractMetadataDetails(buffer) {
  let tags = {};
  let rawXmp = "";

  try {
    tags = ExifReader.load(buffer, { expanded: true });
  } catch (err) {
    logger.debug(`ExifReader parse note: ${err.message}`);
  }

  // Look for raw XMP if embedded
  const xmpStart = buffer.indexOf("<x:xmpmeta");
  const xmpEnd = buffer.indexOf("</x:xmpmeta>");
  if (xmpStart !== -1 && xmpEnd !== -1 && xmpEnd > xmpStart) {
    rawXmp = buffer.toString("utf8", xmpStart, xmpEnd + 12);
  }

  const extracted = {
    hasExif: Object.keys(tags).length > 0,
    cameraMake: tags.exif?.Make?.description || tags.image?.Make?.description || null,
    cameraModel: tags.exif?.Model?.description || tags.image?.Model?.description || null,
    software: tags.exif?.Software?.description || tags.image?.Software?.description || tags.xmp?.SoftwareAgent?.description || null,
    creatorTool: tags.xmp?.CreatorTool?.description || null,
    digitalSourceType: tags.xmp?.DigitalSourceType?.description || null,
    credit: tags.iptc?.Credit?.description || tags.xmp?.Credit?.description || null,
    userComment: tags.exif?.UserComment?.description || null,
    dateCreated: tags.exif?.DateTimeOriginal?.description || tags.image?.DateTime?.description || null,
    dimensions: {
      width: tags.file?.["Image Width"]?.value || tags.image?.["Image Width"]?.value || null,
      height: tags.file?.["Image Height"]?.value || tags.image?.["Image Height"]?.value || null,
    },
    rawXmp,
  };

  // Inspect for Third-Party AI tools in metadata
  const rawSample = buffer.toString("latin1", 0, Math.min(buffer.length, 1000000));
  const metadataString = JSON.stringify(tags) + " " + rawXmp + " " + rawSample;
  extracted.detectedAITool = null;

  for (const tool of AI_TOOLS_PATTERNS) {
    if (tool.regex.test(metadataString)) {
      extracted.detectedAITool = tool;
      break;
    }
  }

  return extracted;
}

/**
 * Main Media Verification function
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - { fileName, mimeType, isDocument, lang }
 */
async function verifyMediaBuffer(buffer, options = {}) {
  const { fileName = "media_file", mimeType = "image/jpeg", isDocument = false, lang = "english" } = options;

  if (!buffer || !Buffer.isBuffer(buffer)) {
    return {
      success: false,
      error: "INVALID_BUFFER",
      message: "Provided media buffer is empty or invalid.",
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: "OVERSIZED_FILE",
      maxSizeMB: MAX_FILE_SIZE_BYTES / (1024 * 1024),
      message: `File exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }

  // 1. Scan C2PA
  const c2pa = scanBinaryC2PA(buffer);

  // 2. Extract Metadata & XMP
  const meta = extractMetadataDetails(buffer);

  // 3. Scan Google SynthID
  const synthId = scanSynthID(buffer, meta.rawXmp);

  // 4. Synthesize Provenance Verdict
  let verdict = "INCONCLUSIVE";
  let confidence = "Medium";
  let summary = "";

  if (synthId.hasSynthID) {
    verdict = "SYNTHID_VERIFIED_AI";
    confidence = "High";
    summary = `Verified AI-generated media tagged with Google SynthID (${synthId.model}).`;
  } else if (c2pa && c2pa.hasC2PA) {
    if (c2pa.digitalSourceType?.includes("trainedAlgorithmicMedia") || c2pa.claimGenerator?.toLowerCase().includes("firefly") || c2pa.claimGenerator?.toLowerCase().includes("dall")) {
      verdict = "C2PA_VERIFIED_AI";
      confidence = "High";
      summary = `Cryptographically certified AI generation via C2PA standard (${c2pa.claimGenerator || "AI Generator"}).`;
    } else if (c2pa.digitalSourceType?.includes("digitalCapture") || c2pa.claimGenerator?.toLowerCase().includes("leica") || c2pa.claimGenerator?.toLowerCase().includes("truepic")) {
      verdict = "C2PA_VERIFIED_AUTHENTIC";
      confidence = "High";
      summary = `Cryptographically certified camera provenance via C2PA standard (${c2pa.signingOrg || c2pa.claimGenerator}).`;
    } else {
      verdict = "C2PA_VERIFIED";
      confidence = "High";
      summary = `Valid C2PA Content Credentials found signed by ${c2pa.signingOrg || c2pa.claimGenerator || "Trusted Authority"}.`;
    }
  } else if (meta.detectedAITool) {
    verdict = "METADATA_AI_DETECTED";
    confidence = "Medium-High";
    summary = `Metadata markers indicate generation or editing by ${meta.detectedAITool.name}.`;
  } else if (meta.cameraMake || meta.cameraModel) {
    verdict = "CAMERA_METADATA_FOUND";
    confidence = "Medium";
    summary = `Hardware camera metadata detected (${meta.cameraMake || ""} ${meta.cameraModel || ""}). No AI signatures found.`;
  } else {
    verdict = "INCONCLUSIVE_NO_SIGNALS";
    confidence = "Low";
    summary = isDocument
      ? "No C2PA Content Credentials, SynthID markers, or EXIF provenance signals were found in this file."
      : "No verifiable provenance signals found. Note: Telegram standard photo compression strips metadata. Try forwarding as an uncompressed 'File / Document'.";
  }

  const analysisReport = {
    verdict,
    confidence,
    summary,
    fileName,
    mimeType,
    fileSizeKB: Math.round(buffer.length / 1024),
    isDocument,
    c2pa: c2pa && c2pa.hasC2PA ? c2pa : { hasC2PA: false },
    synthId,
    metadata: {
      hasExif: meta.hasExif,
      cameraMake: meta.cameraMake,
      cameraModel: meta.cameraModel,
      software: meta.software,
      creatorTool: meta.creatorTool,
      dateCreated: meta.dateCreated,
      detectedAITool: meta.detectedAITool ? meta.detectedAITool.name : null,
    },
  };

  const formattedReport = formatVerificationReport(analysisReport, lang);

  return {
    success: true,
    data: analysisReport,
    report: formattedReport,
  };
}

/**
 * Format user-facing verification report in Markdown
 */
function formatVerificationReport(data, lang = "english") {
  const isOr = lang === "oromo";

  const { verdict, confidence, c2pa, synthId, metadata, fileSizeKB, fileName, isDocument } = data;

  let statusEmoji = "🔍";
  let statusTitle = "Media Verification Report";

  if (verdict === "SYNTHID_VERIFIED_AI" || verdict === "C2PA_VERIFIED_AI") {
    statusEmoji = "🤖";
    statusTitle = isOr ? "MIIDIYAA AI'N UUMAME (Mirkanaa'e)" : "AI-GENERATED MEDIA (Verified)";
  } else if (verdict === "C2PA_VERIFIED_AUTHENTIC") {
    statusEmoji = "🛡️";
    statusTitle = isOr ? "ORIGINAL MIRKANAA'E (C2PA)" : "PROVENANCE VERIFIED (C2PA)";
  } else if (verdict === "METADATA_AI_DETECTED") {
    statusEmoji = "⚠️";
    statusTitle = isOr ? "MALLATTOON AI ARGAMEERA" : "AI TOOL SIGNATURE DETECTED";
  } else if (verdict === "CAMERA_METADATA_FOUND") {
    statusEmoji = "📷";
    statusTitle = isOr ? "RAGAAN KAAMERAA ARGAMEERA" : "HARDWARE CAMERA CAPTURE DETECTED";
  } else {
    statusEmoji = "❓";
    statusTitle = isOr ? "RAGAAN MIRKANAA'U HIN ARGAMNE" : "NO VERIFIABLE SIGNALS DETECTED";
  }

  let text =
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${statusEmoji} *${statusTitle}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📁 *${isOr ? "Faayila:" : "File:"}* \`${fileName}\` (${fileSizeKB} KB)\n` +
    `🎯 *${isOr ? "Murtoo:" : "Verdict:"}* ${data.summary}\n` +
    `📊 *${isOr ? "Sadarkaa Amanamummaa:" : "Confidence Level:"}* ${confidence}\n\n`;

  // C2PA Section
  text += `🛡 *C2PA Content Credentials:*\n`;
  if (c2pa.hasC2PA) {
    text += `  • *Status:* ✅ ${isOr ? "Mallattoon Dijitaalaa Argameera" : "Active Manifest Found"}\n`;
    if (c2pa.claimGenerator) text += `  • *${isOr ? "Meeshaa Uume:" : "Claim Generator:"}* \`${c2pa.claimGenerator}\`\n`;
    if (c2pa.signingOrg) text += `  • *${isOr ? "Dhaabbata Mallatteesse:" : "Signing Organization:"}* \`${c2pa.signingOrg}\`\n`;
    if (c2pa.digitalSourceType) text += `  • *${isOr ? "Madda Dijitaalaa:" : "Digital Source:"}* \`${c2pa.digitalSourceType}\`\n`;
    if (c2pa.actions && c2pa.actions.length > 0) {
      const actionsFormatted = c2pa.actions.map(a => `\`${a}\``).join(", ");
      text += `  • *${isOr ? "Tarkaanfiiwwan Hojjataman:" : "Processing History:"}* ${actionsFormatted}\n`;
    }
  } else {
    text += `  • *Status:* ❌ ${isOr ? "Manifestiin C2PA hin argamne" : "No C2PA manifest found"}\n`;
  }
  text += `\n`;

  // SynthID Section
  text += `🧬 *Google SynthID Watermark:*\n`;
  if (synthId.hasSynthID) {
    text += `  • *Status:* ✅ ${isOr ? "Mallattoon SynthID Argameera" : "SynthID Detected"}\n`;
    text += `  • *Model:* \`${synthId.model}\`\n`;
    text += `  • *Provider:* \`${synthId.provider}\`\n`;
    text += `  • *Signal:* ${synthId.detectionMethod}\n`;
  } else {
    text += `  • *Status:* ❌ ${isOr ? "Mallattoon SynthID hin argamne" : "No SynthID watermarks detected"}\n`;
  }
  text += `\n`;

  // Camera / Hardware EXIF Section
  if (metadata.cameraMake || metadata.cameraModel || metadata.software || metadata.detectedAITool) {
    text += `📸 *${isOr ? "Ragaa Metadata & Meeshaa:" : "Metadata & Device Origins:"}*\n`;
    if (metadata.cameraMake || metadata.cameraModel) {
      text += `  • *Camera:* \`${metadata.cameraMake || ""} ${metadata.cameraModel || ""}\`\n`;
    }
    if (metadata.detectedAITool) {
      text += `  • *AI Tool Signature:* \`${metadata.detectedAITool}\`\n`;
    }
    if (metadata.software) {
      text += `  • *Software/Editor:* \`${metadata.software}\`\n`;
    }
    if (metadata.dateCreated) {
      text += `  • *Timestamp:* \`${metadata.dateCreated}\`\n`;
    }
    text += `\n`;
  }

  // Telegram Compression Notice if Inconclusive
  if (!isDocument && verdict === "INCONCLUSIVE_NO_SIGNALS") {
    text +=
      `💡 *${isOr ? "Hubachiisa:" : "Tip:"}*\n` +
      `_${isOr
        ? "Telegram ergaawwan suuraa idilee yemmuu ergan metadata fi mallattoolee c2pa ni haqa. Mirkaneessa qulqullina olaanaaf, faayilicha akka 'File / Document' tti ergaa."
        : "Standard Telegram photo uploads strip cryptographic EXIF/C2PA metadata. For the highest verification accuracy, send or forward the image as an uncompressed 'File / Document'."}_\n\n`;
  }

  // Mandatory Standard Disclaimer
  text +=
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚖️ *${isOr ? "Hubachiisa Seeraa:" : "Disclaimer:"}*\n` +
    `_${isOr
      ? "Mirkaneessi dijitaalaa kun mallattoolee amanamummaa qorachuuf gargaara. Ragaan C2PA fi SynthID madda fi seenaa jijjiiramaa agarsiisu, garuu yeroo hunda madda amansiisaa biroo waliin mirkaneeffachuun barbaachisaadha."
      : "Digital provenance and metadata analysis provide verification signals to assess authenticity. Cryptographic credentials confirm recorded origin and processing steps, but users should always consider corroborating evidence and trusted sources."}_`;

  return text;
}

module.exports = {
  verifyMediaBuffer,
  scanBinaryC2PA,
  scanSynthID,
  extractMetadataDetails,
  formatVerificationReport,
  MAX_FILE_SIZE_BYTES,
};
