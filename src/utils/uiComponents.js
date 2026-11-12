const logger = require("./logger");
const { getActiveServices, getAllCategories, getServicesByCategory } = require("../services/serviceCatalogService");
const { getActiveProducts, getProductById } = require("../services/productCatalogService");
const { getActivePortfolio } = require("../services/portfolioService");
const {
  getConfig,
  getWelcomeMessage,
  getSocialLinks,
  getChannelLinks,
  getMenuVisibility,
} = require("../services/businessConfigService");

function getWelcomeText(lang = "english", firstName = "Valued Client") {
  const config = getConfig();
  const c = config.company || {};
  const brandName = c.name || "Ariiti Tech";
  const normalizedLang = (lang || "english").toLowerCase();

  const customMsg = getWelcomeMessage(normalizedLang);
  if (customMsg) {
    return customMsg.replace(/Valued Client/g, firstName);
  }

  if (normalizedLang === "oromo" || normalizedLang === "om") {
    return (
      `🌟 *BAGA GARA ${brandName.toUpperCase()} NAGAYAN DHUFTAN*\n` +
      `_${c.positioning || "Hiriyaa Teeknoolojii Daldalaa fi Furmaata Dijitaalaa"}_\n\n` +
      `Baga nagaan dhuftan, *${firstName}*! _"${c.brandMessage || "Daldala fooyya'aaf furmaata dijitaalaa ijaarra."}"_\n\n` +
      `${c.description || "Ariiti Tech misoonsa software, oomishaalee dijitaalaa, e-commerce, fi sirnaalee automation daldalaa dhiheessa."}\n\n` +
      `💡 *Har'a maal ilaaluu barbaaddu?* Qabduuwwan armaan gadii fayyadamaa:`
    );
  }

  if (normalizedLang === "amharic" || normalizedLang === "am") {
    return (
      `🌟 *ወደ ${brandName.toUpperCase()} እንኳን በደህና መጡ*\n` +
      `_${c.positioning || "የቢዝነስ ቴክኖሎጂ አጋር እና የዲጂታል መፍትሄዎች አቅራቢ"}_\n\n` +
      `እንኳን ደህና መጡ፣ *${firstName}*! _"${c.brandMessage || "ለተሻለ ንግድ ዘመናዊ ዲጂታል መፍትሄዎችን መገንባት።"}"_\n\n` +
      `${c.description || "አሪቲ ቴክ የሶፍትዌር ልማት፣ የዲጂታል ምርቶች፣ የኢ-ኮሜርስ እና የቢዝነስ አውቶሜሽን ሲስተሞችን ያቀርባል።"}\n\n` +
      `💡 *ዛሬ ምን ማሰስ ይፈልጋሉ?* ከታች ያሉትን አማራጮች ይጠቀሙ፦`
    );
  }

  return (
    `🌟 *WELCOME TO ${brandName.toUpperCase()}*\n` +
    `_${c.positioning || "Business Technology Partner & Digital Solutions Provider"}_\n\n` +
    `Welcome, *${firstName}*! _"${c.brandMessage || "Building digital solutions for better businesses."}"_\n\n` +
    `${c.description || "Ariiti Tech provides software development, digital products, e-commerce solutions, and business automation systems to help businesses and individuals improve their operations through technology."}\n\n` +
    `💡 *How can we empower your business today?* Use the interactive menu below:`
  );
}

function getMainMenuKeyboard(lang = "english", isAdminUser = false) {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";
  const vis = getMenuVisibility();

  const labels = {
    services: isOr ? "💻 Tajaajila Keenya" : isAm ? "💻 አገልግሎቶቻችን" : "💻 Our Services",
    products: isOr ? "📦 Oomishaalee Keenya" : isAm ? "📦 ምርቶቻችን" : "📦 Our Products",
    portfolio: isOr ? "🚀 Poortfolioo Keenya" : isAm ? "🚀 የቀደሙ ስራዎች (Portfolio)" : "🚀 Our Portfolio",
    about: isOr ? "🏢 Waa'ee Ariiti Tech" : isAm ? "🏢 ስለ አሪቲ ቴክ" : "🏢 About Ariiti Tech",
    request_service: isOr ? "📝 Tajaajila Gaafadhu" : isAm ? "📝 አገልግሎት / ዋጋ ይጠይቁ" : "📝 Request a Service",
    contact: isOr ? "📞 Nu Quunnamaa" : isAm ? "📞 አግኙን (Contact Us)" : "📞 Contact Us",
    channels: isOr ? "📢 Chaanaloota Hordofaa" : isAm ? "📢 ቻናሎቻችንን ይከተሉ" : "📢 Follow Our Channels",
    languages: isOr ? "🌐 Qindaa'ina Afaanii" : isAm ? "🌐 የቋንቋ ቅንብሮች" : "🌐 Language Settings",
  };

  const rows = [];

  // Row 1: Services & Products
  const row1 = [];
  if (vis.services !== false) row1.push({ text: labels.services, callback_data: "view_services" });
  if (vis.products !== false) row1.push({ text: labels.products, callback_data: "view_products" });
  if (row1.length > 0) rows.push(row1);

  // Row 2: Portfolio & About
  const row2 = [];
  if (vis.portfolio !== false) row2.push({ text: labels.portfolio, callback_data: "view_portfolio" });
  if (vis.about !== false) row2.push({ text: labels.about, callback_data: "view_about" });
  if (row2.length > 0) rows.push(row2);

  // Row 3: Request a Service & Contact
  const row3 = [];
  if (vis.request_service !== false) row3.push({ text: labels.request_service, callback_data: "start_quote" });
  if (vis.contact !== false) row3.push({ text: labels.contact, callback_data: "view_contact" });
  if (row3.length > 0) rows.push(row3);

  // Row 4: Channels & Media Verification
  const row4 = [];
  row4.push({ text: isOr ? "🔍 Miidiyaa Mirkaneessi (C2PA)" : isAm ? "🔍 ሚዲያ አረጋግጥ (C2PA)" : "🔍 Verify Media (C2PA)", callback_data: "verify_media_prompt" });
  if (vis.channels !== false) row4.push({ text: labels.channels, callback_data: "view_channels" });
  if (row4.length > 0) rows.push(row4);

  // Row 5: Language Settings
  const row5 = [];
  if (vis.languages !== false) row5.push({ text: labels.languages, callback_data: "switch_lang" });
  if (row5.length > 0) rows.push(row5);

  // Optional Row 5: AI Media Verification (Preserved feature, configurable via menuVisibility)
  if (vis.verify_media === true) {
    rows.push([
      {
        text: isOr ? "🔍 Miidiyaa Mirkaneessi (C2PA)" : isAm ? "🔍 ሚዲያ አረጋግጥ (C2PA)" : "🔍 Verify Media (C2PA)",
        callback_data: "verify_media_prompt",
      },
    ]);
  }

  // Admin Control Panel (Only visible to verified Admins)
  if (isAdminUser) {
    rows.push([
      { text: "⚙️ Admin Control Panel", callback_data: "admin_nav_main" },
    ]);
  }

  return { inline_keyboard: rows };
}

// ----------------------------------------------------
// 1. SERVICES VIEW
// ----------------------------------------------------
function getServicesText(lang = "english", selectedCategory = null) {
  const config = getConfig();
  const c = config.company || {};
  const brandName = c.name || "Ariiti Tech";
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  const services = getActiveServices();
  if (!services || services.length === 0) {
    if (isOr) return `💻 *TAJAAJILOOTA ${brandName.toUpperCase()}*\n\n_Yeroo ammaa tajaajilli tarreeffame hin jiru. Maaloo tajaajila addaa qopheessuuf garee keenya quunnamaa._`;
    if (isAm) return `💻 *የ${brandName.toUpperCase()} አገልግሎቶች*\n\n_በአሁኑ ሰዓት የተዘረዘረ አገልግሎት የለም። ልዩ የሶፍትዌር ፍላጎት ካለዎት እባክዎ ቡድናችንን ያነጋግሩ።_`;
    return `💻 *${brandName.toUpperCase()} SERVICES*\n\n_No services are currently listed. Please contact our engineering team directly for custom solutions._`;
  }

  if (selectedCategory) {
    const filtered = services.filter((s) => s.category.toLowerCase() === selectedCategory.toLowerCase());
    if (filtered.length === 0) {
      if (isOr) return `💻 *${selectedCategory.toUpperCase()}*\n\n_Gosa kana keessatti tajaajilli dhihaate hin jiru._`;
      if (isAm) return `💻 *${selectedCategory.toUpperCase()}*\n\n_በዚህ ምድብ ውስጥ የተዘረዘረ አገልግሎት የለም።_`;
      return `💻 *${selectedCategory.toUpperCase()}*\n\n_No active services found in this category._`;
    }

    let text = `💻 *${selectedCategory.toUpperCase()} SERVICES*\n\n`;
    text += isOr
      ? `Tajaajila armaan gadii filachuun odeeffannoo dabalataa argadhaa ykn ajajaa:\n\n`
      : isAm
      ? `ከታች ካሉት አገልግሎቶች በመምረጥ ተጨማሪ መረጃ ያግኙ ወይም ያዝዙ፦\n\n`
      : `Explore our specialized solutions below or tap to request a build:\n\n`;

    for (const s of filtered) {
      text += `• *${s.name}*\n  _${s.description}_\n`;
      if (s.features && s.features.length > 0) {
        text += `  ✨ ${(s.features.slice(0, 3)).join(" • ")}\n`;
      }
      text += `  💰 From $${s.startingPrice} ${s.currency} | Est. ${s.estimatedDays} days\n\n`;
    }
    return text;
  }

  // General Categories Overview
  if (isOr) {
    return (
      `💻 *TAJAAJILOOTA ${brandName.toUpperCase()}*\n\n` +
      `Ariiti Tech gosa tajaajila 4 gurguddoo irratti fuulleffata:\n\n` +
      `1️⃣ *Software Development*\n` +
      `   Website, Web Apps, Mobile Apps, fi Sirnaalee Software addaa.\n\n` +
      `2️⃣ *E-commerce Solutions*\n` +
      `   Suuqii toora intarneetaa, Platformiiwwan Marketplace, fi Digital Commerce.\n\n` +
      `3️⃣ *Business Automation*\n` +
      `   Sirna POS, Hordoffii Qabeenyaa (Inventory), Kaffaltii fi Billing.\n\n` +
      `4️⃣ *Digital Innovation*\n` +
      `   Wal-qabsiisa Sirnaa (System Integrations), fi Furmaata Dijitaalaa Haaraa.\n\n` +
      `_Tajaajila bal'inaan ilaaluuf gosa armaan gadii filadhaa:_`
    );
  }

  if (isAm) {
    return (
      `💻 *የ${brandName.toUpperCase()} አገልግሎቶች*\n\n` +
      `አሪቲ ቴክ በ4 ዋና ዋና የቴክኖሎጂ ዘርፎች ላይ ያተኮረ አገልግሎት ይሰጣል፦\n\n` +
      `1️⃣ *Software Development (የሶፍትዌር ልማት)*\n` +
      `   ዘመናዊ ዌብሳይት፣ የዌብ መተግበሪያዎች፣ የሞባይል አፖች እና ብጁ የሶፍትዌር ሲስተሞች።\n\n` +
      `2️⃣ *E-commerce Solutions (የኢ-ኮሜርስ መፍትሄዎች)*\n` +
      `   የኦንላይን መደብሮች፣ የገበያ መድረኮች (Marketplaces) እና የዲጂታል ግብይት ሲስተሞች።\n\n` +
      `3️⃣ *Business Automation (የቢዝነስ አውቶሜሽን)*\n` +
      `   የPOS ሲስተሞች፣ የእቃ ክምችት ቁጥጥር (Inventory)፣ የክፍያ እና ቢሊንግ ሲስተሞች።\n\n` +
      `4️⃣ *Digital Innovation (ዲጂታል ፈጠራ)*\n` +
      `   የሲስተሞች ውህደት (System Integrations) እና ብጁ የዲጂታል መፍትሄዎች።\n\n` +
      `_ዝርዝር መረጃ ለማየት ከታች ያሉትን ምድቦች ይጫኑ፦_`
    );
  }

  return (
    `💻 *${brandName.toUpperCase()} SERVICES*\n\n` +
    `Ariiti Tech provides high-impact digital solutions organized across 4 key disciplines:\n\n` +
    `1️⃣ *Software Development*\n` +
    `   Website development, Web applications, Mobile apps, Custom software systems.\n\n` +
    `2️⃣ *E-commerce Solutions*\n` +
    `   Online stores, Marketplace platforms, Digital commerce solutions.\n\n` +
    `3️⃣ *Business Automation*\n` +
    `   POS systems, Inventory management, Billing and management systems, Process automation.\n\n` +
    `4️⃣ *Digital Innovation*\n` +
    `   System integrations, Digital transformation, Custom digital solutions.\n\n` +
    `_Select a category below to explore individual solutions, features, and pricing:_`
  );
}

function getServicesKeyboard(lang = "english", selectedCategory = null) {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  if (selectedCategory) {
    const services = getServicesByCategory(selectedCategory);
    const rows = [];
    for (const s of services) {
      rows.push([
        { text: `🔹 ${s.name} (From $${s.startingPrice})`, callback_data: `srv_view_${s.id}` },
      ]);
    }
    rows.push([
      { text: isOr ? "📝 Tajaajila Kana Ajaji" : isAm ? "📝 ይህን አገልግሎት ይጠይቁ" : "📝 Request This Service", callback_data: "start_quote" },
      { text: isOr ? "⬅️ Gosa Tajaajilaatti" : isAm ? "⬅️ ወደ ምድቦች ተመለስ" : "⬅️ Back to Categories", callback_data: "view_services" },
    ]);
    rows.push([
      { text: isOr ? "🏠 Fuula Duraa" : isAm ? "🏠 ዋና ማውጫ" : "🏠 Main Menu", callback_data: "main_menu" },
    ]);
    return { inline_keyboard: rows };
  }

  // Categories Selection Menu
  return {
    inline_keyboard: [
      [
        { text: "🖥 Software Development", callback_data: "srv_cat_software" },
        { text: "🛍 E-commerce Solutions", callback_data: "srv_cat_ecommerce" },
      ],
      [
        { text: "⚙️ Business Automation", callback_data: "srv_cat_automation" },
        { text: "💡 Digital Innovation", callback_data: "srv_cat_innovation" },
      ],
      [
        { text: isOr ? "📝 Tajaajila Gaafadhu" : isAm ? "📝 አገልግሎት / ዋጋ ይጠይቁ" : "📝 Request a Service", callback_data: "start_quote" },
        { text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

// ----------------------------------------------------
// 2. PRODUCTS VIEW
// ----------------------------------------------------
function getProductsText(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const brandName = c.name || "Ariiti Tech";
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  const products = getActiveProducts();
  if (!products || products.length === 0) {
    if (isOr) return `📦 *OOMISHAALEE ${brandName.toUpperCase()}*\n\n_Yeroo ammaa oomishni qophaa'e hin jiru. Pirojektii dhuunfaa qopheessuuf nu quunnamaa!_`;
    if (isAm) return `📦 *የ${brandName.toUpperCase()} ምርቶች*\n\n_በአሁኑ ሰዓት የተዘረዘረ ምርት የለም። ለተለየ የሶፍትዌር ፍላጎት ቡድናችንን ያነጋግሩ!_`;
    return `📦 *${brandName.toUpperCase()} DIGITAL PRODUCTS*\n\n_No ready-made products are currently listed. Please contact us to build a custom solution for your business!_`;
  }

  let text = isOr
    ? `📦 *OOMISHAALEE DIJITAALAA ${brandName.toUpperCase()}*\n\n` +
      `Oomishaalee qophaa'oo daldala keessan saffisiisan daawwadhaa:\n\n`
    : isAm
    ? `📦 *የ${brandName.toUpperCase()} ዝግጁ የዲጂታል ምርቶች*\n\n` +
      `ለንግድዎ ዝግጁ የሆኑ ዘመናዊ የዲጂታል ምርቶቻችንን ይመልከቱ፦\n\n`
    : `📦 *${brandName.toUpperCase()} DIGITAL PRODUCTS*\n\n` +
      `Explore our ready-to-deploy software products and platforms designed for immediate business impact:\n\n`;

  for (const p of products) {
    text += `🔹 *${p.name}* (${p.category})\n`;
    text += `   _${p.description}_\n`;
    if (p.features && p.features.length > 0) {
      text += `   ✨ ${(p.features.slice(0, 2)).join(" • ")}\n`;
    }
    text += `   🏷 *Pricing:* ${p.pricing}\n\n`;
  }

  text += isOr
    ? `_Demo daawwachuuf ykn oomisha bitachuuf qabduuwwan armaan gadii fayyadamaa:_`
    : isAm
    ? `_ምርቶቹን ለመሞከር ወይም ለመግዛት ከታች ያሉትን አማራጮች ይጠቀሙ፦_`
    : `_Select a product below for details, live demos, or order intake:_`;

  return text;
}

function getProductsKeyboard(lang = "english") {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  const products = getActiveProducts();
  const rows = [];

  for (const p of products) {
    rows.push([
      { text: `📦 ${p.name}`, callback_data: `prod_view_${p.id}` },
    ]);
  }

  rows.push([
    { text: isOr ? "📝 Oomisha / Tajaajila Ajaji" : isAm ? "📝 ምርት / አገልግሎት ይዘዙ" : "📝 Order a Product", callback_data: "start_quote" },
    { text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
  ]);

  return { inline_keyboard: rows };
}

// ----------------------------------------------------
// 3. PORTFOLIO VIEW
// ----------------------------------------------------
function getPortfolioText(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const brandName = c.name || "Ariiti Tech";
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  const portfolio = getActivePortfolio();
  if (!portfolio || portfolio.length === 0) {
    if (isOr) return `🚀 *POORTFOLIOO ${brandName.toUpperCase()}*\n\n_Poortfolioon keenya yeroo ammaa haaromfamaa jira. Fakkeenya hojii keenyaa ilaaluuf nu quunnamaa._`;
    if (isAm) return `🚀 *የ${brandName.toUpperCase()} የቀደሙ ስራዎች*\n\n_ፖርትፎሊዮአችን በአሁኑ ሰዓት በመታደስ ላይ ነው። የቀደሙ ስራዎቻችንን ናሙና ለመመልከት እባክዎ ያነጋግሩን።_`;
    return `🚀 *${brandName.toUpperCase()} PORTFOLIO & SHOWCASE*\n\n_Our portfolio is currently being updated with recent client deployments. Please contact us directly to explore custom project demos._`;
  }

  let text = isOr
    ? `🚀 *POORTFOLIOO FI HOJIILEEN ${brandName.toUpperCase()}*\n\n` +
      `Pirojektiiwwan fi sirnaalee dhiheenya kana milkaa'inaan ijaarru:\n\n`
    : isAm
    ? `🚀 *የ${brandName.toUpperCase()} የቀደሙ ስራዎች እና ውጤቶች*\n\n` +
      `በቅርቡ በተሳካ ሁኔታ የገነባናቸው ዘመናዊ ሲስተሞች እና ፕላትፎርሞች፦\n\n`
    : `🚀 *${brandName.toUpperCase()} PORTFOLIO & PROVEN WORK*\n\n` +
      `Explore our recent enterprise platforms, e-commerce engines, and business automation solutions:\n\n`;

  for (const item of portfolio) {
    text += `🌟 *${item.title}*\n`;
    text += `   📁 Category: _${item.category}_\n`;
    text += `   📝 ${item.description}\n`;
    text += `   🛠 Tech: \`${item.techStack}\`\n\n`;
  }

  text += isOr
    ? `_Demos kallattiin daawwachuuf hidhata armaan gadii fayyadamaa:_`
    : isAm
    ? `_የቀጥታ ማሳያዎችን ለመመልከት ከታች ያሉትን ሊንኮች ይጠቀሙ፦_`
    : `_Select showcase links below or request an estimate for your custom build:_`;

  return text;
}

function getPortfolioKeyboard(lang = "english") {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  return {
    inline_keyboard: [
      [
        { text: "🌐 Live Web Showcase", url: "https://myportfolio-1-01m7.onrender.com/" },
        { text: "💻 GitHub Repositories", url: "https://github.com/yihune1234" },
      ],
      [
        { text: isOr ? "📝 Gatii Gaafadhu" : isAm ? "📝 የዋጋ ግምት ይጠይቁ" : "📝 Request a Quote", callback_data: "start_quote" },
        { text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

// ----------------------------------------------------
// 4. ABOUT ARIITI TECH VIEW
// ----------------------------------------------------
function getAboutText(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const brandName = c.name || "Ariiti Tech";
  const legalName = c.legalName || "Ariiti Technologies PLC";
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  if (isOr) {
    const aboutOr = c.aboutOr || `*${legalName}* hiriyaa teeknoolojii daldalaa fi dhiheessaa furmaata dijitaalaati.`;
    return (
      `🏢 *WAA'EE ${brandName.toUpperCase()}*\n\n` +
      `📌 *Madda Daldalaa:* ${c.positioning || "Hiriyaa Teeknoolojii Daldalaa"}\n` +
      `💡 *Ergaa Brand:* _"${c.brandMessage || "Daldala fooyya'aaf furmaata dijitaalaa ijaarra."}"_\n\n` +
      `${aboutOr}\n\n` +
      `📍 *Bakka:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
      `⏰ *Sa'aatii Hojii:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n` +
      `🌐 *Website:* ${c.website || "https://ariiti.com"}\n\n` +
      `✨ *Fuulleffannoo Ijoo:* Software Development • E-commerce Solutions • Business Automation • Digital Innovation`
    );
  }

  if (isAm) {
    const aboutAm = c.aboutAm || `*${legalName}* አስተማማኝ የቢዝነስ ቴክኖሎጂ አጋር እና የዲጂታል መፍትሄዎች አቅራቢ ድርጅት ነው።`;
    return (
      `🏢 *ስለ ${brandName.toUpperCase()}*\n\n` +
      `📌 *የስራ ዘርፍ:* ${c.positioning || "የቢዝነስ ቴክኖሎጂ አጋር እና የዲጂታል መፍትሄዎች አቅራቢ"}\n` +
      `💡 *የኩባንያው መሪ ቃል:* _"${c.brandMessage || "ለተሻለ ንግድ ዘመናዊ ዲጂታል መፍትሄዎችን መገንባት።"}"_\n\n` +
      `${aboutAm}\n\n` +
      `📍 *ዋና መሥሪያ ቤት:* ${c.location || "አዲስ አበባ፣ ኢትዮጵያ"}\n` +
      `⏰ *የስራ ሰዓት:* ${c.operatingHours || "ሰኞ-አርብ ከጠዋቱ 2:30 - ከሰዓት 11:30"}\n` +
      `🌐 *ድህረ ገጽ:* ${c.website || "https://ariiti.com"}\n\n` +
      `✨ *ዋና ዋና የትኩረት መስኮች:* የሶፍትዌር ልማት • የኢ-ኮሜርስ መድረኮች • የቢዝነስ አውቶሜሽን • ዲጂታል ፈጠራ`
    );
  }

  const aboutEn = c.about || `*${legalName}* is a premier business technology partner and digital solutions provider.`;
  return (
    `🏢 *ABOUT ${brandName.toUpperCase()}*\n\n` +
    `📌 *Positioning:* ${c.positioning || "Business Technology Partner & Digital Solutions Provider"}\n` +
    `💡 *Brand Message:* _"${c.brandMessage || "Building digital solutions for better businesses."}"_\n\n` +
    `${aboutEn}\n\n` +
    `📍 *Headquarters:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
    `⏰ *Operating Hours:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n` +
    `🌐 *Website:* ${c.website || "https://ariiti.com"}\n\n` +
    `✨ *Core Solutions:* Software Development • E-commerce Solutions • Business Automation • Digital Innovation`
  );
}

function getAboutKeyboard(lang = "english") {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  return {
    inline_keyboard: [
      [
        { text: isOr ? "💻 Tajaajila Keenya" : isAm ? "💻 አገልግሎቶቻችን" : "💻 Our Services", callback_data: "view_services" },
        { text: isOr ? "📦 Oomishaalee Keenya" : isAm ? "📦 ምርቶቻችን" : "📦 Our Products", callback_data: "view_products" },
      ],
      [
        { text: isOr ? "📞 Nu Quunnamaa" : isAm ? "📞 አግኙን" : "📞 Contact Us", callback_data: "view_contact" },
        { text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

// ----------------------------------------------------
// 5. CONTACT US VIEW
// ----------------------------------------------------
function getContactText(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const brandName = c.name || "Ariiti Tech";
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  if (isOr) {
    return (
      `📞 *NU QUUNNAMAA — ${brandName.toUpperCase()}*\n\n` +
      `Pirojektii haaraa mari'achuuf ykn yaada qabdaniif bilisa ta'aatii nu quunnamaa:\n\n` +
      `📱 *Telegram:* ${c.telegramContact || c.telegram || "@Yihun2bel"}\n` +
      `✉️ *Email:* ${c.email || "contact@ariititech.com"}\n` +
      `📞 *Bilbila:* ${c.phone || "+251987414282"}\n` +
      `🌐 *Website:* ${c.website || "https://ariiti.com"}\n` +
      `📍 *Bakka:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
      `⏰ *Sa'aatii Hojii:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n\n` +
      `_Kallattiin Telegram irratti nuuf barreessaa ykn gatii tilmaamaa gaafadhaa:_`
    );
  }

  if (isAm) {
    return (
      `📞 *ያግኙን — ${brandName.toUpperCase()}*\n\n` +
      `ስለ አዲስ ፕሮጀክት ለመወያየት ወይም ማንኛውንም ጥያቄ ለመጠየቅ በማንኛውም ጊዜ ያግኙን፦\n\n` +
      `📱 *ቴሌግራም:* ${c.telegramContact || c.telegram || "@Yihun2bel"}\n` +
      `✉️ *ኢሜይል:* ${c.email || "contact@ariititech.com"}\n` +
      `📞 *ስልክ:* ${c.phone || "+251987414282"}\n` +
      `🌐 *ድህረ ገጽ:* ${c.website || "https://ariiti.com"}\n` +
      `📍 *አድራሻ:* ${c.location || "አዲስ አበባ፣ ኢትዮጵያ"}\n` +
      `⏰ *የስራ ሰዓት:* ${c.operatingHours || "ሰኞ-አርብ ከጠዋቱ 2:30 - ከሰዓት 11:30"}\n\n` +
      `_በቴሌግራም በቀጥታ መልእክት ይላኩ ወይም የፕሮጀክት ዋጋ ግምት ይጠይቁ፦_`
    );
  }

  return (
    `📞 *CONTACT US — ${brandName.toUpperCase()}*\n\n` +
    `Have a project or partnership in mind? Feel free to reach out to our team directly:\n\n` +
    `📱 *Telegram:* ${c.telegramContact || c.telegram || "@Yihun2bel"}\n` +
    `✉️ *Email:* ${c.email || "contact@ariititech.com"}\n` +
    `📞 *Phone:* ${c.phone || "+251987414282"}\n` +
    `🌐 *Website:* ${c.website || "https://ariiti.com"}\n` +
    `📍 *Headquarters:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
    `⏰ *Operating Hours:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n\n` +
    `_Message our engineering team directly or submit a project quotation request below:_`
  );
}

function getContactKeyboard(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";
  const tgHandle = (c.telegramContact || c.telegram || "@Yihun2bel").replace(/^@/, "");

  return {
    inline_keyboard: [
      [
        { text: `💬 Message on Telegram`, url: `https://t.me/${tgHandle}` },
        { text: "🌐 Visit Website", url: c.website || "https://ariiti.com" },
      ],
      [
        { text: isOr ? "📝 Tajaajila Gaafadhu" : isAm ? "📝 አገልግሎት / ዋጋ ይጠይቁ" : "📝 Request a Service", callback_data: "start_quote" },
        { text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

// ----------------------------------------------------
// 6. FOLLOW OUR CHANNELS VIEW
// ----------------------------------------------------
function getChannelsText(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const brandName = c.name || "Ariiti Tech";
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  if (isOr) {
    return (
      `📢 *CHAANALOOTA FI SOCIAL MEDIA ${brandName.toUpperCase()}*\n\n` +
      `Odeeffannoo teeknoolojii haaraa, pirojektiiwwan, fi fooyya'iinsa daldalaa argachuuf chaanaloota keenya hordofaa:\n\n` +
      `• Telegram Channels & Updates\n` +
      `• LinkedIn, GitHub, fi Media Platforms\n\n` +
      `_Hidhata armaan gadii filachuun nutti dabalamaa:_`
    );
  }

  if (isAm) {
    return (
      `📢 *የ${brandName.toUpperCase()} ይፋዊ ቻናሎች እና ማህበራዊ ሚዲያዎች*\n\n` +
      `አዳዲስ የቴክኖሎጂ ዜናዎች፣ የምርት ማሻሻያዎች እና የዲጂታል መፍትሄዎችን ለመከታተል ቻናሎቻችንን ይቀላቀሉ፦\n\n` +
      `• የቴሌግራም ቻናሎች እና ዜናዎች\n` +
      `• LinkedIn, GitHub እና ሌሎች መድረኮች\n\n` +
      `_ከታች ያሉትን ሊንኮች በመጠቀም ይቀላቀሉን፦_`
    );
  }

  return (
    `📢 *FOLLOW ARIITI TECH CHANNELS*\n\n` +
    `Stay connected with Ariiti Tech for our latest digital product releases, software insights, tech articles, and enterprise case studies:\n\n` +
    `• Official Telegram Announcements\n` +
    `• Software Repositories & Engineering Showcase\n` +
    `• Professional Social Networks\n\n` +
    `_Tap any channel below to join our community:_`
  );
}

function getChannelsKeyboard(lang = "english") {
  const channels = getChannelLinks();
  const socials = getSocialLinks();
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  const rows = [];

  for (const ch of channels) {
    rows.push([{ text: `${ch.icon || "📢"} ${ch.name}`, url: ch.url }]);
  }

  const socialRow = [];
  for (const s of socials) {
    socialRow.push({ text: `${s.icon || "🔗"} ${s.name}`, url: s.url });
    if (socialRow.length === 2) {
      rows.push([...socialRow]);
      socialRow.length = 0;
    }
  }
  if (socialRow.length > 0) rows.push(socialRow);

  rows.push([
    { text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
  ]);

  return { inline_keyboard: rows };
}

// ----------------------------------------------------
// 7. LANGUAGE SELECTION VIEW
// ----------------------------------------------------
function getLanguagesKeyboard(lang = "english") {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  return {
    inline_keyboard: [
      [
        { text: "English 🇺🇸", callback_data: "lang_switch_english" },
        { text: "Afaan Oromoo 🇪🇹", callback_data: "lang_switch_oromo" },
      ],
      [
        { text: "አማርኛ (Amharic) 🇪🇹", callback_data: "lang_switch_amharic" },
      ],
      [
        { text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

// ----------------------------------------------------
// 8. REQUEST A SERVICE / QUOTE WIZARD
// ----------------------------------------------------
function getQuoteWizardStep1Text(lang = "english") {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  if (isOr) {
    return (
      `📝 *Qajeelfama Gatii fi Tajaajila Ariiti Tech (Tarkaanfii 1/4)*\n\n` +
      `Gosa tajaajila software kam barbaaddu?\n` +
      `_(Software Development, E-commerce, Business Automation, Digital Innovation)_\n\n` +
      `Qabduuwwan armaan gadii filadhaa ykn kallattiin barreessaa:`
    );
  }

  if (isAm) {
    return (
      `📝 *የአሪቲ ቴክ የአገልግሎት እና የዋጋ መጠየቂያ (ደረጃ 1/4)*\n\n` +
      `ምን ዓይነት የቴክኖሎጂ አገልግሎት ይፈልጋሉ?\n` +
      `_(የሶፍትዌር ልማት፣ የኢ-ኮሜርስ መፍትሄዎች፣ የቢዝነስ አውቶሜሽን፣ ዲጂታል ፈጠራ)_\n\n` +
      `ከታች ካሉት አንዱን ይምረጡ ወይም በቀጥታ ይጻፉ፦`
    );
  }

  return (
    `📝 *Ariiti Tech Service & Quote Wizard (Step 1 of 4)*\n\n` +
    `What type of digital service or software solution do you need?\n` +
    `_(Software Development, E-commerce, Business Automation, Digital Innovation)_\n\n` +
    `Tap an option below or type your requirement:`
  );
}

function getQuoteWizardKeyboard(lang = "english") {
  const normalized = (lang || "english").toLowerCase();
  const isOr = normalized === "oromo" || normalized === "om";
  const isAm = normalized === "amharic" || normalized === "am";

  return {
    inline_keyboard: [
      [
        { text: "🖥 Software Development", callback_data: "quote_service_software" },
        { text: "🛍 E-commerce Solutions", callback_data: "quote_service_ecommerce" },
      ],
      [
        { text: "⚙️ Business Automation", callback_data: "quote_service_automation" },
        { text: "💡 Digital Innovation", callback_data: "quote_service_innovation" },
      ],
      [
        { text: isOr ? "❌ Dhiisi (Cancel)" : isAm ? "❌ ሰርዝ (Cancel)" : "❌ Cancel Request", callback_data: "quote_cancel" },
      ],
    ],
  };
}

// ----------------------------------------------------
// RESILIENT SAFE EDIT / SEND HELPER
// ----------------------------------------------------
async function safeEditOrSend(bot, chatId, messageId, text, replyMarkup, parseMode = "Markdown") {
  if (messageId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
      });
      return true;
    } catch (err) {
      if (err.message && err.message.includes("message is not modified")) {
        return true;
      }
      logger.debug(`editMessageText fallback without parse_mode: ${err.message}`);
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return true;
      } catch (_) {}
    }
  }

  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: parseMode,
      reply_markup: replyMarkup,
    });
    return true;
  } catch (err2) {
    logger.debug(`sendMessage Markdown failed: ${err2.message}. Retrying plain text.`);
    try {
      await bot.sendMessage(chatId, text, {
        reply_markup: replyMarkup,
      });
      return true;
    } catch (err3) {
      logger.error(`sendMessage failed in safeEditOrSend: ${err3.message}`);
      return false;
    }
  }
}

module.exports = {
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
  safeEditOrSend,
};
