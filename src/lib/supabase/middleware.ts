import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PORTAL_ROLES = new Set(["admin", "department_admin"]);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/students",
  "/sessions",
  "/checkers",
  "/reports",
  "/settings",
  "/departments",
  "/users",
  "/attendance",
  "/qr",
  "/import",
  "/audit",
  "/profile",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (isProtected || isAuthPage)) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, status, department")
      .eq("id", user.id)
      .maybeSingle();

    const isPortalUser =
      Boolean(profile) &&
      PORTAL_ROLES.has(profile!.role) &&
      profile!.status === "active" &&
      (profile!.role !== "department_admin" ||
        Boolean(profile!.department?.trim()));

    if (isProtected && !isPortalUser) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "portal_access_denied");
      return NextResponse.redirect(url);
    }

    if (isAuthPage && isPortalUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
