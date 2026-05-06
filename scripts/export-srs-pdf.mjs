import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "../asis/frontend/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js";

const root = process.cwd();
const inputPath = path.resolve(root, "docs", "ASIS_v4_1_SRS.html");
const outputPath = path.resolve(root, "docs", "ASIS_v4_1_SRS.pdf");
const browserPath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  headless: true,
  executablePath: browserPath,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(inputPath).href, { waitUntil: "networkidle0" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "16mm",
      right: "12mm",
      bottom: "16mm",
      left: "12mm",
    },
    preferCSSPageSize: true,
  });
  console.log(`Generated ${outputPath}`);
} finally {
  await browser.close();
}
