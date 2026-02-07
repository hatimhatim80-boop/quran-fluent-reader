import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDiagnosticModeStore } from '@/stores/diagnosticModeStore';
import { Lock, Unlock, Stethoscope, X } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticModeActivatorProps {
  children: React.ReactNode;
}

export function DiagnosticModeActivator({ children }: DiagnosticModeActivatorProps) {
  const { isEnabled, handleGestureClick, verifyPassword, disable } = useDiagnosticModeStore();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const handleClick = useCallback(() => {
    if (isEnabled) {
      // Already enabled - do nothing on click
      return;
    }
    
    const activated = handleGestureClick();
    if (activated) {
      toast.success('🔓 تم تفعيل وضع التشخيص', {
        description: 'انقر 5 مرات متتالية أخرى للخروج',
      });
    }
  }, [isEnabled, handleGestureClick]);
  
  const handlePasswordSubmit = async () => {
    setIsVerifying(true);
    const success = await verifyPassword(password);
    setIsVerifying(false);
    
    if (success) {
      toast.success('🔓 تم تفعيل وضع التشخيص');
      setShowPasswordDialog(false);
      setPassword('');
    } else {
      toast.error('كلمة المرور غير صحيحة');
    }
  };
  
  const handleDisable = () => {
    disable();
    toast.info('تم إلغاء وضع التشخيص');
  };
  
  return (
    <>
      {/* Clickable wrapper for gesture activation */}
      <div 
        onClick={handleClick}
        className="cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        {children}
      </div>
      
      {/* Password Dialog (for alternative activation) */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[350px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-arabic">
              <Lock className="w-5 h-5" />
              وضع التشخيص
            </DialogTitle>
            <DialogDescription className="font-arabic">
              أدخل كلمة مرور المسؤول لتفعيل وضع التشخيص
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-arabic">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowPasswordDialog(false)}
            >
              إلغاء
            </Button>
            <Button 
              onClick={handlePasswordSubmit}
              disabled={isVerifying || !password}
            >
              {isVerifying ? 'جاري التحقق...' : 'تفعيل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Badge component that shows when diagnostic mode is active
export function DiagnosticModeBadge() {
  const { isEnabled, disable } = useDiagnosticModeStore();
  
  if (!isEnabled) return null;
  
  return (
    <Badge 
      variant="destructive" 
      className="fixed top-2 left-2 z-50 gap-1 cursor-pointer animate-pulse"
      onClick={() => {
        if (confirm('هل تريد إلغاء وضع التشخيص؟')) {
          disable();
          toast.info('تم إلغاء وضع التشخيص');
        }
      }}
    >
      <Stethoscope className="w-3 h-3" />
      وضع التشخيص
      <X className="w-3 h-3" />
    </Badge>
  );
}

// Wrapper that only shows children when diagnostic mode is enabled
export function DiagnosticModeOnly({ children }: { children: React.ReactNode }) {
  const { isEnabled } = useDiagnosticModeStore();
  
  if (!isEnabled) return null;
  
  return <>{children}</>;
}
