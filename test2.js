const fs = require('fs');
const path = require('path');
const libre = require('libreoffice-convert');
libre.convertAsync = require('util').promisify(libre.convertWithOptions);

async function testConvert() {
    const pdfPath = path.join(__dirname, 'uploads', '1776859458871-FH_SITXFSA006_Practical_Observation_1-_Instructions__LV__1___1_.pdf');
    const docxPath = path.join(__dirname, 'test_output.docx');

    const input = fs.readFileSync(pdfPath);
    
    // Test 1: without infilter
    console.log("Testing without infilter...");
    try {
        const done1 = await require('util').promisify(libre.convert)(input, '.docx', undefined);
        fs.writeFileSync(docxPath, done1);
        console.log("Success without infilter!");
    } catch (e) {
        console.error("Failed without infilter:", e.message);
    }

    // Test 2: with infilter
    console.log("Testing with infilter...");
    try {
        const done2 = await libre.convertAsync(input, '.docx', undefined, {
            sofficeAdditionalArgs: ['--infilter=writer_pdf_import']
        });
        fs.writeFileSync(docxPath, done2);
        console.log("Success with infilter!");
    } catch (e) {
        console.error("Failed with infilter:", e.message);
    }
}

// Inject path if needed
const libreOfficeProgramDir = process.env.LIBREOFFICE_PATH || "C:\\Program Files\\LibreOffice\\program";
if (fs.existsSync(path.join(libreOfficeProgramDir, "soffice.exe"))) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter);
  if (!pathEntries.includes(libreOfficeProgramDir)) {
    process.env.PATH = `${libreOfficeProgramDir}${path.delimiter}${process.env.PATH || ""}`;
  }
}

testConvert();
