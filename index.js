// Import necessary packages and initialize Express
const express = require("express");
const fs = require('fs-extra');
const PDFDocument = require('pdfkit');
const aws = require('aws-sdk');

let puppeteer;
let chrome = {};

// Function to set up Puppeteer based on environment
function setupPuppeteer() {
  // Check if the script is running on AWS Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    // Use 'chrome-aws-lambda' and 'puppeteer-core' for Lambda
    chrome = require("chrome-aws-lambda");
    puppeteer = require("puppeteer-core");
  } else {
    // Use 'puppeteer' otherwise
    puppeteer = require("puppeteer");
  }
}

// Function to generate PDF from given HTML content
async function generatePDF(options, config, html) {
  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();

  // Set page details
  const { width, height, margin } = config;
  await page.setViewport({
    width: parseInt(width),
    height: parseInt(height),
    deviceScaleFactor: 1,
  });

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US',
  });

  // Set content and generate PDF
  await page.setContent(html);
  const pdf = await page.pdf(config);

  // Close the browser
  await browser.close();

  return pdf;
}

// Function to write PDF file to AWS S3
function writeToS3(pdf, timestamp, res) {
  // Prepare to write to AWS S3
  const params = {
    Key: `real_${timestamp}.pdf`,
    Body: pdf,
    Bucket: 'bucket-name',
    ContentType: 'application/pdf',
  };

  // AWS S3 configuration
  const s3 = new aws.S3({
    accessKeyId: process.env.YOUR_AWS_KEY,
    secretAccessKey: process.env.YOUR_AWS_SECRET,
  });

  // Write to S3
  s3.putObject(params, function (err, response) {
    if(err) {
      console.log(err);
      res.status(500).json({ response: `Error writing file ${timestamp} to S3` });
    } else {
      res.status(200).json({ response: `File ${timestamp} saved to S3` });
    }
  });
}

// Initialize express
const app = express();

// Define API endpoint
app.get("/api", async (req, res) => {
  setupPuppeteer();
  
  let options = {};

  // Set options if running on AWS Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      args: chrome.args.concat(["--hide-scrollbars", "--disable-web-security"]),
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
      ignoreHTTPSErrors: true,
    };
  }

  // PDF configuration
  const bodyjson = {
    "config": {
      "width": "11.694444444444445in",
      "height": "8.26388888888889in",
      "margin": {
        "top": "0in",
        "right": "0.20833333333333334in",
        "bottom": "0in",
        "left": "0.20833333333333334in"
      },
      "displayHeaderFooter": true,
      "headerTemplate": " ",
      "footerTemplate": " ",
      "printBackground": true,
      "viewport": {
        "width": 686,
        "height": 976
      },
      "scale": 1.578231292517007
    },
      "html": "test"
  }
  
  const { config, html } = bodyjson;
  
  const pdf = await generatePDF(options, config, html);
  
  // Generate timestamp for unique file names
  const timestamp = Date.now();

  // Initialize a new PDF document
  const doc = new PDFDocument();

  // Create write stream for the new PDF
  let writeStream = fs.createWriteStream(`/tmp/${timestamp}.pdf`);
  doc.pipe(writeStream);
  doc.text('title');
  doc.end();

  // Once write stream is finished
  writeStream.on('finish', function () {
    writeToS3(pdf, timestamp, res);
  });
});

module.exports = app;
