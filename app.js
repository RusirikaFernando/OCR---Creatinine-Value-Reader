const express = require("express");
const cors = require("cors");
const app = express();
const fs = require("fs");
const multer = require("multer");
const { createWorker } = require("tesseract.js");

app.use(
  cors({
    origin: "http://192.168.1.2:5000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

(async () => {
  // Create and initialize the worker properly
  const worker = await createWorker("eng");

  // Multer Storage Configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./uploads");
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  });

  const upload = multer({ storage: storage }).single("avatar");

  app.set("view engine", "ejs");

  // Routes
  app.get("/", (req, res) => {
    res.render("index");
  });

  app.post("/upload", (req, res) => {
    upload(req, res, async (err) => {
      if (err) return res.status(500).send("Error uploading file.");

      fs.readFile(`./uploads/${req.file.originalname}`, async (err, data) => {
        if (err) return res.status(500).send("Error reading file.");

        try {
          // OCR processing
          const {
            data: { text: extractedText },
          } = await worker.recognize(data);

          // Log extracted text for debugging
          //console.log("Extracted Text:", extractedText);

          // Determine the format of the report
          let reportedDate, serumCreatinine;

          // Regex patterns for different formats
          const dateRegexPatterns = [
            /Reported\s+D[ae]te?[:\s]*(\d{2}\/\d{2}\/\d{4})/i, // A_format
            /REPORTED\s*:\s*(\d{2}\/\d{2}\/\d{4})/i, // lanka 1,3
            /REPORTED\s*[©:]?\s*(\d{2}\/\d{2}\/\d{4})/i, // lanka 2
          ];

          const creatinineRegexPatterns = [
            /Creatinine-\s*Serum\s+([0-9.]+)/i, // A_format
            /CREATININE\s+([0-9.]+)\s+(?:[0-9.-]+\s+mg\/dL)?/i, // lanka 1
            /CREATININE-(?:BLOOD)?\s*\(?CREATININE\)?\s*([\d.]+)\s*mg\/dL/i, //lanka 2
            /CREATININE\s+([0-9.]+)\s+(?:[0-9.-]+\s+)?mg\/dL/i, // lanka 3
          ];

          // Extract reported date
          for (const regex of dateRegexPatterns) {
            const match = extractedText.match(regex);
            if (match) {
              reportedDate = match[1];
              break;
            }
          }

          // Extract creatinine value
          for (const regex of creatinineRegexPatterns) {
            const match = extractedText.match(regex);
            if (match) {
              serumCreatinine = match[1];
              break;
            }
          }

          // If no date or creatinine found, set to "Not found"
          reportedDate = reportedDate || "Not found";
          serumCreatinine = serumCreatinine || "Not found";

          // Month conversion
          let month = "Not found";
          if (reportedDate !== "Not found") {
            const [day, monthNum, year] = reportedDate.split("/");
            const monthNames = [
              "january",
              "february",
              "march",
              "april",
              "may",
              "june",
              "july",
              "august",
              "september",
              "october",
              "november",
              "december",
            ];
            month = monthNames[parseInt(monthNum) - 1] || "Not found";
          }

          // Return JSON response
          res.json({
            reportedDate,
            month: month.toLowerCase(),
            serumCreatinine,
          });
        } catch (error) {
          console.log("OCR Error:", error);
          res.status(500).send("OCR processing failed.");
        }
      });
    });
  });

  // Start the server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Running on port ${PORT}`));
})();
