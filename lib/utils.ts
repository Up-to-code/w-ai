import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ms from "ms";

export type Locale = "ar" | "en";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const timeAgo = (timestamp: Date | number, timeOnly?: boolean): string => {
  if (!timestamp) return "never";
  return `${ms(Date.now() - new Date(timestamp).getTime())}${
    timeOnly ? "" : " ago"
  }`;
};

export function capitalize(str: string) {
  if (!str || typeof str !== "string") return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const truncate = (str: string, length: number) => {
  if (!str || str.length <= length) return str;
  return `${str.slice(0, length)}...`;
};

export function formatRelativeTime(date: Date, locale: Locale = "ar") {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (locale === "ar") {
    if (diffInDays === 0) return "اليوم";
    if (diffInDays === 1) return "أمس";
    if (diffInDays < 7) return `قبل ${diffInDays} أيام`;
    if (diffInDays < 30) return `قبل ${Math.floor(diffInDays / 7)} أسابيع`;
    if (diffInDays < 365) return `قبل ${Math.floor(diffInDays / 30)} أشهر`;
    return `قبل ${Math.floor(diffInDays / 365)} سنوات`;
  }

  if (diffInDays === 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

export function generateExcerpt(content: string, maxLength: number = 160) {
  const text = content.replace(/<[^>]*>/g, "").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function calculateReadingTime(content: string, locale: Locale = "ar") {
  const wordsPerMinute = locale === "ar" ? 150 : 200;
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/<[^>]*$/g, "");
  text = text.replace(/^[^<]*>/g, "");

  const entityMap: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&nbsp;": " ",
    "&apos;": "'",
    "&hellip;": "...",
    "&mdash;": "—",
    "&ndash;": "–",
  };

  text = text.replace(/&[#\w]+;/g, (entity) => {
    return entityMap[entity.toLowerCase()] || entity;
  });
  text = text.replace(/&#(\d+);/g, (_match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return text.replace(/[\s\n\r\t]+/g, " ").trim();
}

export function truncateText(text: string, maxLength: number = 100) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
