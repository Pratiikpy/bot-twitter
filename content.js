/* Enhanced Universal Twitter Bot - Works on ALL x.com pages with full control and API management */

console.log('🚀 [Universal Twitter Bot v2.1] Starting with enhanced configuration...');

// Bot state with enhanced API configuration
let botState = {
  active: false,
  busy: false,
  lastAction: 0,
  lastActivityTime: Date.now(), // Track last activity for stuck detection
  commentTimestamps: [], // Track comment times for rate limiting
  lastBreakTime: Date.now(), // Track breaks
  tweetsScrolledSinceComment: 0, // Track tweets between comments
  currentMood: 'normal', // Session mood: active, normal, passive
  lastMoodChange: Date.now(), // When mood last changed
  // NEW: Stuck detection
  currentTweetId: null, // Currently processing tweet ID
  currentTweetStartTime: null, // When we started processing this tweet
  stuckCheckInterval: null, // Interval for checking if stuck
  stats: {
    commentsPosted: 0,
    tweetsLiked: 0,
    pagesVisited: 0,
    apiCalls: 0,
    sessionStart: Date.now(),
    successRate: 0,
    totalAttempts: 0,
    autoRefreshes: 0,
    tweetsScrolled: 0,
    breaksTaken: 0,
    commentsAbandoned: 0,
    modalsEscaped: 0
  },
  settings: {
    tone: 'casual',
    lengthMode: 'short',
    emojiPolicy: 'none',
    hashtagPolicy: 'never',
    cooldown: 8000,
    minLikes: 0,
    minFollowers: 0,
    // Rate limiting settings
    commentsPerMinute: 2, // Max comments per minute (1-3)
    minCommentInterval: 20000, // Minimum time between comments in ms (20 seconds default)
    // Human-like behavior settings
    enableMouseMovement: true, // Random mouse movements
    enableAutoRefresh: true, // Auto-refresh if stuck
    stuckThresholdMinutes: 5, // Refresh if no activity for this many minutes
    // NEW: Advanced human-like behaviors
    enableReadingTime: true, // Simulate reading before commenting
    readingTimeMin: 3, // Min seconds to "read" a tweet
    readingTimeMax: 10, // Max seconds to "read" a tweet
    engagementProbability: 15, // % chance to engage with a valid tweet (10-30%)
    enableRandomBreaks: true, // Take random breaks
    breakIntervalMin: 20, // Min minutes between breaks
    breakIntervalMax: 45, // Max minutes between breaks
    breakDurationMin: 60, // Min break duration in seconds
    breakDurationMax: 180, // Max break duration in seconds
    enableRealisticTyping: true, // Variable typing speed + typos
    typingSpeedMin: 40, // Min ms per character
    typingSpeedMax: 120, // Max ms per character
    typoChance: 8, // % chance of typo per comment
    enableSessionMoods: true, // Change behavior based on "mood"
    moodChangeInterval: 25, // Change mood every X minutes
    skipTweetsBetweenComments: true, // Don't comment consecutively
    minTweetsToSkip: 2, // Min tweets to skip between comments
    maxTweetsToSkip: 6, // Max tweets to skip between comments
    enableMediaDetection: true, // Pause for images/videos
    mediaViewTimeMin: 2, // Min seconds to "view" media
    mediaViewTimeMax: 5, // Max seconds to "view" media
    abandonCommentChance: 5, // % chance to start then abandon comment
    enabledPages: {
      home: true,
      search: true,
      hashtag: true,
      profile: true,
      community: true,
      lists: true,
      explore: true
    }
  },
  apiConfig: {
    apiKey: '',
    model: 'claude-3-haiku-20240307',
    temperature: 0.8,
    systemPrompt: ''
  }
};

const processedTweets = new Set();
const likedTweets = new Set();
const repliedTweets = new Set();

const POLL_MS = 250;
const POLL_MAX = 20;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const poll = async (fn, n = POLL_MAX) => {
  while (n--) {
    const v = fn();
    if (v) return v;
    await sleep(POLL_MS);
  }
  return null;
};

// NEW: Rate limiting - check if we can comment based on rate limit settings
function canCommentNow() {
  const now = Date.now();
  const { commentsPerMinute, minCommentInterval } = botState.settings;

  // Check minimum interval between comments
  if (now - botState.lastAction < minCommentInterval) {
    console.log(`⏳ Rate limit: Waiting ${Math.round((minCommentInterval - (now - botState.lastAction)) / 1000)}s before next comment`);
    return false;
  }

  // Clean up old timestamps (older than 1 minute)
  const oneMinuteAgo = now - 60000;
  botState.commentTimestamps = botState.commentTimestamps.filter(t => t > oneMinuteAgo);

  // Check comments per minute limit
  if (botState.commentTimestamps.length >= commentsPerMinute) {
    const oldestTimestamp = Math.min(...botState.commentTimestamps);
    const waitTime = Math.round((60000 - (now - oldestTimestamp)) / 1000);
    console.log(`⏳ Rate limit: ${botState.commentTimestamps.length}/${commentsPerMinute} comments in last minute. Wait ${waitTime}s`);
    return false;
  }

  return true;
}

// NEW: Record a comment for rate limiting
function recordComment() {
  botState.commentTimestamps.push(Date.now());
  botState.lastActivityTime = Date.now();
}

// NEW: Simulate random mouse movements to appear more human-like
function simulateMouseMovement() {
  if (!botState.settings.enableMouseMovement) return;

  try {
    const randomX = Math.floor(Math.random() * window.innerWidth);
    const randomY = Math.floor(Math.random() * window.innerHeight);

    // Create and dispatch a mousemove event
    const event = new MouseEvent('mousemove', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: randomX,
      clientY: randomY
    });

    document.dispatchEvent(event);
    console.log(`🖱️ Mouse moved to (${randomX}, ${randomY})`);
  } catch (error) {
    console.log('⚠️ Mouse movement simulation failed:', error);
  }
}

// NEW: Check if bot is stuck and needs refresh
function checkIfStuckAndRefresh() {
  if (!botState.settings.enableAutoRefresh || !botState.active) return;

  const now = Date.now();
  const stuckThresholdMs = botState.settings.stuckThresholdMinutes * 60000;
  const timeSinceLastActivity = now - botState.lastActivityTime;

  if (timeSinceLastActivity > stuckThresholdMs) {
    console.log(`🔄 Bot stuck for ${Math.round(timeSinceLastActivity / 60000)} minutes. Refreshing to home feed...`);
    botState.stats.autoRefreshes++;
    botState.lastActivityTime = now;

    // Navigate to home feed
    if (window.location.pathname !== '/home') {
      window.location.href = 'https://x.com/home';
    } else {
      // Already on home, just refresh
      window.location.reload();
    }
  }
}

// NEW: Calculate realistic reading time based on tweet content
function calculateReadingTime(tweetText, article) {
  if (!botState.settings.enableReadingTime) return 0;

  const { readingTimeMin, readingTimeMax, mediaViewTimeMin, mediaViewTimeMax } = botState.settings;

  // Base reading time based on text length
  const wordCount = tweetText.split(/\s+/).length;
  const baseTime = Math.min(wordCount * 0.3, readingTimeMax); // ~200 WPM reading speed

  // Add time for media
  let mediaTime = 0;
  if (botState.settings.enableMediaDetection) {
    const hasImage = article.querySelector('img[src*="media"]') || article.querySelector('[data-testid="tweetPhoto"]');
    const hasVideo = article.querySelector('video') || article.querySelector('[data-testid="videoPlayer"]');
    const hasLink = article.querySelector('a[href*="http"]');

    if (hasImage) mediaTime += Math.random() * (mediaViewTimeMax - mediaViewTimeMin) + mediaViewTimeMin;
    if (hasVideo) mediaTime += Math.random() * (mediaViewTimeMax - mediaViewTimeMin) + mediaViewTimeMin + 2; // Videos take longer
    if (hasLink) mediaTime += 1; // Quick pause for links
  }

  // Random variance to look human
  const variance = (Math.random() - 0.5) * 2; // -1 to +1 seconds
  const totalTime = Math.max(readingTimeMin, Math.min(baseTime + mediaTime + variance, readingTimeMax + mediaTime));

  return totalTime * 1000; // Convert to milliseconds
}

// NEW: Check if bot should engage with this tweet (selective engagement)
function shouldEngageWithTweet() {
  // Check skip tweets between comments
  if (botState.settings.skipTweetsBetweenComments) {
    const { minTweetsToSkip, maxTweetsToSkip } = botState.settings;
    const requiredSkips = Math.floor(Math.random() * (maxTweetsToSkip - minTweetsToSkip + 1)) + minTweetsToSkip;

    if (botState.tweetsScrolledSinceComment < requiredSkips) {
      console.log(`⏭️ Skip requirement: ${botState.tweetsScrolledSinceComment}/${requiredSkips} tweets skipped`);
      return false;
    }
  }

  // Selective engagement probability (mood-adjusted)
  let engagementChance = botState.settings.engagementProbability;

  // Adjust based on mood
  if (botState.settings.enableSessionMoods) {
    if (botState.currentMood === 'active') {
      engagementChance *= 1.5; // 50% more likely to engage
    } else if (botState.currentMood === 'passive') {
      engagementChance *= 0.5; // 50% less likely to engage
    }
  }

  const roll = Math.random() * 100;
  const shouldEngage = roll < engagementChance;

  if (!shouldEngage) {
    console.log(`🎲 Engagement roll: ${roll.toFixed(1)}% < ${engagementChance.toFixed(1)}% threshold - skipping`);
  }

  return shouldEngage;
}

// NEW: Check if it's time for a break
async function checkAndTakeBreak() {
  if (!botState.settings.enableRandomBreaks || !botState.active) return;

  const now = Date.now();
  const { breakIntervalMin, breakIntervalMax, breakDurationMin, breakDurationMax } = botState.settings;

  const nextBreakInterval = (Math.random() * (breakIntervalMax - breakIntervalMin) + breakIntervalMin) * 60000;
  const timeSinceBreak = now - botState.lastBreakTime;

  if (timeSinceBreak > nextBreakInterval) {
    const breakDuration = (Math.random() * (breakDurationMax - breakDurationMin) + breakDurationMin) * 1000;
    console.log(`☕ Taking a ${Math.round(breakDuration / 1000)}s break (human behavior simulation)`);

    botState.stats.breaksTaken++;
    botState.lastBreakTime = now;
    botState.busy = true;

    await sleep(breakDuration);

    botState.busy = false;
    console.log(`✅ Break finished, resuming activity`);
  }
}

// NEW: Update session mood
function updateSessionMood() {
  if (!botState.settings.enableSessionMoods) return;

  const now = Date.now();
  const moodChangeInterval = botState.settings.moodChangeInterval * 60000;

  if (now - botState.lastMoodChange > moodChangeInterval) {
    const moods = ['active', 'normal', 'passive'];
    const weights = [0.25, 0.55, 0.20]; // 25% active, 55% normal, 20% passive

    const roll = Math.random();
    let cumulativeWeight = 0;
    let newMood = 'normal';

    for (let i = 0; i < moods.length; i++) {
      cumulativeWeight += weights[i];
      if (roll < cumulativeWeight) {
        newMood = moods[i];
        break;
      }
    }

    if (newMood !== botState.currentMood) {
      console.log(`🎭 Mood changed: ${botState.currentMood} → ${newMood}`);
      botState.currentMood = newMood;
      botState.lastMoodChange = now;
    }
  }
}

// NEW: Close comment modal by clicking the X button
function closeCommentModal() {
  try {
    // Find the modal dialog
    const modal = document.querySelector('[role="dialog"]');
    if (!modal) {
      console.log('ℹ️ No modal found to close');
      return false;
    }

    // Look for close button - Twitter uses an X button with aria-label "Close"
    const closeButton = modal.querySelector('[aria-label="Close"]') ||
                       modal.querySelector('[data-testid="app-bar-close"]') ||
                       modal.querySelector('button[aria-label="Close"]');

    if (closeButton) {
      console.log('❌ Clicking X button to close stuck modal');
      closeButton.click();
      botState.stats.modalsEscaped++;
      return true;
    } else {
      // Fallback to Escape key
      console.log('⎋ Using Escape key as fallback');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      botState.stats.modalsEscaped++;
      return true;
    }
  } catch (error) {
    console.error('❌ Error closing modal:', error);
    // Last resort: Escape key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return false;
  }
}

// NEW: Check if bot is stuck on same tweet for too long
function checkIfStuck() {
  if (!botState.busy || !botState.currentTweetId || !botState.currentTweetStartTime) {
    return; // Not processing anything, can't be stuck
  }

  const now = Date.now();
  const timeOnCurrentTweet = now - botState.currentTweetStartTime;
  const stuckThreshold = 2 * 60 * 1000; // 2 minutes in milliseconds

  if (timeOnCurrentTweet > stuckThreshold) {
    console.log(`⚠️ STUCK DETECTED! Been on tweet ${botState.currentTweetId} for ${Math.round(timeOnCurrentTweet / 1000)}s`);
    console.log('🔧 Attempting to close modal and move on...');

    // Close the modal
    const closed = closeCommentModal();

    if (closed) {
      // Clear current tweet tracking
      botState.currentTweetId = null;
      botState.currentTweetStartTime = null;
      botState.busy = false;

      // Scroll to next content
      console.log('📜 Scrolling to next tweet...');
      window.scrollBy({
        top: window.innerHeight * 0.8,
        behavior: 'smooth'
      });
    }
  }
}

// NEW: Start stuck checker when bot starts
function startStuckChecker() {
  if (botState.stuckCheckInterval) {
    clearInterval(botState.stuckCheckInterval);
  }

  // Check every 30 seconds
  botState.stuckCheckInterval = setInterval(checkIfStuck, 30000);
  console.log('🔍 Started stuck detection checker (checks every 30s)');
}

// NEW: Stop stuck checker when bot stops
function stopStuckChecker() {
  if (botState.stuckCheckInterval) {
    clearInterval(botState.stuckCheckInterval);
    botState.stuckCheckInterval = null;
    console.log('🛑 Stopped stuck detection checker');
  }
}

// NEW: Realistic typing with typos and corrections
async function typeRealisticComment(textBox, text) {
  if (!botState.settings.enableRealisticTyping) {
    // Fall back to old typing method
    for (const ch of text) {
      document.execCommand('insertText', false, ch);
      textBox.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
      await sleep(20 + Math.random() * 20);
    }
    return;
  }

  const { typingSpeedMin, typingSpeedMax, typoChance } = botState.settings;
  const shouldMakeTypo = Math.random() * 100 < typoChance;

  let currentText = '';
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isLastWord = i === words.length - 1;

    // Type word character by character
    for (let j = 0; j < word.length; j++) {
      const char = word[j];

      // Variable typing speed
      const typingDelay = Math.random() * (typingSpeedMax - typingSpeedMin) + typingSpeedMin;
      await sleep(typingDelay);

      // Maybe make a typo (only once per comment, mid-word)
      if (shouldMakeTypo && i === Math.floor(words.length / 2) && j === Math.floor(word.length / 2)) {
        // Type wrong character
        const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // random letter
        document.execCommand('insertText', false, wrongChar);
        textBox.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: wrongChar }));
        currentText += wrongChar;

        await sleep(200 + Math.random() * 300); // Pause (notice mistake)

        // Delete wrong character
        document.execCommand('delete', false);
        textBox.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        currentText = currentText.slice(0, -1);

        await sleep(100 + Math.random() * 100);
      }

      // Type correct character
      document.execCommand('insertText', false, char);
      textBox.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
      currentText += char;
    }

    // Add space after word (except last word)
    if (!isLastWord) {
      await sleep(typingSpeedMin); // Shorter delay for space
      document.execCommand('insertText', false, ' ');
      textBox.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' }));
      currentText += ' ';
    }

    // Random pause between words (thinking)
    if (i < words.length - 1 && Math.random() > 0.7) {
      await sleep(300 + Math.random() * 500);
    }
  }
}

// Load settings from storage with enhanced API config
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['botSettings', 'botStats', 'apiConfig']);
    
    if (result.botSettings) {
      botState.settings = { ...botState.settings, ...result.botSettings };
    }
    
    if (result.botStats) {
      botState.stats = { ...botState.stats, ...result.botStats };
    }
    
    if (result.apiConfig) {
      botState.apiConfig = { ...botState.apiConfig, ...result.apiConfig };
      console.log('✅ API config loaded:', {
        model: botState.apiConfig.model,
        temperature: botState.apiConfig.temperature,
        hasApiKey: !!botState.apiConfig.anthropic_api_key,
        hasPrompt: !!botState.apiConfig.system_prompt
      });
    }
    
    console.log('✅ All settings loaded successfully');
  } catch (error) {
    console.log('⚠️ Using default settings:', error);
  }
}

// Save settings to storage with enhanced API config
async function saveSettings() {
  try {
    await chrome.storage.local.set({
      botSettings: botState.settings,
      botStats: botState.stats,
      apiConfig: botState.apiConfig
    });
    console.log('💾 Settings saved to storage');
  } catch (error) {
    console.error('❌ Failed to save settings:', error);
  }
}

// Universal page detection
function detectPageInfo() {
  const url = window.location.href;
  const pathname = window.location.pathname;
  
  let pageType = 'unknown';
  let isValidPage = false;
  
  if (pathname === '/' || pathname === '/home') {
    pageType = 'home';
    isValidPage = botState.settings.enabledPages.home;
  } else if (url.includes('/search?q=')) {
    pageType = 'search';
    isValidPage = botState.settings.enabledPages.search;
  } else if (pathname.startsWith('/hashtag/')) {
    pageType = 'hashtag';
    isValidPage = botState.settings.enabledPages.hashtag;
  } else if (pathname.startsWith('/i/communities/') || pathname.match(/^\/[a-zA-Z0-9_]+\/communities/)) {
    pageType = 'community';
    isValidPage = botState.settings.enabledPages.community;
  } else if (pathname.match(/^\/[a-zA-Z0-9_]+$/)) {
    pageType = 'profile';
    isValidPage = botState.settings.enabledPages.profile;
  } else if (pathname.startsWith('/i/lists/') || pathname.startsWith('/lists/')) {
    pageType = 'lists';
    isValidPage = botState.settings.enabledPages.lists;
  } else if (pathname.startsWith('/explore')) {
    pageType = 'explore';
    isValidPage = botState.settings.enabledPages.explore;
  } else if (pathname.includes('/status/')) {
    pageType = 'tweet';
    isValidPage = true; // Individual tweets always allowed
  }
  
  // Must be on Twitter/X domain
  const hostname = window.location.hostname;
  if (!hostname.includes('twitter.com') && !hostname.includes('x.com')) {
    isValidPage = false;
  }
  
  return { pageType, isValidPage, url };
}

function getTweetId(article) {
  const timeLink = article.querySelector('time')?.parentElement?.href;
  if (timeLink) return timeLink.split('/').pop();
  return null;
}

function getTweetText(article) {
  const textEl = article.querySelector('[data-testid="tweetText"]');
  return textEl ? textEl.textContent.trim() : '';
}

function getTweetMetrics(article) {
  const metrics = { likes: 0, retweets: 0, replies: 0, total: 0 };
  
  try {
    const likeEl = article.querySelector('[data-testid="like"] span');
    const retweetEl = article.querySelector('[data-testid="retweet"] span');
    const replyEl = article.querySelector('[data-testid="reply"] span');
    
    const parseCount = (text) => {
      if (!text) return 0;
      const num = parseFloat(text);
      if (text.includes('K')) return num * 1000;
      if (text.includes('M')) return num * 1000000;
      return num || 0;
    };
    
    metrics.likes = parseCount(likeEl?.textContent);
    metrics.retweets = parseCount(retweetEl?.textContent);
    metrics.replies = parseCount(replyEl?.textContent);
    metrics.total = metrics.likes + metrics.retweets + metrics.replies;
  } catch (error) {
    console.log('⚠️ Could not parse metrics');
  }
  
  return metrics;
}

function getUserInfo(article) {
  const userInfo = { followers: 0, isVerified: false, username: '' };
  
  try {
    const usernameEl = article.querySelector('[data-testid="User-Name"] a');
    userInfo.username = usernameEl?.href.split('/').pop() || '';
    
    const verifiedEl = article.querySelector('[data-testid="icon-verified"]');
    userInfo.isVerified = !!verifiedEl;
    
    // Note: Follower count is harder to get from timeline, would need profile visit
  } catch (error) {
    console.log('⚠️ Could not parse user info');
  }
  
  return userInfo;
}

function isOriginalMainPost(article, tweetText, pageInfo) {
  console.log(`🔍 Analyzing tweet: "${tweetText.substring(0, 50)}..." on ${pageInfo.pageType} page`);
  
  // Basic filtering
  if (tweetText.toLowerCase().includes('replying to')) {
    console.log('❌ Contains "Replying to" - this is a reply');
    return false;
  }
  
  if (article.textContent.includes('Replying to @')) {
    console.log('❌ Found "Replying to @" text - this is a reply');
    return false;
  }
  
  const nestedTweet = article.querySelector('[data-testid="tweet"] [data-testid="tweet"]');
  if (nestedTweet) {
    console.log('❌ Nested tweet structure - this is a reply');
    return false;
  }
  
  const quoteTweet = article.querySelector('[data-testid="quoteTweet"]');
  if (quoteTweet) {
    console.log('❌ Quote tweet detected - skipping');
    return false;
  }
  
  if (tweetText.startsWith('@') && pageInfo.pageType === 'home') {
    console.log('❌ Starts with @ on home timeline - likely a reply');
    return false;
  }
  
  if (tweetText.length < 10) {
    console.log('❌ Too short - likely not meaningful');
    return false;
  }
  
  // Page-specific filtering
  if (pageInfo.pageType === 'profile') {
    console.log('✅ Profile page - using respectful filtering');
    return true; // More permissive on profiles
  }
  
  if (['search', 'hashtag', 'community', 'explore'].includes(pageInfo.pageType)) {
    console.log(`✅ ${pageInfo.pageType} page - using targeted filtering`);
    return true; // More permissive on focused pages
  }
  
  console.log('✅ Passed all filters - engaging with this post!');
  return true;
}

function isTweetAlreadyLiked(article) {
  const likeButton = article.querySelector('[data-testid="like"]');
  if (!likeButton) return false;
  
  const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
  if (isLiked) {
    console.log('❤️ Tweet already liked by us - skipping');
    return true;
  }
  
  return false;
}

function meetsEngagementThreshold(metrics) {
  const { minLikes } = botState.settings;
  if (metrics.likes < minLikes) {
    console.log(`📊 Below engagement threshold: ${metrics.likes} < ${minLikes} likes`);
    return false;
  }
  return true;
}

function getReplyButton() {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  return (
    dlg.querySelector('button[data-testid="tweetButtonInline"]:not([disabled])') ||
    [...dlg.querySelectorAll('button:not([disabled])')].find(
      b => b.textContent.trim().toLowerCase() === 'reply'
    )
  );
}

// ENHANCED: Human-like processTweet function with all realistic behaviors
async function processTweet(article) {
  if (!botState.active || botState.busy) return;

  // NEW: Update mood periodically
  updateSessionMood();

  // NEW: Check for random breaks
  await checkAndTakeBreak();

  const pageInfo = detectPageInfo();
  if (!pageInfo.isValidPage) return;

  // NEW: Check rate limiting before processing
  if (!canCommentNow()) {
    return; // Skip this tweet due to rate limiting
  }

  // Check if API is configured
  if (!botState.apiConfig.anthropic_api_key) {
    console.log('⚠️ API key not configured, skipping tweet processing');
    return;
  }

  const tweetId = getTweetId(article);
  if (!tweetId) return;

  // Memory checks
  if (processedTweets.has(tweetId) || likedTweets.has(tweetId) || repliedTweets.has(tweetId)) {
    return;
  }

  const tweetText = getTweetText(article);
  if (!tweetText) {
    processedTweets.add(tweetId);
    botState.stats.tweetsScrolled++;
    return;
  }

  // Check if already liked
  if (isTweetAlreadyLiked(article)) {
    processedTweets.add(tweetId);
    likedTweets.add(tweetId);
    botState.stats.tweetsScrolled++;
    return;
  }

  // Get metrics and user info
  const metrics = getTweetMetrics(article);
  const userInfo = getUserInfo(article);

  // Apply filters
  if (!isOriginalMainPost(article, tweetText, pageInfo)) {
    console.log(`⏭️ Not engaging with: ${tweetText.substring(0, 30)}...`);
    processedTweets.add(tweetId);
    botState.stats.tweetsScrolled++;
    botState.tweetsScrolledSinceComment++;
    return;
  }

  if (!meetsEngagementThreshold(metrics)) {
    processedTweets.add(tweetId);
    botState.stats.tweetsScrolled++;
    botState.tweetsScrolledSinceComment++;
    return;
  }

  // NEW: Selective engagement check (human doesn't comment on everything!)
  if (!shouldEngageWithTweet()) {
    processedTweets.add(tweetId);
    botState.stats.tweetsScrolled++;
    botState.tweetsScrolledSinceComment++;
    return;
  }

  // Cooldown check
  if (Date.now() - botState.lastAction < botState.settings.cooldown) return;

  // NEW: Simulate reading the tweet first (CRITICAL for human behavior!)
  const readingTime = calculateReadingTime(tweetText, article);
  if (readingTime > 0) {
    console.log(`📖 Reading tweet for ${Math.round(readingTime / 1000)}s (${tweetText.split(/\s+/).length} words)...`);
    await sleep(readingTime);
  }

  console.log(`🔍 Processing tweet ${tweetId} on ${pageInfo.pageType} page:`, tweetText.substring(0, 50) + '...');

  try {
    botState.busy = true;
    // NEW: Track current tweet for stuck detection
    botState.currentTweetId = tweetId;
    botState.currentTweetStartTime = Date.now();

    botState.stats.totalAttempts++;
    
    // Ask Claude with enhanced context including API config
    console.log(`🤖 Asking Claude about tweet ${tweetId} using model ${botState.apiConfig.model}...`);
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'CLAUDE_DECIDE',
        tweet: tweetText,
        context: {
          pageType: pageInfo.pageType,
          metrics: metrics,
          userInfo: userInfo,
          settings: botState.settings
        }
      }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
    
    botState.stats.apiCalls++;
    console.log(`📝 Claude response:`, response);
    
    if (!response?.ok) {
      console.log(`👎 Claude API error:`, response?.error || 'Unknown error');
      if (response?.error?.includes('API key')) {
        console.error('🔑 API key issue detected');
      }
      processedTweets.add(tweetId);
      return;
    }
    
    if (!response.should) {
      console.log(`👎 Claude said NO`);
      processedTweets.add(tweetId);
      return;
    }
    
    console.log(`👍 Claude said YES! Reply: "${response.text}"`);
    
    if (!response.text || response.text.length < 3) {
      console.log(`❌ Invalid reply text`);
      processedTweets.add(tweetId);
      return;
    }
    
    // Like the tweet - FASTER timing
    const likeButton = article.querySelector('[data-testid="like"]');
    if (likeButton && !likeButton.getAttribute('aria-pressed')) {
      likeButton.click();
      console.log(`❤️ Liked tweet ${tweetId} on ${pageInfo.pageType} page`);
      likedTweets.add(tweetId);
      botState.stats.tweetsLiked++;
      await sleep(500); // Reduced from 800ms
    }
    
    // Reply process
    const replyButton =
      article.querySelector('[role="button"][aria-label^="Reply"]') ||
      article.querySelector('div[data-testid="reply"]') ||
      article.querySelector('button[data-testid="reply"]');
    
    if (!replyButton) {
      console.log(`⏭️ No inline reply icon – skipping tweet ${tweetId}`);
      processedTweets.add(tweetId);
      return;
    }
    
    console.log(`📝 Opening inline reply modal for ${tweetId}...`);
    replyButton.click();
    
    const textBox = await poll(() => 
      document.querySelector('[data-testid="tweetTextarea_0"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]')
    );
    
    if (!textBox) {
      console.error(`❌ Reply textbox not found for ${tweetId}`);
      processedTweets.add(tweetId);
      return;
    }
    
    console.log(`✅ Found textbox for ${tweetId}`);

    // NEW: Abandon comment feature (sometimes humans start typing then change their mind)
    const shouldAbandon = Math.random() * 100 < botState.settings.abandonCommentChance;
    if (shouldAbandon) {
      console.log(`🤔 Decided not to comment after all (human behavior)`);
      botState.stats.commentsAbandoned++;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      processedTweets.add(tweetId);
      botState.tweetsScrolledSinceComment = 0; // Reset counter even for abandoned comments
      return;
    }

    // Type reply - NEW: Realistic typing with typos and variable speed
    console.log(`⌨️ Typing reply: "${response.text}"`);
    textBox.focus();
    await sleep(200 + Math.random() * 300); // Variable focus delay

    // Use realistic typing function
    await typeRealisticComment(textBox, response.text);

    console.log(`📤 Text entered, waiting for Reply button...`);
    await sleep(600 + Math.random() * 400); // Variable delay before clicking

    const postButton = await poll(getReplyButton);

    if (!postButton) {
      console.error(`❌ Reply button not found for ${tweetId}`);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      processedTweets.add(tweetId);
      return;
    }

    console.log(`🚀 Clicking Reply button...`);
    postButton.click();
    
    const modalClosed = await poll(() => !document.querySelector('[role="dialog"]'));
    
    if (modalClosed) {
      console.log(`✅ Successfully replied to ${tweetId} on ${pageInfo.pageType} page: "${response.text}"`);
      repliedTweets.add(tweetId);
      botState.stats.commentsPosted++;

      // NEW: Record this comment for rate limiting
      recordComment();

      // NEW: Reset tweets scrolled counter after successful comment
      botState.tweetsScrolledSinceComment = 0;

      // ENHANCED: Immediate fast scroll after successful comment
      console.log('🚀 FAST SCROLL: Moving to next content immediately');
      window.scrollBy({
        top: window.innerHeight * 1.2, // Larger scroll distance
        behavior: 'smooth'
      });

      // Update success rate
      botState.stats.successRate = Math.round((botState.stats.commentsPosted / botState.stats.totalAttempts) * 100);
    } else {
      console.log(`⚠️ Modal still open, but attempted reply to ${tweetId}`);
    }

    processedTweets.add(tweetId);
    botState.lastAction = Date.now();
    
    // Save stats
    await saveSettings();
    
  } catch (error) {
    console.error(`💥 Error processing ${tweetId}:`, error);
    processedTweets.add(tweetId);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  } finally {
    botState.busy = false;
    // NEW: Reset tweet tracking after processing
    botState.currentTweetId = null;
    botState.currentTweetStartTime = null;
  }
}

function scanForTweets() {
  const pageInfo = detectPageInfo();
  if (!pageInfo.isValidPage) {
    return;
  }
  
  try {
    const articles = document.querySelectorAll('article');
    if (articles.length > 0) {
      console.log(`📊 Scanning ${articles.length} articles on ${pageInfo.pageType} page...`);
      articles.forEach((article) => {
        processTweet(article);
      });
    }
  } catch (error) {
    console.error('❌ Scanning error:', error);
  }
}

// ENHANCED: More aggressive auto-scroll function with human-like behavior
function autoScroll() {
  const pageInfo = detectPageInfo();
  if (botState.active && !botState.busy && pageInfo.isValidPage) {
    console.log(`📜 ENHANCED AUTO-SCROLL on ${pageInfo.pageType} page...`);

    // NEW: Random mouse movement before scrolling
    if (Math.random() > 0.5) { // 50% chance
      simulateMouseMovement();
    }

    // More aggressive scrolling
    const scrollAmount = window.innerHeight * 0.8; // Increased from 0.5
    window.scrollBy({
      top: scrollAmount,
      behavior: 'smooth'
    });

    // Optional: Random scroll variation to look more human
    setTimeout(() => {
      if (Math.random() > 0.7) { // 30% chance for extra micro-scroll
        window.scrollBy({
          top: Math.random() * 200 + 100,
          behavior: 'smooth'
        });
        // NEW: Another mouse movement after micro-scroll
        if (Math.random() > 0.6) {
          simulateMouseMovement();
        }
      }
    }, 1000);

    // Update activity time on scroll
    botState.lastActivityTime = Date.now();
  }
}

// Enhanced message listener for popup communication with API config support
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({
        active: botState.active,
        stats: botState.stats,
        settings: botState.settings,
        pageInfo: detectPageInfo(),
        apiConfig: {
          model: botState.apiConfig.model,
          temperature: botState.apiConfig.temperature,
          apiKey: botState.apiConfig.anthropic_api_key,
          systemPrompt: botState.apiConfig.system_prompt
        }
      });
      break;
      
    case 'START_BOT':
      if (!botState.apiConfig.anthropic_api_key) {
        sendResponse({ success: false, error: 'API key not configured' });
        break;
      }
      botState.active = true;
      startStuckChecker(); // NEW: Start monitoring for stuck states
      console.log('🚀 Bot started by user');
      sendResponse({ success: true });
      break;

    case 'STOP_BOT':
      botState.active = false;
      botState.busy = false;
      stopStuckChecker(); // NEW: Stop monitoring when bot stops
      console.log('⏹️ Bot stopped by user');
      sendResponse({ success: true });
      break;
      
    case 'UPDATE_SETTINGS':
      const settings = message.settings;
      
      // Handle API config separately
      if (settings.apiKey !== undefined) {
        botState.apiConfig.anthropic_api_key = settings.apiKey;
        delete settings.apiKey;
      }
      if (settings.model !== undefined) {
        botState.apiConfig.model = settings.model;
        delete settings.model;
      }
      if (settings.temperature !== undefined) {
        botState.apiConfig.temperature = settings.temperature;
        delete settings.temperature;
      }
      if (settings.systemPrompt !== undefined) {
        botState.apiConfig.system_prompt = settings.systemPrompt;
        delete settings.systemPrompt;
      }
      
      // Handle regular settings
      botState.settings = { ...botState.settings, ...settings };
      
      saveSettings();
      console.log('⚙️ Settings updated:', Object.keys(message.settings));
      sendResponse({ success: true });
      break;
      
    case 'RESET_STATS':
      botState.stats = {
        commentsPosted: 0,
        tweetsLiked: 0,
        pagesVisited: 0,
        apiCalls: 0,
        sessionStart: Date.now(),
        successRate: 0,
        totalAttempts: 0,
        autoRefreshes: 0,
        tweetsScrolled: 0,
        breaksTaken: 0,
        commentsAbandoned: 0,
        modalsEscaped: 0
      };
      saveSettings();
      sendResponse({ success: true });
      break;
  }
});

// ENHANCED: Initialize with faster timing
async function initialize() {
  await loadSettings();
  
  // Check API configuration on startup
  if (!botState.apiConfig.anthropic_api_key) {
    console.log('⚠️ No API key configured. Please configure in settings.');
  } else {
    console.log('✅ API key configured, bot ready to run');
  }
  
  // Initial scan - FASTER startup
  setTimeout(() => {
    console.log('🚀 Starting universal tweet scanning...');
    scanForTweets();
  }, 1500); // Reduced from 2000ms
  
  // ENHANCED: More frequent scanning for faster action
  setInterval(() => {
    if (botState.active && !botState.busy) {
      scanForTweets();
    }
  }, 5000); // Reduced from 8000ms - scan every 5 seconds instead of 8
  
  // ENHANCED: More frequent auto-scroll for faster browsing
  setInterval(autoScroll, 8000); // Reduced from 12000ms - scroll every 8 seconds

  // NEW: Check for stuck bot and auto-refresh every 30 seconds
  setInterval(() => {
    checkIfStuckAndRefresh();
  }, 30000); // Check every 30 seconds

  // NEW: Random mouse movements throughout the session
  setInterval(() => {
    if (botState.active && botState.settings.enableMouseMovement) {
      if (Math.random() > 0.7) { // 30% chance every interval
        simulateMouseMovement();
      }
    }
  }, 15000); // Every 15 seconds

  // Memory cleanup - keep this the same
  setInterval(() => {
    if (processedTweets.size > 1000) {
      const oldEntries = Array.from(processedTweets).slice(0, 500);
      oldEntries.forEach(id => {
        processedTweets.delete(id);
        likedTweets.delete(id);
        repliedTweets.delete(id);
      });
      console.log(`🧹 Cleaned up ${oldEntries.length} old entries`);
    }
  }, 300000);
}

// Track page changes
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    botState.stats.pagesVisited++;
    console.log(`📍 Page changed to: ${detectPageInfo().pageType}`);
  }
}, 1000);

initialize();
console.log('✅ Enhanced Universal Twitter Bot v2.1 loaded - Full control with API management!');