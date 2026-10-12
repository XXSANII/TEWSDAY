import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storage_files_file_category_enum } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { guard, requireFound } from '../../common/errors';
import { db, transaction } from '../../db';
import { config } from '../../config';
import { newId } from '../../common/ids';

const storageBucket = requireStorageBucket();
const s3 = new S3Client({
  region: config.AWS_REGION,
  ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT, forcePathStyle: true } : {}),
});
const bucket = config.S3_BUCKET;
const maxBytes = 15 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const categorySchema = z.nativeEnum(storage_files_file_category_enum);

function requireStorageBucket(): string {
  guard(
    Boolean(bucket),
    503,
    'STORAGE_NOT_CONFIGURED',
    'Storage is not configured. Please configure S3_BUCKET.',
  );

  return bucket!;
}

export const storageRouter = Router();
storageRouter.use(authenticate);

storageRouter.post('/presigned-upload', async (req, res) => {
  const body = z
    .object({
      file_name: z.string().trim().min(1).max(255),
      mime_type: z.string().min(1).max(100),
      file_size_bytes: z.number().int().positive().max(maxBytes),
      file_category: categorySchema,
    })
    .strict()
    .parse(req.body);

  guard(allowedTypes.has(body.mime_type), 422, 'FILE_TYPE_NOT_ALLOWED', 'Unsupported file type');
  guard(
    (body.file_category === 'AVATAR' && body.mime_type.startsWith('image/')) ||
      (body.file_category !== 'AVATAR' && true),
    422,
    'FILE_CATEGORY_MISMATCH',
    'File type does not match category',
  );

  const fileKey = `users/${req.actor.userId}/${randomUUID()}`;
  const command = new PutObjectCommand({
    Bucket: storageBucket,
    Key: fileKey,
    ContentType: body.mime_type,
    Metadata: { owner: req.actor.userId, category: body.file_category },
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  res.status(201).json({
    data: {
      upload_url: uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': body.mime_type },
      file_key: fileKey,
      expires_in: 300,
    },
  });
});

storageRouter.post('/confirm-upload', async (req, res) => {
  const body = z
    .object({
      file_key: z.string().min(1).max(1024),
      file_name: z.string().trim().min(1).max(255),
      mime_type: z.string().min(1).max(100),
      file_category: categorySchema,
    })
    .strict()
    .parse(req.body);

  guard(
    body.file_key.startsWith(`users/${req.actor.userId}/`),
    403,
    'FILE_FORBIDDEN',
    'Upload key does not belong to you',
  );
  guard(allowedTypes.has(body.mime_type), 422, 'FILE_TYPE_NOT_ALLOWED', 'Unsupported file type');
  const head = await s3.send(new HeadObjectCommand({ Bucket: storageBucket, Key: body.file_key }));
  guard(
    head.ContentLength != null && head.ContentLength > 0 && head.ContentLength <= maxBytes,
    422,
    'FILE_SIZE_INVALID',
    'Uploaded file is empty or exceeds 15 MB',
  );
  guard(
    head.ContentType === body.mime_type,
    422,
    'FILE_TYPE_MISMATCH',
    'Uploaded content type does not match request',
  );
  guard(
    head.Metadata?.owner === req.actor.userId && head.Metadata?.category === body.file_category,
    403,
    'FILE_METADATA_MISMATCH',
    'Uploaded file metadata does not match request',
  );

  const data = await transaction(req.actor.userId, async (tx) => {
    const existing = await tx.storage_files.findFirst({ where: { file_key: body.file_key } });
    if (existing) {
      guard(
        existing.created_by === req.actor.userId,
        403,
        'FILE_FORBIDDEN',
        'File belongs to another user',
      );
      return existing;
    }
    return tx.storage_files.create({
      data: {
        id: newId('fil'),
        bucket_name: storageBucket,
        file_key: body.file_key,
        file_name: body.file_name,
        mime_type: body.mime_type,
        file_size_bytes: BigInt(head.ContentLength!),
        file_category: body.file_category,
        created_by: req.actor.userId,
        updated_by: req.actor.userId,
      },
      select: {
        id: true,
        file_name: true,
        mime_type: true,
        file_size_bytes: true,
        file_category: true,
        created_at: true,
      },
    });
  });
  res.status(201).json({ data: { ...data, file_size_bytes: data.file_size_bytes.toString() } });
});

storageRouter.get('/files/:id/view-url', async (req, res) => {
  const id = z.string().min(1).max(36).parse(req.params.id);
  const file = requireFound(
    await db.storage_files.findFirst({
      where: { id, is_active: true },
    }),
    'File not found',
  );
  guard(
    file.created_by === req.actor.userId || req.actor.roles.includes('ADMIN'),
    403,
    'FILE_FORBIDDEN',
    'You are not allowed to view this file',
  );
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: storageBucket,
      Key: file.file_key,
      ResponseContentDisposition: 'inline',
    }),
    { expiresIn: 120 },
  );
  res.json({ data: { view_url: url, expires_in: 120 } });
});
