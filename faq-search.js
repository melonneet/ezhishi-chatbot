const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

// 1. Load your FAQ data
const faqs = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'data/faqs_updated_full.json'), 'utf8')
);

// 2. Flatten into bilingual “documents”
const faqDocs = faqs.flatMap((faq, idx) => {
  const docs = [
    {
      id: `${idx}-en`,
      text: faq.questionEn.trim(),
      answer: faq.answer.trim(),
    },
    {
      id: `${idx}-zh`,
      text: faq.questionZh.trim(),
      answer: faq.answer.trim(),
    }
  ];
  // Add alternate English questions
  if (faq.alternateQuestionsEn && Array.isArray(faq.alternateQuestionsEn)) {
    docs.push(...faq.alternateQuestionsEn.map((alt, i) => ({
      id: `${idx}-en-alt${i}`,
      text: alt.trim(),
      answer: faq.answer.trim(),
    })));
  }
  // Add alternate Chinese questions
  if (faq.alternateQuestionsZh && Array.isArray(faq.alternateQuestionsZh)) {
    docs.push(...faq.alternateQuestionsZh.map((alt, i) => ({
      id: `${idx}-zh-alt${i}`,
      text: alt.trim(),
      answer: faq.answer.trim(),
    })));
  }
  return docs;
});

console.log('Loaded FAQ docs:', faqDocs.map(d => d.text));

// 3. Fuse.js setup for typo-tolerant English fallback
const fuse = new Fuse(faqDocs, {
  keys: ['text'],
  threshold: 0.45, // typo-tolerant but not too loose
  minMatchCharLength: 2,
  includeScore: true,
});

function findBestMatch(rawQuery) {
  const raw = (rawQuery || '').trim();
  const qLower = raw.toLowerCase();
  let match = null;

  // 1) Quick English substring match (case‑insensitive)
  match = faqDocs.find(doc =>
    doc.text.toLowerCase().includes(qLower)
  );
  if (match) {
    console.log(`[FAQ-MATCH] EN substring: "${raw}" → "${match.text}"`);
    return match;
  }

  // 2) If query contains any non‑ASCII (likely Chinese), do char‑by‑char match
  if (/[^\u0000-\u007f]/.test(raw)) {
    // keep only CJK characters
    const chineseChars = raw.replace(/[^\u4E00-\u9FFF]/g, '');
    if (chineseChars.length >= 2) { // require at least 2 chars for a match
      match = faqDocs.find(doc => {
        // strip punctuation/whitespace from doc text
        const docNorm = doc.text.replace(/[\p{P}\p{S}\s]+/gu, '');
        // require at least N-1 of N chars to match for longer queries
        const chars = chineseChars.split('');
        const matchCount = chars.filter(ch => docNorm.includes(ch)).length;
        return matchCount >= Math.max(1, chars.length - 1);
      });
      if (match) {
        console.log(`[FAQ-MATCH] ZH char-match: "${raw}" → "${match.text}"`);
        return match;
      }
    }
  }

  // 3) English fallback: require all words to appear
  const terms = qLower
    .split(/\W+/)
    .filter(Boolean);
  if (terms.length > 0) {
    match = faqDocs.find(doc => {
      const txt = doc.text.toLowerCase();
      return terms.every(term => txt.includes(term));
    });
    if (match) {
      console.log(`[FAQ-MATCH] EN all-words: "${raw}" → "${match.text}"`);
      return match;
    }
  }

  // 4) Fuzzy/typo-tolerant English fallback (Fuse.js)
  const fuseResults = fuse.search(raw);
  if (fuseResults.length > 0 && fuseResults[0].score < 0.45) {
    match = fuseResults[0].item;
    console.log(`[FAQ-MATCH] EN fuzzy: "${raw}" → "${match.text}" (score: ${fuseResults[0].score})`);
    return match;
  }

  // No match found
  console.log(`[FAQ-MATCH] NO MATCH: "${raw}"`);
  return null;
}

// Simple CLI test for direct search
if (require.main === module) {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.log('Usage: node faq-search.js <your question>');
    process.exit(1);
  }
  const result = findBestMatch(query);
  if (result) {
    console.log('\nBest match:');
    console.log('Q:', result.text);
    console.log('A:', result.answer);
  } else {
    console.log('No match found.');
  }
}

module.exports = { findBestMatch }; 