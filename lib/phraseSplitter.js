/**
 * Sophisticated phrase splitter that handles quoted phrases and embedded quotes
 * 
 * Rules:
 * 1. Split on sentence endings (. ! ?) followed by whitespace
 * 2. Handle quoted phrases that follow a colon as separate phrases
 * 3. Keep embedded quotes within their containing phrase
 * 4. Preserve context for dialogue and narrative structure
 * 5. Handle various quote styles: "text", 'text', "text", 'text'
 */

export function splitIntoPhrases(text) {
  if (!text || typeof text !== 'string') {
    return []
  }

  // Normalize the text - remove extra whitespace but preserve structure
  const normalizedText = text.trim().replace(/\s+/g, ' ')
  
  // Track quote states
  let phrases = []
  let currentPhrase = ''
  let inQuotes = false
  let quoteChar = null
  let afterColon = false
  
  // Quote characters to recognize
  const quoteChars = ['"', "'", '\u201C', '\u201D', '\u2018', '\u2019']
  const openQuotes = ['"', "'", '\u201C', '\u2018']
  const closeQuotes = ['"', "'", '\u201D', '\u2019']
  
  // Helper function to check if character is a quote
  function isQuoteChar(char) {
    return quoteChars.includes(char)
  }
  
  // Helper function to get matching close quote
  function getMatchingCloseQuote(openChar) {
    const index = openQuotes.indexOf(openChar)
    return index !== -1 ? closeQuotes[index] : openChar
  }
  
  // Helper function to check if we're at a sentence boundary
  function isSentenceEnd(char, nextChar) {
    return ['.', '!', '?'].includes(char) && 
           (!nextChar || /\s/.test(nextChar) || isQuoteChar(nextChar))
  }
  
  // Helper function to add a phrase if it's not empty
  function addPhrase(phrase) {
    const trimmed = phrase.trim()
    if (trimmed) {
      phrases.push(trimmed)
    }
  }
  
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i]
    const nextChar = normalizedText[i + 1]
    const prevChar = normalizedText[i - 1]
    
    currentPhrase += char
    
    // Handle quote detection
    if (isQuoteChar(char)) {
      if (!inQuotes) {
        // Starting a quote
        inQuotes = true
        quoteChar = getMatchingCloseQuote(char)
        
        // Check if this quote follows a colon (dialogue/quoted speech)
        const beforeQuote = currentPhrase.slice(0, -1).trim()
        if (beforeQuote.endsWith(':')) {
          afterColon = true
        }
      } else if (char === quoteChar || (quoteChar === char)) {
        // Ending a quote
        inQuotes = false
        
        // If this was a quote after a colon, it should be its own phrase
        if (afterColon) {
          addPhrase(currentPhrase)
          currentPhrase = ''
          afterColon = false
          continue
        }
        
        quoteChar = null
      }
    }
    
    // Handle colon detection (potential dialogue marker)
    if (char === ':' && !inQuotes) {
      // Look ahead to see if there's a quote coming
      let hasQuoteAhead = false
      for (let j = i + 1; j < Math.min(i + 10, normalizedText.length); j++) {
        if (isQuoteChar(normalizedText[j])) {
          hasQuoteAhead = true
          break
        }
        if (!/\s/.test(normalizedText[j])) {
          break
        }
      }
      
      if (hasQuoteAhead) {
        // This colon introduces dialogue, prepare for quote handling
        afterColon = true
      }
    }
    
    // Handle sentence endings
    if (isSentenceEnd(char, nextChar) && !inQuotes) {
      // Check if the next non-whitespace character starts a new sentence
      let nextNonSpace = ''
      for (let j = i + 1; j < normalizedText.length; j++) {
        if (!/\s/.test(normalizedText[j])) {
          nextNonSpace = normalizedText[j]
          break
        }
      }
      
      // Split here if:
      // 1. Next character is uppercase (new sentence)
      // 2. Next character is a quote (dialogue)
      // 3. We're at the end of text
      if (!nextNonSpace || 
          /[A-Z]/.test(nextNonSpace) || 
          isQuoteChar(nextNonSpace) ||
          i === normalizedText.length - 1) {
        
        addPhrase(currentPhrase)
        currentPhrase = ''
        afterColon = false
      }
    }
  }
  
  // Add any remaining phrase
  addPhrase(currentPhrase)
  
  return phrases
}

/**
 * Format phrases with empty lines between them
 */
export function formatPhrasesWithSpacing(phrases) {
  return phrases.join('\n\n')
}

/**
 * Main function to split transcript into phrases with spacing
 */
export function splitTranscriptIntoPhrases(transcript) {
  const phrases = splitIntoPhrases(transcript)
  return formatPhrasesWithSpacing(phrases)
}

/**
 * Get phrase count and statistics
 */
export function getPhraseStats(transcript) {
  const phrases = splitIntoPhrases(transcript)
  const totalWords = transcript.split(/\s+/).length
  const avgWordsPerPhrase = phrases.length > 0 ? Math.round(totalWords / phrases.length) : 0
  
  return {
    phraseCount: phrases.length,
    totalWords,
    avgWordsPerPhrase,
    phrases
  }
}
