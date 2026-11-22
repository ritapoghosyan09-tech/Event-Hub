/**
 * Art direction per category: the cover photograph and one line of copy.
 * This is brand content (like marketing imagery), not event data — event
 * records and their photos live in the database.
 *
 * Every photo was chosen against its source description and is free to use
 * under the Pexels or Unsplash licence. Credits are listed in PHOTO_CREDITS.md.
 */
export type CategoryArt = { image: string; alt: string; line: string; tone: string };

export const CATEGORY_ART: Record<string, CategoryArt> = {
  music: {
    image: "https://images.pexels.com/photos/1763068/pexels-photo-1763068.jpeg",
    alt: "A performer silhouetted against bright stage lights above a concert crowd",
    line: "Concerts, club nights and intimate sets",
    tone: "#2b2340",
  },
  technology: {
    image: "https://images.pexels.com/photos/1708936/pexels-photo-1708936.jpeg",
    alt: "A speaker presenting to an attentive audience in a modern auditorium",
    line: "Conferences, meetups and product nights",
    tone: "#1d2a3a",
  },
  art: {
    image: "https://images.pexels.com/photos/34633/pexels-photo.jpg",
    alt: "Visitors admiring paintings in a busy art gallery",
    line: "Exhibitions, openings and guided evenings",
    tone: "#3a3128",
  },
  business: {
    image: "https://images.unsplash.com/photo-1675716921224-e087a0cca69a",
    alt: "A group of people talking together at a networking event",
    line: "Mixers, forums and founder dinners",
    tone: "#26303a",
  },
  festivals: {
    image: "https://images.pexels.com/photos/3052307/pexels-photo-3052307.jpeg",
    alt: "A festival crowd watching fireworks light up the night sky",
    line: "Open-air weekends and city celebrations",
    tone: "#2a2035",
  },
  workshops: {
    image: "https://images.pexels.com/photos/8063838/pexels-photo-8063838.jpeg",
    alt: "Hands shaping wet clay on a pottery wheel",
    line: "Hands-on classes with makers and teachers",
    tone: "#3b2f26",
  },
  sports: {
    image: "https://images.unsplash.com/photo-1777715330440-025d52e54435",
    alt: "A crowd watching a football match in a large stadium",
    line: "Match days, watch parties and tours",
    tone: "#1f2d24",
  },
};

export const FALLBACK_ART: CategoryArt = {
  image: "https://images.pexels.com/photos/2990835/pexels-photo-2990835.jpeg",
  alt: "A crowd enjoying a live performance under bright stage lights",
  line: "Live events near you",
  tone: "#1d2a3a",
};

export const artFor = (slug: string) => CATEGORY_ART[slug] ?? FALLBACK_ART;
