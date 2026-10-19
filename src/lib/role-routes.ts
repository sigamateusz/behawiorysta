export function dashboardRedirect(role: "client" | "behaviorist" | null): "/consultations" | "/" | null {
  if (role === "behaviorist") {
    return null;
  }
  if (role === "client") {
    return "/consultations";
  }
  return "/";
}

export function redirectAfterSignIn(role: "client" | "behaviorist" | null): "/dashboard" | "/consultations" | "/" {
  if (role === "behaviorist") {
    return "/dashboard";
  }
  if (role === "client") {
    return "/consultations";
  }
  return "/";
}
