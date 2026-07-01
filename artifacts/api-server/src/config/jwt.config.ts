function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Refusing to start with an empty JWT secret — this would allow anyone to forge valid tokens.`,
    );
  }
  return value;
}

export const jwtConfig = {
  secret:           requireSecret('JWT_ACCESS_SECRET'),
  expiresIn:        process.env.JWT_ACCESS_EXPIRY  || '15m',
  refreshSecret:    requireSecret('JWT_REFRESH_SECRET'),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '30d',
};