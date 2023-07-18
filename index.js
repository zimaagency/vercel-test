const express = require("express");
const fs = require('fs-extra');
const PDFDocument = require('pdfkit');
const aws = require('aws-sdk');

let puppeteer;
let chrome = {};


function setupPuppeteer() {
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    chrome = require("chrome-aws-lambda");
    puppeteer = require("puppeteer-core");
  } else {
    puppeteer = require("puppeteer");
  }
}


async function generatePDF(options, config, html) {
  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();


  const { width, height, margin } = config;
  await page.setViewport({
    width: parseInt(width),
    height: parseInt(height),
    deviceScaleFactor: 1,
  });

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US',
  });

  await page.setContent(html);
  const pdf = await page.pdf(config);

  await browser.close();
  return pdf;
}


function writeToS3(pdf, timestamp, res) {
  const params = {
    Key: `real_${timestamp}.pdf`,
    Body: pdf,
    Bucket: 'bubble-upload-s3-bucket',
    ContentType: 'application/pdf',
  };

  const s3 = new aws.S3({
    accessKeyId: process.env.YOUR_AWS_KEY,
    secretAccessKey: process.env.YOUR_AWS_SECRET,
  });

  s3.putObject(params, function (err, response) {
    if(err) {
      console.log(err);
      res.status(500).json({ response: `Error writing file ${timestamp} to S3` });
    } else {
      res.status(200).json({ response: `File ${timestamp} saved to S3` });
    }
  });
}



const app = express();

app.get("/api", async (req, res) => {
  setupPuppeteer();
  let options = {};

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      args: chrome.args.concat(["--hide-scrollbars", "--disable-web-security"]),
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
      ignoreHTTPSErrors: true,
    };
  }


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
