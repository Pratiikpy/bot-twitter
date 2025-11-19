// popup.js - Enhanced UI Controller for Twitter Bot with Prompt & API Management

let currentStatus = null;
let activityLog = [];

// Default prompts for presets
const DEFAULT_PROMPTS = {
  default: `You are a witty, opinionated, and relatable crypto-Twitter degen. You sound like a real person on CT: casual, funny, sharp, and a bit salty when needed. You're not a bot — you're a trader who tweets. Your tone is natural and punchy, never robotic. Write like a human with a 9th-grade reading level. Use real words. Be short, clear, and clever. No jargon. No metaphors. No fluff. No emojis. No gibberish. No random characters. Never ask questions unless it really fits. Your replies must: Stay under 20 words Be about crypto, trading, or finance only Use slight CT slang when natural (e.g. "rekt", "cope", "L", "exit pump", "zero soon", "devs do something") Be funny, savage, or hype, depending on the tweet Use proper grammar, but casual speech is fine (e.g. "ain't", dropping subjects, CT style) Tag a project if it's mentioned as @Project, otherwise use the project name plainly You are here to entertain, engage, and sound real. Never go off-topic. Never act like a bot. Never be cringe. Always use real words. Sound like a real human, not an AI assistant and also dont use any emoji. NO HASHTAGS EVER. im giving you some convertional things but dont just copy it be natural understand my goal`,
  
  degen: `You're a total crypto degen. YOLO everything, diamond hands till you die. Always bullish, always ready to ape into the next moon mission. Use terms like "LFG", "this is the way", "rekt", "ngmi", "wagmi". Be hyped about pumps, cope about dumps. Never financial advice but always shilling your bags. Keep it under 15 words, no emojis, pure degen energy.`,
  
  professional: `You're a sophisticated crypto investor with institutional background. Provide measured, analytical takes on market movements. Reference fundamentals, macroeconomics, and technical analysis. Use terms like "accumulation", "distribution", "market structure". Stay professional but not boring. Keep replies under 20 words, focus on actionable insights.`,
  
  memer: `You're the crypto meme lord. Everything is either "this is fine" or "number go up". Reference popular crypto memes, wojaks, and internet culture. Mock paper hands, celebrate diamond hands. Be funny but not cringe. Use phrases like "cope harder", "have fun staying poor", "few understand". Keep it witty and under 15 words.`,
  
  analyst: `You're a data-driven crypto analyst. Focus on charts, patterns, and market metrics. Reference support/resistance levels, volume, momentum indicators. Be objective but opinionated. Use terms like "confluence", "invalidation", "thesis". Provide concise technical insights under 20 words.`,
  
  hype: `You're the ultimate crypto hype man! Everything is going to the moon! Bull market forever! Use CAPS for emphasis, get excited about every pump. Reference rockets, lambos, and life-changing money. Stay positive and energetic. Keep replies under 15 words but make them feel like 50 with pure ENERGY!`,
  
  skeptic: `You're the crypto skeptic who's seen it all. Question every pump, doubt every narrative. Use phrases like "we've seen this before", "different coin same story", "show me adoption". Be cynical but not toxic. Point out flaws and risks. Keep it real under 20 words.`
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎛️ Enhanced bot control panel loaded');
  
  setupTabNavigation();
  setupEventListeners();
  await loadCurrentStatus();
  startStatusUpdates();
});

// Tab navigation
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      contents.forEach(content => {
        content.classList.remove('active');
        if (content.dataset.content === targetTab) {
          content.classList.add('active');
        }
      });
    });
  });
}

// Setup all event listeners
function setupEventListeners() {
  // Control buttons
  document.getElementById('start-btn').addEventListener('click', startBot);
  document.getElementById('stop-btn').addEventListener('click', stopBot);
  document.getElementById('reset-btn').addEventListener('click', resetStats);
  
  // Settings
  document.getElementById('cooldown-slider').addEventListener('input', updateCooldown);
  document.getElementById('min-likes-slider').addEventListener('input', updateMinLikes);
  document.getElementById('min-followers-slider').addEventListener('input', updateMinFollowers);

  // NEW: Rate limiting and human-like behavior settings
  document.getElementById('cpm-slider').addEventListener('input', updateCommentsPerMinute);
  document.getElementById('interval-slider').addEventListener('input', updateCommentInterval);
  document.getElementById('mouse-movement-checkbox').addEventListener('change', updateMouseMovement);
  document.getElementById('auto-refresh-checkbox').addEventListener('change', updateAutoRefresh);
  document.getElementById('stuck-slider').addEventListener('input', updateStuckThreshold);

  // API Configuration
  document.getElementById('api-key').addEventListener('input', updateApiKey);
  document.getElementById('model-select').addEventListener('change', updateModel);
  document.getElementById('temperature-slider').addEventListener('input', updateTemperature);
  
  // Prompt Management
  document.getElementById('custom-prompt').addEventListener('input', updatePromptStats);
  document.getElementById('test-prompt').addEventListener('click', testPrompt);
  document.getElementById('restore-prompt').addEventListener('click', restoreDefaultPrompt);
  document.getElementById('save-prompt').addEventListener('click', savePrompt);
  
  // Preset buttons
  document.getElementById('preset-degen').addEventListener('click', () => loadPreset('degen'));
  document.getElementById('preset-professional').addEventListener('click', () => loadPreset('professional'));
  document.getElementById('preset-memer').addEventListener('click', () => loadPreset('memer'));
  document.getElementById('preset-analyst').addEventListener('click', () => loadPreset('analyst'));
  document.getElementById('preset-hype').addEventListener('click', () => loadPreset('hype'));
  document.getElementById('preset-skeptic').addEventListener('click', () => loadPreset('skeptic'));
  
  // Behavior settings
  document.querySelectorAll('input[name="tone"]').forEach(radio => {
    radio.addEventListener('change', updateTone);
  });
  
  document.querySelectorAll('input[name="length"]').forEach(radio => {
    radio.addEventListener('change', updateLength);
  });
  
  document.getElementById('emoji-policy').addEventListener('change', updateEmojiPolicy);
  document.getElementById('hashtag-policy').addEventListener('change', updateHashtagPolicy);

  // NEW: Human-like behavior settings
  document.getElementById('enable-reading-time').addEventListener('change', updateReadingTimeEnabled);
  document.getElementById('reading-min-slider').addEventListener('input', updateReadingTimeMin);
  document.getElementById('reading-max-slider').addEventListener('input', updateReadingTimeMax);

  document.getElementById('engagement-prob-slider').addEventListener('input', updateEngagementProb);
  document.getElementById('skip-tweets-checkbox').addEventListener('change', updateSkipTweets);
  document.getElementById('min-skip-slider').addEventListener('input', updateMinSkip);
  document.getElementById('max-skip-slider').addEventListener('input', updateMaxSkip);

  document.getElementById('enable-breaks-checkbox').addEventListener('change', updateBreaksEnabled);
  document.getElementById('break-interval-min-slider').addEventListener('input', updateBreakIntervalMin);
  document.getElementById('break-interval-max-slider').addEventListener('input', updateBreakIntervalMax);
  document.getElementById('break-duration-min-slider').addEventListener('input', updateBreakDurationMin);
  document.getElementById('break-duration-max-slider').addEventListener('input', updateBreakDurationMax);

  document.getElementById('enable-typing-checkbox').addEventListener('change', updateTypingEnabled);
  document.getElementById('typing-min-slider').addEventListener('input', updateTypingMin);
  document.getElementById('typing-max-slider').addEventListener('input', updateTypingMax);
  document.getElementById('typo-chance-slider').addEventListener('input', updateTypoChance);

  document.getElementById('enable-moods-checkbox').addEventListener('change', updateMoodsEnabled);
  document.getElementById('mood-interval-slider').addEventListener('input', updateMoodInterval);

  document.getElementById('enable-media-checkbox').addEventListener('change', updateMediaEnabled);
  document.getElementById('media-min-slider').addEventListener('input', updateMediaMin);
  document.getElementById('media-max-slider').addEventListener('input', updateMediaMax);

  document.getElementById('abandon-chance-slider').addEventListener('input', updateAbandonChance);

  // Page settings
  const pageCheckboxes = [
    'enable-home', 'enable-search', 'enable-hashtag', 'enable-profile',
    'enable-community', 'enable-lists', 'enable-explore'
  ];

  pageCheckboxes.forEach(id => {
    document.getElementById(id).addEventListener('change', updatePageSettings);
  });

  // Advanced
  document.getElementById('restore-defaults').addEventListener('click', restoreDefaults);
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('clear-log').addEventListener('click', clearActivityLog);
}

// Load current bot status
async function loadCurrentStatus() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' });
    
    if (response) {
      currentStatus = response;
      updateUI();
    }
  } catch (error) {
    console.error('Failed to load status:', error);
    updateUI({ 
      active: false, 
      stats: {}, 
      settings: {}, 
      pageInfo: {},
      apiConfig: {}
    });
  }
}

// Update UI with current status
function updateUI(status = currentStatus) {
  if (!status) return;
  
  // Update status indicator
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  if (status.active) {
    statusIndicator.className = 'status-indicator status-active';
    statusText.textContent = 'Active';
  } else {
    statusIndicator.className = 'status-indicator status-inactive';
    statusText.textContent = 'Inactive';
  }
  
  // Update page info
  const pageInfo = status.pageInfo || {};
  document.getElementById('current-page').textContent = pageInfo.pageType || 'Unknown';
  document.getElementById('page-status').textContent = pageInfo.isValidPage ? '✅ Supported' : '❌ Not Supported';
  
  // Update stats
  const stats = status.stats || {};
  document.getElementById('comments-count').textContent = stats.commentsPosted || 0;
  document.getElementById('likes-count').textContent = stats.tweetsLiked || 0;
  document.getElementById('success-rate').textContent = `${stats.successRate || 0}%`;
  document.getElementById('api-calls').textContent = stats.apiCalls || 0;
  
  // Update detailed stats
  document.getElementById('pages-visited').textContent = stats.pagesVisited || 0;
  document.getElementById('total-attempts').textContent = stats.totalAttempts || 0;
  
  // Calculate session time
  if (stats.sessionStart) {
    const sessionTime = Math.floor((Date.now() - stats.sessionStart) / 60000);
    document.getElementById('session-time').textContent = `${sessionTime}m`;
  }
  
  // Calculate estimated cost (rough estimate based on model)
  const apiCalls = stats.apiCalls || 0;
  const model = status.apiConfig?.model || 'claude-3-haiku-20240307';
  let costPerCall = 0.001; // Default haiku cost
  
  if (model.includes('sonnet')) costPerCall = 0.01;
  if (model.includes('opus')) costPerCall = 0.05;
  
  const estimatedCost = (apiCalls * costPerCall).toFixed(3);
  document.getElementById('estimated-cost').textContent = `$${estimatedCost}`;
  
  // Update API configuration
  const apiConfig = status.apiConfig || {};
  
  if (apiConfig.apiKey) {
    const maskedKey = '•'.repeat(20) + apiConfig.apiKey.slice(-8);
    document.getElementById('api-key').value = maskedKey;
    document.getElementById('api-status').textContent = 'Valid';
    document.getElementById('api-status').className = 'api-status valid';
  } else {
    document.getElementById('api-status').textContent = 'Not Set';
    document.getElementById('api-status').className = 'api-status invalid';
  }
  
  if (apiConfig.model) {
    document.getElementById('model-select').value = apiConfig.model;
  }
  
  if (apiConfig.temperature !== undefined) {
    document.getElementById('temperature-slider').value = apiConfig.temperature;
    document.getElementById('temperature-value').textContent = apiConfig.temperature;
  }
  
  if (apiConfig.systemPrompt) {
    document.getElementById('custom-prompt').value = apiConfig.systemPrompt;
    updatePromptStats();
  }
  
  // Update behavior settings
  const settings = status.settings || {};
  
  // Cooldown
  if (settings.cooldown) {
    const cooldownSlider = document.getElementById('cooldown-slider');
    const cooldownValue = document.getElementById('cooldown-value');
    cooldownSlider.value = settings.cooldown / 1000;
    cooldownValue.textContent = settings.cooldown / 1000;
  }
  
  // Min likes/followers
  if (settings.minLikes !== undefined) {
    const minLikesSlider = document.getElementById('min-likes-slider');
    const minLikesValue = document.getElementById('min-likes-value');
    minLikesSlider.value = settings.minLikes;
    minLikesValue.textContent = settings.minLikes;
  }
  
  if (settings.minFollowers !== undefined) {
    const minFollowersSlider = document.getElementById('min-followers-slider');
    const minFollowersValue = document.getElementById('min-followers-value');
    minFollowersSlider.value = settings.minFollowers;
    minFollowersValue.textContent = settings.minFollowers;
  }
  
  // Tone and length
  if (settings.tone) {
    const toneRadio = document.getElementById(`tone-${settings.tone}`);
    if (toneRadio) toneRadio.checked = true;
  }
  
  if (settings.lengthMode) {
    const lengthRadio = document.getElementById(`length-${settings.lengthMode}`);
    if (lengthRadio) lengthRadio.checked = true;
  }
  
  // Policies
  if (settings.emojiPolicy) {
    document.getElementById('emoji-policy').value = settings.emojiPolicy;
  }
  
  if (settings.hashtagPolicy) {
    document.getElementById('hashtag-policy').value = settings.hashtagPolicy;
  }

  // NEW: Rate limiting settings
  if (settings.commentsPerMinute !== undefined) {
    const cpmSlider = document.getElementById('cpm-slider');
    const cpmValue = document.getElementById('cpm-value');
    cpmSlider.value = settings.commentsPerMinute;
    cpmValue.textContent = settings.commentsPerMinute;
  }

  if (settings.minCommentInterval !== undefined) {
    const intervalSlider = document.getElementById('interval-slider');
    const intervalValue = document.getElementById('interval-value');
    intervalSlider.value = settings.minCommentInterval / 1000; // Convert from ms to seconds
    intervalValue.textContent = settings.minCommentInterval / 1000;
  }

  // NEW: Human-like behavior settings
  if (settings.enableMouseMovement !== undefined) {
    document.getElementById('mouse-movement-checkbox').checked = settings.enableMouseMovement;
  }

  if (settings.enableAutoRefresh !== undefined) {
    document.getElementById('auto-refresh-checkbox').checked = settings.enableAutoRefresh;
  }

  if (settings.stuckThresholdMinutes !== undefined) {
    const stuckSlider = document.getElementById('stuck-slider');
    const stuckValue = document.getElementById('stuck-value');
    stuckSlider.value = settings.stuckThresholdMinutes;
    stuckValue.textContent = settings.stuckThresholdMinutes;
  }

  // NEW: Advanced human-like behavior settings
  if (settings.enableReadingTime !== undefined) {
    document.getElementById('enable-reading-time').checked = settings.enableReadingTime;
  }
  if (settings.readingTimeMin !== undefined) {
    document.getElementById('reading-min-slider').value = settings.readingTimeMin;
    document.getElementById('reading-min-value').textContent = settings.readingTimeMin;
  }
  if (settings.readingTimeMax !== undefined) {
    document.getElementById('reading-max-slider').value = settings.readingTimeMax;
    document.getElementById('reading-max-value').textContent = settings.readingTimeMax;
  }

  if (settings.engagementProbability !== undefined) {
    document.getElementById('engagement-prob-slider').value = settings.engagementProbability;
    document.getElementById('engagement-prob-value').textContent = settings.engagementProbability;
  }
  if (settings.skipTweetsBetweenComments !== undefined) {
    document.getElementById('skip-tweets-checkbox').checked = settings.skipTweetsBetweenComments;
  }
  if (settings.minTweetsToSkip !== undefined) {
    document.getElementById('min-skip-slider').value = settings.minTweetsToSkip;
    document.getElementById('min-skip-value').textContent = settings.minTweetsToSkip;
  }
  if (settings.maxTweetsToSkip !== undefined) {
    document.getElementById('max-skip-slider').value = settings.maxTweetsToSkip;
    document.getElementById('max-skip-value').textContent = settings.maxTweetsToSkip;
  }

  if (settings.enableRandomBreaks !== undefined) {
    document.getElementById('enable-breaks-checkbox').checked = settings.enableRandomBreaks;
  }
  if (settings.breakIntervalMin !== undefined) {
    document.getElementById('break-interval-min-slider').value = settings.breakIntervalMin;
    document.getElementById('break-interval-min-value').textContent = settings.breakIntervalMin;
  }
  if (settings.breakIntervalMax !== undefined) {
    document.getElementById('break-interval-max-slider').value = settings.breakIntervalMax;
    document.getElementById('break-interval-max-value').textContent = settings.breakIntervalMax;
  }
  if (settings.breakDurationMin !== undefined) {
    document.getElementById('break-duration-min-slider').value = settings.breakDurationMin;
    document.getElementById('break-duration-min-value').textContent = settings.breakDurationMin;
  }
  if (settings.breakDurationMax !== undefined) {
    document.getElementById('break-duration-max-slider').value = settings.breakDurationMax;
    document.getElementById('break-duration-max-value').textContent = settings.breakDurationMax;
  }

  if (settings.enableRealisticTyping !== undefined) {
    document.getElementById('enable-typing-checkbox').checked = settings.enableRealisticTyping;
  }
  if (settings.typingSpeedMin !== undefined) {
    document.getElementById('typing-min-slider').value = settings.typingSpeedMin;
    document.getElementById('typing-min-value').textContent = settings.typingSpeedMin;
  }
  if (settings.typingSpeedMax !== undefined) {
    document.getElementById('typing-max-slider').value = settings.typingSpeedMax;
    document.getElementById('typing-max-value').textContent = settings.typingSpeedMax;
  }
  if (settings.typoChance !== undefined) {
    document.getElementById('typo-chance-slider').value = settings.typoChance;
    document.getElementById('typo-chance-value').textContent = settings.typoChance;
  }

  if (settings.enableSessionMoods !== undefined) {
    document.getElementById('enable-moods-checkbox').checked = settings.enableSessionMoods;
  }
  if (settings.moodChangeInterval !== undefined) {
    document.getElementById('mood-interval-slider').value = settings.moodChangeInterval;
    document.getElementById('mood-interval-value').textContent = settings.moodChangeInterval;
  }

  if (settings.enableMediaDetection !== undefined) {
    document.getElementById('enable-media-checkbox').checked = settings.enableMediaDetection;
  }
  if (settings.mediaViewTimeMin !== undefined) {
    document.getElementById('media-min-slider').value = settings.mediaViewTimeMin;
    document.getElementById('media-min-value').textContent = settings.mediaViewTimeMin;
  }
  if (settings.mediaViewTimeMax !== undefined) {
    document.getElementById('media-max-slider').value = settings.mediaViewTimeMax;
    document.getElementById('media-max-value').textContent = settings.mediaViewTimeMax;
  }

  if (settings.abandonCommentChance !== undefined) {
    document.getElementById('abandon-chance-slider').value = settings.abandonCommentChance;
    document.getElementById('abandon-chance-value').textContent = settings.abandonCommentChance;
  }

  // Page settings
  if (settings.enabledPages) {
    Object.keys(settings.enabledPages).forEach(page => {
      const checkbox = document.getElementById(`enable-${page}`);
      if (checkbox) {
        checkbox.checked = settings.enabledPages[page];
      }
    });
  }
}

// Bot control functions
async function startBot() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'START_BOT' });
    
    addActivityLog('🚀 Bot started by user');
    await loadCurrentStatus();
  } catch (error) {
    console.error('Failed to start bot:', error);
    addActivityLog('❌ Failed to start bot: ' + error.message);
  }
}

async function stopBot() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_BOT' });
    
    addActivityLog('⏹️ Bot stopped by user');
    await loadCurrentStatus();
  } catch (error) {
    console.error('Failed to stop bot:', error);
    addActivityLog('❌ Failed to stop bot: ' + error.message);
  }
}

async function resetStats() {
  if (!confirm('Are you sure you want to reset all statistics?')) return;
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'RESET_STATS' });
    
    addActivityLog('🔄 Statistics reset by user');
    await loadCurrentStatus();
  } catch (error) {
    console.error('Failed to reset stats:', error);
    addActivityLog('❌ Failed to reset stats: ' + error.message);
  }
}

// API Configuration functions
async function updateApiKey() {
  const apiKey = document.getElementById('api-key').value.trim();
  if (apiKey && !apiKey.includes('•')) { // Don't update if it's the masked version
    await updateSettings({ apiKey });
    addActivityLog('🔑 API key updated');
  }
}

async function updateModel() {
  const model = document.getElementById('model-select').value;
  await updateSettings({ model });
  addActivityLog(`🤖 Model changed to ${model}`);
}

async function updateTemperature() {
  const temperature = parseFloat(document.getElementById('temperature-slider').value);
  document.getElementById('temperature-value').textContent = temperature;
  await updateSettings({ temperature });
}

// Prompt management functions
function updatePromptStats() {
  const prompt = document.getElementById('custom-prompt').value;
  const chars = prompt.length;
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const estimatedTokens = Math.ceil(chars / 3.5); // Rough estimate
  
  document.getElementById('prompt-chars').textContent = chars;
  document.getElementById('prompt-words').textContent = words;
  document.getElementById('prompt-tokens').textContent = estimatedTokens;
}

async function testPrompt() {
  const prompt = document.getElementById('custom-prompt').value.trim();
  if (!prompt) {
    alert('Please enter a prompt to test');
    return;
  }
  
  // Simple validation
  if (prompt.length < 50) {
    alert('Prompt seems too short. Consider adding more specific instructions.');
    return;
  }
  
  if (prompt.length > 2000) {
    alert('Prompt is very long. Consider shortening it to reduce token costs.');
    return;
  }
  
  addActivityLog('🧪 Prompt validation passed');
  alert('Prompt looks good! Remember to save it.');
}

async function savePrompt() {
  const prompt = document.getElementById('custom-prompt').value.trim();
  if (!prompt) {
    alert('Please enter a prompt before saving');
    return;
  }
  
  await updateSettings({ systemPrompt: prompt });
  addActivityLog('💾 Custom prompt saved');
  alert('Prompt saved successfully!');
}

async function restoreDefaultPrompt() {
  if (!confirm('Are you sure you want to restore the default prompt? This will overwrite your current prompt.')) return;
  
  document.getElementById('custom-prompt').value = DEFAULT_PROMPTS.default;
  updatePromptStats();
  await savePrompt();
  addActivityLog('🔄 Default prompt restored');
}

async function loadPreset(presetName) {
  if (!confirm(`Load the ${presetName} preset? This will overwrite your current prompt.`)) return;
  
  const prompt = DEFAULT_PROMPTS[presetName] || DEFAULT_PROMPTS.default;
  document.getElementById('custom-prompt').value = prompt;
  updatePromptStats();
  
  addActivityLog(`🎯 Loaded ${presetName} preset`);
}

// Settings update functions
async function updateSettings(settingsUpdate) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'UPDATE_SETTINGS', 
      settings: settingsUpdate 
    });
    
    if (Object.keys(settingsUpdate).length <= 2) {
      // Don't log every single setting change
      console.log('Settings updated:', settingsUpdate);
    }
  } catch (error) {
    console.error('Failed to update settings:', error);
    addActivityLog('❌ Failed to update settings: ' + error.message);
  }
}

async function updateCooldown(event) {
  const value = parseInt(event.target.value);
  document.getElementById('cooldown-value').textContent = value;
  await updateSettings({ cooldown: value * 1000 });
}

async function updateMinLikes(event) {
  const value = parseInt(event.target.value);
  document.getElementById('min-likes-value').textContent = value;
  await updateSettings({ minLikes: value });
}

async function updateMinFollowers(event) {
  const value = parseInt(event.target.value);
  document.getElementById('min-followers-value').textContent = value;
  await updateSettings({ minFollowers: value });
}

async function updateTone(event) {
  await updateSettings({ tone: event.target.value });
}

async function updateLength(event) {
  await updateSettings({ lengthMode: event.target.value });
}

async function updateEmojiPolicy(event) {
  await updateSettings({ emojiPolicy: event.target.value });
}

async function updateHashtagPolicy(event) {
  await updateSettings({ hashtagPolicy: event.target.value });
}

// NEW: Rate limiting and human-like behavior update functions
async function updateCommentsPerMinute(event) {
  const value = parseInt(event.target.value);
  document.getElementById('cpm-value').textContent = value;
  await updateSettings({ commentsPerMinute: value });
}

async function updateCommentInterval(event) {
  const value = parseInt(event.target.value);
  document.getElementById('interval-value').textContent = value;
  await updateSettings({ minCommentInterval: value * 1000 }); // Convert to ms
}

async function updateMouseMovement(event) {
  await updateSettings({ enableMouseMovement: event.target.checked });
}

async function updateAutoRefresh(event) {
  await updateSettings({ enableAutoRefresh: event.target.checked });
}

async function updateStuckThreshold(event) {
  const value = parseInt(event.target.value);
  document.getElementById('stuck-value').textContent = value;
  await updateSettings({ stuckThresholdMinutes: value });
}

// NEW: Advanced human-like behavior update functions
async function updateReadingTimeEnabled(event) {
  await updateSettings({ enableReadingTime: event.target.checked });
}

async function updateReadingTimeMin(event) {
  const value = parseInt(event.target.value);
  document.getElementById('reading-min-value').textContent = value;
  await updateSettings({ readingTimeMin: value });
}

async function updateReadingTimeMax(event) {
  const value = parseInt(event.target.value);
  document.getElementById('reading-max-value').textContent = value;
  await updateSettings({ readingTimeMax: value });
}

async function updateEngagementProb(event) {
  const value = parseInt(event.target.value);
  document.getElementById('engagement-prob-value').textContent = value;
  await updateSettings({ engagementProbability: value });
}

async function updateSkipTweets(event) {
  await updateSettings({ skipTweetsBetweenComments: event.target.checked });
}

async function updateMinSkip(event) {
  const value = parseInt(event.target.value);
  document.getElementById('min-skip-value').textContent = value;
  await updateSettings({ minTweetsToSkip: value });
}

async function updateMaxSkip(event) {
  const value = parseInt(event.target.value);
  document.getElementById('max-skip-value').textContent = value;
  await updateSettings({ maxTweetsToSkip: value });
}

async function updateBreaksEnabled(event) {
  await updateSettings({ enableRandomBreaks: event.target.checked });
}

async function updateBreakIntervalMin(event) {
  const value = parseInt(event.target.value);
  document.getElementById('break-interval-min-value').textContent = value;
  await updateSettings({ breakIntervalMin: value });
}

async function updateBreakIntervalMax(event) {
  const value = parseInt(event.target.value);
  document.getElementById('break-interval-max-value').textContent = value;
  await updateSettings({ breakIntervalMax: value });
}

async function updateBreakDurationMin(event) {
  const value = parseInt(event.target.value);
  document.getElementById('break-duration-min-value').textContent = value;
  await updateSettings({ breakDurationMin: value });
}

async function updateBreakDurationMax(event) {
  const value = parseInt(event.target.value);
  document.getElementById('break-duration-max-value').textContent = value;
  await updateSettings({ breakDurationMax: value });
}

async function updateTypingEnabled(event) {
  await updateSettings({ enableRealisticTyping: event.target.checked });
}

async function updateTypingMin(event) {
  const value = parseInt(event.target.value);
  document.getElementById('typing-min-value').textContent = value;
  await updateSettings({ typingSpeedMin: value });
}

async function updateTypingMax(event) {
  const value = parseInt(event.target.value);
  document.getElementById('typing-max-value').textContent = value;
  await updateSettings({ typingSpeedMax: value });
}

async function updateTypoChance(event) {
  const value = parseInt(event.target.value);
  document.getElementById('typo-chance-value').textContent = value;
  await updateSettings({ typoChance: value });
}

async function updateMoodsEnabled(event) {
  await updateSettings({ enableSessionMoods: event.target.checked });
}

async function updateMoodInterval(event) {
  const value = parseInt(event.target.value);
  document.getElementById('mood-interval-value').textContent = value;
  await updateSettings({ moodChangeInterval: value });
}

async function updateMediaEnabled(event) {
  await updateSettings({ enableMediaDetection: event.target.checked });
}

async function updateMediaMin(event) {
  const value = parseInt(event.target.value);
  document.getElementById('media-min-value').textContent = value;
  await updateSettings({ mediaViewTimeMin: value });
}

async function updateMediaMax(event) {
  const value = parseInt(event.target.value);
  document.getElementById('media-max-value').textContent = value;
  await updateSettings({ mediaViewTimeMax: value });
}

async function updateAbandonChance(event) {
  const value = parseInt(event.target.value);
  document.getElementById('abandon-chance-value').textContent = value;
  await updateSettings({ abandonCommentChance: value });
}

async function updatePageSettings() {
  const enabledPages = {
    home: document.getElementById('enable-home').checked,
    search: document.getElementById('enable-search').checked,
    hashtag: document.getElementById('enable-hashtag').checked,
    profile: document.getElementById('enable-profile').checked,
    community: document.getElementById('enable-community').checked,
    lists: document.getElementById('enable-lists').checked,
    explore: document.getElementById('enable-explore').checked
  };
  
  await updateSettings({ enabledPages });
}

async function restoreDefaults() {
  if (!confirm('Are you sure you want to restore ALL settings to defaults? This includes prompt, API settings, and behavior settings.')) return;
  
  const defaultSettings = {
    // API Settings
    model: 'claude-3-haiku-20240307',
    temperature: 0.8,
    systemPrompt: DEFAULT_PROMPTS.default,
    
    // Behavior Settings
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
  };
  
  await updateSettings(defaultSettings);
  
  // Update UI elements
  document.getElementById('custom-prompt').value = DEFAULT_PROMPTS.default;
  document.getElementById('model-select').value = 'claude-3-haiku-20240307';
  document.getElementById('temperature-slider').value = 0.8;
  document.getElementById('temperature-value').textContent = '0.8';
  updatePromptStats();
  
  addActivityLog('🔄 All settings restored to defaults');
  await loadCurrentStatus();
}

// Activity log functions
function addActivityLog(message) {
  const timestamp = new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  activityLog.unshift({ timestamp, message });
  
  // Keep only last 50 entries
  if (activityLog.length > 50) {
    activityLog = activityLog.slice(0, 50);
  }
  
  updateActivityLogDisplay();
}

function updateActivityLogDisplay() {
  const logContainer = document.getElementById('activity-log');
  logContainer.innerHTML = '';
  
  activityLog.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="activity-time">${entry.timestamp}</span>
      ${entry.message}
    `;
    logContainer.appendChild(item);
  });
}

function clearActivityLog() {
  activityLog = [];
  updateActivityLogDisplay();
  addActivityLog('🗑️ Activity log cleared');
}

function exportData() {
  const data = {
    status: currentStatus,
    activityLog: activityLog,
    exportTime: new Date().toISOString(),
    version: '2.1'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `twitter-bot-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
  addActivityLog('📤 Data exported successfully');
}

// Periodic status updates
function startStatusUpdates() {
  // Update status every 5 seconds
  setInterval(async () => {
    await loadCurrentStatus();
  }, 5000);
  
  // Add sample activity log entries
  setTimeout(() => {
    addActivityLog('✅ Enhanced control panel connected');
  }, 1000);
}