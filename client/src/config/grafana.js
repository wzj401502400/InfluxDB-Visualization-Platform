export { getAggregateWindow };

// 根据时间范围自动选择合适的聚合窗口
const getAggregateWindow = (range) => {
  if (!range) range = '-1h';

  // 提取时间数值和单位
  const match = range.match(/^-?(\d+)([mhd])$/);
  if (!match) return '1m';

  const [, num, unit] = match;
  const value = parseInt(num);

  switch (unit) {
    case 'm': // 分钟
      if (value <= 30) return '30s';
      if (value <= 60) return '1m';
      return '2m';
    case 'h': // 小时
      if (value <= 3) return '1m';
      if (value <= 6) return '5m';
      if (value <= 12) return '10m';
      if (value <= 24) return '30m';
      return '1h';
    case 'd': // 天
      if (value <= 3) return '1h';
      if (value <= 7) return '4h';
      if (value <= 30) return '1d';
      return '1d';
    default:
      return '1m';
  }
};


