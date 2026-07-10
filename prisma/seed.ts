import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type SeedCategory = {
  name: string;
  slug: string;
  description?: string;
  parentSlug?: string;
};

type SeedIntent = {
  name: string;
  description?: string;
  categorySlugs: string[];
  tags: string[];
};

const categories: SeedCategory[] = [
  { name: 'Food', slug: 'food', description: 'Food creators and dining content.' },
  { name: 'Technology', slug: 'technology', description: 'Technology creators and product content.' },
  { name: 'Fashion', slug: 'fashion', description: 'Fashion and style content.' },
  { name: 'Travel', slug: 'travel', description: 'Travel creators and destination storytelling.' },
  { name: 'Beauty', slug: 'beauty', description: 'Beauty, skincare, and cosmetics content.' },
  { name: 'Fitness', slug: 'fitness', description: 'Fitness and wellness creators.' },
  { name: 'Business', slug: 'business', description: 'Business, founders, and entrepreneurship content.' },
  { name: 'Finance', slug: 'finance', description: 'Finance and money-focused creators.' },
  { name: 'Entertainment', slug: 'entertainment', description: 'Film, music, and pop-culture creators.' },
  { name: 'Gaming', slug: 'gaming', description: 'Gaming creators and tournaments.' },
  { name: 'Education', slug: 'education', description: 'Education and academic outreach.' },
  { name: 'Politics', slug: 'politics', description: 'Political advocacy and campaign outreach.' },
  { name: 'Real Estate', slug: 'real-estate', description: 'Property, housing, and real-estate promotion.' },
  { name: 'Home & Living', slug: 'home-living', description: 'Architecture, interiors, and decor.' },
  { name: 'Hospitality', slug: 'hospitality', description: 'Hotels, lodging, and guest experiences.' },
  { name: 'Events', slug: 'events', description: 'Weddings and event-driven creator content.' },
  { name: 'Apartment Tours', slug: 'apartment-tours', parentSlug: 'real-estate' },
  { name: 'Luxury Homes', slug: 'luxury-homes', parentSlug: 'real-estate' },
  { name: 'Property Showcase', slug: 'property-showcase', parentSlug: 'real-estate' },
  { name: 'Real Estate Investment', slug: 'real-estate-investment', parentSlug: 'real-estate' },
  { name: 'Architecture', slug: 'architecture', parentSlug: 'home-living' },
  { name: 'Interior Design', slug: 'interior-design', parentSlug: 'home-living' },
  { name: 'Home Decor', slug: 'home-decor', parentSlug: 'home-living' },
  { name: 'Restaurants', slug: 'restaurants', parentSlug: 'food' },
  { name: 'Coffee', slug: 'coffee', parentSlug: 'food' },
  { name: 'Phone Launches', slug: 'phone-launches', parentSlug: 'technology' },
  { name: 'Fintech', slug: 'fintech', parentSlug: 'finance' },
  { name: 'Crypto', slug: 'crypto', parentSlug: 'finance' },
  { name: 'Entrepreneurship', slug: 'entrepreneurship', parentSlug: 'business' },
  { name: 'Startups', slug: 'startups', parentSlug: 'business' },
  { name: 'Luxury Brands', slug: 'luxury-brands', parentSlug: 'fashion' },
  { name: 'Skincare', slug: 'skincare', parentSlug: 'beauty' },
  { name: 'Hotels', slug: 'hotels', parentSlug: 'hospitality' },
  { name: 'Travel Campaigns', slug: 'travel-campaigns', parentSlug: 'travel' },
  { name: 'Movie Promotion', slug: 'movie-promotion', parentSlug: 'entertainment' },
  { name: 'Music Release', slug: 'music-release', parentSlug: 'entertainment' },
  { name: 'Gaming Tournaments', slug: 'gaming-tournaments', parentSlug: 'gaming' },
  { name: 'Fitness Challenges', slug: 'fitness-challenges', parentSlug: 'fitness' },
  { name: 'University Admissions', slug: 'university-admissions', parentSlug: 'education' },
  { name: 'Political Campaigns', slug: 'political-campaigns', parentSlug: 'politics' },
  { name: 'Weddings', slug: 'weddings', parentSlug: 'events' },
];

const intents: SeedIntent[] = [
  {
    name: 'Apartment Showcase',
    categorySlugs: [
      'real-estate',
      'apartment-tours',
      'luxury-homes',
      'architecture',
      'interior-design',
      'property-showcase',
      'home-decor',
    ],
    tags: ['apartment', 'apartments', 'property', 'real estate', 'home', 'house', 'condo', 'airbnb', 'short-let'],
  },
  {
    name: 'Restaurant Opening',
    categorySlugs: ['food', 'restaurants', 'hospitality'],
    tags: ['restaurant', 'opening', 'menu', 'chef', 'dining', 'foodie'],
  },
  {
    name: 'Phone Launch',
    categorySlugs: ['technology', 'phone-launches'],
    tags: ['phone', 'smartphone', 'mobile', 'launch', 'gadget', 'tech'],
  },
  {
    name: 'Hotel Promotion',
    categorySlugs: ['hospitality', 'hotels', 'travel'],
    tags: ['hotel', 'resort', 'staycation', 'travel', 'suite', 'booking'],
  },
  {
    name: 'Luxury Brand',
    categorySlugs: ['fashion', 'luxury-brands'],
    tags: ['luxury', 'premium', 'designer', 'style', 'fashion'],
  },
  {
    name: 'Real Estate Investment',
    categorySlugs: ['real-estate', 'real-estate-investment', 'finance'],
    tags: ['investment', 'property', 'returns', 'development', 'real estate'],
  },
  {
    name: 'Fintech Campaign',
    categorySlugs: ['finance', 'business', 'entrepreneurship', 'fintech', 'startups'],
    tags: ['bank', 'banking', 'payments', 'wallet', 'money', 'crypto'],
  },
  {
    name: 'Skincare Campaign',
    categorySlugs: ['beauty', 'skincare'],
    tags: ['skincare', 'skin', 'serum', 'beauty', 'glow', 'spf'],
  },
  {
    name: 'Travel Campaign',
    categorySlugs: ['travel', 'travel-campaigns', 'hospitality'],
    tags: ['travel', 'vacation', 'destination', 'trip', 'tourism', 'adventure'],
  },
  {
    name: 'Coffee Campaign',
    categorySlugs: ['food', 'coffee'],
    tags: ['coffee', 'cafe', 'espresso', 'latte', 'brew'],
  },
  {
    name: 'Wedding Campaign',
    categorySlugs: ['events', 'weddings', 'fashion'],
    tags: ['wedding', 'bridal', 'groom', 'ceremony', 'love'],
  },
  {
    name: 'Movie Promotion',
    categorySlugs: ['entertainment', 'movie-promotion'],
    tags: ['movie', 'film', 'cinema', 'premiere', 'trailer'],
  },
  {
    name: 'Music Release',
    categorySlugs: ['entertainment', 'music-release'],
    tags: ['music', 'album', 'single', 'artist', 'release'],
  },
  {
    name: 'Gaming Tournament',
    categorySlugs: ['gaming', 'gaming-tournaments', 'technology'],
    tags: ['gaming', 'tournament', 'esports', 'streamer', 'console'],
  },
  {
    name: 'Fitness Challenge',
    categorySlugs: ['fitness', 'fitness-challenges'],
    tags: ['fitness', 'challenge', 'workout', 'gym', 'wellness'],
  },
  {
    name: 'University Admissions',
    categorySlugs: ['education', 'university-admissions'],
    tags: ['university', 'admission', 'student', 'college', 'campus'],
  },
  {
    name: 'Political Campaign',
    categorySlugs: ['politics', 'political-campaigns'],
    tags: ['election', 'campaign', 'vote', 'policy', 'governance'],
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? '',
    }),
  });

  try {
    await prisma.$connect();

    const categoryMap = new Map<string, string>();

    for (const category of categories.filter((item) => !item.parentSlug)) {
      const record = await prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          parentId: null,
          level: 1,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          level: 1,
        },
      });
      categoryMap.set(category.slug, record.id);
    }

    for (const category of categories.filter((item) => item.parentSlug)) {
      const parentId = categoryMap.get(category.parentSlug!);
      if (!parentId) {
        throw new Error(`Missing parent category for ${category.slug}`);
      }

      const parent = await prisma.category.findUniqueOrThrow({
        where: { id: parentId },
      });

      const record = await prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          parentId,
          level: parent.level + 1,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          parentId,
          level: parent.level + 1,
        },
      });
      categoryMap.set(category.slug, record.id);
    }

    for (const intent of intents) {
      const slug = intent.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const categoryIds = intent.categorySlugs.map((categorySlug) => {
        const categoryId = categoryMap.get(categorySlug);
        if (!categoryId) {
          throw new Error(`Missing category "${categorySlug}" for intent "${intent.name}"`);
        }
        return categoryId;
      });

      await prisma.campaignIntent.upsert({
        where: { slug },
        update: {
          name: intent.name,
          description: intent.description,
          categories: {
            deleteMany: {},
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
          tags: {
            deleteMany: {},
            create: [...new Set(intent.tags.map((tag) => tag.toLowerCase()))].map(
              (tag) => ({ tag }),
            ),
          },
        },
        create: {
          name: intent.name,
          slug,
          description: intent.description,
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
          tags: {
            create: [...new Set(intent.tags.map((tag) => tag.toLowerCase()))].map(
              (tag) => ({ tag }),
            ),
          },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
