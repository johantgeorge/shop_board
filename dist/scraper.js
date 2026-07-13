function parsePriceCandidate(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d{1,2})?/);
  return match ? Number(match[0]) : null;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = cleanText(element?.textContent || "");
    if (text) {
      return text;
    }
  }

  return "";
}

function firstAttr(selectors, attribute) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = cleanText(element?.getAttribute(attribute) || "");
    if (value) {
      return value;
    }
  }

  return "";
}

function isAmazonDomain() {
  return /(^|\.)amazon\./i.test(window.location.hostname);
}

function isWalmartDomain() {
  return /(^|\.)walmart\./i.test(window.location.hostname);
}

function parseAmazonSplitPrice(rootSelector) {
  const root = document.querySelector(rootSelector);
  if (!root) {
    return null;
  }

  const whole = cleanText(root.querySelector(".a-price-whole")?.textContent || "");
  const fraction = cleanText(root.querySelector(".a-price-fraction")?.textContent || "");
  if (!whole) {
    return null;
  }

  const parsed = parsePriceCandidate(`${whole}.${fraction || "00"}`);
  // console.log("[ShopBoard][Amazon] split price candidate", {
  //   rootSelector,
  //   whole,
  //   fraction,
  //   parsed
  // });
  return parsed;
}

function parseAmazonPrice() {
  const directPriceText =
    firstText([
      "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
      "#corePrice_feature_div .a-price .a-offscreen",
      "#apex_desktop .a-price .a-offscreen",
      "#corePrice_desktop .a-price .a-offscreen",
      ".a-price.aok-align-center .a-offscreen",
      ".a-price .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      "#priceblock_saleprice",
      "#price_inside_buybox"
    ]) || firstAttr(["meta[name='twitter:data1']"], "content");

  const directPrice = parsePriceCandidate(directPriceText);
  // console.log("[ShopBoard][Amazon] direct price lookup", {
  //   directPriceText,
  //   directPrice
  // });

  if (directPrice !== null) {
    return directPrice;
  }

  // Fall back to Amazon's split whole/fraction markup when no offscreen value is present.
  const splitPrice =
    parseAmazonSplitPrice("#corePriceDisplay_desktop_feature_div .a-price") ??
    parseAmazonSplitPrice("#corePrice_feature_div .a-price") ??
    parseAmazonSplitPrice("#apex_desktop .a-price") ??
    parseAmazonSplitPrice(".a-price");

  // console.log("[ShopBoard][Amazon] split price fallback result", { splitPrice });
  return splitPrice;
}

function parseAmazonProduct() {
  if (!isAmazonDomain()) {
    return null;
  }

  // console.log("[ShopBoard][Amazon] amazon domain detected", {
  //   hostname: window.location.hostname,
  //   url: window.location.href
  // });

  const title = firstText([
    "#productTitle",
    "#title",
    "h1.a-size-large",
    "h1 span"
  ]);

  const price = parseAmazonPrice();
  const canonicalUrl = firstAttr(["link[rel='canonical']"], "href");

  if (!title && price === null) {
    // console.warn("[ShopBoard][Amazon] no amazon title or price found");
    return null;
  }

  // console.log("[ShopBoard][Amazon] amazon scraper result", {
  //   title,
  //   price,
  //   canonicalUrl
  // });

  return {
    title,
    price: price ?? 0,
    url: canonicalUrl || window.location.href,
    store: window.location.hostname,
    source: "dom"
  };
}

function parseWalmartPrice() {
  const directPrice = parsePriceCandidate(
    firstText([
      '[itemprop="price"]',
      '[data-testid="price-wrap"] [aria-hidden="true"]',
      '[data-testid="product-price"] [aria-hidden="true"]',
      '[data-automation-id="product-price"] [aria-hidden="true"]',
      '[class*="price-characteristic"]',
      '[class*="prod-PriceSection"] [aria-hidden="true"]'
    ]) ||
      firstAttr(
        [
          'meta[property="product:price:amount"]',
          'meta[name="price"]',
          'meta[itemprop="price"]'
        ],
        "content"
      )
  );

  if (directPrice !== null) {
    return directPrice;
  }

  const whole =
    firstAttr(['[itemprop="price"]'], "content") ||
    firstAttr(['[class*="price-characteristic"]'], "content") ||
    cleanText(document.querySelector('[class*="price-characteristic"]')?.textContent || "");
  const fraction =
    firstAttr(['[class*="price-mantissa"]'], "content") ||
    cleanText(document.querySelector('[class*="price-mantissa"]')?.textContent || "");

  if (!whole) {
    return null;
  }

  return parsePriceCandidate(`${whole}.${fraction || "00"}`);
}

function parseWalmartProduct() {
  if (!isWalmartDomain()) {
    return null;
  }

  const title = firstText([
    'h1[itemprop="name"]',
    '[data-automation-id="product-title"]',
    '[data-testid="product-title"]',
    "main h1",
    "h1"
  ]);

  const price = parseWalmartPrice();
  const canonicalUrl = firstAttr(["link[rel='canonical']"], "href");

  if (!title && price === null) {
    return null;
  }

  return {
    title,
    price: price ?? 0,
    url: canonicalUrl || window.location.href,
    store: window.location.hostname,
    source: "dom"
  };
}

function parseJsonLdProduct() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || "null");
      const candidates = Array.isArray(data) ? data : [data, ...(Array.isArray(data?.["@graph"]) ? data["@graph"] : [])];

      for (const candidate of candidates) {
        const type = candidate?.["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (!types.includes("Product")) {
          continue;
        }

        const price = parsePriceCandidate(candidate?.offers?.price || candidate?.offers?.lowPrice || candidate?.price);
        const url = cleanText(candidate?.url || window.location.href);
        const title = cleanText(candidate?.name || "");

        if (title || price !== null) {
          return {
            title,
            price: price ?? 0,
            url,
            store: window.location.hostname,
            source: "json-ld"
          };
        }
      }
    } catch {
      // Ignore malformed JSON-LD and continue down the fallback chain.
    }
  }

  return null;
}

function parseMetaProduct() {
  const title = firstAttr(
    ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]'],
    "content"
  );
  const price = parsePriceCandidate(
    firstAttr(
      [
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        'meta[name="price"]',
        'meta[itemprop="price"]'
      ],
      "content"
    )
  );

  if (!title && price === null) {
    return null;
  }

  return {
    title,
    price: price ?? 0,
    url: window.location.href,
    store: window.location.hostname,
    source: "meta"
  };
}

function parseDomProduct() {
  const title = firstText(["h1[itemprop='name']", "[data-testid='product-title']", "main h1", "h1"]);

  // Fallback through common price selectors before falling back to plain page title.
  const priceText = firstText([
    "[itemprop='price']",
    ".price",
    ".product-price",
    ".sale-price",
    "[data-testid='price']",
    "[class*='price']"
  ]);
  const price = parsePriceCandidate(priceText);

  if (!title && price === null) {
    return null;
  }

  return {
    title,
    price: price ?? 0,
    url: window.location.href,
    store: window.location.hostname,
    source: "dom"
  };
}

function parseFallbackProduct() {
  // Last resort: keep a minimally useful draft instead of leaving the form blank.
  return {
    title: cleanText(document.title),
    price: 0,
    url: window.location.href,
    store: window.location.hostname,
    source: "fallback"
  };
}

function scrapeProduct() {
  return parseAmazonProduct() || parseWalmartProduct() || parseJsonLdProduct() || parseMetaProduct() || parseDomProduct() || parseFallbackProduct();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SHOPBOARD_SCRAPE_PRODUCT") {
    return undefined;
  }

  sendResponse({ product: scrapeProduct() });
  return false;
});
