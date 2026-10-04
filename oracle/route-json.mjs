// Independent artifact reader: deliberately imports no RouteLeaf implementation.
export const workshopCases = ['print', 'book'].flatMap(track => [
  { id: `${track}-no`, answers: { track, loan: 'no' } },
  ...['morning', 'evening'].map(pickup => ({ id: `${track}-${pickup}`, answers: { track, loan: 'yes', pickup } }))
]);
export const textAnswer = source => `Oracle answer for ${source}`;
export const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export function questionEvent(source, kind, label, choices = []) {
  return { event: 'question', source, kind, label: normalize(label), choices: choices.map(c => ({ value: c.value, label: normalize(c.label) })) };
}
export function traverseRoute(manifest, answers) {
  if (manifest.schema !== 'routeleaf/1') throw new Error('Unsupported route schema');
  if (!Array.isArray(manifest.cards) || manifest.cards.length === 0) throw new Error('No cards');
  const cards = new Map();
  for (const card of manifest.cards) {
    if (cards.has(card.id)) throw new Error(`Duplicate card ${card.id}`);
    cards.set(card.id, card);
  }
  const events = [], visited = new Set(), sources = new Set(), ids = [];
  let target = manifest.start;
  while (target !== 'END') {
    if (visited.has(target)) throw new Error(`Cycle at ${target}`);
    visited.add(target);
    const card = cards.get(target);
    if (!card) throw new Error(`Missing target ${target}`);
    if (sources.has(card.source)) throw new Error(`Repeated source ${card.source}`);
    sources.add(card.source); ids.push(card.id);
    if (!['select_one', 'text', 'note'].includes(card.kind)) throw new Error(`Unsupported kind ${card.kind}`);
    events.push(questionEvent(card.source, card.kind, card.label, card.options ?? []));
    if (card.kind === 'select_one') {
      const answer = answers[card.source];
      const matches = (card.options ?? []).filter(option => option.value === answer);
      if (matches.length !== 1) throw new Error(`Answer ${answer} not uniquely available for ${card.source}`);
      events.push({ event: 'answer', source: card.source, value: answer });
      target = matches[0].next;
    } else {
      if (card.kind === 'text') events.push({ event: 'answer', source: card.source, value: textAnswer(card.source) });
      target = card.next;
    }
    if (typeof target !== 'string') throw new Error(`No next target after ${card.id}`);
  }
  for (const key of Object.keys(answers)) if (!sources.has(key)) throw new Error(`Unvisited controller ${key}`);
  events.push({ event: 'terminal', value: 'END' });
  return { events, cards: ids };
}
