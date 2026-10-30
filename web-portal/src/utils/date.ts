export interface ExpiryInfo {
  isExpired: boolean;
  isExpiringSoon: boolean;
  isRed: boolean;
  daysRemaining: number | null;
  text: string;
}

/**
 * Calculates whether an expiry date (BRP / SIA licence) is expired
 * or expires within 30 days, which requires highlighting in red.
 */
export function getExpiryInfo(dateStr?: string | null): ExpiryInfo {
  if (!dateStr || !dateStr.trim()) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      isRed: false,
      daysRemaining: null,
      text: '—',
    };
  }

  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      isRed: false,
      daysRemaining: null,
      text: dateStr,
    };
  }

  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      isRed: false,
      daysRemaining: null,
      text: dateStr,
    };
  }

  // End of the expiry day
  const expiry = new Date(year, month - 1, day, 23, 59, 59);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      isRed: true,
      daysRemaining: diffDays,
      text: `Expired (${dateStr})`,
    };
  }

  if (diffDays <= 30) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      isRed: true,
      daysRemaining: diffDays,
      text: `${dateStr} (${diffDays === 0 ? 'Today' : `${diffDays}d left`})`,
    };
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    isRed: false,
    daysRemaining: diffDays,
    text: dateStr,
  };
}

