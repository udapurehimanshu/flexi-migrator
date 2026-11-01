const fs = require('fs');
const path = require('path');

const apiHtml = fs.readFileSync(path.join(__dirname, 'FlexiAPI.html'), 'utf8');
const wsHtml = fs.readFileSync(path.join(__dirname, 'FlexiWebService.html'), 'utf8');
const inputHtml = fs.readFileSync(path.join(__dirname, 'TextInputField.html'), 'utf8');
const pageHtml = fs.readFileSync(path.join(__dirname, 'Page.html'), 'utf8');

function getMethodDetail(html, anchor) {
  const needle = 'name="' + anchor;
  const start = html.indexOf(needle);
  if (start === -1) return null;
  const end = html.indexOf('</li>', start + needle.length) + 6;
  return html.slice(start, end).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

const anchors = [
  { file: apiHtml, anchors: ['backToPreviousPage--', 'backToPage-java.lang.String-', 'automate-java.lang.String-', 'automate-java.lang.String-java.lang.String-', 'sendKey-java.lang.String-', 'openApplication-java.lang.String-', 'putSessionObject-java.lang.String-java.lang.Object-', 'getSessionObject-java.lang.String-', 'putObject-java.lang.String-java.lang.Object-', 'getObject-java.lang.String-', 'setStatusMessage-java.lang.String-', 'openPage-java.lang.String-', 'closePage--', 'gotoComponent-java.lang.String-', 'validateForm-'] },
  { file: wsHtml, anchors: ['updateRawResponse-java.lang.String-', 'getRawResponse--', 'getResponseCode--', 'callWebService-java.util.HashMap-', 'setRequest-java.lang.String-'] },
  { file: inputHtml, anchors: ['getValue--', 'setPassword-boolean-'] },
];

for (const group of anchors) {
  for (const anchor of group.anchors) {
    const detail = getMethodDetail(group.file, anchor);
    if (detail) {
      console.log(`[${anchor}]\n${detail}\n`);
    } else {
      console.log(`[${anchor}] NOT FOUND`);
    }
  }
}
