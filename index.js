import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { parseArgs } from 'node:util';

class Business {
  constructor(
    name = '',
    address = '',
    website = '',
    phoneNumber = '',
    reviewsAverage = 0,
    latitude = null,
    longitude = null
  ) {
    this.name = name;
    this.address = address;
    this.website = website;
    this.phoneNumber = phoneNumber;
    this.reviewsAverage = reviewsAverage;
    this.latitude = latitude;
    this.longitude = longitude;
  }
}

class BusinessList {
  constructor() {
    this.businessList = [];
    this.saveAt = 'output';
  }

  saveToExcel(filename) {
    if (!fs.existsSync(this.saveAt)) fs.mkdirSync(this.saveAt);
    const ws = xlsx.utils.json_to_sheet(this.businessList);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    xlsx.writeFile(wb, path.join(this.saveAt, `${filename}.xlsx`));
  }

  saveToCsv(filename) {
    if (!fs.existsSync(this.saveAt)) fs.mkdirSync(this.saveAt);
    const csvContent = this.businessList
      .map(b => Object.values(b).join(','))
      .join('\n');
    fs.writeFileSync(path.join(this.saveAt, `${filename}.csv`), csvContent);
  }
}

const extractCoordinatesFromUrl = (url) => {
  try {
    const coordinates = url.split('/@')[1].split('/')[0].split(',');
    return [parseFloat(coordinates[0]), parseFloat(coordinates[1])];
  } catch {
    return [null, null];
  }
};

(async () => {
  const args = parseArgs({
    options: {
      search: { type: 'string', short: 's' },
      total: { type: 'string', short: 't' }
    }
  }).values;

  // Use -s argument or load search terms from input.txt
  let searchList = args.search ? [args.search] : [];
  let total = args.total ? parseInt(args.total) : 1000000;

  if (!args.search) {
    const inputFilePath = path.join(process.cwd(), 'input.txt');
    if (fs.existsSync(inputFilePath)) {
      searchList = fs
        .readFileSync(inputFilePath, 'utf-8')
        .split('\n')
        .filter(Boolean);
    }
    if (searchList.length === 0) {
      console.error("Error: Provide a search term using -s or add terms to input.txt");
      process.exit(1);
    }
  }

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();


  await page.goto("https://www.google.com/maps", { timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  for (const searchFor of searchList) {
    console.log(`Searching: ${searchFor}`);

    await page.goto("https://www.google.com/maps", { timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    const searchBoxSelector = '#searchboxinput';
    await page.waitForSelector(searchBoxSelector);
    await page.evaluate(selector => { document.querySelector(selector).value = ""; }, searchBoxSelector);
    await page.type(searchBoxSelector, searchFor);
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Wait for listings to appear
    const listingsSelector = 'a[href*="https://www.google.com/maps/place"]';
    await page.waitForSelector(listingsSelector, { timeout: 10000 });

    // Scroll to load more listings until count stops increasing or total is reached
    let previousCount = 0;
    let listings = [];
    while (true) {
      await page.evaluate(() => window.scrollBy(0, 10000));
      await new Promise(resolve => setTimeout(resolve, 3000));
      listings = await page.$$(listingsSelector);
      const currentCount = listings.length;
      if (currentCount >= total || currentCount === previousCount) break;
      previousCount = currentCount;
    }

    if (listings.length === 0) {
      console.error(`No listings found for search term: ${searchFor}`);
      continue;
    }

    const businessList = new BusinessList();
    const listingsCount = listings.length;
    
    for (let i = 0; i < Math.min(listingsCount, total); i++) {
      // Re-query to get the current listing handle at index i
      const currentListings = await page.$$(listingsSelector);
      if (currentListings.length <= i) break;
      const listing = currentListings[i];

      try {
        // Use evaluate to click to reduce detached node issues
        await page.evaluate(el => el.click(), listing);
        await new Promise(resolve => setTimeout(resolve, 5000));
  
        // Scrape details with updated selectors
        const name = await page.$eval('[role="heading"]', el => el.innerText).catch(() => '');
        const address = await page.$eval('button[data-item-id="address"] div', el => el.innerText).catch(() => '');
        const website = await page.$eval('a[data-item-id="authority"] div', el => el.innerText).catch(() => '');
        const phoneNumber = await page.$eval('button[data-item-id*="phone:"] div', el => el.innerText).catch(() => '');
        
        let reviewsAverage = 0;
        try {
          const ratingText = await page.$eval(
            'div[jsaction="pane.reviewChart.moreReviews"] div[role="img"]',
            el => el.getAttribute("aria-label")
          );
          reviewsAverage = ratingText ? parseFloat(ratingText.split(' ')[0].replace(',', '.')) : 0;
        } catch {}
  
        const [latitude, longitude] = extractCoordinatesFromUrl(page.url());
        businessList.businessList.push(new Business(name, address, website, phoneNumber, reviewsAverage, latitude, longitude));
  
        // Click the "Back" button to return to the list of results
        const backButtonSelector = 'button[aria-label="Back"]';
        await page.waitForSelector(backButtonSelector, { timeout: 10000 });
        await page.click(backButtonSelector);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (e) {
        console.error(`Error scraping business at index ${i}: `, e);
      }
    }
  
    const filename = `google_maps_data_${searchFor.replace(/\s+/g, '_')}`;
    businessList.saveToExcel(filename);
    businessList.saveToCsv(filename);
  }
  
  await browser.close();
})();
