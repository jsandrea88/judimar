const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const qs = require("qs");

const BASE_URL =
  "https://catalogo.fiereparma.it/manifestazione/tuttofood-2025/";
const COOKIE = "PHPSESSID=5151aa220862007fc982ff58aa353060"; // Replace if needed
const OUTPUT_FILE = "./all_companies_with_stands.json";

let baseDelay = 1500;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageHtml(page, maxRetries = 5) {
  const data = qs.stringify({ "search[paged]": String(page) });

  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: BASE_URL,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: COOKIE,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: BASE_URL,
    },
    data,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.request(config);
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = status === 429 || status >= 500;

      console.warn(
        `⚠️ Error on page ${page}, attempt ${attempt}/${maxRetries}: ${err.message}`
      );

      if (attempt < maxRetries && isRetryable) {
        const retryDelay =
          baseDelay * attempt + Math.floor(Math.random() * 500);
        console.warn(`⏳ Retrying after ${retryDelay} ms...`);
        await delay(retryDelay);
      } else {
        console.error(
          `❌ Failed to fetch page ${page} after ${maxRetries} attempts.`
        );
        return null;
      }
    }
  }
}

function parseCompaniesFromHtml(html) {
  const $ = cheerio.load(html);
  const result = [];

  const test = $("section:nth-of-type(2) > div:nth-of-type(2)");

  console.log("test:", test);

  const containers = $(
    "section:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div"
  );

  containers.each((_, el) => {
    const container = $(el);
    const fullText = container.find("div").first().text().trim();
    const standText = container.find("small").first().text().trim();

    if (fullText && standText && fullText.includes(standText)) {
      const company = fullText.replace(standText, "").trim();
      result.push({ company, stand: standText });
    }
  });

  return result;
}

async function scrapeAllPages(maxPages = 1) {
  const allResults = [];

  for (let page = 1; page <= maxPages; page++) {
    console.log(`🔄 Fetching page ${page}...`);
    const html = await fetchPageHtml(page);
    if (!html) break;

    const parsed = parseCompaniesFromHtml(html);
    if (parsed.length === 0) {
      console.log("✅ No more companies found. Stopping.");
      break;
    }

    allResults.push(...parsed);

    console.log(`✅ Page ${page} fetched with ${parsed.length} companies.`);
    await delay(baseDelay);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2));
  console.log(
    `🎉 Scraped ${allResults.length} companies. Saved to ${OUTPUT_FILE}`
  );
}

scrapeAllPages();
