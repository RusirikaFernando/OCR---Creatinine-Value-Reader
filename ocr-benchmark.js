const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const sharp = require("sharp");
const { createWorker } = require("tesseract.js");

// Helper to format bytes to MB
const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);

// Get test image paths
const testDir = path.resolve(__dirname, "./test/test_images/");
const imagePaths = fs.readdirSync(testDir)
  .filter(file => /\.(jpg|jpeg|png)$/i.test(file))
  .map(file => path.join(testDir, file));

// Benchmark OCR for each image
(async () => {
  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_pageseg_mode: 6,
    preserve_interword_spaces: 1,
  });

  let totalTime = 0;
  let totalMem = 0;
  let totalSize = 0;

  for (const imagePath of imagePaths) {
    try {
      const processedPath = path.join(testDir, "processed-" + path.basename(imagePath));
      
      // Measure memory and time before processing
      const startMemStats = process.memoryUsage();
      const startMem = startMemStats.rss;
      const startTime = performance.now();

      // Resize the image
      await sharp(imagePath)
        .resize({ width: 1000 })
        .toFile(processedPath);

      // Run OCR
      await worker.recognize(processedPath);

      // Measure memory and time after processing
      const endTime = performance.now();
      const endMemStats = process.memoryUsage();
      const endMem = endMemStats.rss;

      const timeTaken = endTime - startTime;
      const memUsed = endMem - startMem;
      const imageSize = fs.statSync(imagePath).size;

      totalTime += timeTaken;
      totalMem += memUsed;
      totalSize += imageSize;

      console.log(`✅ Processed: ${imagePath}`);
      console.log(`   Time: ${timeTaken.toFixed(0)} ms`);
      console.log(`   Memory: ${toMB(memUsed)} MB`);
      console.log(`   Image Size: ${(imageSize / 1024).toFixed(2)} KB\n`);

      fs.unlinkSync(processedPath); // Clean up processed image
    } catch (err) {
      console.error(`❌ Failed on: ${imagePath}`, err.message);
    }
  }

  const avgTime = totalTime / imagePaths.length;
  const avgMem = totalMem / imagePaths.length;
  const avgSize = totalSize / imagePaths.length;

  console.log("📊 Average Performance Metrics:");
  console.log(`   Avg Time: ${avgTime.toFixed(2)} ms`);
  console.log(`   Avg Memory: ${toMB(avgMem)} MB`);
  console.log(`   Avg Image Size: ${(avgSize / 1024).toFixed(2)} KB`);

  await worker.terminate();
})();
