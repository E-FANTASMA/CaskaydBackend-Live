import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface ResolveIntentInput {
  query: string;
  tokens: string[];
}

@Injectable()
export class CampaignIntentResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve({ query, tokens }: ResolveIntentInput) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return undefined;
    }

    let intents;
    try {
      intents = await this.prisma.campaignIntent.findMany({
        include: {
          categories: {
            include: {
              category: true,
            },
          },
          tags: true,
        },
      });
    } catch (error) {
      if (this.isMissingTaxonomySchemaError(error)) {
        return undefined;
      }

      throw error;
    }

    const tokenSet = new Set(tokens.map((token) => token.toLowerCase()));
    let bestMatch:
      | {
          score: number;
          intent: {
            id: string;
            name: string;
            slug: string;
            description: string | null;
            categories: { category: { id: string; name: string } }[];
            tags: { tag: string }[];
          };
        }
      | undefined;

    for (const intent of intents) {
      const normalizedName = intent.name.toLowerCase();
      const normalizedSlugPhrase = intent.slug.replace(/-/g, ' ');
      let score = 0;

      if (normalizedQuery.includes(normalizedName)) {
        score += 6;
      }

      if (normalizedQuery.includes(normalizedSlugPhrase)) {
        score += 5;
      }

      for (const word of normalizedName.split(/\s+/)) {
        if (tokenSet.has(word)) {
          score += 1;
        }
      }

      for (const tag of intent.tags) {
        const normalizedTag = tag.tag.toLowerCase();
        if (normalizedQuery.includes(normalizedTag)) {
          score += normalizedTag.includes(' ') ? 3 : 2;
        }
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          score,
          intent,
        };
      }
    }

    if (!bestMatch || bestMatch.score < 4) {
      return undefined;
    }

    return {
      id: bestMatch.intent.id,
      name: bestMatch.intent.name,
      slug: bestMatch.intent.slug,
      categoryIds: bestMatch.intent.categories.map(({ category }) => category.id),
      categoryNames: bestMatch.intent.categories.map(
        ({ category }) => category.name,
      ),
      tags: bestMatch.intent.tags.map(({ tag }) => tag),
    };
  }

  private isMissingTaxonomySchemaError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2021', 'P2022'].includes(error.code)
    );
  }
}
