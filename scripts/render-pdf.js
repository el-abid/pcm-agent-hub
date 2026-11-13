import path from "node:path";
import { pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

async function findBrowser() {
  for (const candidate of CANDIDATES) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("Aucun navigateur Edge/Chrome trouvé");
}

const executablePath = await findBrowser();
const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  const inputArg = process.argv[2] || "docs/RUNBOOK.html";
  const outputArg = process.argv[3] || "docs/RUNBOOK.pdf";
  const footerLabel = process.argv[4] || "PCM Agent Hub · Documentation";
  const htmlPath = path.resolve(inputArg);
  const pdfPath = path.resolve(outputArg);

  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            }),
      ),
    );
  });
  await page.emulateMediaType("print");

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `
      <div style="width:100%; padding:0 14mm; display:flex; justify-content:space-between; align-items:center; font-family:'Segoe UI',Arial,sans-serif; font-size:8px; color:#94a3b8;">
        <span>${footerLabel}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    margin: { top: "14mm", bottom: "18mm", left: "14mm", right: "14mm" },
  });

  const { size } = await stat(pdfPath);
  console.log(`PDF généré : ${pdfPath}`);
  console.log(`Taille : ${(size / 1024).toFixed(1)} Ko`);
} finally {
  await browser.close();
}
