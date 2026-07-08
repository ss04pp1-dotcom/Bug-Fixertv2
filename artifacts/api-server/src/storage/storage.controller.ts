import {
  Controller, Post, Delete, Param, UploadedFile,
  UseInterceptors, UseGuards, BadRequestException, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

const IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALL_ALLOWED = [...IMAGE_MIME, ...VIDEO_MIME];

const SIZE = {
  PROFILE: 5 * 1024 * 1024,
  LOGO:    5 * 1024 * 1024,
  BANNER:  10 * 1024 * 1024,
  POSTER:  15 * 1024 * 1024,
  GENERAL: 100 * 1024 * 1024,
};

type UploadFolder = 'avatars' | 'logos' | 'banners' | 'posters' | 'categories' | 'ads' | 'uploads';

// Magic-byte signatures — client-supplied Content-Type is trivially spoofed, so we
// inspect the file's leading bytes and reject anything that doesn't match a real
// image/video container. This blocks polyglot payloads (e.g. HTML/JS renamed .png).
const MAGIC: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/jpeg', test: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png',  test: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/gif',  test: b => b.length > 6 && b.slice(0, 6).toString('ascii').startsWith('GIF8') },
  { mime: 'image/webp', test: b => b.length > 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'video/mp4',  test: b => b.length > 12 && b.slice(4, 8).toString('ascii') === 'ftyp' },
  { mime: 'video/webm', test: b => b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { mime: 'video/quicktime', test: b => b.length > 12 && b.slice(4, 8).toString('ascii') === 'ftyp' && b.slice(8, 12).toString('ascii').startsWith('qt') },
];

function sniffMime(buf: Buffer | undefined): string | null {
  if (!buf || buf.length < 4) return null;
  const hit = MAGIC.find(m => m.test(buf));
  return hit?.mime ?? null;
}

function validateFile(
  file: Express.Multer.File | undefined,
  allowedMime: string[],
  maxSize: number,
  label: string,
) {
  if (!file) throw new BadRequestException('No file provided');
  if (!allowedMime.includes(file.mimetype)) {
    throw new BadRequestException(
      `${label}: type '${file.mimetype}' not allowed. Accepted: ${allowedMime.join(', ')}`,
    );
  }
  if (file.size > maxSize) {
    throw new BadRequestException(
      `${label}: exceeds limit of ${Math.round(maxSize / 1024 / 1024)} MB`,
    );
  }
  // Magic-byte check — reject files whose real content contradicts the declared MIME.
  const sniffed = sniffMime(file.buffer);
  if (!sniffed || !allowedMime.includes(sniffed)) {
    throw new BadRequestException(
      `${label}: file content does not match a permitted ${allowedMime.includes('image/jpeg') ? 'image' : 'media'} format`,
    );
  }
}

@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'storage', version: '1' })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseGuards(RolesGuard) @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'General upload — images & videos, max 100 MB' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'folder', required: false, enum: ['avatars','logos','banners','posters','categories','ads','uploads'] })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SIZE.GENERAL } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Query('folder') folder?: string) {
    validateFile(file, ALL_ALLOWED, SIZE.GENERAL, 'Upload');
    const valid: UploadFolder[] = ['avatars','logos','banners','posters','categories','ads','uploads'];
    const dest: UploadFolder = valid.includes(folder as UploadFolder) ? (folder as UploadFolder) : 'uploads';
    return this.storageService.upload(file, dest);
  }

  @Post('upload/avatar')
  @ApiOperation({ summary: 'Profile avatar — images only, max 5 MB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SIZE.PROFILE } }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    validateFile(file, IMAGE_MIME, SIZE.PROFILE, 'Avatar');
    return this.storageService.upload(file, 'avatars');
  }

  @Post('upload/logo')
  @UseGuards(RolesGuard) @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Channel / brand logo — images only, max 5 MB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SIZE.LOGO } }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    validateFile(file, IMAGE_MIME, SIZE.LOGO, 'Logo');
    return this.storageService.upload(file, 'logos');
  }

  @Post('upload/banner')
  @UseGuards(RolesGuard) @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Banner image — images only, max 10 MB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SIZE.BANNER } }))
  async uploadBanner(@UploadedFile() file: Express.Multer.File) {
    validateFile(file, IMAGE_MIME, SIZE.BANNER, 'Banner');
    return this.storageService.upload(file, 'banners');
  }

  @Post('upload/poster')
  @UseGuards(RolesGuard) @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Movie / series poster — images only, max 15 MB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SIZE.POSTER } }))
  async uploadPoster(@UploadedFile() file: Express.Multer.File) {
    validateFile(file, IMAGE_MIME, SIZE.POSTER, 'Poster');
    return this.storageService.upload(file, 'posters');
  }

  @Post('upload/category')
  @UseGuards(RolesGuard) @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Category image — images only, max 10 MB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SIZE.BANNER } }))
  async uploadCategory(@UploadedFile() file: Express.Multer.File) {
    validateFile(file, IMAGE_MIME, SIZE.BANNER, 'Category image');
    return this.storageService.upload(file, 'categories');
  }

  @Post('upload/ad')
  @UseGuards(RolesGuard) @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Advertisement image — images only, max 10 MB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SIZE.BANNER } }))
  async uploadAd(@UploadedFile() file: Express.Multer.File) {
    validateFile(file, IMAGE_MIME, SIZE.BANNER, 'Ad image');
    return this.storageService.upload(file, 'ads');
  }

  @Delete(':key(*)')
  @UseGuards(RolesGuard) @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete file from Cloudflare R2' })
  async delete(@Param('key') key: string) {
    // A-033: restrict deletions to paths under known upload folders so an
    // admin cannot delete arbitrary S3 objects by crafting a path like
    // "../../other-bucket-key" or "config/sensitive-file".
    const ALLOWED_PREFIXES: UploadFolder[] = [
      'avatars', 'logos', 'banners', 'posters', 'categories', 'ads', 'uploads',
    ];
    const normalised = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const isAllowed = ALLOWED_PREFIXES.some(prefix => normalised.startsWith(`${prefix}/`));
    if (!isAllowed) {
      throw new BadRequestException(
        `Delete rejected: key must start with one of [${ALLOWED_PREFIXES.join(', ')}]. ` +
        `Got: "${normalised}"`,
      );
    }
    await this.storageService.delete(normalised);
    return { message: 'File deleted', key: normalised };
  }
}
