const fs = require('fs');
const path = require('path');
const { convertFile } = require('./src/services/converter');

async function runTests() {
  const testDir = path.join(__dirname, 'test_files');
  const outputDir = path.join(__dirname, 'test_outputs');
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  // Create dummy text file to act as input, but it needs to be valid format for ffmpeg/sharp/libreoffice.
  // Actually, we can just log the `ensureSupported` logic and try with real files if possible, or just review the logic.
  
  console.log("Testing converter logic...");
  
  try {
    const res = await convertFile({
        sourcePath: 'dummy.pdf',
        sourceExt: 'pdf',
        targetExt: 'docx',
        outputPath: 'dummy.docx'
    });
    console.log(res);
  } catch (e) {
    console.error("PDF to DOCX Error:", e);
  }
}

runTests();
