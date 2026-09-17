import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuggestionStatus } from '@prisma/client';
import { CreatorSuggestionsService } from './creator-suggestions.service';

describe('CreatorSuggestionsService', () => {
  let service: CreatorSuggestionsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      creatorPlatform: {
        findFirst: jest.fn(),
      },
      creatorSuggestion: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      creator: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    service = new CreatorSuggestionsService(prisma);
  });

  describe('normalizeUsername', () => {
    it('strips leading @, trims, and converts to lowercase', () => {
      expect(service.normalizeUsername('  @JohnDoe  ')).toBe('johndoe');
      expect(service.normalizeUsername('@@Jane_Doe')).toBe('jane_doe');
    });
  });

  describe('create', () => {
    it('creates a new suggestion when no duplicate exists', async () => {
      prisma.creatorPlatform.findFirst.mockResolvedValue(null);
      prisma.creatorSuggestion.findFirst.mockResolvedValue(null);
      prisma.creatorSuggestion.create.mockResolvedValue({
        id: 'sug-1',
        name: 'John Doe',
        username: 'johndoe',
        platform: 'Instagram',
        link: 'https://instagram.com/johndoe',
        status: SuggestionStatus.PENDING,
      });

      const result = await service.create({
        name: 'John Doe',
        username: '@JohnDoe',
        platform: 'Instagram',
        link: 'https://instagram.com/johndoe',
      });

      expect(prisma.creatorPlatform.findFirst).toHaveBeenCalledWith({
        where: { handle: { equals: 'johndoe', mode: 'insensitive' } },
      });
      expect(prisma.creatorSuggestion.findFirst).toHaveBeenCalledWith({
        where: { username: 'johndoe', status: SuggestionStatus.PENDING },
      });
      expect(result.username).toBe('johndoe');
    });

    it('throws BadRequestException if username exists in CreatorPlatform', async () => {
      prisma.creatorPlatform.findFirst.mockResolvedValue({ creatorId: 'c-1' });

      await expect(
        service.create({
          name: 'John Doe',
          username: '@johndoe',
          platform: 'Instagram',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException if pending suggestion exists', async () => {
      prisma.creatorPlatform.findFirst.mockResolvedValue(null);
      prisma.creatorSuggestion.findFirst.mockResolvedValue({ id: 'sug-1' });

      await expect(
        service.create({
          name: 'John Doe',
          username: '@johndoe',
          platform: 'Instagram',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateStatusAdmin', () => {
    it('approves a pending suggestion and creates a new creator atomically', async () => {
      const suggestion = {
        id: 'sug-1',
        name: 'Jane Doe',
        username: 'janedoe',
        platform: 'Instagram',
        link: 'https://instagram.com/janedoe',
        status: SuggestionStatus.PENDING,
      };

      prisma.creatorSuggestion.findUnique.mockResolvedValue(suggestion);
      prisma.creator.create.mockResolvedValue({
        id: 'creator-1',
        name: 'Jane Doe',
        primaryCategory: null,
        secondaryCategories: [],
        platforms: [
          {
            id: 'cp-1',
            creatorId: 'creator-1',
            platform: 'INSTAGRAM',
            handle: 'janedoe',
            followers: 0,
            verified: false,
            profileUrl: 'https://instagram.com/janedoe',
          },
        ],
        searchTags: [],
      });
      prisma.creatorSuggestion.update.mockResolvedValue({
        ...suggestion,
        status: SuggestionStatus.APPROVED,
      });

      const result = await service.updateStatusAdmin('sug-1', {
        status: SuggestionStatus.APPROVED,
      });

      expect(prisma.creator.create).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          state: null,
          primaryCategoryId: null,
          platforms: {
            create: {
              platform: 'INSTAGRAM',
              handle: 'janedoe',
              followers: 0,
              verified: false,
              profileUrl: 'https://instagram.com/janedoe',
            },
          },
        },
        include: expect.any(Object),
      });
      expect(prisma.creatorSuggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: { status: SuggestionStatus.APPROVED },
      });
      expect(result.suggestion.status).toBe(SuggestionStatus.APPROVED);
    });

    it('rejects a pending suggestion without creating a creator', async () => {
      const suggestion = {
        id: 'sug-1',
        name: 'Jane Doe',
        username: 'janedoe',
        platform: 'Instagram',
        status: SuggestionStatus.PENDING,
      };

      prisma.creatorSuggestion.findUnique.mockResolvedValue(suggestion);
      prisma.creatorSuggestion.update.mockResolvedValue({
        ...suggestion,
        status: SuggestionStatus.REJECTED,
      });

      const result = await service.updateStatusAdmin('sug-1', {
        status: SuggestionStatus.REJECTED,
      });

      expect(prisma.creator.create).not.toHaveBeenCalled();
      expect(result.suggestion.status).toBe(SuggestionStatus.REJECTED);
    });

    it('throws NotFoundException if suggestion does not exist', async () => {
      prisma.creatorSuggestion.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatusAdmin('sug-999', {
          status: SuggestionStatus.APPROVED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException if suggestion is already processed', async () => {
      prisma.creatorSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1',
        status: SuggestionStatus.APPROVED,
      });

      await expect(
        service.updateStatusAdmin('sug-1', {
          status: SuggestionStatus.APPROVED,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
