/* Enhanced Universal Twitter Bot - Works on ALL x.com pages with full control and API management */

console.log('🚀 [Universal Twitter Bot v2.1] Starting with enhanced configuration...');

// Bot state with enhanced API configuration
let botState = {
  active: false,
  busy: false,
  lastAction: 0,
  stats: {
    commentsPosted: 0,
    tweetsLiked: 0,
    pagesVisited: 0,
    apiCalls: 0,
    sessionStart: Date.now(),
    successRate: 0,
    totalAttempts: 0
  },
  settings: {
    tone: 'casual',
    lengthMode: 'short',
    emojiPolicy: 'none',
    hashtagPolicy: 'never',
    cooldown: 8000,
    minLikes: 0,
    minFollowers: 0,
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
  } else if (pathname.match(/^\/[a-zA-Z0-9_]+$/)) {
    pageType = 'profile';
    isValidPage = botState.settings.enabledPages.profile;
  } else if (pathname.startsWith('/i/communities/')) {
    pageType = 'community';
    isValidPage = botState.settings.enabledPages.community;
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

// ENHANCED: Faster processTweet function with immediate scrolling
async function processTweet(article) {
  if (!botState.active || botState.busy) return;
  
  const pageInfo = detectPageInfo();
  if (!pageInfo.isValidPage) return;
  
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
    return;
  }
  
  // Check if already liked
  if (isTweetAlreadyLiked(article)) {
    processedTweets.add(tweetId);
    likedTweets.add(tweetId);
    return;
  }
  
  // Get metrics and user info
  const metrics = getTweetMetrics(article);
  const userInfo = getUserInfo(article);
  
  // Apply filters
  if (!isOriginalMainPost(article, tweetText, pageInfo)) {
    console.log(`⏭️ Not engaging with: ${tweetText.substring(0, 30)}...`);
    processedTweets.add(tweetId);
    return;
  }
  
  if (!meetsEngagementThreshold(metrics)) {
    processedTweets.add(tweetId);
    return;
  }
  
  // Cooldown check
  if (Date.now() - botState.lastAction < botState.settings.cooldown) return;
  
  console.log(`🔍 Processing tweet ${tweetId} on ${pageInfo.pageType} page:`, tweetText.substring(0, 50) + '...');
  
  try {
    botState.busy = true;
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
    
    // Type reply - FASTER typing
    console.log(`⌨️ Typing reply: "${response.text}"`);
    textBox.focus();
    await sleep(200); // Reduced from 300ms
    
    for (const ch of response.text) {
      document.execCommand('insertText', false, ch);
      textBox.dispatchEvent(
        new InputEvent('input', { 
          bubbles: true, 
          inputType: 'insertText', 
          data: ch 
        })
      );
      await sleep(20 + Math.random() * 20); // Faster typing: reduced from 35+30
    }
    
    console.log(`📤 Text entered, waiting for Reply button...`);
    await sleep(600); // Reduced from 1000ms
    
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

// ENHANCED: More aggressive auto-scroll function
function autoScroll() {
  const pageInfo = detectPageInfo();
  if (botState.active && !botState.busy && pageInfo.isValidPage) {
    console.log(`📜 ENHANCED AUTO-SCROLL on ${pageInfo.pageType} page...`);
    
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
      }
    }, 1000);
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
      console.log('🚀 Bot started by user');
      sendResponse({ success: true });
      break;
      
    case 'STOP_BOT':
      botState.active = false;
      botState.busy = false;
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
        totalAttempts: 0
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