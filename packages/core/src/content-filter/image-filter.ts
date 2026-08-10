/**
 * Image content filter — two-stage Google Vision check:
 *
 * Stage 1 — SafeSearch:
 *   Rejects if adult / violence / racy is LIKELY or VERY_LIKELY.
 *
 * Stage 2 — Label blocklist (religious + text-heavy imagery):
 *   Google Vision LABEL_DETECTION returns a ranked list of visual labels
 *   (e.g. "Bible", "Text", "Book page", "Cross", "Church", etc.).
 *   We reject any image whose labels intersect our blocklists:
 *
 *   a) RELIGIOUS_LABELS — catches: Bible pages, churches, crosses, mosques,
 *      temples, prayer books, shrines, religious iconography.
 *      Root cause of Post 5: Pexels returned a Bible-page photo for "universe
 *      in ecstatic motion" because "motion" + dark background matched a
 *      moody scripture photography style.
 *
 *   b) TEXT_HEAVY_LABELS — catches: images where readable body text dominates
 *      the frame (open books, newspapers, scripture pages, tattoos with words).
 *      Root cause of Post 3: Unsplash returned a wrist tattoo with "FOCUS"
 *      text for the query "live amongst people" — the tattoo was the largest
 *      visible element and competed directly with the overlay quote text.
 *
 * Both blocklists are matched case-insensitively against label descriptions.
 * The threshold for label confidence is 0.6 (60%) — labels below this are
 * ignored (they indicate the object is barely visible / minor element).
 */

const REJECT_LEVELS = new Set(["LIKELY", "VERY_LIKELY"]);

/**
 * Labels that indicate religious visual content.
 * Sourced from Google Vision's label taxonomy for religion/faith imagery.
 */
const RELIGIOUS_LABELS = new Set([
  // Scriptures / texts
  "bible", "quran", "koran", "torah", "scripture", "holy book",
  "religious text", "gospel", "prayer book", "hymnal",
  // Buildings / structures
  "church", "cathedral", "chapel", "mosque", "temple", "synagogue",
  "shrine", "monastery", "convent", "minaret", "steeple",
  "place of worship",
  // Symbols / objects
  "cross", "crucifix", "altar", "pew", "pulpit", "communion",
  "rosary", "menorah", "star of david", "crescent", "om symbol",
  "prayer beads", "incense", "religious icon", "saint", "angel",
  "halo", "nativity", "manger",
  // Concepts / scenes
  "religion", "religious", "worship", "prayer", "baptism",
  "clergy", "priest", "monk", "nun", "imam", "rabbi",
  "religious ceremony", "religious art", "religious organisation",
  "pilgrimage", "holy", "sacred",
]);

/**
 * Labels that indicate an image is dominated by human-readable text
 * (book pages, newspapers, tattoos with words, signage with dense text).
 * These compete directly with the quote overlay and look unprofessional.
 */
const TEXT_HEAVY_LABELS = new Set([
  // Physical text documents
  "book", "open book", "page", "book page", "text", "printed text",
  "document", "paper", "manuscript", "script", "handwriting",
  "newspaper", "magazine", "journal", "diary",
  // Typography / lettering as the primary subject
  "font", "typography", "lettering", "calligraphy",
  // Tattoo text
  "tattoo", "body art",
  // Signage / blackboards with dense text
  "blackboard", "whiteboard", "chalkboard",
]);

/** Minimum Vision label confidence to treat a label as a positive detection. */
const LABEL_CONFIDENCE_THRESHOLD = 0.6;

interface SafeSearchAnnotation {
  adult?: string;
  violence?: string;
  racy?: string;
}

interface LabelAnnotation {
  description: string;
  score: number;
}

export interface ImageFilterResult {
  passes: boolean;
  annotation: SafeSearchAnnotation;
  /** Labels that caused rejection, if any (empty if rejected by SafeSearch). */
  rejectedLabels?: string[];
}

/**
 * Per plan.md §7.5 / §2.7: multi-feature Google Cloud Vision check.
 *
 * Makes a single API call requesting both SAFE_SEARCH_DETECTION and
 * LABEL_DETECTION features — no extra round-trip cost.
 *
 * Rejects if:
 *  - adult / violence / racy is LIKELY or VERY_LIKELY (SafeSearch), OR
 *  - any high-confidence label (≥ 0.6) matches the religious/text blocklists
 */
export async function imagePassesFilter(
  imageUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageFilterResult> {
  const res = await fetchImpl(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [
              { type: "SAFE_SEARCH_DETECTION" },
              { type: "LABEL_DETECTION", maxResults: 20 },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Vision SafeSearch request failed: ${res.status}`);
  }

  const body = (await res.json()) as {
    responses?: Array<{
      safeSearchAnnotation?: SafeSearchAnnotation;
      labelAnnotations?: LabelAnnotation[];
    }>;
  };

  const response = body.responses?.[0];
  if (!response) {
    throw new Error("Google Vision SafeSearch response missing responses[0].safeSearchAnnotation");
  }

  const annotation = response.safeSearchAnnotation ?? {};

  // Stage 1: SafeSearch
  const safesearchFlagged = [annotation.adult, annotation.violence, annotation.racy].some(
    (level) => level !== undefined && REJECT_LEVELS.has(level),
  );
  if (safesearchFlagged) {
    return { passes: false, annotation };
  }

  // Stage 2: Label blocklist — religious + text-heavy
  const labels = (response.labelAnnotations ?? []).filter(
    (l) => l.score >= LABEL_CONFIDENCE_THRESHOLD,
  );

  const rejectedLabels: string[] = [];
  for (const label of labels) {
    const lc = label.description.toLowerCase();
    if (RELIGIOUS_LABELS.has(lc) || TEXT_HEAVY_LABELS.has(lc)) {
      rejectedLabels.push(label.description);
    }
  }

  if (rejectedLabels.length > 0) {
    return { passes: false, annotation, rejectedLabels };
  }

  return { passes: true, annotation, rejectedLabels: [] };
}
