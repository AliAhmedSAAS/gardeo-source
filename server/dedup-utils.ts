export function normalizeSiteName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractUkPostcodeUtil(text: string): string | null {
  const match = text.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i);
  return match ? match[1].toUpperCase().replace(/\s+/g, '') : null;
}

export function stripPostcodeFromName(name: string): string {
  return name.replace(/\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s*$/i, '').trim();
}

export interface FuzzySiteMatch {
  siteId: number;
  siteName: string;
  matchReason: string;
  score: number;
}

export function findFuzzySiteMatches(
  incomingSiteName: string,
  existingSites: Array<{ id: number; name: string; postcode?: string | null }>
): FuzzySiteMatch[] {
  const incoming = incomingSiteName.trim();
  const incomingLower = incoming.toLowerCase();
  const incomingNorm = normalizeSiteName(incoming);
  const incomingPostcode = extractUkPostcodeUtil(incoming);
  const incomingStripped = stripPostcodeFromName(incoming).toLowerCase();
  const incomingNormStripped = normalizeSiteName(stripPostcodeFromName(incoming));

  const matches: FuzzySiteMatch[] = [];

  for (const site of existingSites) {
    const storedName = (site.name || '').trim();
    const storedLower = storedName.toLowerCase();
    const storedNorm = normalizeSiteName(storedName);
    const storedPostcode = site.postcode
      ? site.postcode.toUpperCase().replace(/\s+/g, '')
      : extractUkPostcodeUtil(storedName);
    const storedStripped = stripPostcodeFromName(storedName).toLowerCase();
    const storedNormStripped = normalizeSiteName(stripPostcodeFromName(storedName));

    if (storedLower === incomingLower) {
      matches.push({ siteId: site.id, siteName: storedName, matchReason: 'Exact match', score: 100 });
      continue;
    }

    if (storedNorm === incomingNorm) {
      matches.push({ siteId: site.id, siteName: storedName, matchReason: 'Exact match (normalized)', score: 95 });
      continue;
    }

    if (incomingStripped && storedStripped && storedStripped === incomingStripped) {
      matches.push({ siteId: site.id, siteName: storedName, matchReason: 'Name match (ignoring postcode)', score: 90 });
      continue;
    }

    if (incomingNormStripped && storedNormStripped && storedNormStripped === incomingNormStripped) {
      matches.push({ siteId: site.id, siteName: storedName, matchReason: 'Name match (normalized, ignoring postcode)', score: 85 });
      continue;
    }

    if (incomingPostcode && storedPostcode && incomingPostcode === storedPostcode && incomingNormStripped && storedNormStripped) {
      const shorter = incomingNormStripped.length <= storedNormStripped.length ? incomingNormStripped : storedNormStripped;
      const longer = incomingNormStripped.length > storedNormStripped.length ? incomingNormStripped : storedNormStripped;
      if (shorter.length >= 4 && longer.includes(shorter)) {
        matches.push({ siteId: site.id, siteName: storedName, matchReason: 'Partial name + same postcode', score: 80 });
        continue;
      }
    }

    if (incomingNormStripped.length >= 6 && storedNormStripped.length >= 6) {
      const shorter = incomingNormStripped.length <= storedNormStripped.length ? incomingNormStripped : storedNormStripped;
      const longer = incomingNormStripped.length > storedNormStripped.length ? incomingNormStripped : storedNormStripped;
      if (longer.includes(shorter) && shorter.length / longer.length > 0.6) {
        matches.push({ siteId: site.id, siteName: storedName, matchReason: 'Substring match', score: 70 });
        continue;
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
