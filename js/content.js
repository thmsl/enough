// Static content: health milestones, badges, missions, craving tags, tips.

export const MIN = 60e3, HOUR = 36e5, DAY = 864e5, WEEK = 7 * DAY;
export const MONTH = 30.44 * DAY, YEAR = 365.25 * DAY;

const SRC = {
  who: { name: 'World Health Organization — Tobacco: health benefits of smoking cessation', url: 'https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation' },
  nhs: { name: 'NHS Better Health — Quit smoking', url: 'https://www.nhs.uk/better-health/quit-smoking/' },
  nhsW: { name: 'NHS — Stop smoking: withdrawal and cravings', url: 'https://www.nhs.uk/live-well/quit-smoking/' },
  acs: { name: 'American Cancer Society — Benefits of quitting smoking over time', url: 'https://www.cancer.org/cancer/risk-prevention/tobacco/benefits-of-quitting-smoking-over-time.html' },
  sg: { name: 'U.S. Surgeon General (2020) — Smoking Cessation: A Report of the Surgeon General', url: 'https://www.hhs.gov/surgeongeneral/reports-and-publications/tobacco/2020-cessation-sgr-factsheet-key-findings/index.html' },
};

export const MILESTONES = [
  { at: 20 * MIN, title: 'Heart rate settles', body: 'Your heart rate and blood pressure drop back toward normal.', src: SRC.who },
  { at: 8 * HOUR, title: 'Oxygen recovers', body: 'Carbon monoxide in your blood halves and oxygen levels return to normal.', src: SRC.nhs },
  { at: 12 * HOUR, title: 'Carbon monoxide normal', body: 'The carbon monoxide level in your blood drops to normal.', src: SRC.who },
  { at: 1 * DAY, title: 'Nicotine on its way out', body: 'Nicotine levels fall fast. Withdrawal tends to peak in the first few days, then eases.', src: SRC.nhsW },
  { at: 2 * DAY, title: 'Taste and smell return', body: 'Carbon monoxide is gone from your body, your lungs start clearing mucus, and taste and smell improve.', src: SRC.nhs },
  { at: 3 * DAY, title: 'Breathing gets easier', body: 'Bronchial tubes relax, breathing feels easier and energy levels rise.', src: SRC.nhs },
  { at: 2 * WEEK, title: 'Circulation improves', body: 'Between 2 and 12 weeks your circulation improves and lung function increases.', src: SRC.who },
  { at: 4 * WEEK, title: 'Five times more likely', body: 'Make it to 28 days smoke free and you are five times more likely to quit for good.', src: SRC.nhs },
  { at: 3 * MONTH, title: 'Lungs work better', body: 'From 3 to 9 months, lung function increases by up to 10%.', src: SRC.nhs },
  { at: 6 * MONTH, title: 'Less coughing', body: 'Coughing and shortness of breath keep decreasing through the first year.', src: SRC.acs },
  { at: 9 * MONTH, title: 'Cilia recover', body: 'The tiny hair-like cilia in your lungs regain normal function, cutting the risk of infection.', src: SRC.who },
  { at: 1 * YEAR, title: 'Heart risk halved', body: 'Your excess risk of coronary heart disease is about half that of someone who smokes.', src: SRC.who },
  { at: 5 * YEAR, title: 'Cancer risk falls', body: 'Risk of cancers of the mouth, throat, oesophagus and bladder is cut in half. Stroke risk can fall to that of a non-smoker within 5–15 years.', src: SRC.acs },
  { at: 10 * YEAR, title: 'Lung cancer risk halved', body: 'Your risk of dying from lung cancer is about half that of someone who still smokes.', src: SRC.who },
  { at: 15 * YEAR, title: 'Heart like a non-smoker', body: 'Your risk of coronary heart disease is the same as someone who never smoked.', src: SRC.who },
];

// Recovery rings: each fills over the window where that marker recovers.
export const RINGS = [
  { key: 'pulse', label: 'Pulse', full: 20 * MIN, color: 'var(--ring-1)' },
  { key: 'oxygen', label: 'Oxygen', full: 8 * HOUR, color: 'var(--ring-2)' },
  { key: 'co', label: 'CO cleared', full: 2 * DAY, color: 'var(--ring-3)' },
];

// 19 badges. `test(s)` receives computed stats.
export const BADGES = [
  { id: 'd1', icon: '🌱', name: 'First day', desc: '24 hours smoke free', test: s => s.recordMs >= DAY },
  { id: 'd3', icon: '🌿', name: 'Three days', desc: 'Nicotine-free stretch', test: s => s.recordMs >= 3 * DAY },
  { id: 'w1', icon: '🍃', name: 'One week', desc: '7 days smoke free', test: s => s.recordMs >= WEEK },
  { id: 'w2', icon: '🌳', name: 'Two weeks', desc: '14 days smoke free', test: s => s.recordMs >= 2 * WEEK },
  { id: 'm1', icon: '🏔️', name: 'One month', desc: '30 days smoke free', test: s => s.recordMs >= 30 * DAY },
  { id: 'm3', icon: '⛰️', name: 'Three months', desc: '90 days smoke free', test: s => s.recordMs >= 90 * DAY },
  { id: 'm6', icon: '🌄', name: 'Half a year', desc: '182 days smoke free', test: s => s.recordMs >= 182 * DAY },
  { id: 'y1', icon: '🏆', name: 'One year', desc: '365 days smoke free', test: s => s.recordMs >= 365 * DAY },
  { id: '$10', icon: '🪙', name: 'Pocket change', desc: 'Saved 10', money: 10, test: s => s.lifetimeMoney >= 10 },
  { id: '$50', icon: '💶', name: 'Night out', desc: 'Saved 50', money: 50, test: s => s.lifetimeMoney >= 50 },
  { id: '$100', icon: '💰', name: 'Treat yourself', desc: 'Saved 100', money: 100, test: s => s.lifetimeMoney >= 100 },
  { id: '$500', icon: '🎁', name: 'Big ticket', desc: 'Saved 500', money: 500, test: s => s.lifetimeMoney >= 500 },
  { id: '$1000', icon: '✈️', name: 'Getaway fund', desc: 'Saved 1,000', money: 1000, test: s => s.lifetimeMoney >= 1000 },
  { id: 'u100', icon: '🚭', name: 'Hundred not smoked', desc: '100 avoided', test: s => s.lifetimeUnits >= 100 },
  { id: 'c1', icon: '🌊', name: 'Rode the wave', desc: 'Logged your first craving', test: s => s.cravingsResisted >= 1 },
  { id: 'c25', icon: '🏄', name: 'Wave rider', desc: 'Rode out 25 cravings', test: s => s.cravingsResisted >= 25 },
  { id: 'j7', icon: '📓', name: 'Week of notes', desc: '7-day diary streak', test: s => s.diaryBest >= 7 },
  { id: 'j30', icon: '📚', name: 'Month of notes', desc: '30-day diary streak', test: s => s.diaryBest >= 30 },
  { id: 'q10', icon: '🎯', name: 'On a mission', desc: 'Completed 10 missions', test: s => s.missionsDone >= 10 },
];

// 37-mission program, in five phases.
export const MISSIONS = [
  ['Prepare', [
    ['Write your reasons', 'List at least three reasons you are quitting. Add them in Settings → My reasons; they show up when a craving hits.'],
    ['Set your quit date', 'Quit now, pick a date within two weeks, or taper down to one.'],
    ['Log three cravings', 'Before you quit, log three cravings as they happen to see your patterns.'],
    ['Tell someone', 'Tell one person you trust that you are quitting and when.'],
    ['Talk to a professional', 'Ask a pharmacist or doctor about nicotine replacement or medication — it roughly doubles your odds.'],
    ['Stock your kit', 'Gum, mints, water bottle, something for your hands.'],
    ['Plan your first morning', 'Decide what you will do first thing, instead of smoking.'],
    ['Clear the decks', 'Remove lighters, ashtrays and spare packs from home, car and bags.'],
  ]],
  ['Day one', [
    ['Finish the last one', 'Throw away anything left. No “emergency” pack.'],
    ['Use the SOS', 'When the first strong craving comes, tap SOS and breathe through it.'],
    ['Drink water', 'Have a glass of water every time a craving hits today.'],
    ['Change one routine', 'Swap the spot, drink or order of a routine that used to end in smoking.'],
    ['Write your first diary entry', 'Check in tonight — how many cravings, how strong.'],
    ['Read your health page', 'Open Health and see what your body has already recovered today.'],
  ]],
  ['First week', [
    ['Walk after meals', 'Take a 10-minute walk after a meal instead of the after-meal smoke.'],
    ['Go easy on alcohol', 'Alcohol is the most common slip trigger. Skip it or keep it short this week.'],
    ['Air everything out', 'Wash jackets, clean the car, freshen the curtains.'],
    ['Handle the coffee trigger', 'Change your cup, your spot, or switch to tea for a few days.'],
    ['Brush after meals', 'A fresh mouth makes smoking less appealing.'],
    ['Check in with your supporter', 'Send a message to the person you told.'],
    ['Find a new evening ritual', 'Tea, a stretch, a book, a shower — something to mark the end of the day.'],
    ['Look at your money', 'Check what you have saved and choose a reward for week two.'],
    ['Seven diary check-ins', 'Keep your diary every day this week.'],
  ]],
  ['First month', [
    ['Spend some savings', 'Buy the reward you picked. You earned it.'],
    ['Notice your senses', 'Write down one thing that tastes or smells better.'],
    ['Plan a social event', 'Decide in advance what you will say and do when someone offers.'],
    ['Write an if-then plan', '“If I get stressed at work, then I will…” — write three.'],
    ['Move three times', 'Exercise three times this week, even briefly.'],
    ['Read your reasons again', 'Revisit why you started. Add new ones.'],
    ['Review your triggers', 'Open the trigger chart and pick the top one to plan around.'],
    ['Thank your supporter', 'Let them know it helped.'],
  ]],
  ['For good', [
    ['Watch for “just one”', 'Write down what you will tell yourself when “just one” comes up.'],
    ['Plan for a slip', 'Decide now: a slip is a reset, not a failure. Log it, learn the trigger, keep going.'],
    ['Set a savings goal', 'Pick something for your three-month savings.'],
    ['Handle a hard day', 'Get through a bad day without smoking and write about it.'],
    ['Help someone else', 'Share what worked with someone who wants to quit.'],
    ['Celebrate 100 days', 'Mark it. You are a non-smoker.'],
  ]],
];
export const MISSION_LIST = MISSIONS.flatMap(([phase, items], pi) =>
  items.map(([title, body], i) => ({ id: `${pi}.${i}`, phase, title, body })));

export const TAGS = {
  where: ['Home', 'Work', 'Car', 'Outside', 'Bar', 'Friend’s place', 'Commute'],
  feeling: ['Stressed', 'Bored', 'Anxious', 'Tired', 'Happy', 'Angry', 'Sad', 'Lonely'],
  doing: ['Coffee', 'After a meal', 'Drinking', 'Working', 'Phone', 'Waking up', 'Break', 'Driving'],
  with: ['Alone', 'Partner', 'Friends', 'Colleagues', 'Family', 'Smokers'],
};
export const TAG_LABELS = { where: 'Where are you?', feeling: 'How do you feel?', doing: 'What are you doing?', with: 'Who are you with?' };

export const TIPS = [
  'A craving usually peaks and fades within 5 to 10 minutes. You only have to outlast this one.',
  'Drink a glass of cold water, slowly.',
  'Get up and move — walk to another room, step outside, do 10 squats.',
  'Chew gum or something crunchy: carrot, apple, ice.',
  'Text someone. Anyone. Say you have a craving.',
  'Delay: tell yourself “not for the next 10 minutes”.',
  'Brush your teeth.',
  'Name the trigger out loud. Then log it.',
];

export const PRODUCTS = {
  cig: { label: 'Cigarettes', unit: 'cigarette', units: 'cigarettes', pack: 'pack', perPackLabel: 'How many in a pack?' },
  roll: { label: 'Rolling tobacco', unit: 'roll-up', units: 'roll-ups', pack: 'pouch', perPackLabel: 'How many from a pouch?' },
  vape: { label: 'Vape', unit: 'device', units: 'devices', pack: 'device', perPackLabel: '' },
};

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'JPY', 'INR', 'BRL', 'MXN', 'ZAR', 'SGD', 'HKD'];
