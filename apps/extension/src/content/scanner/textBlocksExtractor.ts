/**
 * Extracts meaningful text blocks from the page.
 * Avoids nested duplicates, layout divs, tiny text, and invisible content.
 */
export function extractTextBlocks(): string[] {
  const blocks: string[] = [];
  // 1. Direct text blocks: <p> and <li>
  const pAndLi = Array.from(document.querySelectorAll("p, li"))
    .filter(el => {
      // Skip elements inside style/script tags
      if (el.closest('style, script, noscript')) return false;
      
      // Skip common UI noise elements (generic across all sites)
      if (el.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]')) return false;
      
      // Skip elements with common noise class/id patterns
      const element = el as HTMLElement;
      const classAndId = `${element.className} ${element.id}`.toLowerCase();
      if (/(sidebar|menu|nav|header|footer|cookie|banner|ad|promo|related|recommend|similar)/i.test(classAndId)) {
        return false;
      }
      
      // Skip hidden elements
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      
      return true;
    })
    .map(el => el.textContent?.trim() || "")
    .filter(text => text.length > 25); // Balanced to catch short requirements while avoiding noise

  blocks.push(...pAndLi);

  // 2. Leaf <div> blocks — <div> that contain text but do NOT contain <p> or <li>
  const leafDivs = Array.from(document.querySelectorAll("div"))
    .filter(div => {
      // Skip elements inside style/script tags
      if (div.closest('style, script, noscript')) return false;
      
      // Skip common UI noise elements (generic across all sites)
      if (div.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]')) return false;
      
      // Skip elements with common noise class/id patterns
      const classAndId = `${div.className} ${div.id}`.toLowerCase();
      if (/(sidebar|menu|nav|header|footer|cookie|banner|ad|promo|related|recommend|similar)/i.test(classAndId)) {
        return false;
      }
      
      // Skip hidden elements
      const style = window.getComputedStyle(div);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      
      const text = div.textContent?.trim() || "";
      if (text.length <= 30) return false; // Balanced threshold
      if (div.querySelector("p, li")) return false; // avoid nested content
      return true;
    })
    .map(div => div.textContent?.trim() || "");

  blocks.push(...leafDivs);

  return dedupe(blocks);
}

// Deduplicate by small fingerprint
function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const text of list) {
    const key = text.slice(0, 80); // perfect for dedupe
    if (!seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  }

  return out;
}
