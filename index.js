const app = require("express")();
const fs = require('fs-extra');
const PDFDocument = require('pdfkit');
import aws from 'aws-sdk';

let chrome = {};
let puppeteer;


if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  chrome = require("chrome-aws-lambda");
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}


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


    const { config, html } = req.body;
    const browser = await puppeteer.launch(options);
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
    
    const timestamp = Date.now();
    const doc = new PDFDocument();
    //use the tmp serverless function folder to create the write stream for the pdf
    let writeStream = fs.createWriteStream(`/tmp/${timestamp}.pdf`);
    doc.pipe(writeStream);
    doc.text('title');
    doc.end();

    writeStream.on('finish', function () {
      //once the doc stream is completed, read the file from the tmp folder
      const fileContent = pdf;
      //create the params for the aws s3 bucket
      var params = {
        Key: `real_${timestamp}.pdf`,
        Body: fileContent,
        Bucket: 'bubble-upload-s3-bucket',
        ContentType: 'application/pdf',
      };
  
      //Your AWS key and secret pulled from environment variables
      const s3 = new aws.S3({
        accessKeyId: process.env.YOUR_AWS_KEY,
        secretAccessKey: process.env.YOUR_AWS_SECRET,
      });
  
  
      s3.putObject(params, function (err, response) {
        res.status(200).json({ response: `File ${timestamp} saved to S3` });
      });
    });

    

});

app.post('/generate-pdf', async (req, res) => {

 
  console.log(req);
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

    const { body } = req;
    const config = body.config;
    const html = body.html;
    const browser = await puppeteer.launch(options);
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
    
    const timestamp = Date.now();
    const doc = new PDFDocument();
    //use the tmp serverless function folder to create the write stream for the pdf
    let writeStream = fs.createWriteStream(`/tmp/${timestamp}.pdf`);
    doc.pipe(writeStream);
    doc.text('title');
    doc.end();

    writeStream.on('finish', function () {
      //once the doc stream is completed, read the file from the tmp folder
      const fileContent = pdf;
      //create the params for the aws s3 bucket
      var params = {
        Key: `real_${timestamp}.pdf`,
        Body: fileContent,
        Bucket: 'bubble-upload-s3-bucket',
        ContentType: 'application/pdf',
      };
  
      //Your AWS key and secret pulled from environment variables
      const s3 = new aws.S3({
        accessKeyId: process.env.YOUR_AWS_KEY,
        secretAccessKey: process.env.YOUR_AWS_SECRET,
      });
  
  
      s3.putObject(params, function (err, response) {
        res.status(200).json({ response: `File ${timestamp} saved to S3` });
      });
    });

    


  } catch (err) {
    console.error(err);
    return null;
  }


});

module.exports = app;