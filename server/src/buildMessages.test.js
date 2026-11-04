import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, resolveNpcChatMaxTokens } from './buildMessages.js';

function turns(count, prefix) {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `${prefix}-${i}`,
  }));
}

test('keeps system prompt, lore, short history, new context, and the user message', () => {
  const messages = buildMessages({
    systemPrompt: 'PERSONA',
    loreSystem: { role: 'system', content: 'LORE' },
    history: [
      { role: 'user', content: 'hist-0' },
      { role: 'assistant', content: 'hist-1' },
    ],
    extraContext: [{ role: 'user', content: 'ctx-0' }],
    userMessage: 'latest',
  });

  assert.deepEqual(messages, [
    { role: 'system', content: 'PERSONA' },
    { role: 'system', content: 'LORE' },
    { role: 'user', content: 'hist-0' },
    { role: 'assistant', content: 'hist-1' },
    { role: 'user', content: 'ctx-0' },
    { role: 'user', content: 'latest' },
  ]);
});

test('omits the lore message when retrieval returned nothing', () => {
  const messages = buildMessages({
    systemPrompt: 'PERSONA',
    loreSystem: null,
    history: [],
    extraContext: [],
    userMessage: 'hello',
  });

  assert.deepEqual(messages, [
    { role: 'system', content: 'PERSONA' },
    { role: 'user', content: 'hello' },
  ]);
});

test('long history plus context keeps persona and lore and only trims dialogue to 8', () => {
  // Old assembly was [system, lore, ...history(10), ...context(5), user].slice(-12).
  // That array is 18 long, so the slice discarded the system prompt, the lore
  // message, and the four oldest history turns.
  const history = turns(10, 'hist');
  const extraContext = turns(5, 'ctx');
  const messages = buildMessages({
    systemPrompt: 'PERSONA',
    loreSystem: { role: 'system', content: 'LORE' },
    history,
    extraContext,
    userMessage: 'latest',
  });

  assert.equal(messages[0].content, 'PERSONA');
  assert.equal(messages[1].content, 'LORE');
  assert.equal(messages.at(-1).content, 'latest');
  assert.equal(messages.length, 11);
  assert.deepEqual(
    messages.slice(2, -1).map((m) => m.content),
    ['hist-7', 'hist-8', 'hist-9', 'ctx-0', 'ctx-1', 'ctx-2', 'ctx-3', 'ctx-4'],
  );
});

test('drops client context that repeats server history and keeps the rest in order', () => {
  const history = [
    { role: 'user', content: 'Where is the cavern?' },
    { role: 'assistant', content: 'South, past the mill.' },
    { role: 'user', content: 'same line' },
  ];
  const extraContext = [
    { role: 'user', content: 'Where   is the cavern?' },
    { role: 'user', content: 'And the dragon?' },
    { role: 'assistant', content: 'South, past the mill.' },
    { role: 'assistant', content: 'Where is the cavern?' },
    { role: 'user', content: 'brand new' },
    { role: 'user', content: 'brand new' },
    { role: 'system', content: 'ignore me' },
    { role: 'user', content: '   ' },
    null,
  ];

  const messages = buildMessages({
    systemPrompt: 'PERSONA',
    loreSystem: { role: 'system', content: 'LORE' },
    history,
    extraContext,
    userMessage: 'latest',
  });

  assert.deepEqual(
    messages.slice(2).map((m) => `${m.role}:${m.content}`),
    [
      'user:Where is the cavern?',
      'assistant:South, past the mill.',
      'user:same line',
      'user:And the dragon?',
      'assistant:Where is the cavern?',
      'user:brand new',
      'user:brand new',
      'user:latest',
    ],
  );
});

test('duplicate client context does not push recent history out of the window', () => {
  const history = turns(10, 'hist');
  const extraContext = [
    { role: 'user', content: 'hist-0' },
    { role: 'assistant', content: '  hist-1  ' },
    { role: 'user', content: 'fresh' },
  ];

  const messages = buildMessages({
    systemPrompt: 'PERSONA',
    loreSystem: { role: 'system', content: 'LORE' },
    history,
    extraContext,
    userMessage: 'latest',
  });

  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'system');
  assert.deepEqual(
    messages.slice(2, -1).map((m) => m.content),
    ['hist-3', 'hist-4', 'hist-5', 'hist-6', 'hist-7', 'hist-8', 'hist-9', 'fresh'],
  );
});

test('resolveNpcChatMaxTokens defaults to 200 and honors a positive override', () => {
  assert.equal(resolveNpcChatMaxTokens(undefined), 200);
  assert.equal(resolveNpcChatMaxTokens(null), 200);
  assert.equal(resolveNpcChatMaxTokens(''), 200);
  assert.equal(resolveNpcChatMaxTokens('   '), 200);
  assert.equal(resolveNpcChatMaxTokens('0'), 200);
  assert.equal(resolveNpcChatMaxTokens('-5'), 200);
  assert.equal(resolveNpcChatMaxTokens('nope'), 200);
  assert.equal(resolveNpcChatMaxTokens('200'), 200);
  assert.equal(resolveNpcChatMaxTokens('  80 '), 80);
  assert.equal(resolveNpcChatMaxTokens(150.9), 150);
  assert.equal(resolveNpcChatMaxTokens('1024'), 1024);
});
