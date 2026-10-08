export function dashboardRedirect(role: "client" | "behaviorist" | null): "/consultations" | "/" | null {
  if (role === "behaviorist") {
    return null;
  }
  if (role === "client") {
    return "/consultations";
  }
  return "/";
}

export function redirectAfterSignIn(role: "client" | "behaviorist" | null): "/dashboard" | "/" {
  if (role === "behaviorist") {
    return "/dashboard";
  }
  return "/";
}
