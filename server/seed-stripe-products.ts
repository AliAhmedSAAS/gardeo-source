import { getUncachableStripeClient } from "./stripeClient";

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({ query: "name:'AI Controller Mode'" });
  if (existing.data.length > 0) {
    console.log("AI Controller Mode product already exists:", existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    console.log("Prices:", prices.data.map(p => `${p.id} - ${p.unit_amount! / 100} ${p.currency}/${p.recurring?.interval || "one-time"}`));
    return;
  }

  const product = await stripe.products.create({
    name: "AI Controller Mode",
    description: "AI-powered Control Room enhancement with real-time situational awareness, smart alerts, quick actions, and conversational AI assistant for workforce management.",
    metadata: {
      addon_key: "ai_controller",
      category: "premium_addon",
      features: "situational_awareness,smart_alerts,quick_actions,ai_chat,kpi_insights",
    },
  });
  console.log("Created product:", product.id);

  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 4900,
    currency: "gbp",
    recurring: { interval: "month" },
    metadata: { billing: "monthly" },
  });
  console.log("Created monthly price:", monthlyPrice.id, "- £49.00/month");

  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 47000,
    currency: "gbp",
    recurring: { interval: "year" },
    metadata: { billing: "yearly" },
  });
  console.log("Created yearly price:", yearlyPrice.id, "- £470.00/year (save £118)");
}

createProducts().catch(console.error);
