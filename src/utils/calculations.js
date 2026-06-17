import { differenceInMonths, parseISO } from 'date-fns';

/**
 * Calculate escalated lot price using simple interest monthly method.
 * Monthly rate = annualRate / 12
 * Adj price = basePrice * (1 + (annualRate/12) * monthsElapsed)
 */
export function calcAdjPrice(basePrice, annualRate, escalatorStart, takedownDate) {
  const start = typeof escalatorStart === 'string' ? parseISO(escalatorStart) : escalatorStart;
  const td    = typeof takedownDate  === 'string' ? parseISO(takedownDate)  : takedownDate;
  const months = Math.max(0, differenceInMonths(td, start));
  return basePrice * (1 + (annualRate / 12) * months);
}

/**
 * Given a contract and a tranche, compute all financial fields.
 */
export function calcTranche(contract, tranche) {
  const ffWidth   = parseFloat(contract.ff_width);
  const ffPrice   = parseFloat(contract.ff_price);
  const basePrice = ffWidth * ffPrice;
  const adjPrice  = calcAdjPrice(
    basePrice,
    parseFloat(contract.escalator_rate),
    contract.escalator_start,
    tranche.scheduled_date
  );
  const lots      = parseInt(tranche.lot_count, 10);
  const revenue   = adjPrice * lots;
  const em        = revenue * parseFloat(contract.em_pct);
  const lift      = (adjPrice - basePrice) * lots;
  const months    = Math.max(
    0,
    differenceInMonths(
      parseISO(tranche.scheduled_date),
      parseISO(contract.escalator_start)
    )
  );
  return {
    base_lot_price: basePrice,
    adj_lot_price: adjPrice,
    months_escalated: months,
    projected_revenue: revenue,
    projected_em: em,
    escalator_lift: lift,
  };
}

/**
 * Format a number as USD currency string.
 */
export function fmtCurrency(val, decimals = 0) {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function fmtPct(val) {
  if (val == null || isNaN(val)) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

export function fmtNum(val) {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-US').format(val);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    // Handle timezone issue by splitting date string and using local time
    // This prevents the date from shifting due to timezone conversion
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      .format(date);
  } catch {
    return dateStr;
  }
}
