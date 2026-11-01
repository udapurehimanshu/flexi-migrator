const fs = require('fs');
const { extractPdfLines } = require('./pure_pdf_parser.js');
const pdf = fs.readFileSync('C:/Users/HimanshuMilindUdapur/.gemini/antigravity/brain/e1feeef5-b217-4bf9-ab68-c0d3dca86824/.user_uploaded/media_1793341657538_03e76727.pdf');
const lines = extractPdfLines(pdf);

lines.forEach((l, idx) => {
  if (l.text.includes('<< Start Personalization') || l.text.includes('Field Name:') || l.text.includes('_afterPageEntered') || l.text.includes('_afterClick')) {
    console.log('p' + l.page + ' L' + idx + ': ' + l.text);
  }
});
