const tagPattern = /^#[\p{L}0-9_]{1,100}$/u;

/**
 * Извлекает теги из content по backend-правилам формата.
 * Тегом считается whitespace-разделенный токен вида #name; имя приводится к lowercase,
 * дубликаты удаляются с сохранением порядка первого появления.
 *
 * @param {string} content
 * @returns {string[]}
 * @throws {Error} Если найден токен с #, но он не соответствует формату тега.
 */
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
