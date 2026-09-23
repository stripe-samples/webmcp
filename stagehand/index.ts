import { localBrowser, type Page, Stagehand, type WebMCPTool } from "@browserbasehq/stagehand";
import { z } from "zod";

const orderSchema = z.object({
  livemode: z.boolean(),
  currency: z.string(),
  totalAmount: z.number(),
  lineItems: z.array(z.object({ name: z.string(), minorUnitsAmount: z.number() })),
});
const toolOutputSchema = z.object({
  content: z.array(z.object({ text: z.string().optional() })).optional(),
});
const inputSchemaSchema = z.object({
  properties: z.record(z.string(), z.unknown()).default({}),
});

const url = process.env.STRIPE_URL;
if (!url) throw new Error("Set STRIPE_URL in .env");
if (process.env.CONFIRM_PURCHASE !== "yes") {
  throw new Error("Set CONFIRM_PURCHASE=yes. This can charge a real card.");
}
const maxTotal = Number(process.env.MAX_TOTAL_MINOR);
if (!(maxTotal > 0)) throw new Error("Set MAX_TOTAL_MINOR");

// Stripe registers its tools one by one after load, so poll until this one shows up.
async function findTool(page: Page, name: string) {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const tools = await page.tools();
    const tool = tools.find((t) => t.name === name);
    if (tool) return tool;
    if (Date.now() > deadline) throw new Error(`No "${name}". Found: ${tools.map((t) => t.name)}`);
    await page.waitForTimeout(500);
  }
}

async function mcp(page: Page, name: string, input: Record<string, string | boolean> = {}) {
  return invoke(await findTool(page, name), input);
}

async function invoke(
  tool: WebMCPTool,
  input: Record<string, string | boolean> = {},
  timeout = 30_000,
) {
  const result = await (await tool.invoke({ input: input as never })).result({ timeout });
  if (result.status !== "Completed") {
    throw new Error(`${tool.name} ${result.status}: ${result.errorText ?? ""}`);
  }
  return (toolOutputSchema.parse(result.output).content ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

const env = process.env;
const browser = await localBrowser.launch();

try {
  await Stagehand.create({ browser });
  const page = await browser.context.newPage();
  await page.goto(url);

  const summary = async () => orderSchema.parse(JSON.parse(await mcp(page, "get_order_summary")));

  await mcp(page, "select_payment_method", { payment_method_type: "card" });

  // Only send fields this Checkout session actually rendered.
  const form = await findTool(page, "fill_payment_form");
  const accepted = inputSchemaSchema.parse(form.inputSchema).properties;
  const payload = Object.fromEntries(
    Object.entries({
      shippingName: env.SHIPPING_NAME,
      shippingAddressLine1: env.SHIPPING_LINE1,
      shippingAddressLine2: env.SHIPPING_LINE2,
      shippingLocality: env.SHIPPING_CITY,
      shippingAdministrativeArea: env.SHIPPING_STATE,
      shippingPostalCode: env.SHIPPING_POSTAL_CODE,
      billingName: env.SHIPPING_NAME,
      billingAddressLine1: env.SHIPPING_LINE1,
      billingLocality: env.SHIPPING_CITY,
      billingAdministrativeArea: env.SHIPPING_STATE,
      billingPostalCode: env.SHIPPING_POSTAL_CODE,
      phoneNumberCountryCode: env.BUYER_PHONE_COUNTRY ?? "US",
      phoneNumber: env.BUYER_PHONE,
      cardNumber: env.CARD_NUMBER?.replaceAll(" ", ""),
      cardExpiry: env.CARD_EXPIRY,
      cardCvc: env.CARD_CVC,
      cardUseShippingAsBilling: true,
      enableStripePass: false,
      email: env.BUYER_EMAIL,
    }).filter((entry): entry is [string, string | boolean] => {
      const [key, value] = entry;
      return value !== undefined && value !== "" && key in accepted;
    }),
  );

  // One field per call: each value that lands re-renders the form, which cancels
  // any in-flight call. The value still applies, so a missing ack is fine.
  for (const [field, value] of Object.entries(payload)) {
    console.log("Filling", field);
    await invoke(await findTool(page, "fill_payment_form"), { [field]: value }, 5_000).catch(
      () => {},
    );
    await page.waitForTimeout(300);
  }

  const due = await summary();
  console.log("Before paying", due);
  if (due.totalAmount > maxTotal) {
    throw new Error(`Total ${due.totalAmount} > MAX_TOTAL_MINOR ${maxTotal}`);
  }

  console.log("Paying", due);
  await mcp(page, "submit_payment");
  await page.waitForTimeout(15_000);
  console.log(await page.url());
  console.log("Final", await summary().catch(() => due));

  if (env.KEEP_OPEN === "yes") {
    console.log("Leaving the browser open. Ctrl+C to exit.");
    await new Promise(() => {});
  }
} finally {
  await browser.close();
}
