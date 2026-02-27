import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export type HomeMode = "index" | "about" | "contact" | "codeview" | "internals";

function resolveHomeMode(pathname: string): HomeMode {
  if (pathname.startsWith("/Home/About")) return "about";
  if (pathname.startsWith("/Home/Contact")) return "contact";
  if (pathname.startsWith("/Home/CodeView")) return "codeview";
  if (pathname.startsWith("/Home/Internals")) return "internals";
  return "index";
}

export function useHomeMode() {
  const location = useLocation();
  return useMemo(() => ({ mode: resolveHomeMode(location.pathname), pathname: location.pathname }), [location.pathname]);
}
