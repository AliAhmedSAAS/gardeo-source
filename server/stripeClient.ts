import Stripe from 'stripe';

let connectionSettings: any;

function getEnvCredentials(): { publishableKey: string; secretKey: string } | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  // Ignore placeholders like sk_test_... / pk_test_...
  const looksReal = (key?: string) =>
    Boolean(key) && !key!.endsWith("...") && key!.length > 20;

  if (looksReal(secretKey) && looksReal(publishableKey)) {
    return { secretKey: secretKey!, publishableKey: publishableKey! };
  }
  if (looksReal(secretKey)) {
    return {
      secretKey: secretKey!,
      publishableKey: looksReal(publishableKey) ? publishableKey! : "",
    };
  }
  return null;
}

function hasReplitConnectorAuth(): boolean {
  return Boolean(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
      (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL),
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(getEnvCredentials() || hasReplitConnectorAuth());
}

async function getCredentialsFromReplit() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) {
    throw new Error('Stripe Replit connector is not available in this environment');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

async function getCredentials() {
  const fromEnv = getEnvCredentials();
  if (fromEnv) {
    return fromEnv;
  }

  if (hasReplitConnectorAuth()) {
    return getCredentialsFromReplit();
  }

  throw new Error(
    'Stripe is not configured. Set STRIPE_SECRET_KEY (and STRIPE_PUBLISHABLE_KEY) in .env, or run on Replit with the Stripe connector.',
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  if (!publishableKey) {
    throw new Error('STRIPE_PUBLISHABLE_KEY is not set');
  }
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
