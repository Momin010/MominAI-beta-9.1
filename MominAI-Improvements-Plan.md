# MominAI Performance & Security Improvements

## 🚀 PERFORMANCE OPTIMIZATION

### 1. **Bundle Size Reduction (Current: ~2.5MB → Target: <1.5MB)**

#### **A. Code Splitting & Lazy Loading**
```typescript
// In App.tsx - Replace static imports with lazy loading
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const IdeLayout = React.lazy(() => import('./components/IdeLayout'));
const AuthPage = React.lazy(() => import('./components/AuthPage'));
const DiffModal = React.lazy(() => import('./components/DiffModal'));

// Wrap with Suspense in renderView()
<Suspense fallback={<LoadingSpinner />}>
  {renderView()}
</Suspense>
```

#### **B. Vite Configuration Updates**
```typescript
// vite.config.ts - Add manual chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'monaco-vendor': ['monaco-editor', '@monaco-editor/react'],
          'ai-vendor': ['@google/genai', '@supabase/supabase-js'],
          'ui-vendor': ['lucide-react', 'recharts', 'date-fns'],
          'webcontainer-vendor': ['@webcontainer/api']
        }
      }
    }
  }
})
```

#### **C. Component Memoization**
```typescript
// Memoize heavy components in IdeLayout.tsx
const MemoizedCodeEditor = React.memo(CodeEditor, (prevProps, nextProps) => {
  return (
    prevProps.fileSystem === nextProps.fileSystem &&
    prevProps.activeFile === nextProps.activeFile &&
    prevProps.isBuilding === nextProps.isBuilding
  );
});

const MemoizedLeftPanel = React.memo(LeftPanel);
const MemoizedCenterPanel = React.memo(CenterPanel);
```

### 2. **WebContainer Optimization**

#### **A. Boot Performance**
```typescript
// In IdeLayout.tsx - Optimize WebContainer boot
const bootOptimizedWebContainer = async () => {
  return WebContainer.boot({
    workdirName: 'mominai',
    terminal: { cols: 80, rows: 24 }
  });
};

// Cache boot result
let webcontainerInstance: WebContainer | null = null;
const getWebContainer = () => {
  if (!webcontainerInstance) {
    webcontainerInstance = bootOptimizedWebContainer();
  }
  return webcontainerInstance;
};
```

#### **B. File System Caching**
```typescript
// Cache file system operations
class OptimizedFileSystem {
  private cache = new Map<string, string>();
  private operationsQueue: Promise<any> = Promise.resolve();

  async readFile(path: string) {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }
    
    const content = await wc.fs.readFile(path);
    this.cache.set(path, content);
    return content;
  }
}
```

### 3. **API Call Optimization**

#### **A. Request Deduplication**
```typescript
// In aiService.ts - Add request caching
const apiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

const getCachedResponse = (key: string) => {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};
```

#### **B. Debounced API Calls**
```typescript
// In IdeLayout.tsx
const debouncedFileSystemUpdate = useCallback(
  debounce((newFs: FileSystem) => {
    setDraftFileSystem(newFs);
    syncToWebContainer(newFs);
  }, 100),
  []
);
```

---

## 🔒 SECURITY HARDENING

### 1. **Critical Security Fixes**

#### **A. Remove Hardcoded API Keys (CRITICAL)**
```typescript
// services/aiService.ts - REMOVE these lines:
const openRouterApiKeys = [
    "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",
    "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",
].map(key => key.trim()).filter(Boolean);

// REPLACE with environment variables:
const openRouterApiKeys = process.env.OPENROUTER_API_KEYS?.split(',').map(k => k.trim()) || [];
```

#### **B. Environment Configuration**
```bash
# .env.example - Add all required variables
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
CLAUDE_API_KEY=your_claude_key
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEYS=key1,key2,key3
PEXELS_API_KEY=your_pexels_key
```

#### **C. API Key Validation**
```typescript
// Add to aiService.ts
const validateApiKeys = () => {
  const requiredKeys = ['gemini', 'claude', 'openai', 'groq'];
  const missingKeys = requiredKeys.filter(provider => !getApiKey(provider as AiProvider));
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing API keys for: ${missingKeys.join(', ')}`);
  }
};
```

### 2. **Input Validation & Sanitization**

#### **A. User Input Sanitization**
```typescript
// Add to components/LandingPage.tsx and Dashboard.tsx
const sanitizePrompt = (input: string) => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
};

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const sanitizedPrompt = sanitizePrompt(prompt);
  // ... rest of logic
};
```

#### **B. File System Security**
```typescript
// Add path validation to file operations
const validateFilePath = (path: string) => {
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid file path');
  }
  if (path.length > 255) {
    throw new Error('File path too long');
  }
};

// In aiService.ts tools validation
const tools = [
  // ... existing tools
  {
    name: "create_or_update_files",
    parameters: {
      type: Type.OBJECT,
      properties: {
        files: {
          type: Type.OBJECT,
          properties: {}
        }
      },
      required: ["files"]
    },
    validate: (args: any) => {
      Object.keys(args.files || {}).forEach(path => validateFilePath(path));
      return true;
    }
  }
];
```

### 3. **Rate Limiting & Abuse Prevention**

#### **A. Client-Side Rate Limiting**
```typescript
// Add to aiService.ts
class RateLimiter {
  private requests = new Map<string, number[]>();
  
  canMakeRequest(provider: AiProvider): boolean {
    const now = Date.now();
    const window = 60000; // 1 minute
    const maxRequests = 10; // per minute per provider
    
    const providerRequests = this.requests.get(provider) || [];
    const recentRequests = providerRequests.filter(time => now - time < window);
    
    if (recentRequests.length >= maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(provider, recentRequests);
    return true;
  }
}
```

#### **B. Session Management**
```typescript
// Add to AuthContext.tsx
const sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours

useEffect(() => {
  const checkSession = setInterval(() => {
    if (session && session.expires_at) {
      const expiresAt = new Date(session.expires_at * 1000).getTime();
      const now = new Date().getTime();
      
      if (now > expiresAt - 300000) { // 5 minutes before expiry
        refreshSession();
      }
    }
  }, 60000); // Check every minute
  
  return () => clearInterval(checkSession);
}, [session]);
```

---

## 🎯 BIGGEST IMPROVEMENT OPPORTUNITIES

### 1. **Unified Deployment Strategy**
- **Current**: Separate frontend/backend deployments
- **Issue**: Complex DevOps, longer deployment times
- **Solution**: Single deployment like Bolt.new (Remix/Next.js)
- **Impact**: 70% reduction in deployment complexity

### 2. **Real-time Collaboration**
- **Current**: No multi-user features
- **Bolt.new**: No multi-user either
- **Opportunity**: Add real-time editing like Google Docs
- **Tech**: WebRTC + Supabase Realtime
- **Impact**: Major competitive advantage

### 3. **Intelligent Code Suggestions**
- **Current**: Basic AI interaction
- **Bolt.new**: Basic action system
- **Opportunity**: Context-aware code completion
- **Tech**: Monaco Editor + AI API integration
- **Impact**: 10x better developer experience

### 4. **Project Templates & Marketplace**
- **Current**: Empty project starts
- **Opportunity**: Pre-built project templates
- **Tech**: GitHub integration + template system
- **Impact**: Faster project creation, viral growth

### 5. **Mobile-First Optimization**
- **Current**: Desktop-focused
- **Issue**: Poor mobile experience
- **Solution**: PWA + mobile-optimized interface
- **Impact**: 3x larger addressable market

---

## 📈 PRIORITY IMPLEMENTATION ROADMAP

### **Week 1: Critical Security**
1. ✅ Remove hardcoded API keys
2. ✅ Environment configuration
3. ✅ Input sanitization
4. ✅ Basic rate limiting

### **Week 2: Performance**
1. ✅ Code splitting & lazy loading
2. ✅ Bundle optimization
3. ✅ WebContainer optimization
4. ✅ API caching

### **Week 3: Production Infrastructure**
1. ✅ Unified deployment
2. ✅ Error monitoring
3. ✅ Performance monitoring
4. ✅ Security audit

### **Week 4-8: Competitive Features**
1. Real-time collaboration
2. Project templates
3. Mobile optimization
4. Advanced code suggestions

---

## 🎯 SUCCESS METRICS

### **Performance Targets**
- **Bundle Size**: <1.5MB (from 2.5MB)
- **First Contentful Paint**: <1.5s
- **Time to Interactive**: <3s
- **WebContainer Boot**: <3s

### **Security Targets**
- **Zero hardcoded secrets**
- **100% input validation**
- **Rate limiting on all endpoints**
- **Security audit score: A+**

### **User Experience**
- **Page load time**: <2s
- **AI response time**: <5s
- **Mobile usability score**: 90+
- **User satisfaction**: 4.5/5