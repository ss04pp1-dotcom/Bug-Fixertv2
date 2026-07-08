export default () => ({
  port: parseInt(process.env['PORT'] ?? '8080', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  app: {
    name: process.env['APP_NAME'] ?? 'SOL TV',
    url: process.env['APP_URL'] ?? 'https://soltv.app',
    adminUrl: process.env['ADMIN_URL'] ?? 'https://admin.soltv.app',
  },

  cors: {
    origin: process.env['CORS_ORIGIN'] ?? '',
  },

  database: {
    url: process.env['DATABASE_URL'],
  },

  jwt: {
    accessSecret: process.env['JWT_ACCESS_SECRET'],
    refreshSecret: process.env['JWT_REFRESH_SECRET'],
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '30d',
  },

  storage: {
    r2AccountId: process.env['CLOUDFLARE_R2_ACCOUNT_ID'],
    r2AccessKeyId: process.env['CLOUDFLARE_R2_ACCESS_KEY_ID'],
    r2SecretAccessKey: process.env['CLOUDFLARE_R2_SECRET_ACCESS_KEY'],
    r2BucketName: process.env['CLOUDFLARE_R2_BUCKET_NAME'] ?? 'soltv-media',
    r2PublicUrl: process.env['CLOUDFLARE_R2_PUBLIC_URL'],
    r2Endpoint: process.env['R2_ENDPOINT'],
  },

  redis: {
    url: process.env['REDIS_URL'],
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'],
  },

  smtp: {
    host: process.env['SMTP_HOST'],
    port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true',
    user: process.env['SMTP_USER'],
    password: process.env['SMTP_PASSWORD'],
    from: process.env['SMTP_FROM'] ?? 'noreply@soltv.app',
  },

  firebase: {
    projectId: process.env['FIREBASE_PROJECT_ID'],
    privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
  },

  payments: {
    stripeSecretKey: process.env['STRIPE_SECRET_KEY'],
    stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    stripePublishableKey: process.env['STRIPE_PUBLISHABLE_KEY'],
    sslcommerzStoreId: process.env['SSLCOMMERZ_STORE_ID'],
    sslcommerzPassword: process.env['SSLCOMMERZ_PASSWORD'],
    paypalClientId: process.env['PAYPAL_CLIENT_ID'],
    paypalClientSecret: process.env['PAYPAL_CLIENT_SECRET'],
    bkashAppKey: process.env['BKASH_APP_KEY'],
    bkashAppSecret: process.env['BKASH_APP_SECRET'],
    nagadMerchantId: process.env['NAGAD_MERCHANT_ID'],
    nagadMerchantPrivateKey: process.env['NAGAD_MERCHANT_PRIVATE_KEY'],
  },

  ads: {
    admobAppId: process.env['ADMOB_APP_ID'],
    applovinKey: process.env['APPLOVIN_KEY'],
    unityGameId: process.env['UNITY_GAME_ID'],
  },
});
