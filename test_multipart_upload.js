const fs = require('fs');
const path = require('path');
const http = require('http');

function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    const postHeader = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`;
    const postFooter = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(postHeader, 'utf8'),
      fileContent,
      Buffer.from(postFooter, 'utf8')
    ]);

    const req = http.request('http://localhost:3000/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const file1 = path.join(__dirname, 'IMS PERSONALIZATION DPW', 'STD - Vehicle load Report_Personalization.pdf');
  const r1 = await uploadFile(file1);
  console.log('Upload 1 (Vehicle Load):', r1.appName, '| Screens:', r1.pagesCount, '| Scripts:', r1.scriptsCount, '| Session:', r1.sessionId);

  const file2 = path.join(__dirname, 'IMS PERSONALIZATION DPW', 'STD-RECIVING BOX LPN PERSONILAZTION REPORT.pdf');
  const r2 = await uploadFile(file2);
  console.log('Upload 2 (Receiving Box):', r2.appName, '| Screens:', r2.pagesCount, '| Scripts:', r2.scriptsCount, '| Session:', r2.sessionId);

  console.log('\nVerification of Session Independence:');
  console.log('Session 1 != Session 2:', r1.sessionId !== r2.sessionId ? 'PASS' : 'FAIL');
  console.log('App 1 != App 2:', r1.appName !== r2.appName ? 'PASS' : 'FAIL');
}

run().catch(console.error);

