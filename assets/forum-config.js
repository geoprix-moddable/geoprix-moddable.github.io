// Supabase connection for the forum.
// Both values are safe to publish: the "anon" / "publishable" key only allows what the
// row-level security rules in supabase/schema.sql allow. NEVER put the service_role key here.
window.FORUM_CONFIG = {
  url: "YOUR_SUPABASE_PROJECT_URL",      // e.g. https://abcdefghijkl.supabase.co
  anonKey: "YOUR_SUPABASE_ANON_KEY",     // Project Settings > API > anon / publishable key
};
