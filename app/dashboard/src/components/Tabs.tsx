import { useState } from "react";
import { motion } from "framer-motion";

interface Tab {
  id: string;
  label: string;
  content: string;
}

const tabs: Tab[] = [
  { id: "tab1", label: "Tab 1", content: "Content for Tab 1" },
  { id: "tab2", label: "Tab 2", content: "Content for Tab 2" },
  { id: "tab3", label: "Tab 3", content: "Content for Tab 3" },
  { id: "tab4", label: "Tab 4", content: "Content for Tab 4" },
];

export default function Tabs() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div className="w-full">
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-blue-600"
                : "text-gray-700 hover:text-blue-600"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                layoutId="activeTab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <div> {tabs.find((tab) => tab.id === activeTab)?.content}</div>
      </div>
    </div>
  );
}
