"use client";

import { useEffect } from "react";

export function SiteHeadCode({ code }: { code?: string }) {
  useEffect(() => {
    if (!code) return;
    const template = document.createElement("template");
    template.innerHTML = code;
    const inserted: Node[] = [];
    for (const node of Array.from(template.content.childNodes)) {
      let next: Node = node.cloneNode(true);
      if (node instanceof HTMLScriptElement) {
        const script = document.createElement("script");
        for (const attribute of Array.from(node.attributes)) {
          script.setAttribute(attribute.name, attribute.value);
        }
        script.text = node.text;
        next = script;
      }
      document.head.appendChild(next);
      inserted.push(next);
    }
    return () => inserted.forEach((node) => node.parentNode?.removeChild(node));
  }, [code]);

  return null;
}

export function SiteFooterCode({ code }: { code?: string }) {
  if (!code) return null;
  return <div data-w-ai-footer-code dangerouslySetInnerHTML={{ __html: code }} />;
}
