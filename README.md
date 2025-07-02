
---
 
# Google Map Scraper

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js CI](https://github.com/Faheem798/Google-Map-Scraper/actions/workflows/nodejs.yml/badge.svg)](https://github.com/Faheem798/Google-Map-Scraper/actions)

Google Map Scraper is a sophisticated, stealth-enhanced scraper built using Puppeteer‑extra with the Stealth Plugin. Designed for extracting detailed business data from Google Maps, it retrieves key information such as business name, category, rating, phone, website, address, and email. The scraper simulates human-like behavior with randomized delays and scrolling patterns to minimize detection, then exports the results to both CSV and XLSX formats.

---

## ✨ Features

- **Stealth-Enhanced Browsing:**  
  Built with Puppeteer‑extra and the Stealth Plugin, the scraper employs advanced techniques to reduce detection by mimicking genuine user behavior.

- **Dynamic Data Extraction:**  
  Extracts critical business details in the order of Name, Category, Rating, Phone, Website, Address, and Email.

- **Human-Like Interaction:**  
  Incorporates random delays and scrolling patterns to simulate a real user's browsing behavior, further lowering the risk of detection.

- **Dual Data Export:**  
  Saves the scraped data in both CSV and Excel (XLSX) formats for easy analysis and reporting.

---

## 🚀 Installation

### Prerequisites

- **Node.js:**  
  Ensure you have Node.js installed (v14 or later is recommended). You can download it from [nodejs.org](https://nodejs.org/).

- **Required Packages:**  
  Install the necessary packages in your project directory:
  ```bash
  npm install puppeteer-extra puppeteer-extra-plugin-stealth xlsx
  ```
  Note: `readline` and `fs` are built into Node.js.

### Clone the Repository

Clone the repository from GitHub:
```bash
git clone https://github.com/Faheem798/Google-Map-Scraper.git
cd Google-Map-Scraper
```

---

## 🔧 Usage

### Running the Scraper

1. **Customize Your Search:**  
   Run the script with Node.js. The program will prompt you to enter:
   - The business niche (e.g., "yoga studio", "hotel")
   - The region (e.g., "NYC", "Lahore")
   - The maximum number of companies to scrape (enter 0 for no limit)

   ```bash
   node scraper.js
   ```

2. **Undetectable Scraping:**  
   The script launches a stealth-enabled browser, navigates to Google Maps, and uses human-like scrolling and delays. It collects detailed business data while minimizing detection risks.

3. **Data Export:**  
   Once completed, the data is automatically exported to:
   - `results.csv` – a CSV file
   - `results.xlsx` – an Excel workbook  
   Both files are saved in the **Output** folder.

### Code Structure

- **Initialization (`init()`):**  
  Sets up Puppeteer‑extra with stealth settings, launches the browser, and configures the viewport and user agent.

- **Human-Like Navigation:**  
  The `_scrollResults()` method simulates natural scrolling with randomized delays to load additional entries.

- **Data Extraction:**  
  The `_extractBusinessDetails()` method navigates to each business detail page and extracts fields in the order:  
  **Name, Category, Rating, Phone, Website, Address, Email**  
  It uses multiple selectors for each field to increase reliability.

- **Export Functions:**  
  The functions `exportToCsv()` and `exportToXlsx()` save the scraped data in your chosen format while maintaining a fixed field order.

---

## 💡 Contributing

Contributions are welcome! Feel free to fork the repository, make improvements, and open a pull request. Please include appropriate tests and documentation with your changes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 📣 Acknowledgments

- Inspired by advanced web scraping techniques using Puppeteer‑extra and stealth enhancements.
- Special thanks to the open-source community for providing excellent tools and libraries.

---
