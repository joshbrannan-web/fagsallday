import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserResult {
  id: string;
  display_name: string;
}

interface UserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (user: UserResult) => void;
  title?: string;
}

const UserSearchDialog: React.FC<UserSearchDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
  title = 'Link to App User',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.rpc('search_users_by_name', {
        search_term: searchTerm.trim(),
      });
      if (error) throw error;
      setResults((data as UserResult[]) || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setHasSearched(false); } onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setHasSearched(false); }}
            onKeyDown={handleKeyDown}
            placeholder="Search by name..."
            autoFocus
          />
          <Button size="icon" onClick={handleSearch} disabled={isSearching || searchTerm.trim().length < 2}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.length === 0 && !isSearching && hasSearched && (
            <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                onSelect(user);
                onOpenChange(false);
                setSearchTerm('');
                setResults([]);
              }}
              className="w-full p-3 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-all flex items-center gap-3"
            >
              <UserCheck className="w-4 h-4 text-primary" />
              <span className="font-medium">{user.display_name || 'Unnamed User'}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserSearchDialog;
