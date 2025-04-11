const fs = require('fs');
const axios = require('axios');
const levenshtein = require('levenshtein');
const FormData = require('form-data');

// Define test images and ground truth data
const testImages = [
  './test_images/test1.jpg',
  './test_images/test2.jpg',
  './test_images/test3.jpg',
  './test_images/test4.jpg',
  './test_images/test5.jpg',
  './test_images/test6.jpg',
  './test_images/test7.jpg',
  './test_images/test8.jpg',
  './test_images/test9.jpg',
  './test_images/test10.jpg',
  './test_images/test11.jpg',
  './test_images/test12.jpg',
  './test_images/test13.jpg',
  './test_images/test14.jpg',
  './test_images/test15.jpg',
];

const groundTruthData = [
  { image: './test_images/test1.jpg', reportedDate: '11/03/2025', serumCreatinine: '0.83' },
  { image: './test_images/test2.jpg', reportedDate: '04/06/2018', serumCreatinine: '0.4' },
  { image: './test_images/test3.jpg', reportedDate: '16/05/2024', serumCreatinine: '0.91' },
  { image: './test_images/test4.jpg', reportedDate: '19/03/2025', serumCreatinine: '1.42' },
  { image: './test_images/test5.jpg', reportedDate: '16/05/2024', serumCreatinine: '0.91' },
  { image: './test_images/test6.jpg', reportedDate: '02/01/2025', serumCreatinine: '0.96' },
  { image: './test_images/test7.jpg', reportedDate: '23/08/2024', serumCreatinine: '0.97' },
  { image: './test_images/test8.jpg', reportedDate: '19/03/2025', serumCreatinine: '1.19' },
  { image: './test_images/test9.jpg', reportedDate: '18/12/2019', serumCreatinine: '0.4' },
  { image: './test_images/test10.jpg', reportedDate: '21/07/2023', serumCreatinine: '0.92' },
  { image: './test_images/test11.jpg', reportedDate: '29/04/2021', serumCreatinine: '0.6' },
  { image: './test_images/test12.jpg', reportedDate: '17/09/2020', serumCreatinine: '0.6' },
  { image: './test_images/test13.jpg', reportedDate: '20/10/2023', serumCreatinine: '0.97' },
  { image: './test_images/test14.jpg', reportedDate: '05/10/2019', serumCreatinine: '0.5' },
  { image: './test_images/test15.jpg', reportedDate: '25/01/2024', serumCreatinine: '0.99' },
];

// Accuracy calculation functions
const calculateWordLevelAccuracy = (ocrText, groundTruthText) => {
  const ocrWords = ocrText.split(/\s+/);
  const groundWords = groundTruthText.split(/\s+/);
  
  let correctWords = 0;
  ocrWords.forEach((word, index) => {
    if (word.toLowerCase() === groundWords[index]?.toLowerCase()) {
      correctWords++;
    }
  });
  return (correctWords / groundWords.length) * 100;
};

const calculateCharacterLevelAccuracy = (ocrText, groundTruthText) => {
  let correctChars = 0;
  for (let i = 0; i < Math.min(ocrText.length, groundTruthText.length); i++) {
    if (ocrText[i] === groundTruthText[i]) {
      correctChars++;
    }
  }
  return (correctChars / groundTruthText.length) * 100;
};

const calculateLevenshteinDistance = (ocrText, groundTruthText) => {
  const lev = new levenshtein(ocrText, groundTruthText);
  return lev.distance;
};

// Function to test OCR accuracy
const testOCR = async (imagePath, groundTruth) => {
    try {
      const formData = new FormData();
      formData.append('avatar', fs.createReadStream(imagePath));
  
      // Send image to the OCR server for processing
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
  
      const ocrData = response.data;
      const { reportedDate, serumCreatinine } = ocrData;
  
      // Calculate accuracy metrics
      const wordAccuracy = calculateWordLevelAccuracy(reportedDate, groundTruth.reportedDate);
      const charAccuracy = calculateCharacterLevelAccuracy(serumCreatinine, groundTruth.serumCreatinine);
      const levenshteinDistance = calculateLevenshteinDistance(serumCreatinine, groundTruth.serumCreatinine);

      //console.log(Testing image: ${imagePath});
      //console.log(Word-Level Accuracy (Date): ${wordAccuracy}%);
      //console.log(Character-Level Accuracy (Creatinine): ${charAccuracy}%);
      //console.log(Levenshtein Distance (Creatinine): ${levenshteinDistance});
  
      // Return the calculated accuracies for aggregation
      return { wordAccuracy, charAccuracy, levenshteinDistance };
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error.response ? error.response.data : error.message);
    }
};

// Variables to accumulate overall accuracy
let totalWordAccuracy = 0;
let totalCharAccuracy = 0;
let totalLevenshteinDistance = 0;
let totalImages = testImages.length;

// Run tests on all test images
(async () => {
  for (let i = 0; i < testImages.length; i++) {
    const imagePath = testImages[i];
    const groundTruth = groundTruthData[i];
    
    const { wordAccuracy, charAccuracy, levenshteinDistance } = await testOCR(imagePath, groundTruth);

    totalWordAccuracy += wordAccuracy;
    totalCharAccuracy += charAccuracy;
    totalLevenshteinDistance += levenshteinDistance; 
  }

  // Calculate overall accuracy
  const overallWordAccuracy = totalWordAccuracy / totalImages;
  const overallCharAccuracy = totalCharAccuracy / totalImages;
  const overallLevenshteinDistance = totalLevenshteinDistance / totalImages; 

  console.log(`Overall Word-Level Accuracy (Date): ${overallWordAccuracy}%`);
  console.log(`Overall Character-Level Accuracy (Creatinine): ${overallCharAccuracy}%`);
  console.log(`Overall Levenshtein Distance (Creatinine): ${overallLevenshteinDistance}`);
})();

