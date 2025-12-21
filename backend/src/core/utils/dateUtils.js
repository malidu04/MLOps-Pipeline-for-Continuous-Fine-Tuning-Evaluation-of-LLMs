import { format, formatDistance, formatRelative, isBefore, isAfter, addDays, subDays } from 'date-fns';

export const formatDate = (date, formatString = 'yyyy-MM-dd HH:mm:ss') => {
  return format(new Date(date), formatString);
};

export const formatTimeAgo = (date) => {
  return formatDistance(new Date(date), new Date(), { addSuffix: true });
};

export const formatRelativeTime = (date) => {
  return formatRelative(new Date(date), new Date());
};

export const isExpired = (date) => {
  return isBefore(new Date(date), new Date());
};

export const willExpireIn = (date, days = 7) => {
  const expiryDate = new Date(date);
  const warningDate = subDays(expiryDate, days);
  return isBefore(new Date(), warningDate);
};

export const calculateDuration = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end - start;
  
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const scheduleDate = (daysFromNow = 7) => {
  return addDays(new Date(), daysFromNow);
};

