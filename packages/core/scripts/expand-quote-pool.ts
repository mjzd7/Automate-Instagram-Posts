import { openDb } from "../src/db/client.js";
import { insertQuote } from "../src/db/repositories/quotes.repo.js";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

const HIGH_QUALITY_QUOTES = [
  // --- SUCCESS ---
  { id: "succ-01", text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", categoryId: "success" },
  { id: "succ-02", text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau", categoryId: "success" },
  { id: "succ-03", text: "Opportunities don't happen. You create them.", author: "Chris Grosser", categoryId: "success" },
  { id: "succ-04", text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller", categoryId: "success" },
  { id: "succ-05", text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson", categoryId: "success" },
  { id: "succ-06", text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill", categoryId: "success" },
  { id: "succ-07", text: "Action is the foundational key to all success.", author: "Pablo Picasso", categoryId: "success" },
  { id: "succ-08", text: "The secret of success is to do the common thing uncommonly well.", author: "John D. Rockefeller Jr.", categoryId: "success" },
  { id: "succ-09", text: "Success is not how high you have climbed, but how you make a positive difference to the world.", author: "Roy T. Bennett", categoryId: "success" },
  { id: "succ-10", text: "Formula for success: rise early, work hard, strike oil.", author: "J. Paul Getty", categoryId: "success" },
  { id: "succ-11", text: "Success is where preparation and opportunity meet.", author: "Bobby Unser", categoryId: "success" },
  { id: "succ-12", text: "Patience, persistence and perspiration make an unbeatable combination for success.", author: "Napoleon Hill", categoryId: "success" },
  { id: "succ-13", text: "The distance between insanity and genius is measured only by success.", author: "Bruce Feirstein", categoryId: "success" },
  { id: "succ-14", text: "Success is getting what you want; happiness is wanting what you get.", author: "W. P. Kinsella", categoryId: "success" },
  { id: "succ-15", text: "Try not to become a man of success. Rather become a man of value.", author: "Albert Einstein", categoryId: "success" },

  // --- BUSINESS ---
  { id: "biz-01", text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs", categoryId: "business" },
  { id: "biz-02", text: "Rule No. 1: Never lose money. Rule No. 2: Never forget Rule No. 1.", author: "Warren Buffett", categoryId: "business" },
  { id: "biz-03", text: "It takes 20 years to build a reputation and five minutes to ruin it.", author: "Warren Buffett", categoryId: "business" },
  { id: "biz-04", text: "The main thing is to keep the main thing the main thing.", author: "Stephen Covey", categoryId: "business" },
  { id: "biz-05", text: "If you don't build your dream, someone else will hire you to help them build theirs.", author: "Dhirubhai Ambani", categoryId: "business" },
  { id: "biz-06", text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett", categoryId: "business" },
  { id: "biz-07", text: "The best way to predict the future is to invent it.", author: "Alan Kay", categoryId: "business" },
  { id: "biz-08", text: "A business that makes nothing but money is a poor business.", author: "Henry Ford", categoryId: "business" },
  { id: "biz-09", text: "Quality means doing it right when no one is looking.", author: "Henry Ford", categoryId: "business" },
  { id: "biz-10", text: "Price is what you pay. Value is what you get.", author: "Warren Buffett", categoryId: "business" },
  { id: "biz-11", text: "Great things in business are never done by one person. They're done by a team of people.", author: "Steve Jobs", categoryId: "business" },
  { id: "biz-12", text: "If you're competitor-focused, you have to wait until a competitor does something. Being customer-focused allows you to be more pioneering.", author: "Jeff Bezos", categoryId: "business" },
  { id: "biz-13", text: "Outstanding leaders go out of their way to boost the self-esteem of their personnel.", author: "Sam Walton", categoryId: "business" },
  { id: "biz-14", text: "Chase the vision, not the money; the money will end up following you.", author: "Tony Hsieh", categoryId: "business" },
  { id: "biz-15", text: "In the business world, the rearview mirror is always clearer than the windshield.", author: "Warren Buffett", categoryId: "business" },

  // --- ENTREPRENEURSHIP ---
  { id: "ent-01", text: "When something is important enough, you do it even if the odds are not in your favor.", author: "Elon Musk", categoryId: "entrepreneurship" },
  { id: "ent-02", text: "Persistence is very important. You should not give up unless you are forced to give up.", author: "Elon Musk", categoryId: "entrepreneurship" },
  { id: "ent-03", text: "Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.", author: "Mark Zuckerberg", categoryId: "entrepreneurship" },
  { id: "ent-04", text: "The most dangerous poison is the feeling of achievement. The antidote is to every evening think what can be done better tomorrow.", author: "Ingvar Kamprad", categoryId: "entrepreneurship" },
  { id: "ent-05", text: "Play iterated games. All gains in life, whether in wealth, relationships, or knowledge, come from compound interest.", author: "Naval Ravikant", categoryId: "entrepreneurship" },
  { id: "ent-06", text: "If you are not embarrassed by the first version of your product, you've launched too late.", author: "Reid Hoffman", categoryId: "entrepreneurship" },
  { id: "ent-07", text: "The value of an idea lies in the using of it.", author: "Thomas Edison", categoryId: "entrepreneurship" },
  { id: "ent-08", text: "Branding is what people say about you when you're not in the room.", author: "Jeff Bezos", categoryId: "entrepreneurship" },
  { id: "ent-09", text: "What do you need to start a business? Three simple things: know your product better than anyone, know your customer, and have a burning desire to succeed.", author: "Dave Thomas", categoryId: "entrepreneurship" },
  { id: "ent-10", text: "Failure is an option here. If things are not failing, you are not innovating enough.", author: "Elon Musk", categoryId: "entrepreneurship" },
  { id: "ent-11", text: "An entrepreneur is someone who jumps off a cliff and builds a plane on the way down.", author: "Reid Hoffman", categoryId: "entrepreneurship" },
  { id: "ent-12", text: "Capitalism without bankruptcy is like Christianity without hell.", author: "Frank Borman", categoryId: "entrepreneurship" },
  { id: "ent-13", text: "If you work on stuff that most people don't care about, you don't have to worry about competition.", author: "Naval Ravikant", categoryId: "entrepreneurship" },
  { id: "ent-14", text: "I knew that if I failed I wouldn't regret that, but I knew the one thing I might regret is not trying.", author: "Jeff Bezos", categoryId: "entrepreneurship" },
  { id: "ent-15", text: "You don't learn to walk by following rules. You learn by doing, and by falling over.", author: "Richard Branson", categoryId: "entrepreneurship" },

  // --- STOIC ---
  { id: "sto-01", text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", categoryId: "stoic" },
  { id: "sto-02", text: "We suffer more often in imagination than in reality.", author: "Seneca", categoryId: "stoic" },
  { id: "sto-03", text: "It's not what happens to you, but how you react to it that matters.", author: "Epictetus", categoryId: "stoic" },
  { id: "sto-04", text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius", categoryId: "stoic" },
  { id: "sto-05", text: "He who is brave is free.", author: "Seneca", categoryId: "stoic" },
  { id: "sto-06", text: "No man is free who is not master of himself.", author: "Epictetus", categoryId: "stoic" },
  { id: "sto-07", text: "The obstacle in the path becomes the path. Never forget, within every obstacle is an opportunity to improve our condition.", author: "Marcus Aurelius", categoryId: "stoic" },
  { id: "sto-08", text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca", categoryId: "stoic" },
  { id: "sto-09", text: "If a man knows not which port he sails on, no wind is favorable.", author: "Seneca", categoryId: "stoic" },
  { id: "sto-10", text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus", categoryId: "stoic" },
  { id: "sto-11", text: "When you arise in the morning think of what a privilege it is to be alive, to think, to enjoy, to love.", author: "Marcus Aurelius", categoryId: "stoic" },
  { id: "sto-12", text: "Associate with people who are likely to improve you.", author: "Seneca", categoryId: "stoic" },
  { id: "sto-13", text: "Man conquered the world by conquering himself.", author: "Zeno of Citium", categoryId: "stoic" },
  { id: "sto-14", text: "How long are you going to wait before you demand the best for yourself?", author: "Epictetus", categoryId: "stoic" },
  { id: "sto-15", text: "The soul becomes dyed with the color of its thoughts.", author: "Marcus Aurelius", categoryId: "stoic" },

  // --- DISCIPLINE ---
  { id: "dis-01", text: "Discipline equals freedom.", author: "Jocko Willink", categoryId: "discipline" },
  { id: "dis-02", text: "We must all suffer one of two things: the pain of discipline or the pain of regret.", author: "Jim Rohn", categoryId: "discipline" },
  { id: "dis-03", text: "Don't stop when you're tired. Stop when you're done.", author: "David Goggins", categoryId: "discipline" },
  { id: "dis-04", text: "Small disciplines repeated with consistency every day lead to great achievements gained slowly over time.", author: "John C. Maxwell", categoryId: "discipline" },
  { id: "dis-05", text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln", categoryId: "discipline" },
  { id: "dis-06", text: "Self-discipline is the master key that unlocks all other great qualities.", author: "Brian Tracy", categoryId: "discipline" },
  { id: "dis-07", text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell", categoryId: "discipline" },
  { id: "dis-08", text: "You will never change your life until you change something you do daily. The secret of your success is found in your daily routine.", author: "John C. Maxwell", categoryId: "discipline" },
  { id: "dis-09", text: "True freedom is impossible without a mind made free by discipline.", author: "Mortimer J. Adler", categoryId: "discipline" },
  { id: "dis-10", text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn", categoryId: "discipline" },
  { id: "dis-11", text: "If you don't conquer self, you will be conquered by self.", author: "Napoleon Hill", categoryId: "discipline" },
  { id: "dis-12", text: "Greatness is not a destiny; it is a choice powered by daily discipline.", author: "Kobe Bryant", categoryId: "discipline" },
  { id: "dis-13", text: "Consistency is the DNA of mastery.", author: "Robin Sharma", categoryId: "discipline" },
  { id: "dis-14", text: "Without self-discipline, success is impossible, period.", author: "Lou Holtz", categoryId: "discipline" },
  { id: "dis-15", text: "When you control your mind, you control your destiny.", author: "David Goggins", categoryId: "discipline" },

  // --- LEADERSHIP ---
  { id: "lea-01", text: "Leadership is not about being in charge. It is about taking care of those in your charge.", author: "Simon Sinek", categoryId: "leadership" },
  { id: "lea-02", text: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell", categoryId: "leadership" },
  { id: "lea-03", text: "The supreme quality for leadership is unquestionably integrity.", author: "Dwight D. Eisenhower", categoryId: "leadership" },
  { id: "lea-04", text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", categoryId: "leadership" },
  { id: "lea-05", text: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker", categoryId: "leadership" },
  { id: "lea-06", text: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch", categoryId: "leadership" },
  { id: "lea-07", text: "To lead people, walk behind them.", author: "Lao Tzu", categoryId: "leadership" },
  { id: "lea-08", text: "He who has never learned to obey cannot be a good commander.", author: "Aristotle", categoryId: "leadership" },
  { id: "lea-09", text: "Leadership is the capacity to translate vision into reality.", author: "Warren Bennis", categoryId: "leadership" },
  { id: "lea-10", text: "Control is not leadership. Empowering others is.", author: "Bill Gates", categoryId: "leadership" },
  { id: "lea-11", text: "Courage is what it takes to stand up and speak; courage is also what it takes to sit down and listen.", author: "Winston Churchill", categoryId: "leadership" },
  { id: "lea-12", text: "Lead from the front, but don't leave your team behind.", author: "Jocko Willink", categoryId: "leadership" },
  { id: "lea-13", text: "The quality of a leader is reflected in the standards they set for themselves.", author: "Ray Kroc", categoryId: "leadership" },
  { id: "lea-14", text: "Do not follow where the path may lead. Go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson", categoryId: "leadership" },
  { id: "lea-15", text: "Real leaders don't create followers, they create more leaders.", author: "Tom Peters", categoryId: "leadership" },

  // --- WEALTH ---
  { id: "wea-01", text: "If you don't find a way to make money while you sleep, you will work until you die.", author: "Warren Buffett", categoryId: "wealth" },
  { id: "wea-02", text: "Wealth is the ability to fully experience life.", author: "Henry David Thoreau", categoryId: "wealth" },
  { id: "wea-03", text: "Seek wealth, not status or money. Wealth is having assets that earn while you sleep.", author: "Naval Ravikant", categoryId: "wealth" },
  { id: "wea-04", text: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett", categoryId: "wealth" },
  { id: "wea-05", text: "Rich people buy assets. Poor people have expenses. The middle class buys liabilities they think are assets.", author: "Robert Kiyosaki", categoryId: "wealth" },
  { id: "wea-06", text: "Spending money to show people how much money you have is the fastest way to have less money.", author: "Morgan Housel", categoryId: "wealth" },
  { id: "wea-07", text: "Freedom is the ultimate dividend that wealth pays.", author: "Morgan Housel", categoryId: "wealth" },
  { id: "wea-08", text: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett", categoryId: "wealth" },
  { id: "wea-09", text: "It's not how much money you make, but how much money you keep.", author: "Robert Kiyosaki", categoryId: "wealth" },
  { id: "wea-10", text: "Financial peace isn't the acquisition of stuff. It's learning to live on less than you make.", author: "Dave Ramsey", categoryId: "wealth" },
  { id: "wea-11", text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin", categoryId: "wealth" },
  { id: "wea-12", text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus", categoryId: "wealth" },
  { id: "wea-13", text: "The real measure of your wealth is how much you'd be worth if you lost all your money.", author: "Anonymous", categoryId: "wealth" },
  { id: "wea-14", text: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.", author: "Albert Einstein", categoryId: "wealth" },
  { id: "wea-15", text: "Never depend on a single income. Make investment to create a second source.", author: "Warren Buffett", categoryId: "wealth" },

  // --- MINDSET ---
  { id: "mnd-01", text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford", categoryId: "mindset" },
  { id: "mnd-02", text: "The mind is everything. What you think you become.", author: "Buddha", categoryId: "mindset" },
  { id: "mnd-03", text: "Change your thoughts and you change your world.", author: "Norman Vincent Peale", categoryId: "mindset" },
  { id: "mnd-04", text: "Your mindset determines your altitude in life.", author: "Zig Ziglar", categoryId: "mindset" },
  { id: "mnd-05", text: "Nurture your mind with great thoughts, for you will never go any higher than you think.", author: "Benjamin Disraeli", categoryId: "mindset" },
  { id: "mnd-06", text: "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle.", author: "Christian D. Larson", categoryId: "mindset" },
  { id: "mnd-07", text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt", categoryId: "mindset" },
  { id: "mnd-08", text: "A winner is a dreamer who never gives up.", author: "Nelson Mandela", categoryId: "mindset" },
  { id: "mnd-09", text: "You are the master of your fate, you are the captain of your soul.", author: "William Ernest Henley", categoryId: "mindset" },
  { id: "mnd-10", text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma", categoryId: "mindset" },
  { id: "mnd-11", text: "Work hard in silence, let your success be your noise.", author: "Frank Ocean", categoryId: "mindset" },
  { id: "mnd-12", text: "Focus on where you want to go, not on what you fear.", author: "Tony Robbins", categoryId: "mindset" },
  { id: "mnd-13", text: "Don't count the days, make the days count.", author: "Muhammad Ali", categoryId: "mindset" },
  { id: "mnd-14", text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair", categoryId: "mindset" },
  { id: "mnd-15", text: "Your life does not get better by chance, it gets better by change.", author: "Jim Rohn", categoryId: "mindset" },

  // --- RESILIENCE ---
  { id: "res-01", text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein", categoryId: "resilience" },
  { id: "res-02", text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela", categoryId: "resilience" },
  { id: "res-03", text: "When everything seems to be going against you, remember that the airplane takes off against the wind, not with it.", author: "Henry Ford", categoryId: "resilience" },
  { id: "res-04", text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche", categoryId: "resilience" },
  { id: "res-05", text: "When we are no longer able to change a situation, we are challenged to change ourselves.", author: "Viktor Frankl", categoryId: "resilience" },
  { id: "res-06", text: "Persistence and determination alone are omnipotent.", author: "Calvin Coolidge", categoryId: "resilience" },
  { id: "res-07", text: "Hard times create strong men. Strong men create good times.", author: "G. Michael Hopf", categoryId: "resilience" },
  { id: "res-08", text: "Fall seven times, stand up eight.", author: "Japanese Proverb", categoryId: "resilience" },
  { id: "res-09", text: "Character cannot be developed in ease and quiet. Only through experience of trial and suffering can the soul be strengthened.", author: "Helen Keller", categoryId: "resilience" },
  { id: "res-10", text: "The gem cannot be polished without friction, nor man perfected without trials.", author: "Confucius", categoryId: "resilience" },
  { id: "res-11", text: "Do not pray for an easy life, pray for the strength to endure a difficult one.", author: "Bruce Lee", categoryId: "resilience" },
  { id: "res-12", text: "Turn your wounds into wisdom.", author: "Oprah Winfrey", categoryId: "resilience" },
  { id: "res-13", text: "Grit is living life like it's a marathon, not a sprint.", author: "Angela Duckworth", categoryId: "resilience" },
  { id: "res-14", text: "Out of suffering have emerged the strongest souls; the most massive characters are seared with scars.", author: "Kahlil Gibran", categoryId: "resilience" },
  { id: "res-15", text: "Courage doesn't always roar. Sometimes courage is the quiet voice at the end of the day saying, 'I will try again tomorrow.'", author: "Mary Anne Radmacher", categoryId: "resilience" },

  // --- WISDOM ---
  { id: "wis-01", text: "The only true wisdom is in knowing you know nothing.", author: "Socrates", categoryId: "wisdom" },
  { id: "wis-02", text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle", categoryId: "wisdom" },
  { id: "wis-03", text: "By three methods we may learn wisdom: reflection, imitation, and experience.", author: "Confucius", categoryId: "wisdom" },
  { id: "wis-04", text: "He who knows others is wise; he who knows himself is enlightened.", author: "Lao Tzu", categoryId: "wisdom" },
  { id: "wis-05", text: "Wisdom begins in wonder.", author: "Socrates", categoryId: "wisdom" },
  { id: "wis-06", text: "The fool doth think he is wise, but the wise man knows himself to be a fool.", author: "William Shakespeare", categoryId: "wisdom" },
  { id: "wis-07", text: "Simple things are also the most extraordinary things, and only the wise can see them.", author: "Paulo Coelho", categoryId: "wisdom" },
  { id: "wis-08", text: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.", author: "Albert Einstein", categoryId: "wisdom" },
  { id: "wis-09", text: "A wise man can learn more from a foolish question than a fool can learn from a wise answer.", author: "Bruce Lee", categoryId: "wisdom" },
  { id: "wis-10", text: "Patience is the companion of wisdom.", author: "Saint Augustine", categoryId: "wisdom" },

  // --- MOTIVATIONAL ---
  { id: "mot-01", text: "The secret of getting ahead is getting started.", author: "Mark Twain", categoryId: "motivational" },
  { id: "mot-02", text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", categoryId: "motivational" },
  { id: "mot-03", text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt", categoryId: "motivational" },
  { id: "mot-04", text: "Act as if what you do makes a difference. It does.", author: "William James", categoryId: "motivational" },
  { id: "mot-05", text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson", categoryId: "motivational" },
  { id: "mot-06", text: "It always seems impossible until it's done.", author: "Nelson Mandela", categoryId: "motivational" },
  { id: "mot-07", text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt", categoryId: "motivational" },
  { id: "mot-08", text: "Your talent determines what you can do. Your motivation determines how much you are willing to do.", author: "Lou Holtz", categoryId: "motivational" },
  { id: "mot-09", text: "If you want to achieve greatness stop asking for permission.", author: "Anonymous", categoryId: "motivational" },
  { id: "mot-10", text: "Dream big and dare to fail.", author: "Norman Vaughan", categoryId: "motivational" }
];

async function run() {
  const seedPath = `${repoRoot}/data/seed/quotes.json`;
  await writeFile(seedPath, JSON.stringify(HIGH_QUALITY_QUOTES, null, 2), "utf-8");
  console.log(`Updated data/seed/quotes.json with ${HIGH_QUALITY_QUOTES.length} high quality quotes.`);

  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);
  try {
    let count = 0;
    for (const q of HIGH_QUALITY_QUOTES) {
      await insertQuote(dbHandle.db, { ...q, source: "curated" });
      count++;
    }
    console.log(`Seeded ${count} quotes into data/app.db`);
  } finally {
    dbHandle.close();
  }
}

run().catch(console.error);
