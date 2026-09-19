import { RankingService } from "./ranking.service";

describe("RankingService", () => {
  const service = new RankingService();

  it("adds category, intent, tag, location, gender, and verified scores", () => {
    const results = service.rank(
      [
        {
          id: "creator-1",
          primaryCategoryId: "cat-1",
          primaryCategory: { id: "cat-1", name: "Real Estate", slug: "real-estate", description: null, parentId: null, level: 1, createdAt: new Date(), updatedAt: new Date() },
          secondaryCategories: [{ creatorId: "creator-1", categoryId: "cat-2", createdAt: new Date(), category: { id: "cat-2", name: "Apartment Tours", slug: "apartment-tours", description: null, parentId: "cat-1", level: 2, createdAt: new Date(), updatedAt: new Date() } }],
          searchTags: [{ id: "tag-1", creatorId: "creator-1", tag: "apartment", createdAt: new Date() }],
          platforms: [{ id: "platform-1", creatorId: "creator-1", platform: "INSTAGRAM", handle: "creator", followers: 1200, verified: true, profileUrl: null, lastUpdated: new Date() }],
          name: "Creator One",
          gender: "male",
          country: "Nigeria",
          state: "Lagos",
          businessEmail: null,
          profileImage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ],
      {
        tokens: [],
        niches: ["Real Estate"],
        locations: ["Lagos"],
        gender: "male",
        platforms: [],
        campaignIntent: {
          id: "intent-1",
          name: "Apartment Showcase",
          slug: "apartment-showcase",
          categoryIds: ["cat-1", "cat-2"],
          categoryNames: ["Real Estate", "Apartment Tours"],
          tags: ["apartment"],
        },
      },
    );

    expect(results[0].score).toBe(125);
  });

  it("prioritizes exact and substring name and handle matches first in ranking", () => {
    const ronaldo = {
      id: "creator-ronaldo",
      name: "Cristiano Ronaldo",
      platforms: [{ platform: "INSTAGRAM", handle: "cristiano" }],
      searchTags: [],
      secondaryCategories: [],
    } as any;

    const otherCreator = {
      id: "creator-other",
      name: "John Doe",
      platforms: [{ platform: "INSTAGRAM", handle: "johndoe" }],
      primaryCategory: { name: "Sports" },
      searchTags: [],
      secondaryCategories: [],
    } as any;

    // Search query: "ronaldo"
    const ronaldoResults = service.rank([otherCreator, ronaldo], {
      tokens: ["ronaldo"],
      niches: [],
      locations: [],
      platforms: [],
    });

    expect(ronaldoResults[0].creator.id).toBe("creator-ronaldo");
    expect(ronaldoResults[0].score).toBeGreaterThan(ronaldoResults[1].score);

    // Search query: "cristiano" (or "@cristiano")
    const cristianoResults = service.rank([otherCreator, ronaldo], {
      tokens: ["cristiano"],
      niches: [],
      locations: [],
      platforms: [],
    });

    expect(cristianoResults[0].creator.id).toBe("creator-ronaldo");
    // Should get exact handle match (+1000), substring name match (+500), and token match (+250*2)
    expect(cristianoResults[0].score).toBeGreaterThanOrEqual(1500);
  });
});
