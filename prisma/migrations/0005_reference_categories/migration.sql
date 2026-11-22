-- Reference data the app needs in every environment: the browse categories.
-- Production starts with these and no demo events. The dev seed still
-- truncates and recreates them, so local development is unchanged.
INSERT INTO "categories" ("id", "slug", "name", "sortOrder", "isActive") VALUES
  (gen_random_uuid()::text, 'music',      'Music',                  0, true),
  (gen_random_uuid()::text, 'technology', 'Technology',             1, true),
  (gen_random_uuid()::text, 'art',        'Art & exhibitions',      2, true),
  (gen_random_uuid()::text, 'business',   'Business & networking',  3, true),
  (gen_random_uuid()::text, 'festivals',  'Festivals',              4, true),
  (gen_random_uuid()::text, 'workshops',  'Workshops',              5, true),
  (gen_random_uuid()::text, 'sports',     'Sports & entertainment', 6, true)
ON CONFLICT ("slug") DO NOTHING;
