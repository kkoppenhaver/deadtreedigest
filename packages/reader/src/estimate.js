// Page estimation for the 100pp issue cap: digest 5.5x8.5 B&W runs ~400
// words/page in the planned type spec; an image costs roughly 0.4pp.

const WORDS_PER_PAGE = 400;
const PAGE_COST_PER_IMAGE = 0.4;

export function estimatePages(wordCount, imageCount = 0) {
  const pages = wordCount / WORDS_PER_PAGE + imageCount * PAGE_COST_PER_IMAGE;
  return Math.max(1, Math.round(pages * 10) / 10);
}
