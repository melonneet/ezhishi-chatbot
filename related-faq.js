const natural = require('natural');
const compromise = require('compromise');
const path = require('path');
const fs = require('fs');

class RelatedFAQ {
  constructor(faqQuestions, semanticModel = null) {
    this.faqQuestions = faqQuestions;
    this.tfidf = new natural.TfIdf();
    faqQuestions.forEach(q => this.tfidf.addDocument(q));
    this.semanticModel = semanticModel; // Optional: pass in your loaded transformer pipeline
    
    // Build spellcheck dictionary from all terms in FAQs
    this.buildSpellcheckDictionary();
  }

  buildSpellcheckDictionary() {
    const allTerms = new Set();
    this.faqQuestions.forEach((q, idx) => {
      this.tfidf.listTerms(idx).forEach(({ term }) => {
        if (term.length >= 3 && /^[a-zA-Z]+$/.test(term)) {
          allTerms.add(term.toLowerCase());
        }
      });
    });
    this.spellcheck = new natural.Spellcheck([...allTerms]);
    console.log(`📚 Built spellcheck dictionary with ${allTerms.size} terms`);
  }

  correctQuery(query) {
    return query
      .split(/\b/)                     // split on word boundaries
      .map(token => {
        const lower = token.toLowerCase();
        // only try to correct alphabetic tokens longer than 2 chars
        if (/^[a-z]{3,}$/.test(lower)) {
          if (!this.spellcheck.isCorrect(lower)) {
            const corrections = this.spellcheck.getCorrections(lower, 1);
            if (corrections.length > 0) {
              const best = corrections[0];
              console.log(`🔤 Spell correction: "${token}" → "${best}"`);
              return best;
            }
          }
        }
        return token;
      })
      .join("");
  }

  getTfidfMap(docIndex) {
    return this.tfidf.listTerms(docIndex)
      .filter(item => !natural.stopwords.includes(item.term))
      .reduce((map, { term, tfidf: w }) => { map[term] = w; return map; }, {});
  }

  cosineSim(mapA, mapB) {
    let dot = 0, magA = 0, magB = 0;
    for (const [t, w] of Object.entries(mapA)) {
      magA += w * w;
      if (mapB[t]) dot += w * mapB[t];
    }
    for (const w of Object.values(mapB)) magB += w * w;
    if (!dot || !magA || !magB) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  extractKeywords(text, topK = 3) {
    const doc = compromise(text);
    const chunks = doc.match('#Noun+').out('array');
    const verbs = doc.verbs().out('array');
    const candidates = Array.from(new Set([...chunks, ...verbs].map(c => c.toLowerCase().trim())));
    // Score by TF-IDF
    const docIndex = this.faqQuestions.indexOf(text);
    const tfidfMap = this.getTfidfMap(docIndex);
    return candidates
      .map(phrase => {
        const tokens = phrase.split(/\s+/).filter(t => tfidfMap[t]);
        if (!tokens.length) return null;
        const avg = tokens.reduce((sum, t) => sum + tfidfMap[t], 0) / tokens.length;
        return { phrase, score: avg };
      })
      .filter(x => x)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(x => x.phrase);
  }

  // Semantic similarity using transformer model (if available)
  async semanticSimilarity(userQuery, topN = 3) {
    if (!this.semanticModel) return [];
    const userVec = await this.semanticModel(userQuery, { pooling: 'mean', normalize: true });
    const results = [];
    for (let i = 0; i < this.faqQuestions.length; i++) {
      const faqVec = await this.semanticModel(this.faqQuestions[i], { pooling: 'mean', normalize: true });
      // Cosine similarity
      let dot = 0, magA = 0, magB = 0;
      for (let j = 0; j < userVec.data.length; j++) {
        dot += userVec.data[j] * faqVec.data[j];
        magA += userVec.data[j] ** 2;
        magB += faqVec.data[j] ** 2;
      }
      const sim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
      results.push({ idx: i, sim });
    }
    return results.sort((a, b) => b.sim - a.sim).slice(0, topN);
  }

  // Main: get top related questions (hybrid) with spell correction
  async relatedQuestionKeywords(userQuery, topN = 3, topK = 3) {
    // 1) Spell-correct the user query
    const corrected = this.correctQuery(userQuery);
    if (corrected !== userQuery) {
      console.log(`🔤 Corrected query: "${userQuery}" → "${corrected}"`);
    }
    
    // 2) Use corrected query for TF-IDF
    this.tfidf.addDocument(corrected);
    const userIdx = this.faqQuestions.length;
    const userMap = this.getTfidfMap(userIdx);
    const sims = this.faqQuestions.map((_, i) => ({
      idx: i,
      sim: this.cosineSim(this.getTfidfMap(i), userMap)
    }));
    this.tfidf.documents.pop();

    // 3) Semantic similarity (if available) - use corrected query
    let semResults = [];
    if (this.semanticModel) {
      semResults = await this.semanticSimilarity(corrected, topN + 2);
    }

    // 4) Merge, dedupe, and sort
    const all = [...sims, ...semResults].sort((a, b) => b.sim - a.sim);
    const seen = new Set();
    const top = [];
    for (const r of all) {
      if (!seen.has(r.idx) && this.faqQuestions[r.idx] !== corrected) {
        seen.add(r.idx);
        top.push(r);
      }
      if (top.length >= topN) break;
    }

    // 5) Build result
    return top.map(({ idx, sim }) => ({
      question: this.faqQuestions[idx],
      similarity: sim.toFixed(3),
      keywords: this.extractKeywords(this.faqQuestions[idx], topK)
    }));
  }
}

module.exports = RelatedFAQ; 