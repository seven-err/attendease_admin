"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type PeopleKindTabsProps = {
  active: "students" | "staff";
};

export function PeopleKindTabs({ active }: PeopleKindTabsProps) {
  const searchParams = useSearchParams();

  function hrefFor(kind: "students" | "staff") {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("page");
    if (kind === "staff") {
      params.set("kind", "staff");
    } else {
      params.delete("kind");
    }
    // Year filter only applies to students.
    if (kind === "staff") {
      params.delete("year");
    }
    const qs = params.toString();
    return qs ? `/students?${qs}` : "/students";
  }

  return (
    <div className="flex gap-2">
      <Link
        href={hrefFor("students")}
        className={active === "students" ? "btn btn-primary" : "btn btn-ghost"}
      >
        Students
      </Link>
      <Link
        href={hrefFor("staff")}
        className={active === "staff" ? "btn btn-primary" : "btn btn-ghost"}
      >
        Staff
      </Link>
    </div>
  );
}
