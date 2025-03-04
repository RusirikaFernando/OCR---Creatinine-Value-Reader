const express = require('express');
const cors = require('cors');
const app = express();
const fs = require('fs');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
app.use(cors({
    origin: 'http://192.168.1.2:5000', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }));

(async () => {
    // Create and initialize the worker properly
    const worker = await createWorker('eng'); 

    // Multer Storage Configuration
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, "./uploads");
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    });

    const upload = multer({ storage: storage }).single("avatar");

    app.set("view engine", "ejs");

    // Routes
    app.get('/', (req, res) => {
        res.render('index');
    });

    app.post('/upload', (req, res) => {
        upload(req, res, async err => {
            if (err) return res.status(500).send("Error uploading file.");
    
            fs.readFile(`./uploads/${req.file.originalname}`, async (err, data) => {
                if (err) return res.status(500).send("Error reading file.");
    
                try {
                    // OCR processing
                    const { data: { text: extractedText } } = await worker.recognize(data);
                    
                    
                    // Date extraction
                    const dateRegex = /Reported\s+D[ae]te?[:\s]*(\d{2}\/\d{2}\/\d{4})/i;
                    const reportedDateMatch = extractedText.match(dateRegex);
                    const reportedDate = reportedDateMatch ? reportedDateMatch[1] : "Not found";
    
                    // Month conversion
                    let month = "Not found";
                    if (reportedDate !== "Not found") {
                        const [day, monthNum, year] = reportedDate.split('/');
                        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                                          'july', 'august', 'september', 'october', 'november', 'december'];
                        month = monthNames[parseInt(monthNum) - 1] || "Not found";
                    }
    
                    
                    // Serum creatinine extraction
                    const creatinineRegex = /Creatinine-\s*Serum\s+([0-9.]+)/i;
                    const serumMatch = extractedText.match(creatinineRegex);
                    const serumValue = serumMatch ? serumMatch[1] : "Not found";
    
                    //  Return proper JSON structure
                    res.json({
                        reportedDate,
                        month: month.toLowerCase(),
                        serumCreatinine: serumValue
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
