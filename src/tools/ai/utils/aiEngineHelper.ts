/**
 * Shared utilities for AI engine operations with fallback support
 */

/**
 * Executes an AI chat request with automatic fallback to available engines
 * This function is designed to be used in JXA scripts and handles engine failures gracefully
 * 
 * @param theApp - The DEVONthink application object
 * @param message - The message/prompt to send to the AI
 * @param options - The chat options (engine, model, temperature, records, etc.)
 * @returns Object with response and metadata about which engine was used
 */
export function generateAIChatWithFallbackScript(): string {
  return `
    function executeAIChatWithFallback(theApp, message, options) {
      const fallbackEngines = ["ChatGPT", "Claude", "Gemini", "Mistral AI", "GPT4All", "LM Studio", "Ollama"];
      
      let aiResponse = null;
      let actualEngine = options.engine;
      let engineError = null;
      let attemptedEngines = [];
      
      // Try the requested engine first
      try {
        aiResponse = theApp.getChatResponseForMessage(message, options);
        if (aiResponse) {
          return {
            success: true,
            response: aiResponse,
            engine: actualEngine,
            requestedEngine: options.engine
          };
        }
      } catch (primaryError) {
        engineError = primaryError.toString();
        attemptedEngines.push(options.engine);
        
        // If the requested engine failed, try fallback engines
        if (engineError.includes("invalid") || 
            engineError.includes("API") || 
            engineError.includes("unauthorized") ||
            engineError.includes("not configured")) {
          
          for (let i = 0; i < fallbackEngines.length; i++) {
            const fallbackEngine = fallbackEngines[i];
            if (fallbackEngine !== options.engine && !attemptedEngines.includes(fallbackEngine)) {
              try {
                const fallbackOptions = {};
                // Copy all options except engine
                for (let key in options) {
                  if (key !== "engine") {
                    fallbackOptions[key] = options[key];
                  }
                }
                fallbackOptions["engine"] = fallbackEngine;
                
                aiResponse = theApp.getChatResponseForMessage(message, fallbackOptions);
                if (aiResponse) {
                  return {
                    success: true,
                    response: aiResponse,
                    engine: fallbackEngine,
                    requestedEngine: options.engine,
                    fallbackUsed: true
                  };
                }
              } catch (fallbackError) {
                attemptedEngines.push(fallbackEngine);
                // Continue to next fallback engine
              }
            }
          }
        }
      }
      
      // All engines failed
      return {
        success: false,
        error: engineError || "No AI engines available",
        attemptedEngines: attemptedEngines,
        requestedEngine: options.engine
      };
    }
  `;
}

/**
 * Generates a script for summarizing content with AI fallback
 * This is specifically for summarizeContentsOf operations
 */
export function generateAISummarizeWithFallbackScript(): string {
  return `
    function executeAISummarizeWithFallback(theApp, summaryOptions) {
      const fallbackEngines = ["ChatGPT", "Claude", "Gemini", "Mistral AI", "GPT4All", "LM Studio", "Ollama"];
      
      let summaryDoc = null;
      let actualEngine = summaryOptions.engine || "ChatGPT";
      let engineError = null;
      let attemptedEngines = [];
      
      // Try the requested engine first
      try {
        summaryDoc = theApp.summarizeContentsOf(summaryOptions);
        if (summaryDoc) {
          return {
            success: true,
            document: summaryDoc,
            engine: actualEngine,
            requestedEngine: summaryOptions.engine
          };
        }
      } catch (primaryError) {
        engineError = primaryError.toString();
        attemptedEngines.push(actualEngine);
        
        // If the requested engine failed, try fallback engines
        if (engineError.includes("invalid") || 
            engineError.includes("API") || 
            engineError.includes("unauthorized") ||
            engineError.includes("not configured")) {
          
          for (let i = 0; i < fallbackEngines.length; i++) {
            const fallbackEngine = fallbackEngines[i];
            if (fallbackEngine !== actualEngine && !attemptedEngines.includes(fallbackEngine)) {
              try {
                const fallbackOptions = {};
                // Copy all options
                for (let key in summaryOptions) {
                  fallbackOptions[key] = summaryOptions[key];
                }
                fallbackOptions["engine"] = fallbackEngine;
                
                summaryDoc = theApp.summarizeContentsOf(fallbackOptions);
                if (summaryDoc) {
                  return {
                    success: true,
                    document: summaryDoc,
                    engine: fallbackEngine,
                    requestedEngine: summaryOptions.engine,
                    fallbackUsed: true
                  };
                }
              } catch (fallbackError) {
                attemptedEngines.push(fallbackEngine);
                // Continue to next fallback engine
              }
            }
          }
        }
      }
      
      // All engines failed
      return {
        success: false,
        error: engineError || "No AI engines available",
        attemptedEngines: attemptedEngines,
        requestedEngine: summaryOptions.engine
      };
    }
  `;
}

/**
 * Helper to check if an AI service is available
 */
export function generateAIHealthCheckScript(): string {
  return `
    function checkAIServiceHealth(theApp) {
      const engines = ["ChatGPT", "Claude", "Gemini", "Mistral AI", "GPT4All", "LM Studio", "Ollama"];
      const availableEngines = [];
      const errors = {};
      
      for (let i = 0; i < engines.length; i++) {
        const engine = engines[i];
        try {
          const testOptions = {};
          testOptions["engine"] = engine;
          testOptions["temperature"] = 0.5;
          
          const response = theApp.getChatResponseForMessage("Test: respond with 'OK'", testOptions);
          if (response) {
            availableEngines.push(engine);
          }
        } catch (error) {
          errors[engine] = error.toString();
        }
      }
      
      return {
        available: availableEngines.length > 0,
        engines: availableEngines,
        errors: errors,
        totalEngines: engines.length,
        availableCount: availableEngines.length
      };
    }
  `;
}