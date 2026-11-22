/**
 * EVENT HUB — development/demo seed.
 *
 * Fills an EMPTY local or staging database with realistic sample content so
 * the interface can be reviewed. Everything here is demo data: organizers,
 * venues and events are fictional. Wipe it before launch.
 *
 * Demo bookings and saves are created through the real booking engine
 * (src/server/bookings-core.ts), so availability and the trending ranking are
 * computed from real rows, exactly as they will be in production.
 *
 * Run: npm run db:seed        Refuses to run when NODE_ENV=production.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createBookingWith } from "../src/server/bookings-core";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-demo-in-production")) {
  console.error("Refusing to seed demo data into production.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const NOW = new Date();

// ── Photography (free licences; subjects checked against each source description) ──
const px = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`;
const PHOTO = {
  m1: [px(2990835), "A lively crowd at a night concert under bright stage lights"],
  m2: [px(1763068), "A performer silhouetted against vibrant stage lighting above the crowd"],
  m3: [px(736355), "A band silhouetted on a smoke-filled stage under dramatic lighting"],
  m4: [px(1047443), "A concert crowd with hands raised toward the stage"],
  m5: [px(2747448), "A silhouetted crowd clapping under bright stage lights"],
  m6: [px(3379257), "A crowd dancing in front of a DJ booth and stage lights"],
  m7: [px(1550469), "A black-and-white photo of a performer on stage in smoke and light"],
  f1: [px(3052307), "A festival crowd watching fireworks light up the night sky"],
  f2: [px(1190298), "An open-air music show with fireworks, smoke and a dancing crowd"],
  f3: [px(3052360), "A crowd watching a fireworks display at a night festival"],
  f4: [px(3052306), "A music festival crowd with fireworks above the stage at night"],
  t1: [px(1708936), "A speaker presenting to an attentive audience in a modern auditorium"],
  t2: [px(1708912), "A speaker presenting to an audience in an auditorium"],
  t3: [px(9275222), "An audience watching a presentation, stage lights and speaker in view"],
  t4: [px(1709003), "Attendees and a presenter at a conference in an auditorium"],
  t5: [
    "https://images.pexels.com/photos/20733081/pexels-photo-20733081/free-photo-of-gathering-during-event.jpeg",
    "A large audience listening to a speaker at a conference",
  ],
  a1: ["https://images.pexels.com/photos/34633/pexels-photo.jpg", "Visitors admiring paintings in a busy art gallery"],
  a2: [px(14638945), "A crowd gathered in front of a large historical painting in a museum"],
  a3: [
    "https://images.pexels.com/photos/16960921/pexels-photo-16960921/free-photo-of-woman-in-a-museum-looking-at-paintings.jpeg",
    "A woman looking at paintings in a museum",
  ],
  a4: [
    "https://images.pexels.com/photos/30489694/pexels-photo-30489694/free-photo-of-art-enthusiast-observing-classic-painting-in-gallery.jpeg",
    "A man studying a large framed painting in a gallery",
  ],
  b1: ["https://images.unsplash.com/photo-1675716921224-e087a0cca69a", "A group of people talking together at a networking event"],
  w1: [px(8063876), "Hands shaping a clay bowl on a pottery wheel"],
  w2: [px(8063838), "An artisan's hands shaping wet clay on a pottery wheel"],
  w3: [px(9304551), "Hands shaping a clay pot on a pottery wheel"],
  w4: [
    "https://images.pexels.com/photos/36731559/pexels-photo-36731559/free-photo-of-grandfather-and-grandson-in-pottery-workshop.jpeg",
    "A grandfather and grandson making pottery together in a workshop",
  ],
  s1: ["https://images.unsplash.com/photo-1777715330440-025d52e54435", "A crowd watching a football match in a large stadium"],
  s2: ["https://images.unsplash.com/photo-1508782478-2164581d40cd", "Fans watching a football game in a floodlit stadium"],
} as const;
type PhotoKey = keyof typeof PHOTO;

// ── Reference data ─────────────────────────────────────────────────────────
const CATEGORIES = [
  ["music", "Music"],
  ["technology", "Technology"],
  ["art", "Art & exhibitions"],
  ["business", "Business & networking"],
  ["festivals", "Festivals"],
  ["workshops", "Workshops"],
  ["sports", "Sports & entertainment"],
] as const;

const ORGS = {
  nocturne: { name: "Nocturne Live", type: "BUSINESS", verified: true, bio: "Independent promoter putting on concerts and late sessions in mid-sized rooms across Europe since 2014." },
  lantern: { name: "Lantern Festivals", type: "BUSINESS", verified: true, bio: "Open-air city festivals built around light, music and long winter evenings." },
  signal: { name: "Signal Summit", type: "BUSINESS", verified: true, bio: "Practical conferences for people who build software, run by engineers for engineers." },
  northlight: { name: "Northlight Arts Collective", type: "COMMUNITY", verified: true, bio: "A collective of curators running openings, late views and guided evenings in London and Paris." },
  founders: { name: "Founders Table", type: "COMMUNITY", verified: false, bio: "Small-format mixers and forums for founders, operators and early-stage investors." },
  fieldwork: { name: "Fieldwork Studio", type: "BUSINESS", verified: true, bio: "Ceramics studios in Lisbon, Barcelona and Yerevan teaching wheel and hand-building to beginners." },
  matchday: { name: "Matchday Club", type: "BUSINESS", verified: false, bio: "Match-day hospitality, stadium tours and big-screen nights for fans who travel." },
  cascade: { name: "Cascade Product Circle", type: "COMMUNITY", verified: false, bio: "A Yerevan community for product managers, designers and engineers, meeting monthly." },
} as const;
type OrgKey = keyof typeof ORGS;

const VENUES = {
  lisbonRiverside: { name: "Riverside Hall", address: "Avenida de Brasília 12", city: "Lisbon", cc: "PT", lat: 38.7058, lng: -9.1466, tz: "Europe/Lisbon" },
  lisbonAtelier: { name: "Atelier Alfama", address: "Rua dos Remédios 54", city: "Lisbon", cc: "PT", lat: 38.7118, lng: -9.1286, tz: "Europe/Lisbon" },
  berlinHalle: { name: "Halle an der Spree", address: "Holzmarktstraße 30", city: "Berlin", cc: "DE", lat: 52.5115, lng: 13.4252, tz: "Europe/Berlin" },
  berlinForum: { name: "Forum am Kanal", address: "Paul-Lincke-Ufer 8", city: "Berlin", cc: "DE", lat: 52.4949, lng: 13.4232, tz: "Europe/Berlin" },
  londonCellar: { name: "The Cellar Room", address: "14 Rivington Street", city: "London", cc: "GB", lat: 51.5263, lng: -0.08, tz: "Europe/London" },
  londonGallery: { name: "Northlight Gallery", address: "22 Vyner Street", city: "London", cc: "GB", lat: 51.534, lng: -0.056, tz: "Europe/London" },
  londonForum: { name: "Bishopsgate Forum", address: "8 Bishopsgate Lane", city: "London", cc: "GB", lat: 51.5176, lng: -0.0807, tz: "Europe/London" },
  londonStadium: { name: "Kingsgate Stadium", address: "Stadium Way", city: "London", cc: "GB", lat: 51.556, lng: -0.2795, tz: "Europe/London" },
  nycLoft: { name: "Hudson Loft", address: "520 West 25th Street", city: "New York", cc: "US", lat: 40.7497, lng: -74.004, tz: "America/New_York" },
  nycGallery: { name: "Bowery Light Gallery", address: "180 Bowery", city: "New York", cc: "US", lat: 40.721, lng: -73.9935, tz: "America/New_York" },
  phillyStadium: { name: "Northside Stadium", address: "1 Stadium Drive", city: "Philadelphia", cc: "US", lat: 39.9008, lng: -75.1675, tz: "America/New_York" },
  yerevanLab: { name: "Cascade Lab", address: "10 Tamanyan Street", city: "Yerevan", cc: "AM", lat: 40.1872, lng: 44.5152, tz: "Asia/Yerevan" },
  yerevanStudio: { name: "Clay House", address: "5 Saryan Street", city: "Yerevan", cc: "AM", lat: 40.1853, lng: 44.5086, tz: "Asia/Yerevan" },
  bcnHarbour: { name: "Moll de la Fusta Grounds", address: "Moll de la Fusta", city: "Barcelona", cc: "ES", lat: 41.378, lng: 2.18, tz: "Europe/Madrid" },
  bcnStudio: { name: "Taller Gràcia", address: "Carrer de Verdi 40", city: "Barcelona", cc: "ES", lat: 41.4035, lng: 2.157, tz: "Europe/Madrid" },
  amsDocks: { name: "Docklands Hall", address: "Ms. van Riemsdijkweg 41", city: "Amsterdam", cc: "NL", lat: 52.401, lng: 4.893, tz: "Europe/Amsterdam" },
  amsStudio: { name: "Westerpark Studio", address: "Polonceaukade 17", city: "Amsterdam", cc: "NL", lat: 52.3864, lng: 4.872, tz: "Europe/Amsterdam" },
  parisGalerie: { name: "Galerie des Maîtres", address: "99 Rue de Rivoli", city: "Paris", cc: "FR", lat: 48.8606, lng: 2.3376, tz: "Europe/Paris" },
} as const;
type VenueKey = keyof typeof VENUES;

type When = { inDays: number } | { weekday: "fri" | "sat" | "sun" };
type SeedEvent = {
  slug: string;
  title: string;
  category: (typeof CATEGORIES)[number][0];
  org: OrgKey;
  venue: VenueKey;
  when: When;
  time: [number, number];
  hours: number;
  featured?: boolean;
  summary: string;
  description: string;
  refund?: string;
  photos: PhotoKey[];
  tickets: { name: string; price: number; qty: number; description?: string; max?: number }[];
};

const CURRENCY: Record<string, string> = { PT: "EUR", DE: "EUR", ES: "EUR", NL: "EUR", FR: "EUR", GB: "GBP", US: "USD", AM: "AMD" };

const EVENTS: SeedEvent[] = [
  {
    slug: "nocturne-riverside-sessions", title: "Nocturne Live: Riverside Sessions", category: "music", org: "nocturne", venue: "lisbonRiverside",
    when: { inDays: 9 }, time: [21, 30], hours: 3.5, featured: true,
    summary: "Three of Lisbon's most talked-about live acts on one riverside stage, from slow-burning soul to a loud, late finale.",
    description: "Riverside Sessions brings three bands together for one long night by the Tagus. The evening opens with a stripped-back soul set, moves into a seven-piece Afro-Lusitanian band, and closes with a headline set that has sold out every room it has played this year.\n\nDoors open an hour before the first act. The hall is standing on the floor with a seated balcony; the bar serves until the last song.",
    refund: "Full refund up to 7 days before the event.",
    photos: ["m1", "m4", "m5"],
    tickets: [{ name: "Standing", price: 2800, qty: 420 }, { name: "Balcony seat", price: 4500, qty: 120, description: "Reserved seating with a view of the full stage" }],
  },
  {
    slug: "low-light-ambient-electronic", title: "Low Light: Ambient & Electronic Night", category: "music", org: "nocturne", venue: "berlinHalle",
    when: { weekday: "sat" }, time: [22, 0], hours: 6,
    summary: "A slow-building night of ambient and electronic sets in a riverside hall, with a quadraphonic sound system and no phones on the floor.",
    description: "Low Light starts quietly and stays patient. Four selectors play long, connected sets across six hours, building from ambient and drone into deep electronic music after midnight.\n\nThe floor is phone-free: stickers go on camera lenses at the door. Coat check and water are free.",
    photos: ["m6", "m2"],
    tickets: [{ name: "General admission", price: 1800, qty: 320 }],
  },
  {
    slug: "velvet-room-late-jazz", title: "The Velvet Room: Late Jazz Quartet", category: "music", org: "nocturne", venue: "londonCellar",
    when: { weekday: "sun" }, time: [20, 0], hours: 2.5,
    summary: "A candle-lit Sunday set from a London quartet playing standards and originals in a 90-seat basement room.",
    description: "The Velvet Room is a weekly late session in a small brick cellar in Shoreditch. This week a quartet of piano, double bass, drums and tenor saxophone plays two sets of standards and new originals.\n\nSeats are unreserved except the front tables, which come with table service.",
    photos: ["m7", "m3"],
    tickets: [{ name: "Seat", price: 2200, qty: 90 }, { name: "Front table", price: 3800, qty: 24, description: "Front-row table for two with table service", max: 4 }],
  },
  {
    slug: "arena-nights-indie-double-bill", title: "Arena Nights: Indie Double Bill", category: "music", org: "nocturne", venue: "amsDocks",
    when: { inDays: 23 }, time: [20, 0], hours: 3.5,
    summary: "Two touring indie bands share a bill in a converted shipyard hall on the IJ.",
    description: "A co-headline night in Docklands Hall, a former shipbuilding shed with a 900-capacity floor. Both bands play full sets with their touring light show.\n\nThe free ferry from Centraal runs every 15 minutes until 01:00.",
    photos: ["m3", "m4"],
    tickets: [{ name: "General admission", price: 3500, qty: 900 }],
  },
  {
    slug: "lanterns-over-the-harbour", title: "Lanterns Over the Harbour", category: "festivals", org: "lantern", venue: "bcnHarbour",
    when: { inDays: 30 }, time: [18, 0], hours: 6, featured: true,
    summary: "Barcelona's winter light festival on the waterfront: live bands, food stalls and a midnight fireworks finale over the harbour.",
    description: "For one night the Moll de la Fusta fills with lantern installations, three music stages and a long row of Catalan food stalls. The evening builds towards a fireworks display over the harbour at midnight.\n\nEntry to the grounds is free. The Terrace pass gives you a reserved spot on the raised terrace with the clearest view of the fireworks, plus two drinks.",
    photos: ["f1", "f3", "f4"],
    tickets: [{ name: "Grounds entry", price: 0, qty: 2000, max: 6 }, { name: "Terrace pass", price: 2500, qty: 150, description: "Raised terrace with fireworks view and two drinks" }],
  },
  {
    slug: "winter-solstice-open-air", title: "Winter Solstice Open Air", category: "festivals", org: "lantern", venue: "lisbonRiverside",
    when: { inDays: 31 }, time: [16, 0], hours: 10,
    summary: "Ten hours of electronic music on the river on the longest night of the year, with a fireworks set at sunset and again at midnight.",
    description: "Winter Solstice Open Air takes over the riverside grounds from late afternoon into the early hours. Two outdoor stages run back to back, with heaters, covered bars and a food court in between.\n\nFireworks mark both sunset and midnight. Dress warm; the river wind is real.",
    refund: "Refunds available until 14 days before the event.",
    photos: ["f2", "f4"],
    tickets: [{ name: "Early entry", price: 3900, qty: 400, description: "Entry before 18:00" }, { name: "General admission", price: 4900, qty: 1600 }],
  },
  {
    slug: "signal-summit-applied-ai", title: "Signal Summit 2027: Applied AI", category: "technology", org: "signal", venue: "berlinForum",
    when: { inDays: 40 }, time: [9, 0], hours: 9, featured: true,
    summary: "A one-day conference on shipping AI features to real users: 14 talks from teams who have done it, and no vendor pitches.",
    description: "Signal Summit is a single-track conference for engineers and product teams putting machine learning into production. Every talk is a case study: what was built, what broke, and what the team would do differently.\n\nThe day includes lunch, two coffee breaks and an evening reception by the canal. Talks are recorded and shared with ticket holders a week later.",
    refund: "Full refund up to 30 days before; transfers allowed any time.",
    photos: ["t1", "t3", "t5"],
    tickets: [{ name: "Conference pass", price: 29000, qty: 600 }, { name: "Student pass", price: 9000, qty: 80, description: "Valid student ID required at entry", max: 1 }],
  },
  {
    slug: "frontend-futures", title: "Frontend Futures", category: "technology", org: "signal", venue: "amsStudio",
    when: { inDays: 19 }, time: [9, 30], hours: 8,
    summary: "A day of talks on the web platform: rendering, design systems, accessibility and performance budgets that survive real products.",
    description: "Frontend Futures gathers 350 front-end engineers and designers in a converted gasworks studio. Ten talks, two panels and a hallway track that people say is worth the ticket alone.\n\nLunch and coffee are included. The venue is step-free throughout.",
    photos: ["t3", "t2"],
    tickets: [{ name: "Conference pass", price: 18000, qty: 350 }],
  },
  {
    slug: "product-night-new-markets", title: "Product Night: Building for New Markets", category: "technology", org: "cascade", venue: "yerevanLab",
    when: { weekday: "fri" }, time: [19, 0], hours: 2.5,
    summary: "Three short talks from Yerevan product teams on launching outside their home market, followed by open discussion.",
    description: "Cascade Product Circle's monthly meetup. This month three teams share how they took a product from Armenia to new markets: localisation, payments, and the support load nobody plans for.\n\nTalks are in English with questions in Armenian or English. Snacks and drinks provided.",
    photos: ["t2", "t4"],
    tickets: [{ name: "Free registration", price: 0, qty: 150, max: 2 }],
  },
  {
    slug: "after-hours-new-painting", title: "After Hours: New Painting", category: "art", org: "northlight", venue: "londonGallery",
    when: { inDays: 5 }, time: [18, 30], hours: 3, featured: true,
    summary: "A late opening of large-scale contemporary painting, with a short talk from two of the artists at 19:30.",
    description: "Northlight Gallery stays open late for the opening of New Painting, a group show of eight artists working at scale. At 19:30 two of the artists talk through their process in front of the work.\n\nThe ticket includes a glass of wine and the printed catalogue.",
    photos: ["a1", "a4"],
    tickets: [{ name: "Late view", price: 1200, qty: 200 }],
  },
  {
    slug: "masters-by-night-guided-evening", title: "Masters by Night: A Guided Gallery Evening", category: "art", org: "northlight", venue: "parisGalerie",
    when: { inDays: 12 }, time: [19, 0], hours: 2,
    summary: "A small-group evening walk through French history painting with an art historian, after the day crowds have gone.",
    description: "Groups of 20 follow an art historian through six large-format works of French history painting, with time to stand and look at each one properly.\n\nThe tour is in English. It ends with coffee in the gallery salon.",
    photos: ["a2", "a1"],
    tickets: [{ name: "Guided tour", price: 2400, qty: 60, max: 4 }],
  },
  {
    slug: "quiet-rooms-portrait-opening", title: "Quiet Rooms: Portrait Exhibition Opening", category: "art", org: "northlight", venue: "nycGallery",
    when: { weekday: "sun" }, time: [17, 0], hours: 3,
    summary: "The opening of a portrait exhibition in a Bowery gallery, free with registration.",
    description: "Quiet Rooms brings together twenty portraits painted over the last decade, hung in small rooms so each can be seen alone.\n\nEntry is free, but registration helps the gallery manage numbers on opening night.",
    photos: ["a3", "a4"],
    tickets: [{ name: "Free registration", price: 0, qty: 250, max: 4 }],
  },
  {
    slug: "founders-table-cross-border-mixer", title: "Founders Table: Cross-Border Startup Mixer", category: "business", org: "founders", venue: "nycLoft",
    when: { inDays: 11 }, time: [18, 30], hours: 3,
    summary: "An evening mixer for founders building across borders, with short introductions every 20 minutes so nobody stands alone.",
    description: "Founders Table runs structured mixers: every 20 minutes the host rotates small groups so you meet people you would not have walked up to. Expect founders, operators and a handful of early-stage investors.\n\nDrinks and small plates included.",
    photos: ["b1", "t4"],
    tickets: [{ name: "Mixer ticket", price: 3500, qty: 180 }],
  },
  {
    slug: "scale-up-forum-operators-investors", title: "Scale-Up Forum: Operators & Investors", category: "business", org: "founders", venue: "londonForum",
    when: { inDays: 27 }, time: [9, 0], hours: 7,
    summary: "A working day for operators at growth-stage companies: hiring, pricing, international expansion, and what investors ask next.",
    description: "Scale-Up Forum mixes short talks with roundtables of eight people. Each roundtable has a named host and a single question, and you choose two in the morning and two in the afternoon.\n\nLunch included. Attendee list shared a week before.",
    photos: ["t4", "b1"],
    tickets: [{ name: "Forum pass", price: 12000, qty: 300 }],
  },
  {
    slug: "yerevan-founders-breakfast", title: "Yerevan Founders Breakfast", category: "business", org: "founders", venue: "yerevanLab",
    when: { inDays: 4 }, time: [8, 30], hours: 2,
    summary: "An early breakfast for founders in Yerevan: coffee, introductions and one short talk on raising a first round.",
    description: "A relaxed morning format for founders and people thinking about starting something. One 15-minute talk, then open tables.\n\nBreakfast provided. Free, but places are limited.",
    photos: ["b1"],
    tickets: [{ name: "Free place", price: 0, qty: 60, max: 1 }],
  },
  {
    slug: "wheel-throwing-for-beginners", title: "Wheel Throwing for Beginners", category: "workshops", org: "fieldwork", venue: "lisbonAtelier",
    when: { weekday: "sat" }, time: [11, 0], hours: 3,
    summary: "A three-hour introduction to the pottery wheel in an Alfama studio. You leave with two pieces, glazed and fired, posted to you later.",
    description: "Twelve wheels, two teachers. You learn to centre, open and pull a cylinder, then make a bowl of your own. Clay, tools and aprons provided.\n\nYour two best pieces are trimmed, glazed and fired by the studio and ready to collect or post two weeks later.",
    refund: "Full refund up to 48 hours before the class.",
    photos: ["w1", "w2"],
    tickets: [{ name: "Class place", price: 6500, qty: 12, max: 2 }],
  },
  {
    slug: "clay-and-coffee-weekend-studio", title: "Clay & Coffee: Weekend Pottery Studio", category: "workshops", org: "fieldwork", venue: "yerevanStudio",
    when: { weekday: "sun" }, time: [11, 0], hours: 2.5,
    summary: "A slow Sunday hand-building class in Yerevan, with coffee and a teacher at every table.",
    description: "Hand-build a cup and a small plate using pinch and slab techniques. No wheel, no rush. Coffee from the café next door is included.\n\nPieces are glazed and fired by the studio and ready to collect two weeks later.",
    photos: ["w3", "w2"],
    tickets: [{ name: "Class place", price: 1800000, qty: 10, max: 2 }],
  },
  {
    slug: "family-pottery-morning", title: "Family Pottery Morning", category: "workshops", org: "fieldwork", venue: "bcnStudio",
    when: { inDays: 18 }, time: [10, 0], hours: 2,
    summary: "A clay morning for an adult and a child together, with a teacher guiding each pair through a first pot.",
    description: "Designed for children aged 6 to 12 with a parent, grandparent or carer. Each pair shares a wheel and makes a small pot and a hand-built figure.\n\nAprons provided; clothes will still get clay on them.",
    photos: ["w4", "w3"],
    tickets: [{ name: "Adult + child", price: 3000, qty: 16, description: "One place for an adult and one child", max: 2 }],
  },
  {
    slug: "matchday-derby-hospitality", title: "Matchday Experience: Derby Hospitality", category: "sports", org: "matchday", venue: "londonStadium",
    when: { inDays: 13 }, time: [14, 0], hours: 5,
    summary: "Derby day with a padded seat, a three-course lunch and a former player hosting the pre-match Q&A.",
    description: "Hospitality includes a reserved seat in the main stand, a three-course lunch, and a half-time drink in the lounge. The tour option adds the dressing rooms and tunnel the morning before kick-off.\n\nSmart casual dress code in the lounge.",
    photos: ["s1", "s2"],
    tickets: [{ name: "Hospitality seat", price: 14500, qty: 80, max: 4 }, { name: "Stadium tour + match seat", price: 6000, qty: 200 }],
  },
  {
    slug: "under-the-lights-night-game", title: "Under the Lights: Night Game", category: "sports", org: "matchday", venue: "phillyStadium",
    when: { inDays: 20 }, time: [19, 30], hours: 4,
    summary: "A floodlit night game with a group block in the lower bowl and a pre-game tailgate.",
    description: "Matchday Club takes a block of lower-bowl seats for the night game, with a tailgate in the lot from 17:30. Food and soft drinks at the tailgate are included.\n\nAll ages welcome; under-12s must sit with an adult.",
    photos: ["s2", "s1"],
    tickets: [{ name: "Lower bowl + tailgate", price: 2500, qty: 500 }],
  },
];

// ── Time helpers ───────────────────────────────────────────────────────────
function tzOffsetMinutes(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUtc - date.getTime()) / 60000;
}
function localDateParts(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, wd: p.weekday as string };
}
function zonedTime(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, tz) * 60000);
}
const WD = { fri: "Fri", sat: "Sat", sun: "Sun" } as const;
function startFor(e: SeedEvent, tz: string) {
  if ("inDays" in e.when) {
    const { y, m, d } = localDateParts(new Date(NOW.getTime() + e.when.inDays * 864e5), tz);
    return zonedTime(y, m, d, e.time[0], e.time[1], tz);
  }
  for (let i = 0; i < 14; i++) {
    const day = new Date(NOW.getTime() + i * 864e5);
    const { y, m, d, wd } = localDateParts(day, tz);
    if (wd !== WD[e.when.weekday]) continue;
    const start = zonedTime(y, m, d, e.time[0], e.time[1], tz);
    if (start.getTime() > NOW.getTime() + 3 * 3600e3) return start;
  }
  throw new Error(`No date found for ${e.slug}`);
}

// ── Seed ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("Clearing tables…");
  await prisma.$executeRawUnsafe(
    `TRUNCATE "notification_logs","favorites","webhook_events","payments","tickets","booking_items","bookings","ticket_types","event_images","events","venues","categories","organization_members","organizations","verifications","accounts","sessions","users" CASCADE`,
  );

  const catIds: Record<string, string> = {};
  for (const [i, [slug, name]] of CATEGORIES.entries()) {
    const id = randomUUID();
    catIds[slug] = id;
    await prisma.category.create({ data: { id, slug, name, sortOrder: i } });
  }

  const orgIds: Record<string, string> = {};
  for (const [key, o] of Object.entries(ORGS)) {
    const id = randomUUID();
    orgIds[key] = id;
    const slug = o.name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await prisma.organization.create({
      data: { id, slug, name: o.name, type: o.type, bio: o.bio, verified: o.verified, contactEmail: `hello@${slug}.example`, updatedAt: NOW },
    });
  }

  const venueIds: Record<string, string> = {};
  for (const [key, v] of Object.entries(VENUES)) {
    const id = randomUUID();
    venueIds[key] = id;
    await prisma.venue.create({
      data: { id, name: v.name, addressLine1: v.address, city: v.city, countryCode: v.cc, latitude: v.lat, longitude: v.lng, timezone: v.tz, updatedAt: NOW },
    });
  }

  const eventIds: Record<string, string> = {};
  const ticketIds: Record<string, string[]> = {};
  for (const e of EVENTS) {
    const v = VENUES[e.venue];
    const currency = CURRENCY[v.cc];
    const startsAt = startFor(e, v.tz);
    const endsAt = new Date(startsAt.getTime() + e.hours * 3600e3);
    const prices = e.tickets.map((t) => t.price);
    const id = randomUUID();
    eventIds[e.slug] = id;
    await prisma.event.create({
      data: {
        id, slug: e.slug, title: e.title, summary: e.summary, description: e.description,
        organizationId: orgIds[e.org], categoryId: catIds[e.category], venueId: venueIds[e.venue],
        startsAt, endsAt, timezone: v.tz, status: "PUBLISHED", visibility: "PUBLIC", refundPolicy: e.refund,
        minPriceMinor: Math.min(...prices), currency, isFree: prices.every((p) => p === 0),
        featuredFrom: e.featured ? new Date(NOW.getTime() - 864e5) : null,
        featuredUntil: e.featured ? new Date(NOW.getTime() + 60 * 864e5) : null,
        publishedAt: new Date(NOW.getTime() - 20 * 864e5), updatedAt: NOW,
        images: {
          create: e.photos.map((k, i) => ({ id: randomUUID(), storageKey: PHOTO[k][0], alt: PHOTO[k][1], width: 1600, height: 1067, sortOrder: i })),
        },
        ticketTypes: {
          create: e.tickets.map((t, i) => ({
            id: randomUUID(), name: t.name, description: t.description, priceMinor: t.price, currency,
            quantityTotal: t.qty, maxPerOrder: t.max ?? 10, sortOrder: i, updatedAt: NOW,
          })),
        },
      },
    });
    ticketIds[e.slug] = (await prisma.ticketType.findMany({ where: { eventId: id }, orderBy: { sortOrder: "asc" }, select: { id: true } })).map((t) => t.id);
  }

  // Demo activity through the real booking engine (dated within the last 7 days).
  console.log("Creating demo bookings through the booking engine…");
  const demand: Record<string, number> = {
    "nocturne-riverside-sessions": 26, "low-light-ambient-electronic": 22, "signal-summit-applied-ai": 18,
    "lanterns-over-the-harbour": 16, "wheel-throwing-for-beginners": 5, "velvet-room-late-jazz": 12,
    "after-hours-new-painting": 9, "matchday-derby-hospitality": 7, "frontend-futures": 6,
    "product-night-new-markets": 8, "founders-table-cross-border-mixer": 4, "winter-solstice-open-air": 10,
    "clay-and-coffee-weekend-studio": 3, "quiet-rooms-portrait-opening": 5,
  };
  let n = 0;
  for (const [slug, count] of Object.entries(demand)) {
    for (let i = 0; i < count; i++) {
      n++;
      const at = new Date(NOW.getTime() - ((n * 37) % 160) * 3600e3 - 60e3);
      const types = ticketIds[slug];
      const tt = types[i % types.length];
      const ev = EVENTS.find((x) => x.slug === slug)!;
      const max = ev.tickets[types.indexOf(tt)].max ?? 10;
      await createBookingWith(
        prisma,
        { eventId: eventIds[slug], items: [{ ticketTypeId: tt, quantity: Math.min(1 + (i % 3), max) }], contactName: `Demo Guest ${n}`, contactEmail: `demo.guest${n}@eventhub.example` },
        at,
      ).catch((err) => console.warn(`  skipped booking for ${slug}: ${err.message}`));
    }
  }

  // Demo members (no login: they have no account rows) whose saves feed the trending ranking.
  const users = await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      prisma.user.create({ data: { id: randomUUID(), name: `Demo Member ${i + 1}`, email: `demo.member${i + 1}@eventhub.example`, updatedAt: NOW } }),
    ),
  );
  const saves = ["nocturne-riverside-sessions", "lanterns-over-the-harbour", "signal-summit-applied-ai", "after-hours-new-painting", "low-light-ambient-electronic", "masters-by-night-guided-evening"];
  for (const [i, u] of users.entries()) {
    for (const [j, slug] of saves.entries()) {
      if ((i + j) % 3 !== 0) continue;
      await prisma.favorite.create({ data: { userId: u.id, eventId: eventIds[slug], createdAt: new Date(NOW.getTime() - ((i * 13 + j * 7) % 150) * 3600e3) } });
    }
  }

  const counts = await Promise.all([prisma.event.count(), prisma.booking.count(), prisma.ticket.count(), prisma.favorite.count()]);
  console.log(`Seeded ${counts[0]} events, ${counts[1]} bookings, ${counts[2]} tickets, ${counts[3]} saves.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
