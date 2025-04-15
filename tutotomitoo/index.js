const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://catalogo.fiereparma.it/manifestazione/tuttofood-2025";
const DATA_FILE = "./extracted_urls.json";
const OUTPUT_FILE = "./scraped_results.json";

let delayMs = 4000;
delayMs = delayMs * 5 + Math.floor(Math.random() * 500);
// Initial delay: 2s
let successStreak = 0; // To reduce delay after successful runs

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:109.0) Gecko/20100101 Firefox/117.0",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchWithRetry(url, retries = 10) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const headers = {
      "User-Agent": getRandomUserAgent(),
    };

    try {
      const response = await axios.get(url, { headers });
      successStreak++;
      if (successStreak >= 5 && delayMs > 20000) {
        delayMs = Math.max(20000, delayMs - 1000);
        console.log(`⏬ Delay decreased to ${delayMs} ms`);
        successStreak = 0;
      }
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      console.warn(`⚠️ Attempt ${attempt} failed for ${url}: ${err.message}`);

      if (status === 429) {
        delayMs += 1000;
        successStreak = 0;
        console.warn(`🚧 429 received. Increasing delay to ${delayMs} ms`);
      }

      if (attempt <= retries) await delay(delayMs);
      else throw err;
    }
  }
}

async function scrape() {
  const rawData = fs.readFileSync(DATA_FILE);
  const { urls } = JSON.parse(rawData);

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const relativeUrl = urls[i];
    const fullUrl = `${BASE_URL}${relativeUrl}`;

    try {
      const html = await fetchWithRetry(fullUrl);
      const $ = cheerio.load(html);

      const name = $("body > div.container > section.content-header > h1").text().trim();
      const subtitle = $("body > div.container > section.content-header > h3").text().trim();

      results.push({ url: relativeUrl, name, subtitle });
      console.log(`✅ [${i + 1}/${urls.length}] Processed: ${relativeUrl}`);
    } catch (err) {
      console.error(`❌ [${i + 1}/${urls.length}] Failed after retries: ${relativeUrl}`);
    }

    await delay(delayMs);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n🎉 Scraping completed. Results saved to ${OUTPUT_FILE}`);
}

scrape();
