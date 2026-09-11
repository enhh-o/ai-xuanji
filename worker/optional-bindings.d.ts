// The starter's database helper is optional; production currently has no D1 binding.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
