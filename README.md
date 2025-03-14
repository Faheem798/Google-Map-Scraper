# Google Map Scraper

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js CI](https://github.com/Faheem798/Google-Map-Scraper/actions/workflows/nodejs.yml/badge.svg)](https://github.com/Faheem798/Google-Map-Scraper/actions)

Google Map Scraper is an advanced, headless scraper built using Puppeteer for extracting business details from Google Maps. It collects essential data such as business name, address, phone, website, category, and email (with smart filtering for default emails) and exports the results into both CSV and XLSX formats.

---

## ✨ Features

- **Headless Browsing with Puppeteer:**  
  Seamlessly browse Google Maps in headless or non-headless mode.

- **Dynamic Data Extraction:**  
  Automatically extract business details like name, address, phone number, website, category, and email from listings.

- **Cookie Consent Handling:**  
  Automatically accepts cookie pop-ups to ensure uninterrupted scraping.

- **Scrolling & Lazy Loading Support:**  
  Automatically scrolls the results list to load additional entries.

- **Dual Data Export:**  
  Export your scraped data to both CSV and Excel (XLSX) formats.

---

## 🚀 Installation

### Prerequisites

- **Node.js:**  
  Make sure you have Node.js installed (v14 or later recommended). You can download it from [nodejs.org](https://nodejs.org/).

- **Puppeteer and Dependencies:**  
  In your project directory, install the required packages:
  ```bash
  npm install puppeteer xlsx
  ```
  The `readline` and `fs` modules are built into Node.js, so no additional installation is required for those.

### Clone the Repository

Clone the repository from GitHub using:
```bash
git clone https://github.com/Faheem798/Google-Map-Scraper.git
cd Google-Map-Scraper
```

---

## 🔧 Usage

### Basic Usage

1. **Customize Your Search:**  
   Run the script using Node.js. The script will prompt you to enter:
   - The business niche (e.g., "yoga studio", "hotel")
   - The region (e.g., "NYC", "Lahore")
   - The maximum number of companies to scrape (enter 0 for no limit)
   
   ```bash
   node scraper.js
   ```

2. **Wait for Completion:**  
   The script navigates to Google Maps, handles cookie consent, executes the search, and scrolls to load additional results. It then extracts details for each business and logs progress to the console.

3. **Data Export:**  
   Once scraping is complete, the data is exported automatically to:
   - `results.csv` – a CSV file
   - `results.xlsx` – an Excel workbook

### Code Structure

- **`init()` Method:**  
  Initializes Puppeteer, launches the browser, and sets up the page with custom options (viewport, user agent, etc.).

- **Cookie & Element Handling:**  
  The `_acceptCookies()` method automatically clicks on cookie consent buttons, while helper methods like `_waitForFirstElementPresent()` and `_scrollResults()` ensure smooth navigation.

- **Data Extraction:**  
  The `_extractBusinessDetails()` method retrieves key information. It checks for email links and ensures that if no valid email is found or if it matches `robert@broofa.com`, the email is set to `"N/A"`.

- **Export Functions:**  
  Use `exportToCsv()` and `exportToXlsx()` to save the scraped data in your preferred format.

---

## 💡 Contributing

Contributions are welcome! Feel free to fork the repository, make changes, and open a pull request. Please ensure that any new features or bug fixes include appropriate tests and documentation.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 📣 Acknowledgments

- Inspired by advanced scraping techniques using Puppeteer.
- Special thanks to the open-source community for providing great tools and libraries.

---
