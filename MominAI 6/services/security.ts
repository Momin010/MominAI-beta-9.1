// Security utilities for MominAI
export class SecurityManager {
  private static rateLimitMap = new Map<string, number[]>();
  
  // Input sanitization
  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .trim();
  }
  
  // File path validation
  static validateFilePath(path: string): boolean {
    if (!path || typeof path !== 'string') return false;
    if (path.includes('..') || path.includes('/') || path.includes('\\')) return false;
    if (path.length > 255) return false;
    return true;
  }
  
  // Rate limiting per IP/provider
  static canMakeRequest(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
    const now = Date.now();
    const requests = this.rateLimitMap.get(identifier) || [];
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.rateLimitMap.set(identifier, recentRequests);
    return true;
  }
  
  // API key validation
  static validateApiKeys(): { isValid: boolean; missingKeys: string[] } {
    const requiredKeys = ['gemini', 'claude', 'openai', 'groq'];
    const missingKeys: string[] = [];
    
    for (const key of requiredKeys) {
      const apiKey = this.getApiKey(key as any);
      if (!apiKey || apiKey.trim() === '') {
        missingKeys.push(key);
      }
    }
    
    return {
      isValid: missingKeys.length === 0,
      missingKeys
    };
  }
  
  private static getApiKey(provider: any): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`${provider}_api_key`);
  }
}