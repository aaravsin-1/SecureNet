
import { useState } from 'react';
import { Navbar } from './Navbar';
import { TopicsTab } from './TopicsTab';
import { ChatTab } from './ChatTab';
import { FilesTab } from './FilesTab';

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('topics');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'topics':
        return <TopicsTab />;
      case 'chat':
        return <ChatTab />;
      case 'files':
        return <FilesTab />;
      default:
        return <TopicsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-background matrix-bg">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderActiveTab()}
      </main>
    </div>
  );
};
