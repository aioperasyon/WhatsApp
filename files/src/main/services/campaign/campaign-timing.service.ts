interface ParsedCampaignTime {
  hour: number;
  minute: number;
}

const DEFAULT_WORK_START_TIME = '09:00';
const DEFAULT_WORK_END_TIME = '18:30';

const invalidWorkingWindowWarnings = new Set<string>();

function parseTime(
  value: string,
): ParsedCampaignTime | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(
    value.trim(),
  );

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
  };
}

function resolveWorkingTime(
  value: string,
  fallback: string,
  label: 'start' | 'end',
): ParsedCampaignTime {
  const parsed = parseTime(value);

  if (parsed) {
    return parsed;
  }

  const warningKey = `${label}:${value}`;

  if (!invalidWorkingWindowWarnings.has(warningKey)) {
    invalidWorkingWindowWarnings.add(warningKey);

    console.warn(
      `[Campaign Engine] Geçersiz çalışma saati "${value}" için ${fallback} varsayılanı kullanılacak.`,
    );
  }

  const fallbackParsed = parseTime(fallback);

  if (!fallbackParsed) {
    throw new Error(
      `Geçersiz varsayılan çalışma saati: ${fallback}`,
    );
  }

  return fallbackParsed;
}

export function randomCampaignInteger(
  minimum: number,
  maximum: number,
): number {
  const min = Math.max(
    0,
    Math.trunc(Math.min(minimum, maximum)),
  );
  const max = Math.max(
    min,
    Math.trunc(Math.max(minimum, maximum)),
  );

  return (
    Math.floor(Math.random() * (max - min + 1)) +
    min
  );
}

export function millisecondsUntilCampaignWorkingWindow(
  startValue: string,
  endValue: string,
  now = new Date(),
): number {
  const start = resolveWorkingTime(
    startValue,
    DEFAULT_WORK_START_TIME,
    'start',
  );
  const end = resolveWorkingTime(
    endValue,
    DEFAULT_WORK_END_TIME,
    'end',
  );

  const startMinutes =
    start.hour * 60 + start.minute;
  const endMinutes =
    end.hour * 60 + end.minute;
  const nowMinutes =
    now.getHours() * 60 + now.getMinutes();

  if (startMinutes === endMinutes) {
    return 0;
  }

  const inside =
    startMinutes < endMinutes
      ? nowMinutes >= startMinutes &&
        nowMinutes < endMinutes
      : nowMinutes >= startMinutes ||
        nowMinutes < endMinutes;

  if (inside) {
    return 0;
  }

  const target = new Date(now);
  target.setSeconds(0, 0);
  target.setHours(
    start.hour,
    start.minute,
    0,
    0,
  );

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return Math.max(
    1000,
    target.getTime() - now.getTime(),
  );
}

export function millisecondsUntilNextCampaignDay(
  now = new Date(),
): number {
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);

  return Math.max(
    1000,
    next.getTime() - now.getTime(),
  );
}
