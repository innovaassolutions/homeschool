/**
 * IXL Diagnostic Scraper
 *
 * Logs into IXL as a parent, visits each child's diagnostic report,
 * extracts current levels and skill recommendations, then syncs the
 * data to your Convex database via the /ixl-sync HTTP action.
 *
 * Run locally:  npm run dev
 * Railway:      npm start  (triggered by a Railway cron job)
 */

import { chromium, type Page } from "playwright";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env from the scraper dir, then fall back to ../.env.local (local dev)
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../../.env.local") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.IXL_BASE_URL ?? "https://www.ixl.com";
const USERNAME = process.env.IXL_USERNAME ?? "";
const PASSWORD = process.env.IXL_PASSWORD ?? "";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const SYNC_SECRET = process.env.IXL_SYNC_SECRET ?? "";
const STUDENT_NAMES = (process.env.IXL_STUDENT_NAMES ?? "")
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean);

if (!USERNAME || !PASSWORD || !CONVEX_URL || !SYNC_SECRET) {
  console.error("Missing required environment variables. Check .env.example");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrandLevel {
  name: string;
  level: number;
}

interface SkillRec {
  skillId: string;
  skillName: string;
  strand: string;
  priority: number;
  url?: string;
}

interface SubjectData {
  overallLevel?: number;
  strands: StrandLevel[];
  recommendations: SkillRec[];
}

interface ChildData {
  name: string;
  math?: SubjectData;
  ela?: SubjectData;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  console.log("Starting IXL sync...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();

    // Suppress noisy console output from IXL's own JS
    page.on("console", () => {});

    await login(page);

    const students = STUDENT_NAMES.length > 0
      ? STUDENT_NAMES
      : await discoverStudentNames(page);

    if (students.length === 0) {
      console.error(
        "No students found. Set IXL_STUDENT_NAMES in your .env file."
      );
      process.exit(1);
    }

    console.log(`Students to sync: ${students.join(", ")}`);

    const childrenData: ChildData[] = [];

    for (const name of students) {
      console.log(`\n--- Syncing: ${name} ---`);
      const data = await scrapeChild(page, name);
      childrenData.push(data);
    }

    await sendToConvex(childrenData);
    console.log("\nIXL sync complete!");
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

async function login(page: Page) {
  // Ensure no double-slash in URL
  const signinUrl = BASE_URL.replace(/\/$/, "") + "/signin";
  console.log(`Navigating to ${signinUrl}`);
  await page.goto(signinUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  console.log(`Page URL after load: ${page.url()}`);
  console.log(`Page title: ${await page.title()}`);

  // Log all input fields found so we can verify selectors
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((i) => ({
      name: i.name,
      id: i.id,
      type: i.type,
      placeholder: i.placeholder,
    }))
  );
  console.log("Inputs on page:", JSON.stringify(inputs));

  // Log all buttons
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, input[type=submit]")).map((b) => ({
      text: b.textContent?.trim().slice(0, 40),
      type: (b as HTMLButtonElement).type,
      id: b.id,
    }))
  );
  console.log("Buttons on page:", JSON.stringify(buttons));

  console.log(`Filling username (starts with: ${USERNAME.slice(0, 3)}...)`);

  // IXL uses React controlled inputs. We must use the native value setter
  // to trigger React's synthetic event system and enable the submit button.
  // Avoid inner `function` declarations — tsx compiles them with __name()
  // which doesn't exist in the browser context.
  await page.evaluate(([u, p]: [string, string]) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    )?.set;
    const uEl = document.getElementById("siusername") as HTMLInputElement;
    nativeSetter?.call(uEl, u);
    uEl.dispatchEvent(new Event("input", { bubbles: true }));
    uEl.dispatchEvent(new Event("change", { bubbles: true }));
    const pEl = document.getElementById("sipassword") as HTMLInputElement;
    nativeSetter?.call(pEl, p);
    pEl.dispatchEvent(new Event("input", { bubbles: true }));
    pEl.dispatchEvent(new Event("change", { bubbles: true }));
  }, [USERNAME, PASSWORD] as [string, string]);

  // Wait for React to process the events and enable the submit button
  await page.waitForTimeout(1000);

  // Log button state before clicking
  const btnDisabled = await page.evaluate(() => {
    const btn = document.getElementById("signin-button") as HTMLButtonElement | null;
    return { disabled: btn?.disabled, text: btn?.textContent?.trim() };
  });
  console.log("Submit button state:", JSON.stringify(btnDisabled));

  // Submit — use force:true as fallback if button is still disabled
  await page.locator('#signin-button').click({ force: btnDisabled.disabled });

  // Wait a moment and log what happened
  await page.waitForTimeout(3000);
  console.log(`URL after submit: ${page.url()}`);
  console.log(`Title after submit: ${await page.title()}`);
  // Log any visible error messages (IXL shows errors in various ways)
  const errorText = await page.evaluate(() => {
    const selectors = ['[class*="error"]', '[class*="alert"]', '[role="alert"]', '#signin-error', '.login-error'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim().slice(0, 200);
    }
    // Also check for any red/warning text
    return document.body.innerText.slice(0, 500);
  });
  console.log(`Page content after submit: ${errorText}`);

  // Wait until we've left the sign-in page
  await page.waitForFunction(
    () => !window.location.href.includes("/signin"),
    { timeout: 30_000 }
  );

  console.log("Logged in successfully");
}

// ---------------------------------------------------------------------------
// Discover student names (fallback when IXL_STUDENT_NAMES is not set)
// ---------------------------------------------------------------------------

async function discoverStudentNames(page: Page): Promise<string[]> {
  await page.goto(`${BASE_URL}/membership/parent/`, {
    waitUntil: "networkidle",
  });

  const names = await page.evaluate(() => {
    const selectors = [
      '[data-student-name]',
      '[class*="student"][class*="name"]',
      '.student-name',
      '.student-card .name',
    ];
    for (const sel of selectors) {
      const els = Array.from(document.querySelectorAll(sel));
      if (els.length) return els.map((el) => el.textContent?.trim() ?? "").filter(Boolean);
    }
    return [];
  });

  return names;
}

// ---------------------------------------------------------------------------
// Scrape a single child
// ---------------------------------------------------------------------------

async function scrapeChild(page: Page, name: string): Promise<ChildData> {
  // Switch the parent account to this student
  await switchToStudent(page, name);

  // Navigate to the diagnostic results page
  const diagnosticUrl = `${BASE_URL}/reports/diagnostic-results`;
  await page.goto(diagnosticUrl, { waitUntil: "networkidle", timeout: 20_000 });

  // Save a debug screenshot (useful when calibrating selectors)
  await page.screenshot({
    path: `debug-${name.toLowerCase()}-diagnostic.png`,
    fullPage: true,
  });

  const math = await scrapeSubject(page, "math");
  const ela = await scrapeSubject(page, "ela");

  console.log(
    `  Math: overall=${math.overallLevel ?? "?"}, strands=${math.strands.length}, recs=${math.recommendations.length}`
  );
  console.log(
    `  ELA:  overall=${ela.overallLevel ?? "?"}, strands=${ela.strands.length}, recs=${ela.recommendations.length}`
  );

  return { name, math, ela };
}

// ---------------------------------------------------------------------------
// Switch parent account to a specific student
// ---------------------------------------------------------------------------

async function switchToStudent(page: Page, studentName: string) {
  // IXL shows a student-switcher dropdown in the parent header.
  // We try several possible selectors — adjust if IXL changes their markup.
  const switcherSelectors = [
    '[data-testid="student-switcher"]',
    '[aria-label*="student" i]',
    '.student-switcher',
    '[class*="studentSwitcher"]',
    '[class*="student-switcher"]',
  ];

  for (const sel of switcherSelectors) {
    const el = page.locator(sel).first();
    const visible = await el.isVisible({ timeout: 2_000 }).catch(() => false);
    if (visible) {
      await el.click();
      // Try to click the student name in the dropdown
      await page.getByText(studentName, { exact: false }).first().click();
      await page.waitForLoadState("networkidle");
      console.log(`  Switched to ${studentName}`);
      return;
    }
  }

  // Fallback: navigate directly via a URL pattern some IXL setups use
  await page.goto(`${BASE_URL}/reports/diagnostic-results`, {
    waitUntil: "networkidle",
  });
  console.log(`  (Student switcher not found — using current active student)`);
}

// ---------------------------------------------------------------------------
// Scrape one subject (math or ela) from the diagnostic results page
// ---------------------------------------------------------------------------

async function scrapeSubject(
  page: Page,
  subject: "math" | "ela"
): Promise<SubjectData> {
  const data: SubjectData = { strands: [], recommendations: [] };

  // The page shows math first, then ELA.
  // We look for the overall-level heading, then walk down to find strands.

  const overallText = subject === "math"
    ? "Overall math level"
    : "Overall english language arts level";

  // ---------- Overall level ----------
  try {
    // The level range is rendered as text near the heading, e.g. "60 130"
    // or as aria-valuemin / aria-valuemax attributes on a slider.
    const section = page
      .getByText(overallText, { exact: false })
      .first();

    await section.waitFor({ timeout: 8_000 });

    // Try to read the level from a nearby numeric text or aria attribute
    const levelHandle = await section.evaluate((el) => {
      // Walk siblings/children for numbers
      const parent = el.parentElement;
      if (!parent) return null;

      // Look for a slider with aria-valuenow
      const slider = parent.querySelector('[aria-valuenow]');
      if (slider) return Number(slider.getAttribute('aria-valuenow'));

      // Look for the first number in surrounding text
      const text = parent.textContent ?? '';
      const nums = text.match(/\d+/g);
      return nums ? Number(nums[0]) : null;
    });

    if (levelHandle != null) {
      data.overallLevel = levelHandle;
    }
  } catch {
    // Heading not found on this page — not all children have both subjects
  }

  // ---------- Strands + Recommendations ----------
  // IXL renders each strand as a section with:
  //   - A coloured heading (strand name)
  //   - A level indicator (star position or aria-valuenow)
  //   - A list of recommended skill links

  const strandData = await page.evaluate(
    ({ subject, overallText }) => {
      const results: Array<{
        strandName: string;
        level: number | null;
        skills: Array<{ name: string; code: string; url: string }>;
      }> = [];

      // Find all headings that could be strand names.
      // IXL uses h2/h3 with a distinct colour class for strand headings.
      const headings = Array.from(
        document.querySelectorAll("h2, h3, h4, [class*='strand'], [class*='Strand']")
      );

      // The subject section starts at the "Overall X level" heading.
      // Find it and only look at content after it.
      const overallHeading = headings.find((h) =>
        h.textContent?.toLowerCase().includes(overallText.toLowerCase().replace("overall ", ""))
      );

      const startIdx = overallHeading
        ? headings.indexOf(overallHeading)
        : 0;

      // The next subject starts at a heading containing the other subject's name.
      const otherSubject = subject === "math" ? "english language arts" : "math";

      for (let i = startIdx + 1; i < headings.length; i++) {
        const h = headings[i];
        const headingText = h.textContent?.trim() ?? "";

        // Stop when we hit the other subject's section
        if (headingText.toLowerCase().includes(otherSubject)) break;

        // Skip empty or very long headings (they're probably not strand names)
        if (!headingText || headingText.length > 60) continue;

        // Skip navigation/UI headings
        if (["math", "english language arts", "reading"].includes(headingText.toLowerCase())) continue;

        // Find the level for this strand
        // Look for a slider or aria element nearby
        let level: number | null = null;

        const container = h.closest("section, [class*='strand'], [class*='Strand']") ?? h.parentElement;
        if (container) {
          const slider = container.querySelector('[aria-valuenow], [data-level]');
          if (slider) {
            const val = slider.getAttribute('aria-valuenow') ?? slider.getAttribute('data-level');
            level = val ? Number(val) : null;
          }

          // Fallback: find a number displayed near a star or flag icon
          if (level == null) {
            const numEls = Array.from(container.querySelectorAll('[class*="level"], [class*="score"], span'));
            for (const el of numEls) {
              const num = Number(el.textContent?.trim());
              if (!isNaN(num) && num > 0 && num <= 1300) {
                level = num;
                break;
              }
            }
          }
        }

        // Find recommended skills (links with ">>" pattern or inside a recommendations list)
        const skillLinks: Array<{ name: string; code: string; url: string }> = [];
        const recommendedSection =
          container?.querySelector('[class*="recommend"], [class*="skill"]') ??
          container;

        if (recommendedSection) {
          const links = Array.from(recommendedSection.querySelectorAll("a[href*='ixl.com'], a[href^='/']"));
          for (const link of links) {
            const href = (link as HTMLAnchorElement).href;
            const text = link.textContent?.replace(">>", "").trim() ?? "";
            if (!text || text.length < 3) continue;

            // IXL skill codes are typically 3 characters like "5B5", "LDQ", "UMT"
            // They appear as a sibling text node or in a span next to the skill name
            const parent = link.parentElement;
            const codeEl = parent?.querySelector('[class*="code"], span:last-child');
            const code = codeEl?.textContent?.trim() ?? "";

            skillLinks.push({ name: text, code, url: href });
          }
        }

        if (headingText && (level != null || skillLinks.length > 0)) {
          results.push({ strandName: headingText, level, skills: skillLinks });
        }
      }

      return results;
    },
    { subject, overallText }
  );

  // Convert scraped data into our format
  for (const strand of strandData) {
    if (strand.level != null) {
      data.strands.push({ name: strand.strandName, level: strand.level });
    }

    for (let i = 0; i < strand.skills.length; i++) {
      const skill = strand.skills[i];
      data.recommendations.push({
        skillId: skill.code || `${subject}_${strand.strandName}_${i + 1}`,
        skillName: skill.name,
        strand: strand.strandName,
        priority: data.recommendations.length + 1,
        url: skill.url,
      });
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Send data to Convex
// ---------------------------------------------------------------------------

async function sendToConvex(children: ChildData[]) {
  console.log(`\nSending to Convex (${children.length} children)...`);

  const response = await fetch(`${CONVEX_URL}/ixl-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SYNC_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ children }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Convex sync failed (${response.status}): ${text}`);
  }

  const result = JSON.parse(text);
  console.log("Convex response:", JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
