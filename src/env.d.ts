declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    role: "client" | "behaviorist" | null;
  }
}
