import puppeteer from 'puppeteer';
import fs from 'fs';
import readline from 'readline';
import XLSX from 'xlsx';

class GoogleMapsPuppeteerScraper {
  constructor(headless = false) {
    this.headless = headless;
  }

  async init() {
    // Launch the browser with the specified options.
    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--window-size=1920,1080',
        '--disable-notifications',
        '--disable-infobars',
        '--start-maximized',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
    );
  }

  async _acceptCookies() {
    const cookieXPaths = [
      "//button[contains(., 'Accept')]",
      "//button[contains(., 'I agree')]",
      "//button[@jsname='higCR']"
    ];
    for (const xpath of cookieXPaths) {
      try {
        const [button] = await this.page.$x(xpath);
        if (button) {
          await button.click();
          console.log("Cookies accepted.");
          await new Promise(resolve => setTimeout(resolve, 1000));
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  async _waitForFirstElementPresent(selectors, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      for (const selector of selectors) {
        try {
          const element = await this.page.$(selector);
          if (element) return selector;
        } catch (e) {
          continue;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  }

  async _scrollResults(scrollCount) {
    console.log(`Scrolling ${scrollCount} times to load more results...`);
    const scrollableSelectors = [
      "div[role='feed']",
      "div.m6QErb[role='region']",
      "div.m6QErb",
      "div.section-layout",
      "div.section-scrollbox"
    ];
    for (let i = 0; i < scrollCount; i++) {
      let scrolled = false;
      for (const selector of scrollableSelectors) {
        try {
          const scrollableDiv = await this.page.$(selector);
          if (scrollableDiv) {
            await this.page.evaluate(el => {
              el.scrollTop = el.scrollHeight;
            }, scrollableDiv);
            scrolled = true;
            console.log(`Scroll ${i + 1}: using selector ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      if (!scrolled) {
        await this.page.evaluate(() => window.scrollBy(0, 300));
      }
      await new Promise(resolve => setTimeout(resolve, 2500 + Math.random() * 1000));
    }
  }

  async _goBackToResults() {
    try {
      await this.page.goBack({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } catch (e) {
      console.log("Failed to go back. Refreshing the page...");
      await this.page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 3000));
      return false;
    }
  }

  async _extractBusinessDetails() {
    const details = {};
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract Address
      const addressSelectors = [
        "button[data-item-id^='address']",
        "[data-tooltip='Copy address']",
        "[aria-label*='address']",
        "a[href*='maps']"
      ];
      for (const selector of addressSelectors) {
        try {
          const handle = await this.page.$(selector);
          if (handle) {
            const text = await this.page.evaluate(el => el.innerText, handle);
            if (text) {
              details.address = text.trim();
              console.log("Address:", details.address.slice(0, 30));
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Extract Phone
      const phoneSelectors = [
        "button[data-item-id^='phone']",
        "[data-tooltip='Copy phone number']",
        "button[aria-label*='phone']",
        "a[href^='tel:']"
      ];
      for (const selector of phoneSelectors) {
        try {
          const handle = await this.page.$(selector);
          if (handle) {
            let text = await this.page.evaluate(el => el.innerText, handle);
            if (!text) {
              text = await this.page.evaluate(el => el.getAttribute('href'), handle);
              if (text && text.startsWith("tel:")) {
                text = text.split("tel:")[1];
              }
            }
            if (text) {
              details.phone = text.trim();
              console.log("Phone:", details.phone);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Extract Website
      const websiteSelectors = [
        "a[data-item-id^='authority']",
        "[data-tooltip='Open website']",
        "a[aria-label*='site']"
      ];
      for (const selector of websiteSelectors) {
        try {
          const handle = await this.page.$(selector);
          if (handle) {
            const href = await this.page.evaluate(el => el.getAttribute('href'), handle);
            if (href && href.includes("http") && !href.includes("google")) {
              details.website = href;
              console.log("Website:", details.website);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Extract Category
      const categorySelectors = [
        "button[jsaction*='category']",
        "span.DkEaL",
        "span.mgr77e"
      ];
      for (const selector of categorySelectors) {
        try {
          const handle = await this.page.$(selector);
          if (handle) {
            const text = await this.page.evaluate(el => el.innerText, handle);
            if (text) {
              details.category = text.trim();
              console.log("Category:", details.category);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
    const emailHandle = await this.page.$("a[href^='mailto:']");
      if (emailHandle) {
        let email = await this.page.evaluate(el => el.getAttribute('href'), emailHandle);
        if (email) {
          email = email.replace("mailto:", "").trim();
          details.email = (email === "robert@broofa.com") ? "N/A" : email;
          console.log("Email:", details.email);
        } else {
          details.email = "N/A";
        }
      } else {
        const content = await this.page.content();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = content.match(emailRegex);
        if (matches && matches.length > 0) {
          const foundEmail = matches[0].trim();
          details.email = (foundEmail === "robert@broofa.com") ? "N/A" : foundEmail;
          console.log("Email from text:", details.email);
        } else {
          details.email = "N/A";
        }
      }
    } catch (e) {
      console.log("Error extracting business details:", e);
    }
    return details;
  }

  async searchBusinesses(query, region, max_results = 0) {
    const results = [];
    const searchTerm = `${query} ${region}`;
    console.log(`Searching for: ${searchTerm}`);
    try {
      await this.page.goto("https://www.google.com/maps", { timeout: 60000 });
      await this._acceptCookies();
      const searchBoxSelector = "#searchboxinput";
      await this.page.waitForSelector(searchBoxSelector, { timeout: 15000 });
      await this.page.evaluate(selector => {
        document.querySelector(selector).value = "";
      }, searchBoxSelector);
      await this.page.type(searchBoxSelector, searchTerm);
      await this.page.keyboard.press("Enter");
      console.log("Search initiated, waiting for results...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const resultSelectors = [
        "div.Nv2PK",
        "div.bfdHYd",
        "div[role='feed'] > div"
      ];
      const workingSelector = await this._waitForFirstElementPresent(resultSelectors, 10000);
      if (!workingSelector) {
        console.log("No results container found.");
        return results;
      }
      console.log("Results container found using:", workingSelector);
      
      let scroll_count = 10;
      if (max_results > 0) {
        scroll_count = Math.max(1, Math.floor(max_results / 5));
      }
      await this._scrollResults(scroll_count);
      
      // Initially get the number of business elements
      let initialElements = await this.page.$$(workingSelector);
      let totalElements = initialElements.length;
      if (max_results > 0) {
        totalElements = Math.min(totalElements, max_results);
      }
      
      for (let i = 0; i < totalElements; i++) {
        try {

          const currentElements = await this.page.$$(workingSelector);
          if (i >= currentElements.length) break;
          const element = currentElements[i];
          const business = {};
          
          const nameSelectors = [
            "div.qBF1Pd",
            "span.fontHeadlineSmall",
            "div.fontHeadlineSmall",
            "span.vcAjh",
            "h3"
          ];
          let nameFound = false;
          for (const sel of nameSelectors) {
            try {
              const handle = await element.$(sel);
              if (handle) {
                const nameText = await this.page.evaluate(el => el.innerText, handle);
                if (nameText) {
                  business.name = nameText.trim();
                  console.log(`Processing business ${i + 1}: ${business.name}`);
                  nameFound = true;
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
          if (!nameFound) {
            console.log(`Could not extract name for result ${i + 1}`);
            continue;
          }
          
          // Click to open business details using multiple selectors
          const clickableSelectors = [
            "a",
            "div[role='button']",
            "div[jsaction*='placeCard']",
            "div[jsaction*='click']"
          ];
          let clicked = false;
          for (const sel of clickableSelectors) {
            try {
              const clickable = await element.$(sel);
              if (clickable) {
                try {
                  await clickable.click();
                  clicked = true;
                  break;
                } catch (e) {
                  await this.page.evaluate(el => el.click(), clickable);
                  clicked = true;
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
          if (!clicked) {
            console.log(`Could not click on element for: ${business.name}`);
            continue;
          }
          await new Promise(resolve => setTimeout(resolve, 4000 + Math.random() * 2000));
          const details = await this._extractBusinessDetails();
          Object.assign(business, details);
          if (Object.keys(business).length > 1) {
            console.log(`Details obtained for: ${business.name}`);
          } else {
            console.log(`Only name obtained for: ${business.name}`);
          }
          results.push(business);
          
          await this._goBackToResults();
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
        } catch (e) {
          console.log(`Error processing result ${i + 1}: ${e}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      }
    } catch (e) {
      console.log("Error during search:", e);
    }
    return results;
  }

  exportToCsv(businesses, filename = 'results.csv') {
    if (!businesses || businesses.length === 0) {
      console.log("No data to export.");
      return false;
    }
    try {
      const allKeys = new Set();
      businesses.forEach(biz => {
        Object.keys(biz).forEach(key => allKeys.add(key));
      });
      const fieldnames = Array.from(allKeys);
      let csvContent = fieldnames.join(",") + "\n";
      businesses.forEach(biz => {
        const row = fieldnames.map(key => {
          const val = biz[key] ? biz[key] : "";
          return `"${val.toString().replace(/"/g, '""')}"`;
        }).join(",");
        csvContent += row + "\n";
      });
      fs.writeFileSync(filename, csvContent, { encoding: "utf-8" });
      console.log(`Data exported to '${filename}' successfully!`);
      return true;
    } catch (e) {
      console.log("Error exporting CSV:", e);
      return false;
    }
  }
  
  exportToXlsx(businesses, filename = 'results.xlsx') {
    if (!businesses || businesses.length === 0) {
      console.log("No data to export to Excel.");
      return false;
    }
    try {
      const worksheet = XLSX.utils.json_to_sheet(businesses);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
      XLSX.writeFile(workbook, filename);
      console.log(`Data exported to '${filename}' successfully!`);
      return true;
    } catch (e) {
      console.log("Error exporting XLSX:", e);
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
  const ask = (question) =>
    new Promise(resolve => rl.question(question, answer => resolve(answer)));
  
  const niche = await ask("Enter the business niche (category) to search for: ");
  const region = await ask("Enter the region: ");
  const qtdStr = await ask("How many companies do you want to collect? (0 = no limit): ");
  let maxResults = parseInt(qtdStr);
  if (isNaN(maxResults)) maxResults = 0;
  rl.close();

  const scraper = new GoogleMapsPuppeteerScraper(false);
  await scraper.init();
  const results = await scraper.searchBusinesses(niche, region, maxResults);
  await scraper.exportToCsv(results, "Output/results.csv");
  await scraper.exportToXlsx(results, "Output/results.xlsx");
  await scraper.close();
}

main();
