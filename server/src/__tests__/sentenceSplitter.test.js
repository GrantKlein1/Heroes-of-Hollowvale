import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, SentenceSplitter } from '../tts/sentenceSplitter.js';

test('SentenceSplitter: does not cut on abbreviations like Mr. and St. (Acceptance Criterion 1)', () => {
  const text = 'I spoke with Mr. Smith on St. Jude street. He was very kind.';
  const sentences = splitSentences(text);
  assert.deepEqual(sentences, [
    'I spoke with Mr. Smith on St. Jude street.',
    'He was very kind.',
  ]);
});

test('SentenceSplitter: does not cut on Dr., Mrs., Ms., or Prof.', () => {
  const text = 'Dr. Tharos and Prof. Eldrin met Mrs. Gable yesterday. They discussed ancient lore.';
  const sentences = splitSentences(text);
  assert.deepEqual(sentences, [
    'Dr. Tharos and Prof. Eldrin met Mrs. Gable yesterday.',
    'They discussed ancient lore.',
  ]);
});

test('SentenceSplitter: does not split on decimal numbers or ellipses', () => {
  const text = 'The potion costs 3.14 gold coins... Are you going to buy it? Yes!';
  const sentences = splitSentences(text);
  assert.deepEqual(sentences, [
    'The potion costs 3.14 gold coins...',
    'Are you going to buy it?',
    'Yes!',
  ]);
});

test('SentenceSplitter: splits across varied terminal punctuation (!, ?, .)', () => {
  const text = 'Halt! Who goes there? State your business at once.';
  const sentences = splitSentences(text);
  assert.deepEqual(sentences, [
    'Halt!',
    'Who goes there?',
    'State your business at once.',
  ]);
});

test('SentenceSplitter: streaming feed() emits complete sentences and flush() returns remainder', () => {
  const emitted = [];
  const splitter = new SentenceSplitter({
    onSentence: (s) => emitted.push(s),
  });

  // Feed tokens incrementally
  splitter.feed('Welcome ');
  splitter.feed('to ');
  splitter.feed('Hollowvale, ');
  splitter.feed('Mr. ');
  splitter.feed('Traveler. ');
  // First sentence is now followed by space + next sentence
  assert.deepEqual(emitted, ['Welcome to Hollowvale, Mr. Traveler.']);

  splitter.feed('The road ');
  splitter.feed('ahead ');
  splitter.feed('is treacherous! ');
  assert.deepEqual(emitted, [
    'Welcome to Hollowvale, Mr. Traveler.',
    'The road ahead is treacherous!',
  ]);

  // Feed final part without terminal punctuation
  splitter.feed('Take this sword');
  assert.deepEqual(emitted, [
    'Welcome to Hollowvale, Mr. Traveler.',
    'The road ahead is treacherous!',
  ]);

  const final = splitter.flush();
  assert.equal(final, 'Take this sword');
  assert.deepEqual(emitted, [
    'Welcome to Hollowvale, Mr. Traveler.',
    'The road ahead is treacherous!',
    'Take this sword',
  ]);
});
