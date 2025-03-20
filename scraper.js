import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import readline from 'readline';
import XLSX from 'xlsx';

puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GoogleMapsPuppeteerScraper {
  constructor(headless = false) {
    this.headless = headless;
  }

  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: [
          '--window-size=1920,1080',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/118.0.0.0 Safari/537.36"
      );
      console.log("Browser launched.");
    } catch (err) {
      console.error("Init error:", err);
      throw err;
    }
  }

  async _scrollResults(scrollCount = 3) {
    const feedSelector = "div[role='feed']";
    for (let i = 0; i < scrollCount; i++) {
      try {
        const feed = await this.page.$(feedSelector);
        if (feed) {
          await this.page.evaluate(el => el.scrollTop = el.scrollHeight, feed);
        } else {
          await this.page.evaluate(() => window.scrollBy(0, 300));
        }
        await sleep(2000 + Math.random() * 1000);
      } catch (err) {
        console.error(`Scroll error ${i + 1}:`, err);
      }
    }
  }

  async _extractBusinessDetails(link) {
    const detailPage = await this.browser.newPage();
    const details = {};
    try {
      await detailPage.goto(link, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(3000 + Math.random() * 1000);
      try {
        const nameEl = await detailPage.$("h1");
        if (nameEl) details.name = (await detailPage.evaluate(el => el.innerText, nameEl)).trim();
      } catch (err) { console.error("Name error:", err); }
      try {
        const categorySelectors = ["button[jsaction*='category']", "span.DkEaL"];
        for (const sel of categorySelectors) {
          const catEl = await detailPage.$(sel);
          if (catEl) {
            details.category = (await detailPage.evaluate(el => el.innerText, catEl)).trim();
            break;
          }
        }
      } catch (err) { console.error("Category error:", err); }
      try {
        const ratingEl = await detailPage.$("div.jANrlb > div.fontDisplayLarge");
        if (ratingEl) details.rating = (await detailPage.evaluate(el => el.innerText, ratingEl)).trim();
      } catch (err) { console.error("Rating error:", err); }
      try {
        const phoneSelectors = ["button[data-item-id^='phone']", "a[href^='tel:']"];
        for (const sel of phoneSelectors) {
          const phoneEl = await detailPage.$(sel);
          if (phoneEl) {
            let phoneText = await detailPage.evaluate(el => el.innerText, phoneEl);
            if (!phoneText) {
              phoneText = await detailPage.evaluate(el => el.getAttribute('href'), phoneEl);
              if (phoneText && phoneText.startsWith("tel:")) phoneText = phoneText.replace("tel:", "");
            }
            if (phoneText) { details.phone = phoneText.trim(); break; }
          }
        }
      } catch (err) { console.error("Phone error:", err); }
      try {
        const websiteSelectors = [
          "a[data-item-id^='authority']",
          "[data-tooltip='Open website']",
          "a[aria-label*='site']"
        ];
        for (const sel of websiteSelectors) {
          const siteEl = await detailPage.$(sel);
          if (siteEl) { details.website = (await detailPage.evaluate(el => el.innerText, siteEl)).trim(); break; }
        }
      } catch (err) { console.error("Website error:", err); }
      try {
        const addressSelectors = ["button[data-item-id^='address']", "[aria-label*='address']"];
        for (const sel of addressSelectors) {
          const addrEl = await detailPage.$(sel);
          if (addrEl) { details.address = (await detailPage.evaluate(el => el.innerText, addrEl)).trim(); break; }
        }
      } catch (err) { console.error("Address error:", err); }
      try {
        const emailEl = await detailPage.$("a[href^='mailto:']");
        if (emailEl) {
          let email = await detailPage.evaluate(el => el.getAttribute('href'), emailEl);
          if (email) {
            email = email.replace("mailto:", "").trim();
            details.email = email;
          }
        } else {
          const pageContent = await detailPage.content();
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
          const match = pageContent.match(emailRegex);
          details.email = match ? match[0].trim() : "N/A";
        }
      } catch (err) { console.error("Email error:", err); }
      console.log("Details:", details);
    } catch (error) {
      console.error("Detail page error:", error);
    } finally {
      await detailPage.close();
    }
    return details;
  }

  async searchBusinesses(query, region, maxResults = 0) {
    const results = [];
    try {
      const searchTerm = `${query} ${region}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(5000 + Math.random() * 2000);
      await this._scrollResults();
      const links = await this.page.$$eval("a.hfpxzc", els => els.map(el => el.href));
      for (const link of links) {
        if (maxResults > 0 && results.length >= maxResults) break;
        const data = await this._extractBusinessDetails(link);
        if (Object.keys(data).length > 0) {
          results.push(data);
          console.log(`Collected: ${data.name || "No Name"}`);
        }
        await sleep(1000 + Math.random() * 1000);
      }
    } catch (err) {
      console.error("Search error:", err);
    }
    return results;
  }

  exportToCsv(businesses, filename = 'results.csv') {
    if (!businesses || businesses.length === 0) return false;
    try {
      const order = ["name", "category", "rating", "phone", "website", "address", "email"];
      let csvContent = order.join(",") + "\n";
      businesses.forEach(biz => {
        const row = order.map(key => `"${(biz[key] || "").replace(/"/g, '""')}"`).join(",");
        csvContent += row + "\n";
      });
      fs.writeFileSync(filename, csvContent, { encoding: "utf-8" });
      console.log(`CSV saved to "${filename}".`);
      return true;
    } catch (err) {
      console.error("CSV export error:", err);
      return false;
    }
  }

  exportToXlsx(businesses, filename = 'results.xlsx') {
    if (!businesses || businesses.length === 0) return false;
    try {
      const order = ["name", "category", "rating", "phone", "website", "address", "email"];
      const dataOrdered = businesses.map(biz => {
        const ordered = {};
        order.forEach(key => ordered[key] = biz[key] || "");
        return ordered;
      });
      const worksheet = XLSX.utils.json_to_sheet(dataOrdered);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
      XLSX.writeFile(workbook, filename);
      console.log(`Excel saved to "${filename}".`);
      return true;
    } catch (err) {
      console.error("Excel export error:", err);
      return false;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed.");
    }
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = question => new Promise(resolve => rl.question(question, answer => resolve(answer)));

  const niche = await ask("Enter the business niche (category) to search for: ");
  const region = await ask("Enter the region: ");
  const qtdStr = await ask("How many companies do you want to collect? (0 for no limit): ");
  let maxResults = parseInt(qtdStr);
  if (isNaN(maxResults)) maxResults = 0;
  rl.close();

  const outputDir = "Output";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log("Created 'Output' folder.");
  }

  const scraper = new GoogleMapsPuppeteerScraper(false);
  await scraper.init();
  const results = await scraper.searchBusinesses(niche, region, maxResults);
  scraper.exportToCsv(results, `${outputDir}/results.csv`);
  scraper.exportToXlsx(results, `${outputDir}/results.xlsx`);
  await scraper.close();
}

main();
