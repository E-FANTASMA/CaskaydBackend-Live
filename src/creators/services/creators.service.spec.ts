import { BadRequestException } from '@nestjs/common';
import { CreatorsService } from './creators.service';

describe('CreatorsService', () => {
  let service: CreatorsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      creator: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new CreatorsService(prisma);
  });

  it('rejects when the primary category is also secondary', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.category.count.mockResolvedValue(2);

    await expect(
      service.create({
        name: 'Creator One',
        primaryCategoryId: 'cat-1',
        secondaryCategoryIds: ['cat-1', 'cat-2'],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects more than five secondary categories', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.category.count.mockResolvedValue(6);

    await expect(
      service.create({
        name: 'Creator One',
        primaryCategoryId: 'cat-1',
        secondaryCategoryIds: ['2', '3', '4', '5', '6', '7'],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects conflicting legacy and normalized primary inputs', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-2' });

    await expect(
      service.create({
        name: 'Creator One',
        primaryCategoryId: 'cat-1',
        primaryNiche: 'Food',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
