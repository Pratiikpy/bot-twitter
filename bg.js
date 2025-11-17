// bg.js — Enhanced background script with storage-based configuration and anti-repetition

let cachedConfig = null;

// Anti-repetition system
const replyHistory = new Set();
const MAX_HISTORY_SIZE = 500;

// Default configuration
const DEFAULT_CONFIG = {
  anthropic_api_key: '',
  model: 'claude-3-haiku-20240307',
  temperature: 0.8,
  system_prompt: `You are a witty, opinionated, and relatable crypto-Twitter degen. You sound like a real person on CT: casual, funny, sharp, and a bit salty when needed. You're not a bot — you're a trader who tweets. Your tone is natural and punchy, never robotic. Write like a human with a 9th-grade reading level. Use real words. Be short, clear, and clever. No jargon. No metaphors. No fluff. No emojis. No gibberish. No random characters. Never ask questions unless it really fits. Your replies must: Stay under 20 words Be about crypto, trading, or finance only Use slight CT slang when natural (e.g. "rekt", "cope", "L", "exit pump", "zero soon", "devs do something") Be funny, savage, or hype, depending on the tweet Use proper grammar, but casual speech is fine (e.g. "ain't", dropping subjects, CT style) Tag a project if it's mentioned as @Project, otherwise use the project name plainly You are here to entertain, engage, and sound real. Never go off-topic. Never act like a bot. Never be cringe. Always use real words. Sound like a real human, not an AI assistant and also dont use any emoji. NO HASHTAGS EVER. im giving you some convertional things but dont just copy it be natural understand my goal`
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'CLAUDE_DECIDE') return;

  console.log('🎯 Background: Tweet decision request:', msg.tweet?.substring(0, 50) + '...');

  (async () => {
    try {
      // Load config from storage
      const cfg = await loadConfig();
      
      if (!cfg.anthropic_api_key) {
        console.error('❌ No API key configured');
        sendResponse({ ok: false, should: false, text: '', error: 'API key not configured. Please set it in the bot settings.' });
        return;
      }

      if (!cfg.model) {
        console.error('❌ No model configured');
        sendResponse({ ok: false, should: false, text: '', error: 'Model not configured' });
        return;
      }

      // Generate context-aware prompt
      const contextPrompt = generateContextPrompt(msg.tweet, msg.context, cfg);

      const payload = {
        model: cfg.model,
        temperature: getTemperatureForTone(msg.context?.settings?.tone, cfg.temperature),
        max_tokens: getMaxTokensForLength(msg.context?.settings?.lengthMode),
        system: cfg.system_prompt,
        messages: [
          {
            role: 'user',
            content: contextPrompt
          }
        ]
      };

      console.log('🤖 Calling Claude API with context-aware prompt...');
      console.log('📊 Using model:', cfg.model, 'Temperature:', payload.temperature);

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': cfg.anthropic_api_key,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API error:', res.status, errorText);
        
        let errorMsg = `API error: ${res.status}`;
        if (res.status === 401) {
          errorMsg = 'Invalid API key. Please check your Anthropic API key in settings.';
        } else if (res.status === 429) {
          errorMsg = 'Rate limit exceeded. Please wait before trying again.';
        } else if (res.status === 400) {
          errorMsg = 'Bad request. Check your prompt and model settings.';
        }
        
        sendResponse({ ok: false, should: false, text: '', error: errorMsg });
        return;
      }

      const data = await res.json();
      console.log('📨 Claude response received');

      const content = data?.content?.[0]?.text?.trim();
      if (!content) {
        console.error('❌ No content in response');
        sendResponse({ ok: false, should: false, text: '', error: 'No content in Claude response' });
        return;
      }

      console.log('🎭 Claude decision:', content);

      // Parse and validate response
      let should = false;
      let replyText = '';

      if (content.toUpperCase().startsWith('YES:')) {
        const potentialReply = content.slice(4).trim();
        
        if (isValidReply(potentialReply, msg.context?.settings)) {
          should = true;
          replyText = potentialReply;
          console.log('👍 Claude says YES (validated):', replyText);
        } else {
          console.log('❌ Rejecting invalid reply:', potentialReply);
          should = false;
        }
      } else if (content.toUpperCase().startsWith('NO')) {
        should = false;
        console.log('👎 Claude says NO');
      } else {
        should = false;
        console.log('👎 Invalid format, treating as NO');
      }

      const response = { ok: true, should, text: replyText };
      console.log('✅ Final response:', response);
      sendResponse(response);

    } catch (e) {
      console.error('❌ Error:', e);
      sendResponse({ ok: false, should: false, text: '', error: String(e) });
    }
  })();

  return true;
});

// Load configuration from Chrome storage
async function loadConfig() {
  try {
    // Try to get from cache first
    if (cachedConfig) {
      return cachedConfig;
    }

    const result = await chrome.storage.local.get(['apiConfig']);
    
    if (result.apiConfig) {
      cachedConfig = { ...DEFAULT_CONFIG, ...result.apiConfig };
      console.log('✅ Config loaded from storage');
    } else {
      // First run - save default config
      cachedConfig = { ...DEFAULT_CONFIG };
      await chrome.storage.local.set({ apiConfig: cachedConfig });
      console.log('✅ Default config initialized');
    }

    return cachedConfig;
  } catch (error) {
    console.error('❌ Config load error:', error);
    return DEFAULT_CONFIG;
  }
}

// Clear config cache when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.apiConfig) {
    console.log('🔄 Config updated, clearing cache');
    cachedConfig = null;
  }
});

// Generate context-aware prompts based on page type and settings
function generateContextPrompt(tweet, context, cfg) {
  const settings = context?.settings || {};
  const pageType = context?.pageType || 'unknown';
  const metrics = context?.metrics || {};
  
  let toneInstructions = getToneInstructions(settings.tone);
  let lengthInstructions = getLengthInstructions(settings.lengthMode);
  let emojiInstructions = getEmojiInstructions(settings.emojiPolicy);
  let hashtagInstructions = getHashtagInstructions(settings.hashtagPolicy);
  let pageContextInstructions = getPageContextInstructions(pageType);
  
  const contextPrompt = `You are a witty crypto Twitter user. Reply naturally and authentically.

CONTEXT: You're on a ${pageType} page. This tweet has ${metrics.likes || 0} likes, ${metrics.retweets || 0} retweets.

${toneInstructions}
${lengthInstructions}
${emojiInstructions}
${hashtagInstructions}
${pageContextInstructions}

CRITICAL ANTI-REPETITION RULES:
- NEVER repeat the same phrases like "gm fam", "lfg", "this is the way"
- ALWAYS vary your responses - be creative and original each time  
- AVOID generic responses that sound copy-pasted
- Mix up your crypto slang and expressions
- Use different sentence structures and approaches
- Be spontaneous and authentic, not robotic

CRITICAL RULES:
- NEVER use AI phrases like "Thank you for sharing", "Great question", "Hope this helps"
- NEVER use corporate language like "leverage", "utilize", "facilitate"
- NEVER be overly polite or formal
- Sound like a real crypto Twitter user, not an AI assistant
- Use crypto slang naturally: gm, lfg, wagmi, ngmi, rekt, moon, hodl

EXAMPLES OF GOOD REPLIES (but don't copy these exactly):
- facts bro
- ngl this hits different  
- WAGMI fr
- bullish af on this
- sheesh that's wild
- cope harder
- diamond hands energy
- few understand this

EXAMPLES OF BAD REPLIES (NEVER DO):
- Thank you for sharing this insightful perspective
- I appreciate your analysis of the market
- This is indeed a comprehensive overview
- Repeating exact same phrases you've used before
- Using quotation marks around your reply like "this"

CRITICAL FORMATTING RULES:
- NEVER put quotation marks around your reply
- NEVER use quotes like "your reply here"
- Reply should be plain text without any wrapping punctuation
- Just write the reply directly without quotes

DECISION FORMAT (EXACTLY):
If engaging: "YES: your authentic unique reply"
If not engaging: "NO"

Tweet: "${tweet}"

Your decision:`;

  return contextPrompt;
}

function getToneInstructions(tone) {
  switch (tone) {
    case 'casual':
      return 'TONE: Be casual and laid-back. Use lowercase, natural speech, be chill.';
    case 'hype':
      return 'TONE: Be excited and energetic! Use caps for emphasis, show enthusiasm.';
    case 'skeptical':
      return 'TONE: Be slightly skeptical and questioning. Use phrases like "ngl", "idk about this".';
    case 'neutral':
      return 'TONE: Be balanced and matter-of-fact. No extreme emotions.';
    case 'sarcastic':
      return 'TONE: Be witty and slightly sarcastic. Use subtle humor.';
    default:
      return 'TONE: Be natural and authentic.';
  }
}

function getLengthInstructions(lengthMode) {
  switch (lengthMode) {
    case 'ultra-short':
      return 'LENGTH: Keep replies 1-5 words maximum. Be extremely concise.';
    case 'short':
      return 'LENGTH: Keep replies 6-10 words maximum. Be brief and punchy.';
    case 'medium':
      return 'LENGTH: Keep replies 11-15 words maximum. Be concise but complete.';
    case 'max':
      return 'LENGTH: Keep replies 16-20 words maximum. You can be more expressive.';
    default:
      return 'LENGTH: Keep replies under 15 words.';
  }
}

function getEmojiInstructions(emojiPolicy) {
  switch (emojiPolicy) {
    case 'none':
      return 'EMOJIS: Never use any emojis. Text only.';
    case 'rare':
      return 'EMOJIS: Very rarely use emojis. Maybe 1 in 10 replies.';
    case 'moderate':
      return 'EMOJIS: Use emojis occasionally when they add value.';
    case 'frequent':
      return 'EMOJIS: Use emojis regularly to express emotions.';
    default:
      return 'EMOJIS: No emojis unless really necessary.';
  }
}

function getHashtagInstructions(hashtagPolicy) {
  switch (hashtagPolicy) {
    case 'never':
      return 'HASHTAGS: NEVER use hashtags (#). Forbidden completely.';
    case 'rare':
      return 'HASHTAGS: Very rarely use hashtags. Only if absolutely necessary.';
    case 'topic-based':
      return 'HASHTAGS: Use hashtags only when discussing specific trending topics.';
    default:
      return 'HASHTAGS: Avoid hashtags unless really needed.';
  }
}

function getPageContextInstructions(pageType) {
  switch (pageType) {
    case 'search':
      return 'CONTEXT: This is from search results. Be more targeted and relevant to the search topic.';
    case 'hashtag':
      return 'CONTEXT: This is from a hashtag page. Be topic-focused and engaged with the trend.';
    case 'community':
      return 'CONTEXT: This is from a community. Be respectful of community norms and more collaborative.';
    case 'profile':
      return 'CONTEXT: This is from someone\'s profile. Be more respectful and less aggressive.';
    case 'explore':
      return 'CONTEXT: This is from explore/trending. Be engaging with viral/trending content.';
    default:
      return 'CONTEXT: Standard timeline interaction.';
  }
}

function getTemperatureForTone(tone, defaultTemp = 0.8) {
  switch (tone) {
    case 'hype': return Math.min(defaultTemp + 0.1, 1.0);
    case 'sarcastic': return defaultTemp;
    case 'casual': return Math.max(defaultTemp - 0.1, 0.1);
    case 'neutral': return Math.max(defaultTemp - 0.2, 0.1);
    case 'skeptical': return Math.max(defaultTemp - 0.05, 0.1);
    default: return defaultTemp;
  }
}

function getMaxTokensForLength(lengthMode) {
  switch (lengthMode) {
    case 'ultra-short': return 30;
    case 'short': return 50;
    case 'medium': return 70;
    case 'max': return 90;
    default: return 60;
  }
}

// Calculate text similarity using Levenshtein distance
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

// Enhanced validation with settings-aware filtering and anti-repetition
function isValidReply(text, settings = {}) {
  if (!text || text.length < 2) {
    console.log('❌ Too short');
    return false;
  }
  
  console.log(`🧪 Validating reply: "${text}"`);
  
  // NEW: Check for quotation marks wrapping (looks unnatural on Twitter)
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    console.log('🚫 REJECTED: Reply wrapped in quotation marks');
    return false;
  }
  
  // NEW: Check for repetitive replies
  const normalizedText = text.toLowerCase().trim().replace(/[^\w\s]/g, '');
  
  // Check if we've used this exact reply recently
  if (replyHistory.has(normalizedText)) {
    console.log('🚫 REJECTED: Duplicate reply detected');
    return false;
  }
  
  // Check for similar replies (fuzzy matching)
  for (const pastReply of replyHistory) {
    const similarity = calculateSimilarity(normalizedText, pastReply);
    if (similarity > 0.8) { // 80% similarity threshold
      console.log(`🚫 REJECTED: Too similar to past reply (${Math.round(similarity * 100)}% similar)`);
      return false;
    }
  }
  
  // Hashtag policy enforcement
  if (settings.hashtagPolicy === 'never' && text.includes('#')) {
    console.log('🚫 REJECTED: Contains hashtag (policy: never)');
    return false;
  }
  
  // Word count validation based on length mode
  const words = text.trim().split(/\s+/);
  let maxWords = 20;
  
  switch (settings.lengthMode) {
    case 'ultra-short': maxWords = 5; break;
    case 'short': maxWords = 10; break;
    case 'medium': maxWords = 15; break;
    case 'max': maxWords = 20; break;
  }
  
  if (words.length > maxWords) {
    console.log(`🚫 REJECTED: Too many words (${words.length}/${maxWords} max for ${settings.lengthMode} mode)`);
    return false;
  }
  
  console.log(`✅ Word count: ${words.length}/${maxWords} (${settings.lengthMode} mode)`);
  
  const lowerText = text.toLowerCase();
  let humanScore = 0;
  let aiPenalty = 0;
  
  // AI red flags detection
  const aiRedFlags = [
    'as an ai', 'i appreciate', 'thank you for sharing', 'great question',
    'i understand your concern', 'hope this helps', 'best regards', 
    'leverage', 'utilize', 'facilitate', 'comprehensive', 'furthermore',
    'moreover', 'consequently', 'nevertheless', 'indeed', 'certainly'
  ];
  
  for (const flag of aiRedFlags) {
    if (lowerText.includes(flag)) {
      aiPenalty += 5;
      console.log(`🚨 AI red flag: "${flag}" (-5)`);
    }
  }
  
  // Human indicators
  const humanIndicators = [
    'gm', 'gn', 'lfg', 'wagmi', 'ngmi', 'rekt', 'moon', 'lol', 'lmao',
    'ngl', 'fr', 'bet', 'damn', 'bruh', 'yo', 'tbh', 'nah', 'facts',
    'sheesh', 'lowkey', 'highkey', 'cap', 'no cap', 'based', 'cringe',
    'af', 'deadass', 'fr fr', 'no shot'
  ];
  
  for (const indicator of humanIndicators) {
    if (lowerText.includes(indicator)) {
      humanScore += 2;
      console.log(`✅ Human indicator: "${indicator}" (+2)`);
    }
  }
  
  // Crypto slang bonus
  const cryptoSlang = [
    'hodl', 'diamond hands', 'paper hands', 'ape', 'degen', 'ser', 'wen',
    'gwei', 'sats', 'btfd', 'ath', 'btc', 'eth', 'defi', 'nft'
  ];
  
  for (const slang of cryptoSlang) {
    if (lowerText.includes(slang)) {
      humanScore += 3;
      console.log(`💎 Crypto slang: "${slang}" (+3)`);
    }
  }
  
  // Natural speech patterns
  const hasTypos = /\b(ur|u|rly|w\/|smth|ppl|af|fr|til|cuz)\b/.test(lowerText);
  const hasLowercase = /^[a-z]/.test(text);
  const hasCapitalizedWords = /\b[A-Z]{2,}\b/.test(text);
  
  if (hasTypos) { humanScore += 2; console.log('✅ Natural abbreviations (+2)'); }
  if (hasLowercase) { humanScore += 1; console.log('✅ Casual start (+1)'); }
  if (hasCapitalizedWords) { humanScore += 1; console.log('✅ Emphasis caps (+1)'); }
  
  // Emoji policy validation
  const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(text);
  if (settings.emojiPolicy === 'none' && hasEmojis) {
    aiPenalty += 3;
    console.log('🚫 Contains emojis (policy: none) (-3)');
  }
  
  // Quality checks
  if (text.length > 120) {
    aiPenalty += 2;
    console.log('🚫 Too long for casual reply (-2)');
  }
  
  // Check for garbled text
  const garbledPattern = /^[^a-zA-Z\s]{3,}|[!@#$%^&*()_+={}\[\]|\\:";'<>?,./]{5,}/;
  if (garbledPattern.test(text)) {
    aiPenalty += 10;
    console.log('🚫 Garbled text (-10)');
  }
  
  const finalScore = humanScore - aiPenalty;
  const isValid = finalScore >= 1;
  
  console.log(`🏆 Final validation: ${humanScore} human - ${aiPenalty} AI = ${finalScore} (Valid: ${isValid})`);
  
  // If valid, add to history
  if (isValid) {
    replyHistory.add(normalizedText);
    
    // Clean up history if it gets too large
    if (replyHistory.size > MAX_HISTORY_SIZE) {
      const oldEntries = Array.from(replyHistory).slice(0, 100);
      oldEntries.forEach(entry => replyHistory.delete(entry));
      console.log('🧹 Cleaned up old reply history');
    }
  }
  
  return isValid;
}