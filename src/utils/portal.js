const DEFAULT_DEV = "http://localhost:5180/";
const DEFAULT_PROD = "/lfb_center/";

export function getPortalUrl() {
  const explicit = String(import.meta.env.VITE_PORTAL_URL || "").trim();
  if (explicit) {
    return explicit.endsWith("/") ? explicit : `${explicit}/`;
  }
  return import.meta.env.PROD ? DEFAULT_PROD : DEFAULT_DEV;
}

export function redirectToPortal() {
  window.location.replace(getPortalUrl());
}
