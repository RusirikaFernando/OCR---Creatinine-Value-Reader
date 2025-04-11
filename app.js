const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { createWorker } = require("tesseract.js");
const sharp = require("sharp");
const compression = require("compression");

const app = express();

app.use(compression());

app.use(
  cors({
    origin: "http://192.168.1.2:5000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

(async () => {
  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_pageseg_mode: 6, // Treat image as a single uniform block of text
    preserve_interword_spaces: 1,
  });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./uploads");
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });

  const upload = multer({ storage }).single("avatar");

  app.set("view engine", "ejs");

  app.get("/", (req, res) => {
    res.render("index");
  });

  app.post("/upload", (req, res) => {
    upload(req, res, async (err) => {
      if (err || !req.file) return res.status(500).send("Error uploading file.");

      const originalPath = `./uploads/${req.file.filename}`;
      const processedPath = `./uploads/processed-${req.file.filename}`;

      try {
        // Resize and optimize image using sharp
        await sharp(originalPath)
          .resize({ width: 1000 }) // Resize to 1000px wide
          .toFile(processedPath);

        // OCR on processed image
        const {
          data: { text: extractedText },
        } = await worker.recognize(processedPath);

        // Log extracted text for debugging
        //console.log("Extracted Text:", extractedText);

        // Clean up temporary files
        fs.unlink(originalPath, () => {});
        fs.unlink(processedPath, () => {});

        // Extract data using regex
        let reportedDate = "Not found";
        let serumCreatinine = "Not found";

        const dateRegexPatterns = [
          /Reported\s+D[ae]te?[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
          /REPORTED\s*:\s*(\d{2}\/\d{2}\/\d{4})/i,
          /REPORTED\s*[©:]?\s*(\d{2}\/\d{2}\/\d{4})/i,
        ];

        const creatinineRegexPatterns = [
          /Creatinine-\s*Serum\s+([0-9.]+)/i,
          /CREATININE\s+([0-9.]+)\s+(?:[0-9.-]+\s+mg\/dL)?/i,
          /CREATININE-(?:BLOOD)?\s*\(?CREATININE\)?\s*([\d.]+)\s*mg\/dL/i,
          /CREATININE\s+([0-9.]+)\s+(?:[0-9.-]+\s+)?mg\/dL/i,
        ];

        for (const regex of dateRegexPatterns) {
          const match = extractedText.match(regex);
          if (match) {
            reportedDate = match[1];
            break;
          }
        }

        for (const regex of creatinineRegexPatterns) {
          const match = extractedText.match(regex);
          if (match) {
            serumCreatinine = match[1];
            break;
          }
        }

        // Extract month from date
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

        res.json({
          reportedDate,
          month: month.toLowerCase(),
          serumCreatinine,
        });
      } catch (error) {
        console.error("OCR Error:", error);
        res.status(500).send("OCR processing failed.");
      }
    });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Running on port ${PORT}`));
})();
