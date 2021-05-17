// Notes
// - Thai Unicode range: \u0E00-\u0E7F
// - Thai sentence is written without space between words.
// See discussion here:
// https://github.com/Common-Voice/sentence-collector/issues/318

// We count chars to validate instead of words.
// Target max time length for recorded speech: 7-10 seconds
const MIN_LENGTH = 2;
const MAX_LENGTH = 80;

// Numbers that are not allowed in a sentence depending on the language.
// For English this is 0-9 once or multiple times after each other.
// Thai digits: \u0E50-\u0E59 (๐-๙)
const NUMBERS_REGEX = /[0-9๐-๙]+/;

// Some languages want to check the structure, this is what this REGEX is for.
//
// Sentence with running characters of 55 or more without a space is considered difficult to read.
//
// These classes of Thai characters are not allowed to be immediately repeated:
// - Lead vowels: \u0E40\u0E41\u0E42\u0E43\u0E44
// - Follow vowels: \u0E30\u0E32\u0E33\u0E45
// - Above vowels: \u0E31\u0E34\u0E35\u0E36\u0E37\u0E4D\u0E47
// - Below vowels: \u0E38\u0E39
// - Tone marks: \u0E48\u0E49\u0E4A\u0E4B
// - Phinthu: \u0E3A
// - Thanthakhat: \u0E4C
// - Nikhahit: \u0E4D
// - Yamakkan: \u0E4E
//
// These classes of Thai characters have a specific legitimate order.
// - Tone marks/Pinthu/Thanthakat/Nikhahit/Yamakkan can't immediately come after lead and follow vowels
// - Tone marks/Pinthu/Thanthakat/Nikhahit/Yamakkan can't immediately come before above and below vowels
//
// Five or more repeating consonants in a row is likely a non-formal spelling or difficult to read.
const STRUCTURE_REGEX = new RegExp(''
  + /[\u0E01-\u0E4Ea-zA-Z.,\-"'“”‘’\u0060?!:;]{55,}|/  // no running 55+ non-whitespace chars
  + /[\u0E40\u0E41\u0E42\u0E43\u0E44]{2,}|/  // no repeat: lead vowels
  + /[\u0E32\u0E33\u0E45]{2,}|/  // no repeat: follow vowels
  + /\u0E30{2,}|/  // no repeat: Sara A
  + /[\u0E30][\u0E32\u0E33\u0E45]|/  // invalid sequence: Sara A + [Sara Aa, Sara Am, Lakkhangyao]
  + /[\u0E33\u0E45][\u0E30]|/  // invalid sequence: [Sara Am, Lakkhangyao] + Sara A
  + /[\u0E31\u0E34\u0E35\u0E36\u0E37\u0E4D\u0E47]{2,}|/  // no repeat: above vowels
  + /[\u0E38\u0E39]{2,}|/ // no repeat: below vowels
  + /[\u0E48\u0E49\u0E4A\u0E4B]{2,}|/  // no repeat: tone marks
  + /\u0E3A{2,}|/  // no repeat: Phinthu
  + /\u0E4C{2,}|/  // no repeat: Thanthakhat
  + /\u0E4D{2,}|/  // no repeat: Nikhahit
  + /\u0E4E{2,}|/  // no repeat: Yamakkan
  + /[\u0E40\u0E41\u0E42\u0E43\u0E44\u0E30\u0E32\u0E33\u0E45][\u0E48\u0E49\u0E4A\u0E4B\u0E3A\u0E4C\u0E4D\u0E4E]|/  // invalid sequence: symbols after lead/follow vowels
  + /[\u0E48\u0E49\u0E4A\u0E4B\u0E3A\u0E4C\u0E4D\u0E4E][\u0E31\u0E34\u0E35\u0E36\u0E37\u0E4D\u0E47\u0E38\u0E39]|/  // invalid sequence: symbols before above/below vowels
  + /(.)\1{6,}/  // no repeat: 7 or more same characters in a row
);

// These Thai chars cannot start the word:
// - All vowels except lead vowels
// - Tone marks
// - Phinthu, Thanthakhat, Nikhahit, Yamakkan
/* eslint-disable-next-line no-misleading-character-class */
const BEGIN_REGEX = /(^|\s+)[\u0E30\u0E32\u0E33\u0E45\u0E31\u0E34\u0E35\u0E36\u0E37\u0E4D\u0E47\u0E38\u0E39\u0E48\u0E49\u0E4A\u0E4B\u0E3A\u0E4C\u0E4D\u0E4E]/;
// These Thai chars cannot end the word:
// - Lead vowels
/* eslint-disable-next-line no-misleading-character-class */
const END_REGEX = /[\u0E40\u0E41\u0E42\u0E43\u0E44](\s+|$)/;

// The following symbols are disallowed,
// please update here as well and not just the regex
// to make it easier to read:
// < > + * \ # @ ^ [ ] ( ) /
// Paiyannoi: \u0E2F ฯ (ellipsis, abbreviation)
// Maiyamok: \u0E46 ๆ (repetition)
// Fongman: \u0E4F ๏ (used as bullet)
// Angkhankhu: \u0E5A ๚ (used to mark end of section/verse)
// Khomut: \u0E5B ๛ (used to mark end of chapter/document)
// Latin characters (difficult to pronounce)
// Emoji range from https://www.regextester.com/106421 and
// https://stackoverflow.com/questions/10992921/how-to-remove-emoji-code-using-javascript
const SYMBOL_REGEX = new RegExp(''
  + /[<>+*\\#@^[\]()/\u0E2F\u0E46\u0E4F\u0E5A\u0E5B]|/  // symbols and Thai symbols
  + /[A-Za-z]|/  // Latin chars
  + /(\u00a9|\u00ae|[\u2000-\u3300]|[\u2580-\u27bf]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[\ue000-\uf8ff])/  // emojis
);

// Any words consisting of letters with a period
// inbetween are considered abbreviations or acronyms.
// Abbreviations in Latin chars are disallowed by SYMBOL_REGEX already.
const ABBREVIATION_REGEX = /[ก-ฮ]+\.([ก-ฮ]+\.)+/;

module.exports = {
  filterNumbers,
  filterAbbreviations,
  filterSymbols,
  filterStructure,
  filterLength,
};

function filterNumbers(sentence) {
  return !sentence.match(NUMBERS_REGEX);
}

function filterAbbreviations(sentence) {
  return !sentence.match(ABBREVIATION_REGEX);
}

function filterSymbols(sentence) {
  return !sentence.match(SYMBOL_REGEX);
}

function filterStructure(sentence) {
  return !(sentence.match(STRUCTURE_REGEX)
    || sentence.match(BEGIN_REGEX)
    || sentence.match(END_REGEX));
}

function filterLength(sentence) {
  return sentence.length >= MIN_LENGTH
    && sentence.length <= MAX_LENGTH;
}
