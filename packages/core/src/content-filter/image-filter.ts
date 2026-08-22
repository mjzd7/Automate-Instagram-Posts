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

/**
 * Labels indicating romance, couples, or intimacy.
 * Catches: couples, kissing, hugging, wedding/bride imagery that competes
 * with the neutral, professional aesthetic.
 */
const RELATIONSHIP_LABELS = new Set([
  "kiss", "kissing", "romance", "romantic", "couple", "love", "lovers",
  "hug", "hugging", "embrace", "holding hands", "marriage", "wedding",
  "bride", "groom", "dating", "relationship", "honeymoon", "intercourse",
  "intimacy", "affection", "coitus", "sensuality", "flirting",
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

interface TextAnnotation {
  description: string;
}

export interface ImageFilterResult {
  passes: boolean;
  annotation: SafeSearchAnnotation;
  /** Labels that caused rejection, if any (empty if rejected by SafeSearch). */
  rejectedLabels?: string[];
  /** Detected text from OCR that caused rejection, if any. */
  detectedText?: string;
  /** Human-readable rejection reason if rejected. */
  rejectionReason?: string;
}

/**
 * Per plan.md §7.5 / §2.7: multi-feature Google Cloud Vision check.
 *
 * Makes a single API call requesting SAFE_SEARCH_DETECTION, LABEL_DETECTION,
 * and TEXT_DETECTION (OCR) features — zero extra round-trips.
 *
 * Rejects if:
 *  - adult / violence / racy is LIKELY or VERY_LIKELY (SafeSearch), OR
 *  - any high-confidence label (>= 0.6) matches the religious/text/relationship blocklists, OR
 *  - any readable text is detected via Vision OCR (TEXT_DETECTION)
 */
export async function imagePassesFilter(
  imageSource: string | Buffer,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageFilterResult> {
  const imagePayload = typeof imageSource === "string" && imageSource.startsWith("http")
    ? { source: { imageUri: imageSource } }
    : { content: (Buffer.isBuffer(imageSource) ? imageSource : Buffer.from(imageSource, "base64")).toString("base64") };

  const res = await fetchImpl(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: imagePayload,
            features: [
              { type: "SAFE_SEARCH_DETECTION" },
              { type: "LABEL_DETECTION", maxResults: 20 },
              { type: "TEXT_DETECTION", maxResults: 5 },
              { type: "FACE_DETECTION", maxResults: 5 },
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
      textAnnotations?: TextAnnotation[];
      faceAnnotations?: Array<unknown>;
    }>;
  };

  const response = body.responses?.[0];
  if (!response) {
    throw new Error("Google Vision SafeSearch response missing responses[0]");
  }

  const annotation = response.safeSearchAnnotation ?? {};

  // Stage 1: SafeSearch
  const safesearchFlagged = [annotation.adult, annotation.violence, annotation.racy].some(
    (level) => level !== undefined && REJECT_LEVELS.has(level),
  );
  if (safesearchFlagged) {
    return {
      passes: false,
      annotation,
      rejectionReason: "Failed SafeSearch moderation (adult/violence/racy)",
    };
  }

  // Stage 1.5: Face Detection — reject background photos/videos containing human faces
  if (response.faceAnnotations && response.faceAnnotations.length > 0) {
    return {
      passes: false,
      annotation,
      rejectedLabels: ["face"],
      rejectionReason: "Failed moderation: human face detected in background image",
    };
  }

  // Stage 2: Label blocklist — religious + text-heavy + relationship (0.35 threshold for relationship labels)
  const labels = (response.labelAnnotations ?? []).filter((l) => {
    const lc = l.description.toLowerCase();
    if (RELATIONSHIP_LABELS.has(lc)) {
      return l.score >= 0.35; // Lower threshold specifically for relationship/romance labels
    }
    return l.score >= LABEL_CONFIDENCE_THRESHOLD;
  });

  const rejectedLabels: string[] = [];
  for (const label of labels) {
    const lc = label.description.toLowerCase();
    if (RELIGIOUS_LABELS.has(lc) || TEXT_HEAVY_LABELS.has(lc) || RELATIONSHIP_LABELS.has(lc)) {
      rejectedLabels.push(label.description);
    }
  }

  if (rejectedLabels.length > 0) {
    return {
      passes: false,
      annotation,
      rejectedLabels,
      rejectionReason: `Matched blocked visual labels: ${rejectedLabels.join(", ")}`,
    };
  }

  // Stage 3: OCR Text Detection — zero embedded text in background images
  if (response.textAnnotations && response.textAnnotations.length > 0) {
    const detectedText = response.textAnnotations[0]?.description?.trim();
    if (detectedText && detectedText.length > 0) {
      return {
        passes: false,
        annotation,
        rejectedLabels: [],
        detectedText,
        rejectionReason: `Background image contains detected text: "${detectedText.slice(0, 80)}"`,
      };
    }
  }

  return { passes: true, annotation, rejectedLabels: [] };
}
