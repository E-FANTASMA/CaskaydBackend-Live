export interface CreatorImportRecord {
  platform?: string;
  platformCreatorId?: string;
  name?: string;
  displayName?: string;
  username?: string;
  bio?: string;
  profileImage?: string;
  followers?: string | number;
  following?: string | number;
  posts?: string | number;
  website?: string;
  businessEmail?: string;
  verified?: string | boolean;
  location?: string;
  externalUrl?: string;
  keywords?: string[] | string;
  [key: string]: unknown;
}
