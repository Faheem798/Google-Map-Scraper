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
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-default-apps'
        ],
        timeout: 60000,
        ignoreDefaultArgs: ['--enable-automation']
      };

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      });
      
      console.log("Browser launched successfully.");
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
    console.log("Scrolling to load more results...");
    
    const feedSelectors = [
      "div[role='feed']",
      "div[role='main'] div[role='region']",
      ".m6QErb[data-value='Search results']"
    ];
    
    let feedElement = null;
    for (const selector of feedSelectors) {
      try {
        feedElement = await this.page.$(selector);
        if (feedElement) break;
      } catch (err) {
        continue;
      }
    }

    for (let i = 0; i < scrollCount; i++) {
      try {
        if (feedElement) {
          await this.page.evaluate(el => {
            el.scrollTop = el.scrollHeight;
          }, feedElement);
        } else {
          await this.page.evaluate(() => {
            window.scrollBy(0, 1000);
          });
        }
        
        await sleep(2000 + Math.random() * 1000);
        
        
        try {
          const loadMoreBtn = await this.page.$('button[aria-label*="more"]');
          if (loadMoreBtn) {
            await loadMoreBtn.click();
            await sleep(2000);
          }
        } catch (err) {
          
        }
        
        console.log(`Scroll ${i + 1}/${scrollCount} completed`);
      } catch (err) {
        console.error(`Scroll error ${i + 1}:`, err.message);
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
          waitUntil: "domcontentloaded", 
          timeout: 30000 
        });
        
        await detailPage.waitForFunction(() => document.readyState === 'complete', 
          { timeout: 10000 }).catch(() => {});
        
        await sleep(3000);
        
        
        await detailPage.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await sleep(2000);
        
        console.log(`Extracting data from: ${link.substring(0, 60)}...`);
        
        
        const nameSelectors = [
          "h1[data-attrid='title']",
          "h1.DUwDvf", 
          "h1"
        ];
        
        for (const selector of nameSelectors) {
          try {
            const nameEl = await detailPage.$(selector);
            if (nameEl) {
              details.name = (await detailPage.evaluate(el => el.innerText, nameEl)).trim();
              break;
            }
          } catch (err) {
            continue;
          }
        }
        
        
        const categorySelectors = [
          "button[jsaction*='category']",
          "span.DkEaL",
          ".YhemCb"
        ];
        
        for (const selector of categorySelectors) {
          try {
            const catEl = await detailPage.$(selector);
            if (catEl) {
              const categoryText = (await detailPage.evaluate(el => el.innerText, catEl)).trim();
              if (categoryText && !categoryText.includes('directions') && !categoryText.includes('call')) {
                details.category = categoryText;
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
        
        
        const ratingSelectors = [
          "div.jANrlb > div.fontDisplayLarge",
          "span.ceNzKf"
        ];
        
        for (const selector of ratingSelectors) {
          try {
            const ratingEl = await detailPage.$(selector);
            if (ratingEl) {
              const ratingText = (await detailPage.evaluate(el => el.innerText, ratingEl)).trim();
              if (ratingText && /^\d+\.?\d*$/.test(ratingText)) {
                details.rating = ratingText;
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
        
        
const phoneSelectors = [
          "button[data-item-id^='phone']",
          "a[href^='tel:']",
          "button[aria-label*='phone']"
        ];
       
        for (const selector of phoneSelectors) {
          try {
            const phoneEl = await detailPage.$(selector);
            if (phoneEl) {
              let phoneText = await detailPage.evaluate(el => el.innerText || el.getAttribute('href'), phoneEl);
              if (phoneText) {
                if (phoneText.startsWith("tel:")) {
                  phoneText = phoneText.replace("tel:", "");
                }
                phoneText = phoneText.replace(//g, '');
                details.phone = phoneText.trim();
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
        
        
        try {
          
          const websiteSelectors = [
            "a[data-item-id^='authority']",
            "button[data-item-id^='authority']",
            "a[href^='http']:not([href*='google']):not([href*='maps']):not([href*='facebook']):not([href*='instagram']):not([href*='youtube']):not([href*='twitter'])"
          ];
          
          for (const selector of websiteSelectors) {
            try {
              const elements = await detailPage.$$(selector);
              for (const element of elements) {
                const href = await detailPage.evaluate(el => el.href, element);
                const text = await detailPage.evaluate(el => el.innerText || el.textContent, element);
                
                if (href && href.startsWith('http') && !href.includes('google.com') && !href.includes('maps')) {
                  details.website = href;
                  console.log(`Found website via href: ${href}`);
                  break;
                }
                
                if (text && (text.includes('www.') || text.includes('http'))) {
                  const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/);
                  if (urlMatch) {
                    let url = urlMatch[0];
                    if (!url.startsWith('http')) {
                      url = 'https://' + url;
                    }
                    details.website = url;
                    console.log(`Found website via text: ${url}`);
                    break;
                  }
                }
              }
              if (details.website) break;
            } catch (err) {
              continue;
            }
          }
          
          
          if (!details.website) {
            try {
              const websiteText = await detailPage.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                  const text = el.innerText || el.textContent || '';
                  if (text.length < 100 && text.length > 5) {
                    const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
                    if (urlMatch) {
                      const url = urlMatch[0];
                      
                      if (!url.includes('google') && !url.includes('facebook') && 
                          !url.includes('instagram') && !url.includes('maps') &&
                          !url.includes('youtube') && !url.includes('twitter')) {
                        return url;
                      }
                    }
                  }
                }
                return null;
              });
              
              if (websiteText) {
                let cleanUrl = websiteText;
                if (!cleanUrl.startsWith('http')) {
                  cleanUrl = 'https://' + cleanUrl;
                }
                details.website = cleanUrl;
                console.log(`Found website via page search: ${cleanUrl}`);
              }
            } catch (err) {
              console.log("Page search for website failed:", err.message);
            }
          }
          
          
          if (!details.website) {
            try {
              const websiteFromAttributes = await detailPage.evaluate(() => {
                const elements = document.querySelectorAll('[data-href], [aria-label*="website"], [title*="website"]');
                for (const el of elements) {
                  const dataHref = el.getAttribute('data-href');
                  const ariaLabel = el.getAttribute('aria-label') || '';
                  const title = el.getAttribute('title') || '';
                  
                  if (dataHref && dataHref.startsWith('http') && !dataHref.includes('google')) {
                    return dataHref;
                  }
                  
                  const text = el.innerText || el.textContent || ariaLabel + ' ' + title;
                  const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
                  if (urlMatch && !urlMatch[0].includes('google')) {
                    return urlMatch[0];
                  }
                }
                return null;
              });
              
              if (websiteFromAttributes) {
                let cleanUrl = websiteFromAttributes;
                if (!cleanUrl.startsWith('http')) {
                  cleanUrl = 'https://' + cleanUrl;
                }
                details.website = cleanUrl;
                console.log(`Found website via attributes: ${cleanUrl}`);
              }
            } catch (err) {
              console.log("Attribute search for website failed:", err.message);
            }
          }
          
        } catch (err) {
          console.error("Website extraction error:", err.message);
        }
        
        
        const addressSelectors = [
          "button[data-item-id^='address']",
          "button[aria-label*='address']"
        ];
        
        for (const selector of addressSelectors) {
          try {
            const addrEl = await detailPage.$(selector);
            if (addrEl) {
              let addressText = (await detailPage.evaluate(el => el.innerText, addrEl)).trim();
              addressText = addressText.replace(//g, '');
              details.address = addressText.trim();
              break;
            }
          } catch (err) {
            continue;
          }
        }
        
        
        this._displayExtractedData(details);
        break;
        
      } catch (error) {
        retryCount++;
        console.error(`Error (attempt ${retryCount}):`, error.message);
        if (retryCount >= this.maxRetries) {
          console.error(`Failed after ${this.maxRetries} attempts`);
        } else {
          await sleep(2000 * retryCount);
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
      
      console.log(`Searching: ${searchTerm}`);
      
      await this.page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(5000);
      
      await this.page.waitForSelector('div[role="feed"], .Nv2PK', { timeout: 30000 }).catch(() => {
        console.log("Results loaded");
      });
      
      await this._scrollResults();
      
      const linkSelectors = [
        "a.hfpxzc",
        "a[data-cid]", 
        "div[role='article'] a",
        ".Nv2PK a"
      ];
      
      let links = [];
      for (const selector of linkSelectors) {
        try {
          const foundLinks = await this.page.$$eval(selector, els => 
            els.map(el => el.href).filter(href => href && href.includes('/maps/place/'))
          );
          if (foundLinks.length > 0) {
            links = foundLinks;
            console.log(`Found ${links.length} businesses`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      if (links.length === 0) {
        console.error("No business links found");
        return results;
      }
      
      links = [...new Set(links)];
      
      const targetCount = maxResults > 0 ? Math.min(links.length, maxResults) : links.length;
      console.log(`Processing ${targetCount} businesses...`);
      
      for (let i = 0; i < links.length && results.length < targetCount; i++) {
        this.currentIndex = results.length + 1;
        console.log(`\n🔍 Processing Business ${this.currentIndex}/${targetCount}`);
        console.log(`📋 URL: ${links[i].substring(0, 80)}...`);
        
        const data = await this._extractBusinessDetails(links[i]);
        
        if (Object.keys(data).length > 0) {
          results.push(data);
          console.log(`✅ SUCCESS! Progress: ${results.length}/${targetCount} completed`);
        } else {
          console.log(`❌ FAILED to extract data from this business`);
        }
        
        if (results.length < targetCount) {
          const delay = 1500 + Math.random() * 2000;
          console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next business...`);
          await sleep(delay);
        }
      }
    } catch (err) {
      console.error("Search error:", err.message);
    }
    return results;
  }

  exportToCsv(businesses, filename = 'results.csv') {
    if (!businesses || businesses.length === 0) {
      console.log("No data to export");
      return false;
    }
    
    try {
      const headers = ["name", "category", "rating", "phone", "website", "address"];
      let csvContent = headers.join(",") + "\n";
      
      businesses.forEach(biz => {
        const row = headers.map(key => {
          const value = (biz[key] || "").toString().replace(/"/g, '""');
          return `"${value}"`;
        }).join(",");
        csvContent += row + "\n";
      });
      
      fs.writeFileSync(filename, csvContent, { encoding: "utf-8" });
      console.log(`✓ CSV saved: ${filename} (${businesses.length} entries)`);
      return true;
    } catch (err) {
      console.error("CSV export error:", err.message);
      return false;
    }
  }
  
  exportToXlsx(businesses, filename = 'results.xlsx') {
    if (!businesses || businesses.length === 0) {
      console.log("No data to export");
      return false;
    }
    
    try {
      const headers = ["name", "category", "rating", "phone", "website", "address"];
      const dataOrdered = businesses.map(biz => {
        const ordered = {};
        headers.forEach(key => ordered[key] = biz[key] || "");
        return ordered;
      });
      
      const worksheet = XLSX.utils.json_to_sheet(dataOrdered);
      
      
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const colWidths = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            maxWidth = Math.max(maxWidth, cell.v.toString().length);
          }
        }
        colWidths.push({ width: Math.min(maxWidth + 2, 50) });
      }
      worksheet['!cols'] = colWidths;
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
      XLSX.writeFile(workbook, filename);
      console.log(`✓ Excel saved: ${filename} (${businesses.length} entries)`);
      return true;
    } catch (err) {
      console.error("Excel export error:", err.message);
      return false;
    }
  }

  _displayExtractedData(data) {
    console.log('\n' + '='.repeat(60));
    console.log(`📍 BUSINESS #${this.currentIndex || 0} EXTRACTED`);
    console.log('='.repeat(60));
    console.log(`🏢 Name:     ${data.name || '❌ Not found'}`);
    console.log(`🏷️  Category: ${data.category || '❌ Not found'}`);
    console.log(`⭐ Rating:   ${data.rating || '❌ Not found'}`);
    console.log(`📞 Phone:    ${data.phone || '❌ Not found'}`);
    console.log(`🌐 Website:  ${data.website || '❌ Not found'}`);
    console.log(`📍 Address:  ${data.address || '❌ Not found'}`);
    console.log('='.repeat(60) + '\n');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}

async function main() {
  console.log('🚀 ' + '='.repeat(50));
  console.log('🗺️  GOOGLE MAPS BUSINESS SCRAPER 2025');
  console.log('🚀 ' + '='.repeat(50));
  
  const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
  });
  
  const ask = question => new Promise(resolve => 
    rl.question(question, answer => resolve(answer))
  );
  
  const askWithValidation = async (question, validator, errorMsg) => {
    while (true) {
      const answer = await ask(question);
      if (validator(answer)) {
        return answer;
      }
      console.log(`❌ ${errorMsg}`);
    }
  };
  
  try {
    console.log('\n📝 Let\'s set up your scraping parameters...\n');
    
    // Business type input
    const niche = await askWithValidation(
      '🏢 Enter business type (e.g., restaurants, dentists, gyms): ',
      (input) => input.trim().length >= 3,
      'Please enter at least 3 characters for business type'
    );
    
    // Region input  
    const region = await askWithValidation(
      '🌍 Enter region (e.g., New York, London, Toronto): ',
      (input) => input.trim().length >= 2,
      'Please enter at least 2 characters for region'
    );
    
    // Max results input
    const maxResults = await askWithValidation(
      '🔢 How many businesses to scrape? (1-500, or 0 for unlimited): ',
      (input) => {
        const num = parseInt(input);
        return !isNaN(num) && num >= 0 && num <= 500;
      },
      'Please enter a number between 0-500'
    );
    
    // Headless mode input
    const headlessChoice = await askWithValidation(
      '👁️  Run in headless mode? (y/n) [y = invisible browser, n = visible]: ',
      (input) => ['y', 'n', 'yes', 'no'].includes(input.toLowerCase()),
      'Please enter y (yes) or n (no)'
    );
    
    // Export format input
    const exportChoice = await askWithValidation(
      '📊 Export format (csv/excel/both) [default: both]: ',
      (input) => ['csv', 'excel', 'both', ''].includes(input.toLowerCase()),
      'Please enter csv, excel, or both'
    );
    
    rl.close();
    
    // Parse inputs
    const maxResultsNum = parseInt(maxResults);
    const isHeadless = ['y', 'yes'].includes(headlessChoice.toLowerCase());
    const exportFormat = exportChoice.toLowerCase() || 'both';
    
    // Display configuration
    console.log('\n' + '📋 SCRAPING CONFIGURATION'.padStart(40, '=').padEnd(60, '='));
    console.log(`🏢 Business Type: ${niche}`);
    console.log(`🌍 Region: ${region}`);
    console.log(`🔢 Max Results: ${maxResultsNum === 0 ? 'Unlimited' : maxResultsNum}`);
    console.log(`👁️  Browser Mode: ${isHeadless ? 'Headless (Invisible)' : 'Visible'}`);
    console.log(`📊 Export Format: ${exportFormat.toUpperCase()}`);
    console.log('='.repeat(60));
    
    // Confirmation
    const confirm = await new Promise(resolve => {
      const confirmRl = readline.createInterface({ 
        input: process.stdin, 
        output: process.stdout 
      });
      confirmRl.question('\n▶️  Start scraping? (y/n): ', (answer) => {
        confirmRl.close();
        resolve(answer);
      });
    });
    
    if (!['y', 'yes'].includes(confirm.toLowerCase())) {
      console.log('🛑 Scraping cancelled by user');
      return;
    }

    // Create output directory
    const outputDir = "Output";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
      console.log(`📁 Created output directory: ${outputDir}/`);
    }

    console.log('\n🚀 STARTING SCRAPER...');
    console.log('⏳ Initializing browser...');
    
    const scraper = new GoogleMapsPuppeteerScraper(isHeadless);
    await scraper.init();
    
    console.log('✅ Browser initialized successfully!');
    console.log('🔍 Starting business search...');
    
    const startTime = Date.now();
    const results = await scraper.searchBusinesses(niche, region, maxResultsNum);
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    if (results.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const csvFile = `${outputDir}/businesses_${timestamp}.csv`;
      const xlsxFile = `${outputDir}/businesses_${timestamp}.xlsx`;
      
      console.log('\n' + '💾 EXPORTING DATA...'.padStart(40, '=').padEnd(60, '='));
      
      let exportCount = 0;
      if (['csv', 'both'].includes(exportFormat)) {
        if (scraper.exportToCsv(results, csvFile)) exportCount++;
      }
      if (['excel', 'both'].includes(exportFormat)) {
        if (scraper.exportToXlsx(results, xlsxFile)) exportCount++;
      }
      
      console.log('\n' + '🎉 SCRAPING COMPLETE!'.padStart(40, '=').padEnd(60, '='));
      console.log(`✅ Total Businesses Scraped: ${results.length}`);
      console.log(`⏱️  Total Time: ${Math.floor(duration/60)}m ${duration%60}s`);
      console.log(`📊 Export Files Created: ${exportCount}`);
      console.log(`📁 Output Directory: ${outputDir}/`);
      
      
      const withWebsite = results.filter(r => r.website).length;
      const withPhone = results.filter(r => r.phone).length;
      const withRating = results.filter(r => r.rating).length;
      
      console.log('\n📈 DATA QUALITY SUMMARY:');
      console.log(`🌐 Businesses with Website: ${withWebsite}/${results.length} (${Math.round(withWebsite/results.length*100)}%)`);
      console.log(`📞 Businesses with Phone: ${withPhone}/${results.length} (${Math.round(withPhone/results.length*100)}%)`);
      console.log(`⭐ Businesses with Rating: ${withRating}/${results.length} (${Math.round(withRating/results.length*100)}%)`);
      
      console.log('\n🎯 Files saved in Output folder. Happy marketing! 🚀');
    } else {
      console.log('\n' + '❌ NO RESULTS FOUND'.padStart(40, '=').padEnd(60, '='));
      console.log('💡 Possible reasons:');
      console.log('   • Search terms too specific');
      console.log('   • Region has no businesses of this type');
      console.log('   • Google Maps detected scraping (try headless mode)');
      console.log('   • Network issues or rate limiting');
      console.log('\n💭 Try with different search terms or broader region');
    }
    
    await scraper.close();
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.log('💡 Try restarting the scraper or check your internet connection');
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

main().catch(console.error);