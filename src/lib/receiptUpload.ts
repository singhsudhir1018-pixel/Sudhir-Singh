import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadedReceiptResult {
  url: string;
  storagePath: string | null;
  fileName: string;
  fileType: 'image' | 'pdf';
  fileSize: number;
}

async function compressImageToDataUrl(file: File, maxDim = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToSafeDataUrl(file: File): Promise<string> {
  if (file.type.startsWith('image/')) {
    try {
      return await compressImageToDataUrl(file);
    } catch {
      // fall through
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadReceiptFile(
  farmId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedReceiptResult> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const fileType: 'image' | 'pdf' = isPdf ? 'pdf' : 'image';
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `gallery_receipts/${farmId}/${Date.now()}_${cleanName}`;

  const fallback = async (): Promise<UploadedReceiptResult> => {
    const dataUrl = await fileToSafeDataUrl(file);
    return {
      url: dataUrl,
      storagePath: null,
      fileName: file.name,
      fileType,
      fileSize: file.size,
    };
  };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: UploadedReceiptResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    // Timeout safeguard if Firebase Storage hangs offline or on CORS
    const timer = setTimeout(async () => {
      if (!settled) {
        try {
          finish(await fallback());
        } catch {
          // ignore
        }
      }
    }, 8000);

    try {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snap) => {
          if (snap.totalBytes > 0 && onProgress) {
            onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        },
        async () => {
          clearTimeout(timer);
          try {
            finish(await fallback());
          } catch {
            // ignore
          }
        },
        async () => {
          clearTimeout(timer);
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            finish({
              url: downloadUrl,
              storagePath: path,
              fileName: file.name,
              fileType,
              fileSize: file.size,
            });
          } catch {
            finish(await fallback());
          }
        }
      );
    } catch {
      clearTimeout(timer);
      fallback().then(finish);
    }
  });
}
