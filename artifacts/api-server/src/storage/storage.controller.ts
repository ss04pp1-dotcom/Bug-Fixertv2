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
