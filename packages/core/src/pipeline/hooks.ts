/**
 * High-converting 1.5s visual & caption hook generator for Instagram Reels.
 * Designed to capture attention in the first 0-2 seconds and drive watch completion.
 */

const AUTHOR_HOOKS: Record<string, string[]> = {
  "Marcus Aurelius": [
    "Marcus Aurelius on controlling your mind:",
    "A Stoic truth from Marcus Aurelius you need today:",
    "Read this before you make your next move:"
  ],
  "Seneca": [
    "Seneca on why most people waste their lives:",
    "A brutal reminder on time from Seneca:",
    "Read this twice:"
  ],
  "Epictetus": [
    "Epictetus on the only thing you truly control:",
    "A Stoic rule 99% of people ignore:",
    "Read this if you feel anxious:"
  ],
  "Naval Ravikant": [
    "Naval Ravikant on what creates true wealth:",
    "The 1 rule of leverage from Naval Ravikant:",
    "Read this if you want financial freedom:"
  ],
  "Charlie Munger": [
    "Charlie Munger on how to avoid lifelong failure:",
    "The brutal rule of thinking from Charlie Munger:",
    "How the top 1% think:"
  ],
  "Carl Jung": [
    "Carl Jung on what secretly controls your life:",
    "The psychological truth 90% of people run from:",
    "Read this if you feel stuck:"
  ],
  "Robert Greene": [
    "Robert Greene on human nature & power:",
    "The 1 harsh law of human behavior:",
    "Read this before you trust anyone:"
  ],
  "Kobe Bryant": [
    "Kobe Bryant on what separates the top 1%:",
    "The Mamba rule of relentless focus:",
    "Read this when you want to quit:"
  ],
  "Steve Jobs": [
    "Steve Jobs on what truly matters in life:",
    "The 1 principle behind true greatness:",
    "Read this to reset your perspective:"
  ]
};

const CATEGORY_HOOKS: Record<string, string[]> = {
  stoic: [
    "Read this before you make your next move:",
    "The 1 rule of self-discipline 99% ignore:",
    "A brutal Stoic truth you need today:",
    "Read this if you feel overwhelmed:"
  ],
  discipline: [
    "Read this when you want to quit:",
    "The harsh rule of discipline that changes everything:",
    "Stop scrolling and read this twice:",
    "The difference between motivation and discipline:"
  ],
  mindset: [
    "Read this to rewire your thinking:",
    "The mindset shift that changes everything:",
    "Read this twice:",
    "A harsh truth about your potential:"
  ],
  business: [
    "The brutal rule of focus in business:",
    "How high-agency people operate:",
    "Read this if you are building something big:",
    "The 1 leverage principle 99% ignore:"
  ],
  wealth: [
    "A truth about wealth most learn too late:",
    "How the top 1% build true freedom:",
    "Read this if you want financial independence:",
    "The rule of high-value skills:"
  ],
  leadership: [
    "The brutal standard of real leadership:",
    "How high-respect leaders think:",
    "Read this before you lead others:"
  ],
  wisdom: [
    "A timeless truth you need to hear today:",
    "Read this slowly:",
    "Wisdom that takes 10 years to understand:"
  ],
  motivational: [
    "Read this before starting your day:",
    "A reminder you needed to see right now:",
    "Save this for when you need a push:"
  ]
};

const GENERAL_HOOKS: string[] = [
  "Read this before you make your next move:",
  "Stop scrolling and read this twice:",
  "A harsh truth about self-respect:",
  "Save this reminder for tomorrow morning:"
];

export function generateReelHook(category: string, author?: string | null): string {
  if (author) {
    for (const [key, hooks] of Object.entries(AUTHOR_HOOKS)) {
      if (author.toLowerCase().includes(key.toLowerCase()) && hooks.length > 0) {
        return hooks[Math.floor(Math.random() * hooks.length)]!;
      }
    }
  }

  const catLower = category.toLowerCase();
  for (const [catKey, hooks] of Object.entries(CATEGORY_HOOKS)) {
    if (catLower.includes(catKey) && hooks.length > 0) {
      return hooks[Math.floor(Math.random() * hooks.length)]!;
    }
  }

  return GENERAL_HOOKS[Math.floor(Math.random() * GENERAL_HOOKS.length)]!;
}
