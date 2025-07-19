
---

# 🗺️ Google Maps Business Scraper

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node.js CI](https://github.com/Faheem798/Google-Map-Scraper/actions/workflows/nodejs.yml/badge.svg)

Google Maps Business Scraper is a simple yet powerful tool built with Puppeteer and stealth plugins to extract businesses from Google Maps. You can get business name, category, rating, phone, website, and address, then export the data as CSV or Excel.

---

## 🚀 Installation (Beginners Friendly)

### 1. 📦 Requirements

- **Node.js** (v14 or above)  
  ➤ Download and install from [https://nodejs.org](https://nodejs.org)

### 2. 📁 Clone the Repository

```bash
git clone https://github.com/Faheem798/Google-Map-Scraper.git
cd Google-Map-Scraper
```

### 3. 🔨 Install Dependencies

Run the following command to install required packages:

```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth xlsx
```

## 🧑‍💻 How to Use

Run the script using Node.js:

```bash
node scraper.js
```

You will be asked to:

- Enter business type (e.g. `restaurants`, `gyms`)
- Enter region (e.g. `New York`, `Lahore`)
- How many businesses to scrape (0 = all)
- Headless mode (yes = invisible browser)
- Export format: CSV, Excel, or Both

🟢 After confirmation, the scraper will:

1. Launch Google Maps in a browser
2. Search and scroll like a human
3. Visit each business page to extract:
   - Name
   - Category
   - Rating
   - Phone
   - Website
   - Address

📁 Scraped data will be saved in the `/Output` folder as:

- `businesses_<timestamp>.csv`
- `businesses_<timestamp>.xlsx`

---

## 📂 Folder Structure

```
Google-Map-Scraper/
├── scraper.js         # Main script
├── Output/            # Saved results
├── README.md          # This file
└── package.json       # Dependencies
```

---

## 🙌 Contributing

Feel free to fork this repo, suggest improvements, or open pull requests. Bug fixes, better selectors, and UX improvements are always welcome!

---

## 🙏 Credits

- Inspired by advanced web scraping techniques using Puppeteer‑extra and stealth enhancements.
- Special thanks to the open-source community for providing excellent tools and libraries.

---
