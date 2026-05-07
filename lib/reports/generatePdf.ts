import chromium from "@sparticuz/chromium"
import puppeteer from "puppeteer-core"

const LOCAL_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
]

export async function generatePdfFromHtml(html: string) {
  const executablePath = await resolveChromiumExecutablePath()
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--disable-dev-shm-usage",
      "--font-render-hinting=medium",
      "--no-sandbox",
    ],
    defaultViewport: {
      width: 1240,
      height: 1754,
      deviceScaleFactor: 1,
    },
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: ["domcontentloaded", "networkidle0"],
    })
    await page.emulateMediaType("print")

    const pdf = await page.pdf({
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="width:100%;font-size:7px;color:#4b5563;padding:0 13mm;display:flex;justify-content:space-between;font-family:Arial,Helvetica,sans-serif;">
          <span>FgasPortal årsrapport</span>
          <span>Sida <span class="pageNumber"></span> av <span class="totalPages"></span></span>
        </div>
      `,
      format: "A4",
      headerTemplate: "<div></div>",
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "10mm",
        left: "0mm",
      },
      preferCSSPageSize: true,
      printBackground: true,
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

async function resolveChromiumExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return await chromium.executablePath()
  }

  if (process.platform === "win32") {
    const { existsSync } = await import("node:fs")
    const localPath = LOCAL_CHROME_PATHS.find((path) => existsSync(path))

    if (localPath) return localPath
  }

  return await chromium.executablePath()
}
