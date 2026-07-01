import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: UserRole;
  isActive: boolean;
  isPremium: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatar: string | null;
  country: string | null;
  language: string;
  // movies.service.ts uses subscriptionEndsAt to gate premium stream access
  subscriptionEndsAt?: Date | string | null;
  sessionId?: string;
  refreshToken?: string;
}
