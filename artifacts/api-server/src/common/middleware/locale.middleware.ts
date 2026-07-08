import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * LocaleMiddleware — extract Accept-Language header and attach to request.
 *
 * Usage in services:
 *   const locale = (req as LocalisedRequest).locale ?? 'en';
 *
 * Apply globally in AppModule:
 *   consumer.apply(LocaleMiddleware).forRoutes('*');
 *
 * Supported locales can be expanded; unsupported values fall back to 'en'.
 */

const SUPPORTED_LOCALES = new Set(['en', 'bn', 'ar', 'hi', 'fr', 'es', 'pt', 'ur', 'tr']);
const DEFAULT_LOCALE = 'en';

export interface LocalisedRequest extends Request {
  locale: string;
}

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers['accept-language'] ?? '';
    // Accept-Language: bn-BD,bn;q=0.9,en;q=0.8
    // Extract the first preferred language tag.
    const preferred = String(header).split(/[,;]/)[0].trim().split('-')[0].toLowerCase();
    (req as LocalisedRequest).locale = SUPPORTED_LOCALES.has(preferred)
      ? preferred
      : DEFAULT_LOCALE;
    next();
  }
}

/**
 * Localised error messages — add more locales as needed.
 * Usage: t('validation.required', locale)
 */
type ErrorKey =
  | 'validation.required'
  | 'auth.invalid_credentials'
  | 'auth.account_disabled'
  | 'auth.otp_expired'
  | 'auth.otp_invalid'
  | 'subscription.required'
  | 'generic.not_found'
  | 'generic.forbidden'
  | 'generic.server_error';

const MESSAGES: Record<ErrorKey, Record<string, string>> = {
  'validation.required': { en: 'This field is required', bn: 'এই ক্ষেত্রটি প্রয়োজনীয়', ar: 'هذا الحقل مطلوب' },
  'auth.invalid_credentials': { en: 'Invalid email or password', bn: 'ইমেইল বা পাসওয়ার্ড ভুল', ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
  'auth.account_disabled': { en: 'Your account has been disabled', bn: 'আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে', ar: 'تم تعطيل حسابك' },
  'auth.otp_expired': { en: 'OTP has expired. Please request a new one', bn: 'OTP মেয়াদ শেষ। নতুন OTP অনুরোধ করুন', ar: 'انتهت صلاحية OTP. يرجى طلب رمز جديد' },
  'auth.otp_invalid': { en: 'Invalid OTP code', bn: 'OTP কোড ভুল', ar: 'رمز OTP غير صحيح' },
  'subscription.required': { en: 'Premium subscription required', bn: 'প্রিমিয়াম সাবস্ক্রিপশন প্রয়োজন', ar: 'مطلوب اشتراك مميز' },
  'generic.not_found': { en: 'Resource not found', bn: 'অনুরোধকৃত তথ্য পাওয়া যায়নি', ar: 'المورد غير موجود' },
  'generic.forbidden': { en: 'You do not have permission to access this resource', bn: 'আপনার এই রিসোর্সে প্রবেশাধিকার নেই', ar: 'ليس لديك إذن للوصول إلى هذا المورد' },
  'generic.server_error': { en: 'An unexpected error occurred', bn: 'একটি অপ্রত্যাশিত ত্রুটি হয়েছে', ar: 'حدث خطأ غير متوقع' },
};

export function t(key: ErrorKey, locale = DEFAULT_LOCALE): string {
  return MESSAGES[key]?.[locale] ?? MESSAGES[key]?.[DEFAULT_LOCALE] ?? key;
}
