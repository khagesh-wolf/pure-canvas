/**
 * Cloudflare R2 Client
 * Handles image uploads to R2 via edge function
 */

import { compressImage } from './imageOptimizer';

const WORKER_URL = 'https://chiyadani-api.wolf76.workers.dev';

interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

interface UploadOptions {
  compress?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  folder?: string;
}

/**
 * Upload image to Cloudflare R2
 */
export async function uploadToR2(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const {
      compress = true,
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.85,
      folder = 'menu'
    } = options;

    // Compress image if enabled
    let uploadFile: File | Blob = file;
    if (compress && file.type.startsWith('image/')) {
      uploadFile = await compressImage(file, maxWidth, maxHeight, quality);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'webp';
    const filename = `${folder}/${timestamp}-${randomId}.${extension}`;

    // Create form data
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('filename', filename);
    formData.append('contentType', 'image/webp');

    // Upload via edge function
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Upload failed');
    }

    const result = await response.json();
    return {
      success: true,
      url: result.url,
      key: result.key
    };
  } catch (error) {
    console.error('R2 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Delete image from Cloudflare R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_URL}?key=${encodeURIComponent(key)}`, {
      method: 'DELETE'
    });

    return response.ok;
  } catch (error) {
    console.error('R2 delete error:', error);
    return false;
  }
}

/**
 * Get signed URL for temporary access
 */
export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
  try {
    const response = await fetch(
      `${WORKER_URL}/signed?key=${encodeURIComponent(key)}&expires=${expiresIn}`
    );

    if (!response.ok) return null;

    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Get signed URL error:', error);
    return null;
  }
}
