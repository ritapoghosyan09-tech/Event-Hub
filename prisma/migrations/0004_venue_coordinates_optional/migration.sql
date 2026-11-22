-- Organizers create venues by address. Coordinates come from geocoding when
-- it succeeds; until then the venue simply has no map pin.
ALTER TABLE "venues" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "venues" ALTER COLUMN "longitude" DROP NOT NULL;
