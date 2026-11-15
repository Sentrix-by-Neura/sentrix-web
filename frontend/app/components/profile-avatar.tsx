"use client";

import { useState } from "react";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileAvatar({ name, avatarUrl, className }: { name: string; avatarUrl?: string; className: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();

  if (avatarUrl && avatarUrl !== failedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        onError={() => setFailedUrl(avatarUrl)}
        className={`${className} shrink-0 rounded-full border border-amber-500/40 object-cover`}
      />
    );
  }

  return (
    <span aria-hidden="true" className={`${className} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-500 font-bold text-[#382315]`}>
      {getInitials(name)}
    </span>
  );
}
