import { Category } from '@prisma/client';

export interface TaxonomyResolution {
  primaryCategoryId: string;
  primaryCategory: Category;
  secondaryCategoryIds: string[];
  secondaryCategories: Category[];
}
