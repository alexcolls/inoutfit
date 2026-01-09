export const USERS_BUCKET = 'users';
export const GALLERY_BUCKET = 'gallery';

export const USER_ASSET_PREFIXES = {
  outfits: 'outfits',
  avatars: 'avatars',
  outputs: 'outputs',
  clothes: 'clothes'
} as const;

export type UserAssetPrefix = (typeof USER_ASSET_PREFIXES)[keyof typeof USER_ASSET_PREFIXES];

export function makeUserObjectPath(params: {
  userId: string;
  prefix: UserAssetPrefix;
  filename: string;
}) {
  return `${params.userId}/${params.prefix}/${params.filename}`;
}
