/**
 * StreamPro Database Seed Script
 * Run: cd artifacts/api-server && npx ts-node --transpile-only prisma/seed.ts
 */
import { PrismaClient, AdType, CouponDiscountType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding StreamPro database…');

  // ─── Roles ──────────────────────────────────────────────────────────────────
  const roles = [
    { name: 'super_admin', description: 'Full platform access',   permissions: ['*'] },
    { name: 'admin',       description: 'Admin panel access',      permissions: ['read:*', 'write:*', 'delete:content'] },
    { name: 'moderator',   description: 'Content moderation',      permissions: ['read:*', 'write:content', 'delete:content'] },
    { name: 'support',     description: 'User support',            permissions: ['read:users', 'write:announcements'] },
    { name: 'user',        description: 'Default user role',       permissions: ['read:public'] },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
  }
  console.log('  ✓ Roles');

  // ─── Admin user ──────────────────────────────────────────────────────────────
  const adminPass = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPass) {
    console.warn('  ⚠ SEED_ADMIN_PASSWORD not set — skipping admin user creation');
    console.warn('    Set it in .env: SEED_ADMIN_PASSWORD=your_secure_password');
  } else {
    const passwordHash = await bcrypt.hash(adminPass, 12);
    await prisma.user.upsert({
      where: { email: 'admin@streampro.com' },
      update: { passwordHash, role: UserRole.super_admin, isActive: true, emailVerified: true },
      create: {
        email: 'admin@streampro.com',
        passwordHash,
        name: 'StreamPro Admin',
        role: UserRole.super_admin,
        emailVerified: true,
        isActive: true,
      },
    });
    console.log('  ✓ Admin user  admin@streampro.com');
  }

  // ─── Categories ─────────────────────────────────────────────────────────────
  const categories = [
    { name: 'Sports',        slug: 'sports',        description: 'Live sports channels',      sortOrder: 1 },
    { name: 'Entertainment', slug: 'entertainment',  description: 'Entertainment channels',    sortOrder: 2 },
    { name: 'News',          slug: 'news',           description: 'News & current affairs',    sortOrder: 3 },
    { name: 'Movies',        slug: 'movies',         description: 'Movies & cinema',           sortOrder: 4 },
    { name: 'Kids',          slug: 'kids',           description: 'Family & kids content',     sortOrder: 5 },
    { name: 'Music',         slug: 'music',          description: 'Music & concerts',          sortOrder: 6 },
    { name: 'Documentary',   slug: 'documentary',    description: 'Documentaries & education', sortOrder: 7 },
    { name: 'Technology',    slug: 'technology',     description: 'Tech & science',            sortOrder: 8 },
    { name: 'Lifestyle',     slug: 'lifestyle',      description: 'Lifestyle & wellness',      sortOrder: 9 },
    { name: 'International', slug: 'international',  description: 'International channels',    sortOrder: 10 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  console.log('  ✓ Categories');

  // ─── Subscription Plans ──────────────────────────────────────────────────────
  const plans = [
    {
      name: 'Free',           slug: 'free',           description: 'Basic free access with ads',
      price: 0,    currency: 'USD', durationDays: 30, trialDays: 0,
      features: ['SD quality', 'Limited channels', 'Ad-supported'],
      isActive: true, isFeatured: false, sortOrder: 1,
    },
    {
      name: 'Basic',          slug: 'basic',          description: 'Great value for individuals',
      price: 4.99, currency: 'USD', durationDays: 30, trialDays: 7,
      features: ['HD quality', '100+ channels', 'No ads', '1 screen'],
      isActive: true, isFeatured: false, sortOrder: 2,
    },
    {
      name: 'Standard',       slug: 'standard',       description: 'Perfect for families',
      price: 9.99, currency: 'USD', durationDays: 30, trialDays: 7,
      features: ['FHD quality', '500+ channels', 'No ads', '2 screens', 'Downloads'],
      isActive: true, isFeatured: true, sortOrder: 3,
    },
    {
      name: 'Premium',        slug: 'premium',        description: 'Ultimate streaming experience',
      price: 14.99, currency: 'USD', durationDays: 30, trialDays: 14,
      features: ['4K Ultra HD', '1000+ channels', 'No ads', '4 screens', 'Unlimited downloads', 'Early access'],
      isActive: true, isFeatured: false, sortOrder: 4,
    },
    {
      name: 'Annual Basic',   slug: 'annual-basic',   description: 'Basic plan — save 20%',
      price: 47.99, currency: 'USD', durationDays: 365, trialDays: 7,
      features: ['HD quality', '100+ channels', 'No ads', '1 screen', 'Save 20%'],
      isActive: true, isFeatured: false, sortOrder: 5,
    },
    {
      name: 'Annual Premium', slug: 'annual-premium', description: 'Premium plan — save 30%',
      price: 124.99, currency: 'USD', durationDays: 365, trialDays: 14,
      features: ['4K Ultra HD', '1000+ channels', 'No ads', '4 screens', 'Unlimited downloads', 'Save 30%'],
      isActive: true, isFeatured: false, sortOrder: 6,
    },
  ];
  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }
  console.log('  ✓ Subscription plans');

  // ─── Payment Gateways ────────────────────────────────────────────────────────
  const gateways = [
    { name: 'Stripe',      slug: 'stripe',      isActive: true,  isTestMode: true, feePercent: 2.9, currencies: ['USD', 'EUR', 'GBP'],        countries: [],               config: { isDefault: true } },
    { name: 'PayPal',      slug: 'paypal',      isActive: true,  isTestMode: true, feePercent: 3.4, currencies: ['USD', 'EUR', 'GBP', 'AUD'], countries: [],               config: {} },
    { name: 'Razorpay',    slug: 'razorpay',    isActive: true,  isTestMode: true, feePercent: 2.0, currencies: ['INR'],                       countries: ['IN'],           config: {} },
    { name: 'Square',      slug: 'square',      isActive: false, isTestMode: true, feePercent: 2.6, currencies: ['USD', 'CAD', 'AUD'],         countries: ['US', 'CA', 'AU'], config: {} },
    { name: 'Flutterwave', slug: 'flutterwave', isActive: true,  isTestMode: true, feePercent: 1.4, currencies: ['NGN', 'GHS', 'KES'],         countries: ['NG', 'GH', 'KE', 'ZA'], config: {} },
    { name: 'Paystack',    slug: 'paystack',    isActive: true,  isTestMode: true, feePercent: 1.5, currencies: ['NGN', 'GHS', 'ZAR'],         countries: ['NG', 'GH', 'ZA'], config: {} },
    { name: 'Crypto',      slug: 'crypto',      isActive: false, isTestMode: true, feePercent: 0.5, currencies: ['BTC', 'ETH', 'USDT'],        countries: [],               config: {} },
  ];
  for (const g of gateways) {
    await prisma.paymentGateway.upsert({ where: { slug: g.slug }, update: {}, create: g });
  }
  console.log('  ✓ Payment gateways');

  // ─── Ad Providers ────────────────────────────────────────────────────────────
  // Slugs must match AdvertisementsService.DEFAULT_PROVIDERS exactly
  const adProviders = [
    { name: 'Google AdMob',              slug: 'admob',      isActive: true,  isSelected: true  },
    { name: 'Meta Audience Network',     slug: 'meta',       isActive: false, isSelected: false },
    { name: 'Unity Ads',                 slug: 'unity',      isActive: false, isSelected: false },
    { name: 'IronSource',                slug: 'ironsource', isActive: false, isSelected: false },
    { name: 'AppLovin MAX',              slug: 'applovin',   isActive: false, isSelected: false },
    { name: 'Adsterra',                  slug: 'adsterra',   isActive: false, isSelected: false },
    { name: 'Start.io',                  slug: 'startio',    isActive: false, isSelected: false },
    { name: 'Pangle (TikTok)',           slug: 'pangle',     isActive: false, isSelected: false },
    { name: 'Amazon Publisher Services', slug: 'amazon',     isActive: false, isSelected: false },
    { name: 'House Ads',                 slug: 'house',      isActive: true,  isSelected: false },
    { name: 'Custom Ad Network',         slug: 'custom',     isActive: false, isSelected: false },
  ];
  for (const ap of adProviders) {
    await prisma.adProvider.upsert({ where: { slug: ap.slug }, update: {}, create: ap });
  }
  console.log('  ✓ Ad providers');

  // ─── Ad Placements ───────────────────────────────────────────────────────────
  const adTypeMap: Record<string, AdType> = {
    banner:       AdType.banner,
    interstitial: AdType.interstitial,
    rewarded:     AdType.rewarded,
    native:       AdType.native,
    video:        AdType.video,
  };
  const screens = [
    'home', 'movies', 'series', 'channels', 'search',
    'player', 'epg', 'profile', 'downloads', 'live',
    'category', 'favorites', 'watchlist', 'browse', 'settings',
    'subscription', 'payment', 'notifications', 'support', 'about',
  ];
  const placementData: { name: string; slug: string; type: AdType; screen: string; isEnabled: boolean; frequency: number }[] = [];
  for (const s of screens) {
    placementData.push({ name: `${s} banner`,       slug: `${s}-banner`,       type: adTypeMap.banner,       screen: s, isEnabled: true, frequency: 1 });
    placementData.push({ name: `${s} interstitial`, slug: `${s}-interstitial`, type: adTypeMap.interstitial, screen: s, isEnabled: true, frequency: 3 });
    if (s === 'player' || s === 'live') {
      placementData.push({ name: `${s} video`, slug: `${s}-video`, type: adTypeMap.video, screen: s, isEnabled: true, frequency: 1 });
    }
  }
  // Special trigger-based placements used by the live player
  const specialPlacements = [
    {
      name: 'Channel Switch',
      slug: 'channel_switch',
      type: AdType.interstitial,
      screen: 'live',
      isEnabled: true,
      frequency: 3,
      description: 'Shown after every 3rd live channel change',
    },
    {
      name: 'Live Hourly',
      slug: 'live_hourly',
      type: AdType.interstitial,
      screen: 'live',
      isEnabled: true,
      frequency: 1,
      cooldownSeconds: 3600,
      description: 'Shown every 60 minutes of continuous live playback',
    },
    {
      name: 'Live Rewarded',
      slug: 'live_rewarded',
      type: AdType.rewarded,
      screen: 'live',
      isEnabled: true,
      frequency: 1,
      skipAfterSeconds: 30,
      description: 'Rewarded ad every 30 minutes during live TV — user watches 30 s, playback continues',
    },
    {
      name: 'Player Rewarded',
      slug: 'player_rewarded',
      type: AdType.rewarded,
      screen: 'player',
      isEnabled: true,
      frequency: 1,
      skipAfterSeconds: 30,
      description: 'Rewarded ad during movie/series playback — fires every 30 minutes',
    },
    {
      name: 'Movie Rewarded',
      slug: 'movie_rewarded',
      type: AdType.rewarded,
      screen: 'movies',
      isEnabled: true,
      frequency: 1,
      skipAfterSeconds: 10,
      description: 'Rewarded ad on movie detail — user watches 10 s to unlock free playback',
    },
    {
      name: 'Sports Match Open',
      slug: 'sports_interstitial',
      type: AdType.interstitial,
      screen: 'sports',
      isEnabled: true,
      frequency: 1,
      skipAfterSeconds: 30,
      description: 'Shown for 30 seconds when a user opens any match from the Sports screen',
    },
  ];
  for (const ap of [...placementData, ...specialPlacements]) {
    await prisma.adPlacement.upsert({ where: { slug: ap.slug }, update: {}, create: ap });
  }
  console.log(`  ✓ Ad placements (${placementData.length + specialPlacements.length})`);

  // ─── Coupons ─────────────────────────────────────────────────────────────────
  const coupons = [
    { code: 'WELCOME20', discountType: CouponDiscountType.percentage, discountValue: 20,   minPurchase: 0,    maxUses: 1000, isActive: true,  expiresAt: new Date('2027-12-31') },
    { code: 'SAVE50',    discountType: CouponDiscountType.percentage, discountValue: 50,   minPurchase: 9.99, maxUses: 500,  isActive: true,  expiresAt: new Date('2026-12-31') },
    { code: 'FLAT5',     discountType: CouponDiscountType.fixed,      discountValue: 5,    minPurchase: 10,   maxUses: 200,  isActive: true,  expiresAt: new Date('2026-12-31') },
    { code: 'ANNUAL30',  discountType: CouponDiscountType.percentage, discountValue: 30,   minPurchase: 40,   maxUses: 100,  isActive: true,  expiresAt: new Date('2027-06-30') },
    { code: 'FREEMONTH', discountType: CouponDiscountType.fixed,      discountValue: 9.99, minPurchase: 9.99, maxUses: 50,   isActive: false, expiresAt: new Date('2026-09-30') },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, update: {}, create: c });
  }
  console.log('  ✓ Coupons');

  // ─── Feature Flags ───────────────────────────────────────────────────────────
  const flags = [
    { name: 'live_streaming',     description: 'Enable live TV streaming',       isEnabled: true  },
    { name: 'download_feature',   description: 'Allow offline downloads',         isEnabled: true  },
    { name: 'offline_mode',       description: 'Offline playback mode',           isEnabled: true  },
    { name: 'ads_enabled',        description: 'Show ads to free users',          isEnabled: true  },
    { name: 'parental_controls',  description: 'Parental control PIN features',   isEnabled: true  },
    { name: 'multi_profile',      description: 'Multiple user profiles',          isEnabled: false },
    { name: 'picture_in_picture', description: 'PiP playback support',            isEnabled: true  },
    { name: 'chromecast',         description: 'Chromecast / AirPlay casting',    isEnabled: false },
    { name: 'social_login',       description: 'Google/Apple sign-in',            isEnabled: false },
    { name: 'dark_mode_forced',   description: 'Force dark mode in app',          isEnabled: false },
    { name: 'maintenance_mode',   description: 'Platform maintenance mode',       isEnabled: false },
    { name: 'geo_blocking',       description: 'Regional content restriction',    isEnabled: true  },
    { name: 'beta_features',      description: 'Experimental features for beta',  isEnabled: false },
    { name: 'push_notifications', description: 'FCM push notifications',          isEnabled: true  },
    { name: 'analytics_tracking', description: 'Usage analytics collection',      isEnabled: true  },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({ where: { name: f.name }, update: {}, create: f });
  }
  console.log('  ✓ Feature flags');

  // ─── Settings ────────────────────────────────────────────────────────────────
  const settings = [
    { key: 'app_name',              value: 'StreamPro',                    isPublic: true,  description: 'Application name' },
    { key: 'app_version',           value: '1.0.0',                        isPublic: true,  description: 'Current app version' },
    { key: 'support_email',         value: 'support@streampro.com',        isPublic: true,  description: 'Support email address' },
    { key: 'privacy_url',           value: 'https://streampro.com/privacy', isPublic: true,  description: 'Privacy policy URL' },
    { key: 'terms_url',             value: 'https://streampro.com/terms',   isPublic: true,  description: 'Terms of service URL' },
    { key: 'min_app_version',       value: '1.0.0',                        isPublic: true,  description: 'Minimum supported app version' },
    { key: 'maintenance_message',   value: 'We are performing scheduled maintenance. Back shortly!', isPublic: true, description: 'Maintenance banner message' },
    { key: 'free_trial_days',       value: 7,                              isPublic: true,  description: 'Free trial duration in days' },
    { key: 'max_login_attempts',    value: 5,                              isPublic: false, description: 'Max failed login attempts before lockout' },
    { key: 'otp_expiry_minutes',    value: 10,                             isPublic: false, description: 'OTP expiry time in minutes' },
    { key: 'session_timeout_days',  value: 30,                             isPublic: false, description: 'Session token lifetime in days' },
    { key: 'currency',              value: 'USD',                          isPublic: true,  description: 'Default currency' },
    { key: 'ads_config',            value: { activeProvider: 'admob', adsEnabled: true, maintenanceMode: false }, isPublic: true, description: 'Ad service configuration' },
    { key: 'billing_tax',           value: { vat: 15, gst: 10, vatEnabled: true, gstEnabled: false, service: 2.5, serviceEnabled: true, processing: 1.5, processingEnabled: true }, isPublic: false, description: 'Tax and fee configuration' },
    { key: 'billing_config',        value: { invoicePrefix: 'INV', companyName: 'StreamPro', companyEmail: 'billing@streampro.com', autoInvoice: true, emailInvoice: true, emailReceipt: true }, isPublic: false, description: 'Billing configuration' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('  ✓ Settings');

  // ─── Announcements ───────────────────────────────────────────────────────────
  const announcements = [
    { title: 'Welcome to StreamPro!',      message: 'Enjoy unlimited streaming with our launch offer — 30% off all annual plans this month!', type: 'info',    isActive: true,  priority: 1, targetAll: true },
    { title: '4K Content Now Available',   message: 'We\'ve added 4K Ultra HD content for Premium subscribers. Update your app to access it.', type: 'feature', isActive: true,  priority: 2, targetAll: false, isPremium: true },
    { title: 'Scheduled Maintenance',      message: 'StreamPro will undergo maintenance on Sunday 2–4 AM UTC. Some services may be interrupted.', type: 'warning', isActive: false, priority: 0, targetAll: true },
    { title: 'New Sports Channels Added',  message: '15 new sports channels have been added including cricket, basketball, and Formula 1!',   type: 'info',    isActive: true,  priority: 3, targetAll: true },
  ];
  for (const a of announcements) {
    const existing = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (!existing) await prisma.announcement.create({ data: a });
  }
  console.log('  ✓ Announcements');

  // ─── Sample Channels ─────────────────────────────────────────────────────────
  const sportsCat = await prisma.category.findUnique({ where: { slug: 'sports' } });
  const entCat    = await prisma.category.findUnique({ where: { slug: 'entertainment' } });
  const newsCat   = await prisma.category.findUnique({ where: { slug: 'news' } });

  const DEMO_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  const channels = [
    { name: 'SportsPro HD', slug: 'sportspro-hd', description: 'Live sports 24/7',          primaryStreamUrl: DEMO_URL, categoryId: sportsCat?.id, isPremium: false, isFeatured: true,  sortOrder: 1, language: 'English', country: 'US' },
    { name: 'ESPN Live',    slug: 'espn-live',    description: 'Sports news and live events', primaryStreamUrl: DEMO_URL, categoryId: sportsCat?.id, isPremium: true,  isFeatured: true,  sortOrder: 2, language: 'English', country: 'US' },
    { name: 'EntertainMax', slug: 'entertainmax', description: 'Top entertainment channel',  primaryStreamUrl: DEMO_URL, categoryId: entCat?.id,   isPremium: false, isFeatured: true,  sortOrder: 3, language: 'English', country: 'US' },
    { name: 'Global News',  slug: 'global-news',  description: 'Breaking news worldwide',    primaryStreamUrl: DEMO_URL, categoryId: newsCat?.id,   isPremium: false, isFeatured: false, sortOrder: 4, language: 'English', country: 'US' },
    { name: 'CricketZone',  slug: 'cricketzone',  description: 'Live cricket matches',       primaryStreamUrl: DEMO_URL, categoryId: sportsCat?.id, isPremium: true,  isFeatured: false, sortOrder: 5, language: 'English', country: 'IN' },
  ];
  for (const c of channels) {
    if (!c.categoryId) continue;
    const { categoryId, ...rest } = c;
    await prisma.channel.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...rest, category: { connect: { id: categoryId } } },
    });
  }
  console.log('  ✓ Sample channels');

  // ─── Sample Movies ───────────────────────────────────────────────────────────
  const moviesCat = await prisma.category.findUnique({ where: { slug: 'movies' } });
  const movies = [
    { title: 'The Grand Adventure', slug: 'grand-adventure', description: 'An epic journey across continents.', genres: ['Action', 'Adventure'], duration: 7200, year: 2024, rating: 8.1, ageRating: 'PG-13', isPremium: false, isFeatured: true,  language: 'English' },
    { title: 'Midnight Mystery',    slug: 'midnight-mystery', description: 'A gripping psychological thriller.', genres: ['Thriller', 'Drama'],   duration: 6600, year: 2024, rating: 7.9, ageRating: 'R',     isPremium: true,  isFeatured: true,  language: 'English' },
    { title: 'Comedy Central',      slug: 'comedy-central',  description: 'Laugh out loud all night long.',    genres: ['Comedy'],                duration: 5400, year: 2023, rating: 7.2, ageRating: 'PG',    isPremium: false, isFeatured: false, language: 'English' },
  ];
  for (const m of movies) {
    if (!moviesCat) continue;
    await prisma.movie.upsert({
      where: { slug: m.slug },
      update: {},
      create: { ...m, category: { connect: { id: moviesCat.id } } },
    });
  }
  console.log('  ✓ Sample movies');

  console.log('\n✅ Database seeded successfully!');
  console.log('   Admin login: admin@streampro.com / (see SEED_ADMIN_PASSWORD in .env)');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
