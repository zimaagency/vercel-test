const app = require("express")();
const fs = require('fs-extra');

let chrome = {};
let puppeteer;

if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  chrome = require("chrome-aws-lambda");
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(express.json()); // Parse JSON bodies

app.get("/api", async (req, res) => {
  let options = {};

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };
  }

  try {
    let browser = await puppeteer.launch(options);

    let page = await browser.newPage();
    await page.goto("https://www.google.com");
    res.send(await page.title());
  } catch (err) {
    console.error(err);
    return null;
  }
});

app.post('/generate-pdf', async (req, res) => {

  let options = {};

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };
  }

  try {
    const { config, html } = req.body;

    // Launch a headless Chrome browser
    const browser = await puppeteer.launch(options);

    // Create a new page
    const page = await browser.newPage();

    // Set the page dimensions and margin
    const { width, height, margin } = config;
    await page.setViewport({
      width: parseInt(width),
      height: parseInt(height),
      deviceScaleFactor: 1,
    });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US',
    });

    // Set the page content with the provided HTML
    await page.setContent(html);

    // Generate the PDF with the specified configuration
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: parseFloat(margin.top),
        right: parseFloat(margin.right),
        bottom: parseFloat(margin.bottom),
        left: parseFloat(margin.left),
      },
      displayHeaderFooter: config.displayHeaderFooter,
      headerTemplate: config.headerTemplate,
      footerTemplate: config.footerTemplate,
      printBackground: config.printBackground,
      scale: config.scale,
    });

    // Close the browser
    await browser.close();

    // Generate a unique file name
    const timestamp = Date.now();
    const outputPath = `${os.tmpdir()}/output_${timestamp}.pdf`;

    // Write the PDF to the specified file path
    const writeStream = fs.createWriteStream(outputPath);
    writeStream.write(pdf);
    writeStream.end();

    writeStream.on('finish', () => {
      console.log('PDF saved successfully:', outputPath);
      res.json({ success: true, outputPath });
    });

    writeStream.on('error', (error) => {
      console.error('PDF generation failed:', error);
      res.status(500).json({ success: false, error: error });
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({ success: false, error: error });
  }
});


app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

module.exports = app;
