import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformType } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CreatorAvatarSyncService {
  private readonly logger = new Logger(CreatorAvatarSyncService.name);
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;
  private readonly bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://ykrjylzazcnfcexdvfaq.supabase.co';
    this.supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_KEY') || '';
    this.bucketName =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ||
      'profile-picture';
  }

  /**
   * Syncs a creator's profile picture in full HD with waterfall fallbacks.
   * Uploads the result to Supabase Storage and updates Creator.profileImage in Postgres.
   */
  async syncCreatorAvatar(creatorId: string, force = false): Promise<string | null> {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      include: { platforms: true },
    });

    if (!creator) {
      this.logger.warn(`Cannot sync avatar: Creator ${creatorId} not found.`);
      return null;
    }

    if (creator.profileImage && !force) {
      this.logger.log(`Creator ${creatorId} already has a profile image, skipping sync.`);
      return creator.profileImage;
    }

    this.logger.log(`[SpinSync] Starting real-time HD avatar retrieval for Creator: ${creator.name} (${creatorId})...`);

    let imageBuffer: Buffer | null = null;
    let sourcePlatform = '';

    // Find Instagram and TikTok handles
    const igPlatform = creator.platforms.find(
      (p) => p.platform === PlatformType.INSTAGRAM,
    );
    const ttPlatform = creator.platforms.find(
      (p) => p.platform === PlatformType.TIKTOK,
    );

    // Tier 1: Try Instagram True HD Scrape
    if (igPlatform && igPlatform.handle) {
      const igHandle = igPlatform.handle.replace(/^@/, '').trim();
      try {
        const igUrl = await this.fetchInstagramAvatarUrl(igHandle);
        if (igUrl) {
          imageBuffer = await this.downloadImageBuffer(igUrl);
          if (imageBuffer) {
            sourcePlatform = `Instagram (@${igHandle})`;
          }
        }
      } catch (igErr) {
        this.logger.warn(`Instagram avatar fetch failed for @${igHandle}: ${igErr}`);
      }
    }

    // Tier 2: Fallback to TikTok 1080x1080 True HD Avatar
    if (!imageBuffer && ttPlatform && ttPlatform.handle) {
      const ttHandle = ttPlatform.handle.replace(/^@/, '').trim();
      try {
        const ttUrl = await this.fetchTikTokAvatarUrl(ttHandle);
        if (ttUrl) {
          imageBuffer = await this.downloadImageBuffer(ttUrl);
          if (imageBuffer) {
            sourcePlatform = `TikTok (@${ttHandle})`;
          }
        }
      } catch (ttErr) {
        this.logger.warn(`TikTok avatar fetch failed for @${ttHandle}: ${ttErr}`);
      }
    }

    // Tier 3: If TikTok handle wasn't listed but we have Instagram handle, try TikTok with that same handle
    if (!imageBuffer && igPlatform && igPlatform.handle) {
      const fallbackHandle = igPlatform.handle.replace(/^@/, '').trim();
      try {
        const ttUrl = await this.fetchTikTokAvatarUrl(fallbackHandle);
        if (ttUrl) {
          imageBuffer = await this.downloadImageBuffer(ttUrl);
          if (imageBuffer) {
            sourcePlatform = `TikTok cross-fallback (@${fallbackHandle})`;
          }
        }
      } catch {
        // quiet fallback
      }
    }

    if (!imageBuffer) {
      this.logger.error(`[SpinSync] Failed to retrieve HD avatar for Creator ${creatorId}`);
      await this.prisma.creator.update({
        where: { id: creatorId },
        data: { pfpError: 'Could not retrieve HD profile picture' },
      });
      return null;
    }

    // Upload to Supabase Storage Bucket
    try {
      const publicUrl = await this.uploadToSupabaseStorage(creatorId, imageBuffer);
      
      await this.prisma.creator.update({
        where: { id: creatorId },
        data: {
          profileImage: publicUrl,
          pfpError: null,
        },
      });

      this.logger.log(
        `[SpinSync] SUCCESS! Uploaded HD avatar (${imageBuffer.length} bytes) for Creator ${creatorId} from ${sourcePlatform} -> ${publicUrl}`,
      );
      return publicUrl;
    } catch (uploadErr) {
      this.logger.error(`Storage upload failed for Creator ${creatorId}: ${uploadErr}`);
      return null;
    }
  }

  private async fetchInstagramAvatarUrl(handle: string): Promise<string | null> {
    const res = await axios.get(`https://www.instagram.com/${handle}/`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 12000,
    });

    const html: string = res.data;
    const ogMatch = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
      return ogMatch[1].replace(/&amp;/g, '&');
    }

    return null;
  }

  private async fetchTikTokAvatarUrl(handle: string): Promise<string | null> {
    const res = await axios.get(`https://www.tiktok.com/@${handle}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 12000,
    });

    const html: string = res.data;
    const avatarMatch = html.match(/"avatarLarger":"([^"]+)"/);
    if (avatarMatch && avatarMatch[1]) {
      try {
        return JSON.parse(`"${avatarMatch[1]}"`);
      } catch {
        return avatarMatch[1].replace(/\\u002F/g, '/');
      }
    }

    return null;
  }

  private async downloadImageBuffer(url: string): Promise<Buffer | null> {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    if (res.status === 200 && res.data) {
      return Buffer.from(res.data);
    }

    return null;
  }

  private async uploadToSupabaseStorage(
    creatorId: string,
    buffer: Buffer,
  ): Promise<string> {
    const fileName = `${creatorId}.jpg`;
    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${fileName}`;

    await axios.post(uploadUrl, buffer, {
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      timeout: 20000,
    });

    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${fileName}`;
  }
}
