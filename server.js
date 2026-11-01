/**
 * =============================================================================
 * Intellinum Flexi Personalization Web Platform Server (SSH -> PWA)
 * Pure Node.js HTTP Server - Zero external dependencies
 * 100% Dynamic • File-Dependent • Single-File Session Isolated
 * =============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const {
  MIGRATION_RULES,
  convertGroovyToPwaJs,
  convertPdfFile,
  convertTxtFile,
  generateOracleSql
} = require('./flexi_converter.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const IMS_FOLDER = path.join(__dirname, 'IMS PERSONALIZATION DPW');

function parseMultipart(req, callback) {
  const cType = req.headers['content-type'] || '';
  if (!cType.includes('boundary=')) {
    return callback(new Error('Missing multipart boundary header'));
  }
  const boundary = cType.split('boundary=')[1];
  const chunks = [];

  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const boundaryBuffer = Buffer.from('--' + boundary);
    const start = buffer.indexOf(boundaryBuffer);
    if (start === -1) return callback(new Error('Invalid multipart body'));

    // Extract filename from header section
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) return callback(new Error('Invalid multipart headers'));
    const headerStr = buffer.slice(start, headerEnd).toString('utf8');

    let fileName = 'uploaded_file';
    const matchFn = headerStr.match(/filename="([^"]+)"/i);
    if (matchFn && matchFn[1]) {
      fileName = path.basename(matchFn[1]);
    }

    const dataStart = headerEnd + 4;
    const end = buffer.indexOf(boundaryBuffer, dataStart) - 2;
    if (dataStart >= end) return callback(new Error('Uploaded file payload is empty'));

    const fileData = buffer.slice(dataStart, end);
    callback(null, { fileName, buffer: fileData });
  });
}

function parseJsonBody(req, callback) {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks).toString('utf8');
      callback(null, body ? JSON.parse(body) : {});
    } catch (e) {
      callback(e);
    }
  });
}

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', engine: 'v2-dynamic-file-dependent', time: new Date().toISOString() }));
    return;
  }

  // Rules Catalog API
  if (pathname === '/api/rules') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MIGRATION_RULES.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description
    }))));
    return;
  }

  // Intellinum Methods API
  if (pathname === '/api/methods') {
    const methodsPath = path.join(__dirname, 'all_intellinum_methods.json');
    if (fs.existsSync(methodsPath)) {
      const data = fs.readFileSync(methodsPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Methods database not found' }));
    }
    return;
  }

  // IMS Sample Reports List API
  if (pathname === '/api/ims-files') {
    if (fs.existsSync(IMS_FOLDER)) {
      try {
        const files = fs.readdirSync(IMS_FOLDER).filter(f => f.endsWith('.pdf') || f.endsWith('.txt') || f.endsWith('.xml'));
        const list = files.map(f => {
          const stat = fs.statSync(path.join(IMS_FOLDER, f));
          return {
            name: f,
            size: stat.size,
            sizeKb: (stat.size / 1024).toFixed(1)
          };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(list));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // IMS Sample Report Direct Loader API
  if (pathname === '/api/ims-file') {
    const fileName = parsedUrl.query.name;
    if (!fileName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing name parameter' }));
      return;
    }

    const safeName = path.basename(fileName);
    const targetFile = path.join(IMS_FOLDER, safeName);
    if (!fs.existsSync(targetFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `File not found in IMS folder: ${safeName}` }));
      return;
    }

    try {
      const buf = fs.readFileSync(targetFile);
      const isPdf = safeName.toLowerCase().endsWith('.pdf') || buf.slice(0, 5).toString('ascii').startsWith('%PDF');
      const result = isPdf ? convertPdfFile(buf, safeName) : convertTxtFile(buf.toString('utf8'), safeName);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Live Snippet Conversion Endpoint
  if (req.method === 'POST' && pathname === '/api/convert-snippet') {
    parseJsonBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
        return;
      }
      const groovyCode = body.code || '';
      const result = convertGroovyToPwaJs(groovyCode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: result.code,
        appliedRules: result.appliedRules.map(r => ({ id: r.id, name: r.name, description: r.description })),
        isValid: result.isValid,
        syntaxError: result.syntaxError
      }));
    });
    return;
  }

  // Full File Conversion Endpoint (Multipart or JSON)
  if (req.method === 'POST' && pathname === '/api/convert') {
    const cType = req.headers['content-type'] || '';
    if (cType.includes('multipart/form-data')) {
      parseMultipart(req, (err, fileObj) => {
        if (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
          return;
        }

        try {
          const { fileName, buffer } = fileObj;
          const isPdf = buffer.slice(0, 5).toString('ascii').startsWith('%PDF') || fileName.toLowerCase().endsWith('.pdf');
          let result;
          if (isPdf) {
            result = convertPdfFile(buffer, fileName);
          } else {
            result = convertTxtFile(buffer.toString('utf8'), fileName);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (convErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: convErr.message }));
        }
      });
      return;
    } else {
      parseJsonBody(req, (err, body) => {
        if (err || !body.content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing content in request body' }));
          return;
        }
        try {
          const fileName = body.fileName || 'uploaded_payload.txt';
          const result = convertTxtFile(body.content, fileName);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (convErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: convErr.message }));
        }
      });
      return;
    }
  }

  // Generate Oracle SQL Endpoint
  if (req.method === 'POST' && pathname === '/api/generate-sql') {
    parseJsonBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
        return;
      }
      try {
        const records = body.records || [];
        const appName = body.appName || 'Custom Application';
        const tableName = body.tableName || 'FLEXI_PERSONALIZATION';
        const sql = generateOracleSql(records, appName, tableName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sql }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.pdf': 'application/pdf'
  };

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback to index.html for SPA routes
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n============================================================`);
  console.log(`   INTELLINUM FLEXI PWA MIGRATION PLATFORM`);
  console.log(`   Engine   : 100% File-Dependent & Dynamic (v2.0)`);
  console.log(`   Status   : Ready and listening`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`   Direct UI: ${path.join(PUBLIC_DIR, 'index.html')}`);
  console.log(`============================================================\n`);
});
