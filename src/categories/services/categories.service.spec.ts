import { BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      creator: {
        count: jest.fn(),
      },
      creatorSecondaryCategory: {
        count: jest.fn(),
      },
      campaignIntentCategory: {
        count: jest.fn(),
      },
    };
    service = new CategoriesService(prisma);
  });

  it('builds a recursive category tree', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: '1', name: 'Real Estate', parentId: null, level: 1 },
      { id: '2', name: 'Apartment Tours', parentId: '1', level: 2 },
      { id: '3', name: 'Luxury Homes', parentId: '1', level: 2 },
      { id: '4', name: 'Interior Design', parentId: '3', level: 3 },
    ]);

    await expect(service.findTree()).resolves.toEqual([
      {
        id: '1',
        name: 'Real Estate',
        parentId: null,
        level: 1,
        children: [
          {
            id: '2',
            name: 'Apartment Tours',
            parentId: '1',
            level: 2,
            children: [],
          },
          {
            id: '3',
            name: 'Luxury Homes',
            parentId: '1',
            level: 2,
            children: [
              {
                id: '4',
                name: 'Interior Design',
                parentId: '3',
                level: 3,
                children: [],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('prevents deleting referenced categories', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.category.count.mockResolvedValue(0);
    prisma.creator.count.mockResolvedValue(1);
    prisma.creatorSecondaryCategory.count.mockResolvedValue(0);
    prisma.campaignIntentCategory.count.mockResolvedValue(0);

    await expect(service.remove('cat-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
