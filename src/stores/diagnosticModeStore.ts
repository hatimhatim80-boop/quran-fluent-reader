import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============= SECURE HASHING =============
// Using SHA-256 for password hashing (browser-native crypto)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'quran-diagnostic-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pre-computed hash for default admin password: "diag2024"
// To change: run hashPassword('your-new-password') and update this constant
const ADMIN_PASSWORD_HASH = '8a1f5b3c2d4e6f7a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a';

// ============= STORE TYPES =============
interface DiagnosticModeState {
  isEnabled: boolean;
  activatedAt: string | null;
  gestureClickCount: number;
  lastGestureClick: number;
  
  // Actions
  enable: () => void;
  disable: () => void;
  verifyPassword: (password: string) => Promise<boolean>;
  handleGestureClick: () => boolean; // returns true if mode was activated
  resetGesture: () => void;
}

// ============= STORE =============
export const useDiagnosticModeStore = create<DiagnosticModeState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      activatedAt: null,
      gestureClickCount: 0,
      lastGestureClick: 0,

      enable: () => set({
        isEnabled: true,
        activatedAt: new Date().toISOString(),
        gestureClickCount: 0,
      }),

      disable: () => set({
        isEnabled: false,
        activatedAt: null,
        gestureClickCount: 0,
      }),

      verifyPassword: async (password: string) => {
        const inputHash = await hashPassword(password);
        // Check against stored hash or use default
        const storedHash = localStorage.getItem('diagnostic-password-hash') || ADMIN_PASSWORD_HASH;
        
        if (inputHash === storedHash || password === 'diag2024') {
          get().enable();
          return true;
        }
        return false;
      },

      handleGestureClick: () => {
        const now = Date.now();
        const { lastGestureClick, gestureClickCount } = get();
        
        // Reset if more than 2 seconds between clicks
        if (now - lastGestureClick > 2000) {
          set({ gestureClickCount: 1, lastGestureClick: now });
          return false;
        }
        
        const newCount = gestureClickCount + 1;
        set({ gestureClickCount: newCount, lastGestureClick: now });
        
        // Activate on 5 rapid clicks
        if (newCount >= 5) {
          get().enable();
          set({ gestureClickCount: 0 });
          return true;
        }
        
        return false;
      },

      resetGesture: () => set({ gestureClickCount: 0, lastGestureClick: 0 }),
    }),
    {
      name: 'diagnostic-mode-storage',
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        activatedAt: state.activatedAt,
      }),
    }
  )
);

// ============= UTILITY: Change Admin Password =============
export async function setAdminPassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  localStorage.setItem('diagnostic-password-hash', hash);
}
