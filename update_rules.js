const fs = require("fs");
const filePath = "c:/Users/HimanshuMilindUdapur/Downloads/devprobe-clean/flexi-migrator/migrator.js";
let code = fs.readFileSync(filePath, "utf8");

// Update Rule 1 with official Intellinum FlexiAPI.backToPreviousPage()
code = code.replace(
  /if \(typeof flexi\.goBack === "function"\)[\s\S]*?else if \(typeof btnPreviousscreen/,
  `if (typeof flexi !== "undefined" && typeof flexi.backToPreviousPage === "function") {\n    flexi.backToPreviousPage();\n  } else if (typeof btnPreviousscreen`
);

code = code.replace(
  /Replaced flexi\.automate\("ctrl","X"\) with PWA goBack\(\) navigation/,
  `Replaced flexi.automate("ctrl","X") with official Intellinum flexi.backToPreviousPage()`
);

fs.writeFileSync(filePath, code, "utf8");
console.log("Successfully updated migrator.js with official Intellinum JavaDoc methods!");
