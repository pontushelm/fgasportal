import chromium from "@sparticuz/chromium"
import puppeteer, { type Browser } from "puppeteer-core"

type ChromiumHeadlessMode = true | "shell"

const LOCAL_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
]

export type PdfGenerationLogger = (message: string, metadata?: Record<string, unknown>) => void

export async function generatePdfFromHtml(
  html: string,
  options: {
    logger?: PdfGenerationLogger
  } = {}
) {
  const logger = options.logger ?? (() => undefined)
  const launchConfig = await resolveChromiumLaunchConfig()
  let browser: Browser | null = null

  logger("Resolved Chromium launch configuration", {
    executablePath: launchConfig.executablePath,
    isServerless: launchConfig.isServerless,
    platform: process.platform,
  })

  try {
    browser = await puppeteer.launch({
      args: launchConfig.args,
    defaultViewport: {
      width: 1240,
      height: 1754,
      deviceScaleFactor: 1,
    },
      executablePath: launchConfig.executablePath,
      headless: launchConfig.headless,
    })

    logger("Chromium browser launched")

    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: ["domcontentloaded", "networkidle0"],
    })
    await page.emulateMediaType("print")
    logger("Annual F-gas report HTML rendered in Chromium")

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
    logger("Annual F-gas report PDF buffer created", {
      byteLength: pdf.length,
    })

    return Buffer.from(pdf)
  } finally {
    if (browser) {
      await browser.close()
      logger("Chromium browser closed")
    }
  }
}

async function resolveChromiumLaunchConfig() {
  const isServerless = Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV
  )

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    const headless: ChromiumHeadlessMode = isServerless ? "shell" : true

    return {
      args: isServerless
        ? puppeteer.defaultArgs({ args: chromium.args, headless })
        : puppeteer.defaultArgs(),
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless,
      isServerless,
    }
  }

  if (isServerless) {
    const headless: ChromiumHeadlessMode = "shell"

    return {
      args: puppeteer.defaultArgs({ args: chromium.args, headless }),
      executablePath: await chromium.executablePath(),
      headless,
      isServerless,
    }
  }

  if (process.platform === "win32") {
    const { existsSync } = await import("node:fs")
    const localPath = LOCAL_CHROME_PATHS.find((path) => existsSync(path))

    if (localPath) {
      return {
        args: puppeteer.defaultArgs(),
        executablePath: localPath,
        headless: true,
        isServerless,
      }
    }
  }

  return {
    args: puppeteer.defaultArgs(),
    executablePath: await chromium.executablePath(),
    headless: true,
    isServerless,
  }
}
