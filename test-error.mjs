import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
page.on('pageerror', err => console.log('Page error:', err.toString()));
page.on('console', msg => {
    if (msg.type() === 'error') console.log('Console error:', msg.text());
});
await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
await browser.close();
