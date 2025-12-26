// Image Upload Client for Cloudflare R2 via Worker

const WORKER_URL = 'https://chiyadani-api.wolf76.workers.dev';

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Upload an image file to R2 storage
 */
export async function uploadImage(file: File, customFilename?: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    if (customFilename) {
      formData.append('filename', customFilename);
    }

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return {
      success: true,
      url: data.url,
      key: data.key,
    };
  } catch (error) {
    console.error('Image upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete an image from R2 storage
 */
export async function deleteImage(key: string): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_URL}?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });

    return response.ok;
  } catch (error) {
    console.error('Image delete error:', error);
    return false;
  }
}

/**
 * Convert a File to WebP format before uploading (client-side optimization)
 */
export async function convertToWebP(file: File, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate dimensions (max 1200px)
      const maxSize = 1200;
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const webpFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.webp'),
              { type: 'image/webp' }
            );
            resolve(webpFile);
          } else {
            reject(new Error('Failed to convert to WebP'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload with automatic WebP conversion
 */
export async function uploadImageOptimized(file: File): Promise<UploadResult> {
  try {
    // Convert to WebP if not already
    let fileToUpload = file;
    if (!file.type.includes('webp')) {
      fileToUpload = await convertToWebP(file);
    }
    
    return uploadImage(fileToUpload);
  } catch (error) {
    // Fallback to original file if conversion fails
    console.warn('WebP conversion failed, uploading original:', error);
    return uploadImage(file);
  }
}
