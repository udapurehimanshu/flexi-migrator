const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const health = await get('/api/health');
  console.log('Health:', health);

  const files = await get('/api/ims-files');
  console.log('Available IMS files count:', files.length);

  const f1 = await get('/api/ims-file?name=NSBP%20-%20Build%20PLT%20Report_Personalization.pdf');
  console.log('\n--- FILE 1 ---');
  console.log('File:', f1.fileName);
  console.log('App:', f1.appName);
  console.log('Screens:', f1.pagesCount, f1.pages.map(p => p.pageName));
  console.log('Components:', f1.componentsCount);
  console.log('Scripts:', f1.scriptsCount);

  const f2 = await get('/api/ims-file?name=STD%20-%20Assign%20Order%20to%20Load%20Report_Personalization.pdf');
  console.log('\n--- FILE 2 ---');
  console.log('File:', f2.fileName);
  console.log('App:', f2.appName);
  console.log('Screens:', f2.pagesCount, f2.pages.map(p => p.pageName));
  console.log('Components:', f2.componentsCount);
  console.log('Scripts:', f2.scriptsCount);

  const f3 = await get('/api/ims-file?name=STD%20-%20Pick%20wave%20LPN%20%20PLT%20Report_Personalization.pdf');
  console.log('\n--- FILE 3 ---');
  console.log('File:', f3.fileName);
  console.log('App:', f3.appName);
  console.log('Screens:', f3.pagesCount, f3.pages.map(p => p.pageName));
  console.log('Components:', f3.componentsCount);
  console.log('Scripts:', f3.scriptsCount);

  const f4 = await get('/api/ims-file?name=STD%20-%20Receiving%20On%20PLT%20Report_Personalization.pdf');
  console.log('\n--- FILE 4 ---');
  console.log('File:', f4.fileName);
  console.log('App:', f4.appName);
  console.log('Screens:', f4.pagesCount, f4.pages.map(p => p.pageName));
  console.log('Components:', f4.componentsCount);
  console.log('Scripts:', f4.scriptsCount);
}

run().catch(console.error);

