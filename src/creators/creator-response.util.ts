import { Prisma } from '@prisma/client';

export const creatorRelationsInclude = {
  primaryCategory: true,
  secondaryCategories: {
    include: {
      category: true,
    },
  },
  platforms: true,
  searchTags: true,
} satisfies Prisma.CreatorInclude;

export type CreatorWithRelations = Prisma.CreatorGetPayload<{
  include: typeof creatorRelationsInclude;
}>;

export function withProfilePhoto<T extends { profileImage?: string | null }>(
  creator: T,
) {
  return {
    ...creator,
    profilePhoto: creator.profileImage ?? null,
  };
}

export function serializeCreator(creator: CreatorWithRelations) {
  return withProfilePhoto({
    ...creator,
    primaryNiche: creator.primaryCategory.name,
    secondaryNiches: creator.secondaryCategories.map(
      ({ category }) => category.name,
    ),
    secondaryCategoryIds: creator.secondaryCategories.map(
      ({ categoryId }) => categoryId,
    ),
  });
}
