import { serializeCreator, withProfilePhoto } from './creator-response.util';

describe('creator response utilities', () => {
  it('adds profilePhoto from profileImage on serialized creators', () => {
    const creator = {
      id: 'creator-1',
      name: 'Creator One',
      gender: 'female',
      country: 'Nigeria',
      state: 'Lagos',
      primaryCategoryId: 'cat-1',
      businessEmail: null,
      profileImage: 'https://cdn.example.com/avatar.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
      primaryCategory: {
        id: 'cat-1',
        name: 'Lifestyle',
        slug: 'lifestyle',
        description: null,
        parentId: null,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      secondaryCategories: [
        {
          creatorId: 'creator-1',
          categoryId: 'cat-2',
          createdAt: new Date(),
          category: {
            id: 'cat-2',
            name: 'Fashion',
            slug: 'fashion',
            description: null,
            parentId: null,
            level: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      platforms: [],
      searchTags: [],
    } as Parameters<typeof serializeCreator>[0];

    expect(serializeCreator(creator)).toMatchObject({
      profileImage: 'https://cdn.example.com/avatar.jpg',
      profilePhoto: 'https://cdn.example.com/avatar.jpg',
      primaryNiche: 'Lifestyle',
      secondaryNiches: ['Fashion'],
      secondaryCategoryIds: ['cat-2'],
    });
  });

  it('adds profilePhoto to legacy creator payloads', () => {
    expect(
      withProfilePhoto({
        id: 'creator-2',
        profileImage: 'https://cdn.example.com/legacy-avatar.jpg',
      }),
    ).toEqual({
      id: 'creator-2',
      profileImage: 'https://cdn.example.com/legacy-avatar.jpg',
      profilePhoto: 'https://cdn.example.com/legacy-avatar.jpg',
    });
  });
});
