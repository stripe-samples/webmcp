import { localBrowser, Stagehand } from "@browserbasehq/stagehand";

const url = process.env.STRIPE_URL;
if (!url || !URL.canParse(url) || !["http:", "https:"].includes(new URL(url).protocol)) {
  throw new Error("Set STRIPE_URL to an HTTP(S) URL in .env or your environment.");
}

const browser = await localBrowser.launch();

try {
  await Stagehand.create({ browser });

  const page = await browser.context.newPage();
  await page.goto(url);

  const deadline = Date.now() + 30_000;
  
  let tools = await page.tools();
  while (tools.length === 0 && Date.now() < deadline) {
    await page.waitForTimeout(500);
    tools = await page.tools();
  }

  if (tools.length === 0) {
    throw new Error(
      "No WebMCP tools found within 30 seconds. Check the page and any required sign-in.",
    );
  }

  console.log(
    JSON.stringify(
      tools.map(({ name, description }) => ({ name, description })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
