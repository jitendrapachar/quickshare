export const MAX_FILE_SIZE_MB = 25;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const FILE_EXPIRY_MINUTES = 10;
export const MAX_FILES_PER_BATCH = 5;

export const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
  'jpg', 'jpeg', 'png', 'webp', 'mp4', 'zip'
];

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/zip',
  'application/x-zip-compressed'
];

export function generateRoomId(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (num) => chars[num % chars.length]).join('');
}

export function validateFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
  const isValidMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type);

  if (!isValidExt && !isValidMime) {
    return `Unsupported file format (.${ext}). Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG, WEBP, MP4, ZIP.`;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" is too large (${formatFileSize(file.size)}). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`;
  }

  return null;
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
