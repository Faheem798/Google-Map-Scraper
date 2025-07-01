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
    this.maxRetries = 3;
  }

  async init() {
    try {
      // Updated Chrome path detection for different OS
      const executablePath = process.env.CHROME_PATH || this.getDefaultChromePath();
      
      const launchOptions = {
        headless: this.headless,
        executablePath, 
        args: [
          '--window-size=1920,1080',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage', // Added for stability
          '--no-first-run',
          '--disable-default-apps'
        ],
        timeout: 60000,
        ignoreDefaultArgs: ['--enable-automation'] // Hide automation flag
      };

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      
      // Enhanced stealth measures
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      
      // Remove webdriver property
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      // Set additional headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      });
      
      console.log("Browser launched with enhanced stealth measures.");
    } catch (err) {
      console.error("Init error:", err);
      throw err;
    }
  }

  getDefaultChromePath() {
    const platform = process.platform;
    switch (platform) {
      case 'win32':
        return "C:/Program Files/Google/Chrome/Application/chrome.exe";
      case 'darwin':
        return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      case 'linux':
        return "/usr/bin/google-chrome";
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async _scrollResults(scrollCount = 5) {
    console.log("Starting to scroll results...");
    
    // Updated selectors for 2025
    const feedSelectors = [
      "div[role='feed']",
      "div[role='main'] div[role='region']",
      ".m6QErb[data-value='Search results']"
    ];
    
    let feedElement = null;
    for (const selector of feedSelectors) {
      try {
        feedElement = await this.page.$(selector);
        if (feedElement) {
          console.log(`Found feed element with selector: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`Selector ${selector} not found, trying next...`);
      }
    }

    for (let i = 0; i < scrollCount; i++) {
      try {
        if (feedElement) {
          await this.page.evaluate(el => {
            el.scrollTop = el.scrollHeight;
          }, feedElement);
        } else {
          // Fallback to window scrolling
          await this.page.evaluate(() => {
            window.scrollBy(0, 1000);
          });
        }
        
        // Wait for new content to load
        await sleep(2000 + Math.random() * 1500);
        
        // Check if "Load more" button exists and click it
        try {
          const loadMoreBtn = await this.page.$('button[aria-label*="more"], button:contains("Show more")');
          if (loadMoreBtn) {
            await loadMoreBtn.click();
            await sleep(2000);
          }
        } catch (err) {
          // No load more button, continue
        }
        
        console.log(`Scroll ${i + 1}/${scrollCount} completed`);
      } catch (err) {
        console.error(`Scroll error ${i + 1}:`, err);
      }
    }
  }

  async _extractBusinessDetails(link) {
    let detailPage;
    const details = {};
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        detailPage = await this.browser.newPage();
        await detailPage.goto(link, { 
          waitUntil: "networkidle2", 
          timeout: 30000 
        });
        await sleep(2000 + Math.random() * 1000);
        
        // Extract business name - Updated selectors
        try {
          const nameSelectors = [
            "h1[data-attrid='title']",
            "h1.DUwDvf",
            "h1.x3AX1-LfntMc-header-title-title",
            "h1"
          ];
          
          for (const selector of nameSelectors) {
            const nameEl = await detailPage.$(selector);
            if (nameEl) {
              details.name = (await detailPage.evaluate(el => el.innerText, nameEl)).trim();
              break;
            }
          }
        } catch (err) { console.error("Name error:", err); }
        
        // Extract category - Updated selectors
        try {
          const categorySelectors = [
            "button[jsaction*='category']",
            "span.DkEaL",
            ".YhemCb",
            "[data-value='Open info']",
            ".x3AX1-LfntMc-header-title-sub-title"
          ];
          
          for (const sel of categorySelectors) {
            const catEl = await detailPage.$(sel);
            if (catEl) {
              const categoryText = (await detailPage.evaluate(el => el.innerText, catEl)).trim();
              if (categoryText && !categoryText.includes('directions') && !categoryText.includes('call')) {
                details.category = categoryText;
                break;
              }
            }
          }
        } catch (err) { console.error("Category error:", err); }
        
        // Extract rating - Updated selectors
        try {
          const ratingSelectors = [
            "div.jANrlb > div.fontDisplayLarge",
            "span.ceNzKf",
            "[data-value='Open reviews']",
            ".x3AX1-LfntMc-header-title-rating"
          ];
          
          for (const sel of ratingSelectors) {
            const ratingEl = await detailPage.$(sel);
            if (ratingEl) {
              const ratingText = (await detailPage.evaluate(el => el.innerText, ratingEl)).trim();
              if (ratingText && /^\d+\.?\d*$/.test(ratingText)) {
                details.rating = ratingText;
                break;
              }
            }
          }
        } catch (err) { console.error("Rating error:", err); }
        
        // Extract phone - Updated selectors
        try {
          const phoneSelectors = [
            "button[data-item-id^='phone']",
            "a[href^='tel:']",
            "[data-tooltip*='phone']",
            "button[aria-label*='phone']"
          ];
          
          for (const sel of phoneSelectors) {
            const phoneEl = await detailPage.$(sel);
            if (phoneEl) {
              let phoneText = await detailPage.evaluate(el => el.innerText || el.getAttribute('href'), phoneEl);
              if (phoneText) {
                if (phoneText.startsWith("tel:")) {
                  phoneText = phoneText.replace("tel:", "");
                }
                details.phone = phoneText.trim();
                break;
              }
            }
          }
        } catch (err) { console.error("Phone error:", err); }
        
        // Extract website - Updated selectors
        try {
          const websiteSelectors = [
            "a[data-item-id^='authority']",
            "[data-tooltip='Open website']",
            "a[aria-label*='website']",
            "a[href^='http']:not([href*='google']):not([href*='maps'])"
          ];
          
          for (const sel of websiteSelectors) {
            const siteEl = await detailPage.$(sel);
            if (siteEl) {
              const websiteText = await detailPage.evaluate(el => 
                el.innerText || el.getAttribute('href'), siteEl
              );
              if (websiteText && websiteText.startsWith('http')) {
                details.website = websiteText.trim();
                break;
              }
            }
          }
        } catch (err) { console.error("Website error:", err); }
        
        // Extract address - Updated selectors
        try {
          const addressSelectors = [
            "button[data-item-id^='address']",
            "[data-tooltip*='address']",
            "button[aria-label*='address']",
            ".x3AX1-LfntMc-header-title-address"
          ];
          
          for (const sel of addressSelectors) {
            const addrEl = await detailPage.$(sel);
            if (addrEl) {
              details.address = (await detailPage.evaluate(el => el.innerText, addrEl)).trim();
              break;
            }
          }
        } catch (err) { console.error("Address error:", err); }
        
        console.log("Details extracted:", details);
        break; // Success, exit retry loop
        
      } catch (error) {
        retryCount++;
        console.error(`Detail page error (attempt ${retryCount}):`, error.message);
        if (retryCount >= this.maxRetries) {
          console.error(`Failed to extract details after ${this.maxRetries} attempts`);
        } else {
          await sleep(2000 * retryCount); // Progressive delay
        }
      } finally {
        if (detailPage) {
          await detailPage.close();
        }
      }
    }
    
    return details;
  }

  async searchBusinesses(query, region, maxResults = 0) {
    const results = [];
    try {
      const searchTerm = `${query} ${region}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
      
      console.log(`Searching for: ${searchTerm}`);
      console.log(`URL: ${url}`);
      
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(5000 + Math.random() * 2000);
      
      // Wait for results to load
      await this.page.waitForSelector('div[role="feed"], .Nv2PK', { timeout: 30000 }).catch(() => {
        console.log("Feed selector not found, proceeding anyway...");
      });
      
      await this._scrollResults();
      
      // Updated business card selectors for 2025
      const linkSelectors = [
        "a.hfpxzc", // Original selector
        "a[data-cid]", // Alternative selector
        "div[role='article'] a", // Generic article link
        ".Nv2PK a" // Updated selector
      ];
      
      let links = [];
      for (const selector of linkSelectors) {
        try {
          const foundLinks = await this.page.$$eval(selector, els => 
            els.map(el => el.href).filter(href => href && href.includes('/maps/place/'))
          );
          if (foundLinks.length > 0) {
            links = foundLinks;
            console.log(`Found ${links.length} business links using selector: ${selector}`);
            break;
          }
        } catch (err) {
          console.log(`Selector ${selector} didn't work, trying next...`);
        }
      }
      
      if (links.length === 0) {
        console.error("No business links found. The page structure may have changed.");
        return results;
      }
      
      // Remove duplicates
      links = [...new Set(links)];
      
      console.log(`Processing ${Math.min(links.length, maxResults || links.length)} businesses...`);
      
      for (let i = 0; i < links.length; i++) {
        if (maxResults > 0 && results.length >= maxResults) break;
        
        console.log(`Processing business ${i + 1}/${links.length}: ${links[i]}`);
        const data = await this._extractBusinessDetails(links[i]);
        
        if (Object.keys(data).length > 0) {
          results.push(data);
          console.log(`✓ Collected: ${data.name || "No Name"} (${results.length}/${maxResults || 'unlimited'})`);
        } else {
          console.log(`✗ Failed to extract data from: ${links[i]}`);
        }
        
        // Random delay between requests
        await sleep(1500 + Math.random() * 2000);
      }
    } catch (err) {
      console.error("Search error:", err);
    }
    return results;
  }

  exportToCsv(businesses, filename = 'results.csv') {
    if (!businesses || businesses.length === 0) {
      console.log("No data to export to CSV.");
      return false;
    }
    
    try {
      const order = ["name", "category", "rating", "phone", "website", "address"];
      let csvContent = order.join(",") + "\n";
      
      businesses.forEach(biz => {
        const row = order.map(key => {
          const value = (biz[key] || "").toString().replace(/"/g, '""');
          return `"${value}"`;
        }).join(",");
        csvContent += row + "\n";
      });
      
      fs.writeFileSync(filename, csvContent, { encoding: "utf-8" });
      console.log(`✓ CSV saved to "${filename}" with ${businesses.length} entries.`);
      return true;
    } catch (err) {
      console.error("CSV export error:", err);
      return false;
    }
  }
  
  exportToXlsx(businesses, filename = 'results.xlsx') {
    if (!businesses || businesses.length === 0) {
      console.log("No data to export to Excel.");
      return false;
    }
    
    try {
      const order = ["name", "category", "rating", "phone", "website", "address"];
      const dataOrdered = businesses.map(biz => {
        const ordered = {};
        order.forEach(key => ordered[key] = biz[key] || "");
        return ordered;
      });
      
      const worksheet = XLSX.utils.json_to_sheet(dataOrdered);
      
      // Auto-size columns
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const colWidths = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            const cellLength = cell.v.toString().length;
            if (cellLength > maxWidth) maxWidth = cellLength;
          }
        }
        colWidths.push({ width: Math.min(maxWidth + 2, 50) });
      }
      worksheet['!cols'] = colWidths;
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
      XLSX.writeFile(workbook, filename);
      console.log(`✓ Excel saved to "${filename}" with ${businesses.length} entries.`);
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
  const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
  });
  
  const ask = question => new Promise(resolve => 
    rl.question(question, answer => resolve(answer))
  );
  
  try {
    console.log("=== Google Maps Business Scraper 2025 ===\n");
    
    const niche = await ask("Enter the business niche (category) to search for: ");
    const region = await ask("Enter the region (city, state, country): ");
    const qtdStr = await ask("How many companies do you want to collect? (0 for no limit): ");
    let maxResults = parseInt(qtdStr);
    if (isNaN(maxResults)) maxResults = 0;
    
    const headlessChoice = await ask("Run in headless mode? (y/n, default: n): ");
    const isHeadless = headlessChoice.toLowerCase() === 'y';
    
    rl.close();

    const outputDir = "Output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
      console.log("Created 'Output' folder.");
    }

    console.log("\n=== Starting Scraper ===");
    const scraper = new GoogleMapsPuppeteerScraper(isHeadless);
    await scraper.init();
    
    const results = await scraper.searchBusinesses(niche, region, maxResults);
    
    if (results.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const csvFile = `${outputDir}/results_${timestamp}.csv`;
      const xlsxFile = `${outputDir}/results_${timestamp}.xlsx`;
      
      scraper.exportToCsv(results, csvFile);
      scraper.exportToXlsx(results, xlsxFile);
      
      console.log(`\n=== Scraping Complete ===`);
      console.log(`Total businesses collected: ${results.length}`);
      console.log(`Files saved in: ${outputDir}/`);
    } else {
      console.log("\n=== No Results Found ===");
      console.log("No businesses were found or extracted. This could be due to:");
      console.log("1. Changes in Google Maps structure");
      console.log("2. Anti-bot measures");
      console.log("3. Network issues");
      console.log("4. Invalid search terms");
    }
    
    await scraper.close();
  } catch (error) {
    console.error("Main error:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  process.exit(0);
});

main().catch(console.error);