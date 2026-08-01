const DEFAULT_MESSAGE = 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';

interface ErrorRule {
  patterns: string[];
  message: string;
}

const ERROR_RULES: ErrorRule[] = [
  {
    patterns: [
      'whatsapp hesabı bağlı değil',
      'hesabı bağlayın',
      'bağlantısı henüz mesaj göndermeye hazır değil',
      'socket closed',
      'connection closed',
      'connection terminated',
      'not connected',
    ],
    message:
      'WhatsApp hesabının bağlantısı kesilmiş. Lütfen hesabı yeniden bağlayın.',
  },
  {
    patterns: [
      'whatsapp hesabı bulunamadı',
      'hesap bulunamadı',
    ],
    message:
      'WhatsApp hesabı bulunamadı. Hesaplar bölümünden hesabı kontrol edin.',
  },
  {
    patterns: [
      'boş mesaj gönderilemez',
      'mesaj metni zorunludur',
    ],
    message: 'Göndermek için bir mesaj yazın.',
  },
  {
    patterns: [
      'mesaj alıcısı bulunamadı',
      'geçerli bir whatsapp numarası bulunamadı',
      'uzak jid',
      'remote jid',
    ],
    message:
      'Mesaj gönderilecek telefon numarası bulunamadı.',
  },
  {
    patterns: [
      'zaman aşımı',
      'timed out',
      'timeout',
      'etimedout',
    ],
    message:
      'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.',
  },
  {
    patterns: [
      'econnreset',
      'econnrefused',
      'network error',
      'failed to fetch',
      'internet',
      'ağ bağlantısı',
    ],
    message:
      'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  },
  {
    patterns: [
      'sqlite_busy',
      'database is locked',
      'database locked',
      'veritabanı meşgul',
    ],
    message:
      'Veriler şu anda işleniyor. Birkaç saniye sonra tekrar deneyin.',
  },
  {
    patterns: [
      'qr',
      'qr kod',
    ],
    message:
      'QR kodu hazırlanamadı. Lütfen bağlantıyı yeniden başlatın.',
  },
  {
    patterns: [
      'yetki',
      'permission denied',
      'access denied',
      'eacces',
    ],
    message:
      'Bu işlem için gerekli izin alınamadı.',
  },
];

function extractErrorText(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === 'string') {
    return reason;
  }

  if (
    reason &&
    typeof reason === 'object' &&
    'message' in reason &&
    typeof (reason as { message?: unknown }).message === 'string'
  ) {
    return (reason as { message: string }).message;
  }

  return '';
}

function cleanTechnicalPrefix(value: string): string {
  return value
    .replace(
      /^error invoking remote method ['"][^'"]+['"]:\s*/i,
      '',
    )
    .replace(/^error:\s*/i, '')
    .trim();
}

export function toUserErrorMessage(
  reason: unknown,
  fallback = DEFAULT_MESSAGE,
): string {
  const rawMessage = cleanTechnicalPrefix(
    extractErrorText(reason),
  );
  const normalized = rawMessage.toLocaleLowerCase('tr-TR');

  for (const rule of ERROR_RULES) {
    if (
      rule.patterns.some((pattern) =>
        normalized.includes(
          pattern.toLocaleLowerCase('tr-TR'),
        ),
      )
    ) {
      return rule.message;
    }
  }

  return fallback;
}

export function reportTechnicalError(
  context: string,
  reason: unknown,
): void {
  console.error(`[${context}]`, reason);
}
