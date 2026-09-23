import { getSettings, many, one } from "./db.js";

function inWindow(month, day, startMonth, startDay, endMonth, endDay) {
  const value = month * 100 + day;
  const start = startMonth * 100 + startDay;
  const end = endMonth * 100 + endDay;
  if (start <= end) return value >= start && value <= end;
  return value >= start || value <= end;
}

export function findRashi(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const rows = many("SELECT * FROM rashis ORDER BY sort_order, id");
  return rows.find((row) => inWindow(month, day, row.start_month, row.start_day, row.end_month, row.end_day)) || null;
}

export function buildRecommendation({ birthDate, purpose, weightKg }) {
  const rashi = birthDate ? findRashi(birthDate) : null;
  const purposeRow = purpose
    ? one("SELECT * FROM purposes WHERE slug = ? AND active = 1", purpose)
    : null;
  const divisor = Number(getSettings().carat_divisor) || 12;
  const safeDivisor = divisor > 0 ? divisor : 12;
  const suggestedCarat = weightKg ? Math.round((Number(weightKg) / safeDivisor) * 100) / 100 : null;

  const names = [];
  if (rashi?.gemstone) names.push(rashi.gemstone);
  if (purposeRow?.gemstone && purposeRow.gemstone !== rashi?.gemstone) names.push(purposeRow.gemstone);

  let products = [];
  if (names.length) {
    const clauses = names.map(() => "name LIKE ?").join(" OR ");
    products = many(
      `SELECT slug FROM products WHERE active = 1 AND (${clauses}) ORDER BY is_vault ASC, sort_order ASC`,
      ...names.map((name) => `%${name.split(" ")[0]}%`),
    );
  }

  return {
    rashi: rashi
      ? {
          name: rashi.name,
          englishName: rashi.english_name,
          lord: rashi.lord,
          gemstone: rashi.gemstone,
          note: rashi.note,
        }
      : null,
    lifeStone: rashi ? { name: rashi.gemstone, planet: rashi.lord, reason: `Life stone for ${rashi.name} (${rashi.english_name}).` } : null,
    purposeStone: purposeRow
      ? { name: purposeRow.gemstone, planet: purposeRow.planet, purpose: purposeRow.name, reason: purposeRow.blurb }
      : null,
    suggestedCarat,
    weightNote: weightKg
      ? `Suggested weight is body weight divided by ${safeDivisor}, the divisor saved in the portal.`
      : "Add body weight if you want a suggested carat.",
    productSlugs: products.map((row) => row.slug),
  };
}
