import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Captures the raw request body as a Buffer on `req.rawBody` before
 * Express JSON parsing destroys the original byte sequence.
 * This is required for webhook signature verification where the exact
 * byte representation of the payload matters.
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
      const chunks: Buffer[] = [];
      let bodySize = 0;
      const maxSize = 10 * 1024 * 1024; // 10MB safety limit

      req.on('data', (chunk: Buffer) => {
        bodySize += chunk.length;
        if (bodySize > maxSize) {
          res.status(413).json({ statusCode: 413, message: 'Payload too large' });
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        (req as any).rawBody = Buffer.concat(chunks).toString('utf8');
        next();
      });

      req.on('error', (err: Error) => {
        next(err);
      });
    } else {
      next();
    }
  }
}