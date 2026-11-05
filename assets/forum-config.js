// Supabase connection for the forum.
// Both values are safe to publish: the "anon" / "publishable" key only allows what the
// row-level security rules in supabase/schema.sql allow. NEVER put the service_role key here.
window.FORUM_CONFIG = {
  url: "https://zqyhweugbcidjqdprejh.supabase.co",
  anonKey: "sb_publishable_jZv81IF41UcVFvA0SoBs5w_GrNllpsI", // publishable key (safe to publish)
};
