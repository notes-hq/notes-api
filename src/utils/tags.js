const tagPattern = /^#[\p{L}0-9_]{1,100}$/u;

export function parseTags(content) {
  const tags = [];
  const seenTags = new Set();
  const fragments = content.split(/\s+/u);

  for (const fragment of fragments) {
    if (!fragment.startsWith('#')) {
      continue;
    }

    if (!tagPattern.test(fragment)) {
      throw new Error('Invalid tag format');
    }

    const tag = fragment.slice(1).toLowerCase();

    if (!seenTags.has(tag)) {
      seenTags.add(tag);
      tags.push(tag);
    }
  }

  return tags;
}
