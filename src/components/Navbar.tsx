
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Terminal, LogOut, User, Shield, Menu, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar = ({ activeTab, setActiveTab }: NavbarProps) => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-primary/30 bg-card/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Terminal className="h-8 w-8 text-primary terminal-glow" />
              <span className="hidden sm:block text-xl font-bold text-primary">SecureNet</span>
              <Badge variant="outline" className="hidden sm:flex text-secondary border-secondary">
                <Shield className="h-3 w-3 mr-1" />
                ENCRYPTED
              </Badge>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4 ml-8">
              {['topics', 'chat', 'files'].map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  onClick={() => setActiveTab(tab)}
                  className={`capitalize ${
                    activeTab === tab 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {tab}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* User info - hidden on very small screens */}
            <div className="hidden sm:flex items-center space-x-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-mono">
                {user?.email?.split('@')[0] || 'Anonymous'}
              </span>
            </div>
            
            {/* Desktop Sign Out Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="hidden sm:flex border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-primary/30 bg-card/50 backdrop-blur-sm">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {['topics', 'chat', 'files'].map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  onClick={() => {
                    setActiveTab(tab);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full justify-start capitalize ${
                    activeTab === tab 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {tab}
                </Button>
              ))}
              
              {/* Mobile User Info and Sign Out */}
              <div className="pt-2 border-t border-primary/30">
                <div className="flex items-center space-x-2 px-3 py-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm text-primary font-mono">
                    {user?.email?.split('@')[0] || 'Anonymous'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
