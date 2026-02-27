import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export type PostsMode =
  | "index"
  | "create"
  | "edit"
  | "details"
  | "delete"
  | "delay"
  | "codeview"
  | "reset"
  | "numposts";

interface PostsRoute {
  mode: PostsMode;
  id: number | null;
  pathname: string;
}

function parseId(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolvePostsRoute(pathname: string): PostsRoute {
  const parts = pathname.split("/").filter(Boolean);
  const modeRaw = (parts[1] || "Index").toLowerCase();
  const id = parseId(parts[2]);

  switch (modeRaw) {
    case "create":
      return { mode: "create", id, pathname };
    case "edit":
      return { mode: "edit", id, pathname };
    case "details":
      return { mode: "details", id, pathname };
    case "delete":
      return { mode: "delete", id, pathname };
    case "delay":
      return { mode: "delay", id, pathname };
    case "codeview":
      return { mode: "codeview", id, pathname };
    case "reset":
      return { mode: "reset", id, pathname };
    case "numposts":
      return { mode: "numposts", id, pathname };
    default:
      return { mode: "index", id, pathname };
  }
}

export function usePostsRoute() {
  const location = useLocation();
  return useMemo(() => resolvePostsRoute(location.pathname), [location.pathname]);
}
