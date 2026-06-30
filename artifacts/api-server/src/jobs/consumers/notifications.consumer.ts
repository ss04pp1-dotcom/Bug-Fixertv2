import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NOTIFICATIONS } from '../jobs.constants';

export interface SendNotificationJob {
  userId: string;
  title: string;
  body: string;
  fcmToken?: string;
  data?: Record<string, string>;
}

interface FirebaseAdmin {
  messaging: () => {
    send: (msg: {
      token: string;
      notification: { title: string; body: string };
      data?: Record<string, string>;
    }) => Promise<string>;
  };
}

let firebaseApp: FirebaseAdmin | null = null;

async function getFirebaseApp(): Promise<FirebaseAdmin | null> {
  if (firebaseApp) return firebaseApp;
  const projectId = process.env['FIREBASE_PROJECT_ID'];
  const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');
  const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
  if (!projectId || !privateKey || !clientEmail) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const admin = await import('firebase-admin');
    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
      });
    }
    firebaseApp = admin as unknown as FirebaseAdmin;
    return firebaseApp;
  } catch {
    return null;
  }
}

@Processor(QUEUE_NOTIFICATIONS)
export class NotificationsQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(NotificationsQueueConsumer.name);

  async process(job: Job<SendNotificationJob>): Promise<void> {
    this.logger.log(`Processing notification job ${job.id} for user ${job.data.userId}`);
    await this.sendPushNotification(job.data);
  }

  private async sendPushNotification(data: SendNotificationJob): Promise<void> {
    if (!data.fcmToken) {
      this.logger.warn(`No FCM token for user ${data.userId} — skipping push`);
      return;
    }
    const app = await getFirebaseApp();
    if (!app) {
      this.logger.warn(`FCM not configured (set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)`);
      return;
    }
    try {
      const messageId = await app.messaging().send({
        token: data.fcmToken,
        notification: { title: data.title, body: data.body },
        ...(data.data && { data: data.data }),
      });
      this.logger.log(`Push sent for user ${data.userId}, messageId: ${messageId}`);
    } catch (err) {
      this.logger.error(`FCM send failed for user ${data.userId}`, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
