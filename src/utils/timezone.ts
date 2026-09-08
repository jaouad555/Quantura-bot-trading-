import { TimezoneMode } from '../types';

export function formatTime(
  timestamp: number | string,
  mode: TimezoneMode = 'GMT+1',
  includeSeconds = true
): string {
  const date = new Date(typeof timestamp === 'string' ? Number(timestamp) : timestamp);
  if (isNaN(date.getTime())) return '--:--:--';

  let timeZone = 'Africa/Casablanca'; // GMT+1 Morocco
  if (mode === 'UTC') timeZone = 'UTC';
  else if (mode === 'LOCAL') timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    }).format(date);
  } catch (e) {
    return date.toLocaleTimeString();
  }
}

export function formatDateOnly(
  timestamp: number | string,
  mode: TimezoneMode = 'GMT+1'
): string {
  const date = new Date(typeof timestamp === 'string' ? Number(timestamp) : timestamp);
  if (isNaN(date.getTime())) return '--/--/----';

  let timeZone = 'Africa/Casablanca'; // GMT+1 Morocco
  if (mode === 'UTC') timeZone = 'UTC';
  else if (mode === 'LOCAL') timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
  } catch (e) {
    return date.toLocaleDateString();
  }
}

export function formatDateTime(
  timestamp: number | string,
  mode: TimezoneMode = 'GMT+1',
  dateOnly = false
): string {
  if (dateOnly) return formatDateOnly(timestamp, mode);
  const date = new Date(typeof timestamp === 'string' ? Number(timestamp) : timestamp);
  if (isNaN(date.getTime())) return '--/--/---- --:--';

  let timeZone = 'Africa/Casablanca'; // GMT+1 Morocco
  if (mode === 'UTC') timeZone = 'UTC';
  else if (mode === 'LOCAL') timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch (e) {
    return date.toLocaleString();
  }
}

export function getTimezoneLabel(mode: TimezoneMode): string {
  switch (mode) {
    case 'GMT+1':
      return 'GMT+1 (Maroc / Casablanca)';
    case 'UTC':
      return 'UTC (Temps Universel)';
    case 'LOCAL':
      return `Heure Locale (${Intl.DateTimeFormat().resolvedOptions().timeZone || 'Système'})`;
    default:
      return 'GMT+1';
  }
}
