const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to http://localhost:5173...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    console.log("Clicking Começar Grátis...");
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Começar Grátis')) {
        await btn.click();
        break;
      }
    }

    // Wait for the ErrorBoundary to render
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Checking for ErrorBoundary...");
    // The details element has the error text
    const errorText = await page.evaluate(() => {
      const pre = document.querySelector('pre');
      return pre ? pre.innerText : 'No error found in DOM';
    });

    console.log("ERROR TEXT FOUND IN DOM:\n", errorText);
  } catch(e) {
    console.log("Script error:", e);
  } finally {
    await browser.close();
  }
})();
