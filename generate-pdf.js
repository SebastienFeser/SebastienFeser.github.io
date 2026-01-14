const puppeteer = require('puppeteer');
const path = require('path');

async function generatePDF(htmlFile, outputFile) {
    const browser = await puppeteer.launch({
        headless: 'new'
    });

    const page = await browser.newPage();

    // Load the HTML file
    const filePath = path.resolve(__dirname, htmlFile);
    await page.goto(`file://${filePath}`, {
        waitUntil: 'networkidle0'
    });

    // Generate PDF
    await page.pdf({
        path: outputFile,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '0',
            right: '0',
            bottom: '0',
            left: '0'
        }
    });

    console.log(`Generated: ${outputFile}`);
    await browser.close();
}

async function main() {
    try {
        // Generate French CV
        await generatePDF(
            'assets/documents/CV_FR.html',
            'assets/documents/CV_FR.pdf'
        );

        // Generate English CV
        await generatePDF(
            'assets/documents/CV_EN.html',
            'assets/documents/CV_EN.pdf'
        );

        console.log('All PDFs generated successfully!');
    } catch (error) {
        console.error('Error generating PDFs:', error);
    }
}

main();
