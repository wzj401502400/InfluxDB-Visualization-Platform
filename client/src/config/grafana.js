export { getAggregateWindow };

// Automatically choose an appropriate aggregate window based on time range
const getAggregateWindow = (range) => {
  if (!range) range = '-1h';

  // Extract numeric value and unit from range string
  const match = range.match(/^-?(\d+)([mhd])$/);
  if (!match) return '1m';

  const [, num, unit] = match;
  const value = parseInt(num);

  switch (unit) {
    case 'm': // minutes
      if (value <= 30) return '30s';
      if (value <= 60) return '1m';
      return '2m';
    case 'h': // hours
      if (value <= 3) return '1m';
      if (value <= 6) return '5m';
      if (value <= 12) return '10m';
      if (value <= 24) return '30m';
      return '1h';
    case 'd': // days
      if (value <= 3) return '1h';
      if (value <= 7) return '4h';
      if (value <= 30) return '1d';
      return '1d';
    default:
      return '1m';
  }
};


