import 'dotenv/config';
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

const slugifySeedCategory = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const primaryCategories: SeedCategory[] = [
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
  { name: 'Real Estate', slug: 'real-estate', description: 'Property, housing, and real-estate promotion.' },
  { name: 'Home & Living', slug: 'home-living', description: 'Architecture, interiors, and decor.' },
  { name: 'Hospitality', slug: 'hospitality', description: 'Hotels, lodging, and guest experiences.' },
  { name: 'Events', slug: 'events', description: 'Weddings and event-driven creator content.' },
  { name: 'Lifestyle', slug: 'lifestyle' },
  { name: 'Food & Drinks', slug: 'food-and-drinks' },
  { name: 'Fitness & Health', slug: 'fitness-and-health' },
  { name: 'Consumer Tech', slug: 'consumer-tech' },
  { name: 'Comedy', slug: 'comedy' },
  { name: 'Music', slug: 'music' },
  { name: 'Photography & Video', slug: 'photography-and-video' },
  { name: 'Automotive', slug: 'automotive' },
  { name: 'Home', slug: 'home' },
  { name: 'Parenting', slug: 'parenting' },
  { name: 'Relationships', slug: 'relationships' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Pets', slug: 'pets' },
  { name: 'Art & Creativity', slug: 'art-and-creativity' },
  { name: 'DIY & Makers', slug: 'diy-and-makers' },
  { name: 'Agriculture', slug: 'agriculture' },
  { name: 'Religion & Faith', slug: 'religion-and-faith' },
  { name: 'News & Politics', slug: 'news-and-politics' },
  { name: 'Sustainability', slug: 'sustainability' },
  { name: 'Kids', slug: 'kids' },
  { name: 'Local Content', slug: 'local-content' },
];

const secondaryCategoriesByParent: Record<string, string[]> = {
  'real-estate': [
    'Apartment Tours',
    'Luxury Homes',
    'Property Showcase',
    'Real Estate Investment',
    'Commercial Real Estate',
    'Luxury Apartments',
    'Property Investment',
    'Property Reviews',
    'Real Estate Investing',
    'Short-let Reviews',
  ],
  'home-living': ['Architecture', 'Interior Design', 'Home Decor'],
  food: ['Restaurants', 'Coffee'],
  technology: ['Phone Launches'],
  finance: ['Fintech', 'Crypto'],
  business: ['Entrepreneurship', 'Startups'],
  fashion: ['Luxury Brands'],
  beauty: ['Skincare'],
  hospitality: ['Hotels'],
  travel: ['Travel Campaigns'],
  entertainment: ['Movie Promotion', 'Music Release'],
  gaming: ['Gaming Tournaments'],
  fitness: ['Fitness Challenges'],
  education: ['University Admissions'],
  'news-and-politics': [
    'Political Campaigns',
    'Current Affairs',
    'News',
    'Public Policy',
  ],
  events: ['Weddings'],
  lifestyle: [
    '9-5 Life',
    'Adulting',
    'Daily Life',
    'Day in the Life',
    'Luxury Lifestyle',
    'Minimalist Lifestyle',
    'Rural Lifestyle',
    'Urban Lifestyle',
    'Work Life',
  ],
  'food-and-drinks': [
    'Baking',
    'BBQ',
    'Beer',
    'Cocktails',
    'Cooking',
    'Desserts',
    'Fine Dining',
    'Meal Prep',
    'Nigerian Food',
    'Recipes',
    'Restaurant Reviews',
    'Street Food',
    'Tea',
    'Wine',
  ],
  'fitness-and-health': [
    'Athletics',
    'Bodybuilding',
    'Calisthenics',
    'CrossFit',
    'Gym',
    'Healthcare',
    'Healthy Eating',
    'Medicine',
    'Mental Health',
    'Nutrition',
    'Physiotherapy',
    'Pilates',
    'Weight Loss',
    'Yoga',
  ],
  'consumer-tech': [
    'Apple',
    'Android',
    'Audio',
    'Cameras',
    'Laptop Reviews',
    'Phone Reviews',
    'Smart Home',
    'Wearables',
  ],
  comedy: ['Memes', 'Parody', 'Pranks', 'Satire', 'Sketch Comedy', 'Stand-up'],
  music: [
    'DJ',
    'Gospel',
    'Hip-Hop',
    'Instrumental',
    'Music Production',
    'Music Reviews',
    'R&B',
    'Singing',
  ],
  'photography-and-video': [
    'Cinematography',
    'Drone',
    'Photography Gear',
    'Photo Editing',
    'Portrait Photography',
    'Street Photography',
    'Videography',
    'Video Editing',
    'Wildlife Photography',
  ],
  automotive: ['Cars', 'EVs', 'Formula 1', 'Motorsports', 'Motorcycles'],
  home: [
    'Cleaning',
    'Furniture',
    'Gardening',
    'Home Renovation',
    'House Tours',
    'Organization',
  ],
  parenting: [
    'Baby Care',
    'Family Activities',
    'Fatherhood',
    'Motherhood',
    'Pregnancy',
  ],
  relationships: ['Dating', 'Family', 'Femininity', 'Marriage', 'Masculinity'],
  sports: [
    'Basketball',
    'Combat Sports',
    'Cricket',
    'Cycling',
    'Football',
    'Golf',
    'Rugby',
    'Swimming',
    'Tennis',
  ],
  pets: ['Aquariums', 'Birds', 'Cats', 'Dogs', 'Exotic Pets', 'Pet Care'],
  'art-and-creativity': [
    'Art',
    'Calligraphy',
    'Crafts',
    'Drawing',
    'Graphic Design',
    'Illustration',
    'Painting',
    'Pottery',
  ],
  'diy-and-makers': ['DIY', 'Maker Projects', 'Metalworking', 'Robotics', 'Woodworking'],
  agriculture: ['Agritech', 'Farming', 'Fish Farming', 'Livestock', 'Poultry'],
  'religion-and-faith': [
    'Bible Study',
    'Christianity',
    'Church',
    'Devotionals',
    'Faith',
    'Islam',
  ],
  sustainability: ['Climate', 'Environment', 'Recycling', 'Renewable Energy'],
  kids: ['Toys'],
  'local-content': [
    'Abuja',
    'African Fashion',
    'African Travel',
    'Hausa Culture',
    'Igbo Culture',
    'Lagos',
    'Northern Nigeria',
    'Port Harcourt',
    'Yoruba Culture',
  ],
};

const additionalSecondaryCategories: Array<[string, string]> = [
  ['Accessories', 'fashion'],
  ['Adventure', 'travel'],
  ['Affordable Fashion', 'fashion'],
  ['Agriculture', 'agriculture'],
  ['AI', 'technology'],
  ['Airbnb Reviews', 'travel'],
  ['Airlines', 'travel'],
  ['Animation', 'entertainment'],
  ['Anime', 'entertainment'],
  ['Apartment Tours', 'real-estate'],
  ['Architecture', 'home'],
  ['Barbering', 'beauty'],
  ['Beauty Reviews', 'beauty'],
  ['Blockchain', 'finance'],
  ['Books', 'education'],
  ['Budget Travel', 'travel'],
  ['Budgeting', 'finance'],
  ['Career', 'business'],
  ['Career Advice', 'business'],
  ['Celebrity News', 'entertainment'],
  ["Children's Education", 'education'],
  ['Cloud Computing', 'technology'],
  ['Coding Education', 'technology'],
  ['Comics', 'entertainment'],
  ['Console Gaming', 'gaming'],
  ['Construction', 'real-estate'],
  ['Consulting', 'business'],
  ['Corporate Life', 'business'],
  ['Cosmetics', 'beauty'],
  ['Crypto Investing', 'finance'],
  ['Cybersecurity', 'technology'],
  ['Data Science', 'technology'],
  ['Digital Nomad', 'travel'],
  ['Economics', 'finance'],
  ['Electronics', 'consumer-tech'],
  ['Esports', 'gaming'],
  ['Family Lifestyle', 'lifestyle'],
  ['Fashion', 'fashion'],
  ['Fintech', 'finance'],
  ['Fish Farming', 'agriculture'],
  ['Fitness', 'fitness-and-health'],
  ['Footwear', 'fashion'],
  ['Forex', 'finance'],
  ['Fragrance', 'beauty'],
  ['Game Development', 'gaming'],
  ['Game Reviews', 'gaming'],
  ['Game Streaming', 'gaming'],
  ['Gaming', 'gaming'],
  ['Gaming Hardware', 'gaming'],
  ['Healthcare', 'fitness-and-health'],
  ['History', 'education'],
  ['Hotels', 'travel'],
  ['HR', 'business'],
  ['Interior Design', 'home'],
  ['Investing', 'finance'],
  ['Jewelry', 'fashion'],
  ['Language Learning', 'education'],
  ['Leadership', 'business'],
  ['Lifestyle', 'lifestyle'],
  ['Local Tourism', 'travel'],
  ['Luxury Fashion', 'fashion'],
  ['Luxury Travel', 'travel'],
  ['Machine Learning', 'technology'],
  ['Makeup', 'beauty'],
  ['Marketing', 'business'],
  ['Mathematics', 'education'],
  ['Medicine', 'fitness-and-health'],
  ["Men's Fashion", 'fashion'],
  ['Mobile Development', 'technology'],
  ['Mobile Gaming', 'gaming'],
  ['Modest Fashion', 'fashion'],
  ['Movies', 'entertainment'],
  ['Music', 'music'],
  ['Natural Hair', 'beauty'],
  ['Online Learning', 'education'],
  ['Outfit Inspiration', 'fashion'],
  ['Parenting', 'parenting'],
  ['PC Builds', 'gaming'],
  ['PC Gaming', 'gaming'],
  ['Personal Brand', 'business'],
  ['Personal Finance', 'finance'],
  ['Personal Styling', 'fashion'],
  ['Photography', 'photography-and-video'],
  ['Podcasts', 'music'],
  ['Politics', 'news-and-politics'],
  ['Pop Culture', 'entertainment'],
  ['Programming', 'technology'],
  ['Productivity', 'business'],
  ['Real Estate', 'real-estate'],
  ['Relationships', 'relationships'],
  ['SaaS', 'technology'],
  ['Sales', 'business'],
  ['Saving', 'finance'],
  ['Science', 'education'],
  ['Self Improvement', 'lifestyle'],
  ['Side Hustles', 'business'],
  ['Small Business', 'business'],
  ['Software', 'technology'],
  ['Startups', 'business'],
  ['Stock Market', 'finance'],
  ['Student Life', 'education'],
  ['Study Tips', 'education'],
  ['Sustainability', 'sustainability'],
  ['Technology', 'technology'],
  ['Travel', 'travel'],
  ['TV Shows', 'entertainment'],
  ['Traditional Fashion', 'fashion'],
  ['Web Development', 'technology'],
  ['Web3', 'technology'],
  ["Women's Fashion", 'fashion'],
];

const seenCategorySlugs = new Set<string>();

const categories: SeedCategory[] = [
  ...primaryCategories.filter((category) => {
    if (seenCategorySlugs.has(category.slug)) {
      return false;
    }

    seenCategorySlugs.add(category.slug);
    return true;
  }),
  ...Object.entries(secondaryCategoriesByParent).flatMap(([parentSlug, names]) =>
    names
      .map((name) => ({
        name,
        slug: slugifySeedCategory(name),
        parentSlug,
      }))
      .filter((category) => {
        if (seenCategorySlugs.has(category.slug)) {
          return false;
        }

        seenCategorySlugs.add(category.slug);
        return true;
      }),
  ),
  ...additionalSecondaryCategories
    .map(([name, parentSlug]) => ({
      name,
      slug: slugifySeedCategory(name),
      parentSlug,
    }))
    .filter((category) => {
      if (seenCategorySlugs.has(category.slug)) {
        return false;
      }

      seenCategorySlugs.add(category.slug);
      return true;
    }),
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
    categorySlugs: ['news-and-politics', 'political-campaigns'],
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
