import React from 'react';
import { CloudIcon, LaptopIcon } from './icons';
import type { MainViewMode } from '../types';

interface ComingSoonPanelProps {
  view: Extract<MainViewMode, 'PREVIEW' | 'CLOUD'>;
}

const viewContent = {
  PREVIEW: {
    icon: <LaptopIcon className="w-12 h-12 text-gray-300 dark:text-gray-300 mb-4" />,
    title: "Live Application Preview",
    message: "This panel will render a live preview of your frontend application.",
    status: "Coming Soon"
  },
  CLOUD: {
    icon: <CloudIcon className="w-12 h-12 text-gray-300 dark:text-gray-300 mb-4" />,
    title: "Cloud Services",
    message: "Manage deployments, storage, and cloud functions right from the IDE.",
    status: "Coming Really Soon"
  }
};

export const ComingSoonPanel: React.FC<ComingSoonPanelProps> = ({ view }) => {
  const { icon, title, message, status } = viewContent[view];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-transparent p-8 text-center">
      {icon}
      <h2 className="text-2xl font-bold text-white dark:text-white">{title}</h2>
      <p className="text-gray-200 dark:text-gray-300 mt-2">{message}</p>
      <p className="text-sm text-blue-300 dark:text-blue-300 font-semibold mt-4 bg-blue-500/30 px-3 py-1 rounded-full">
        {status}
      </p>
    </div>
  );
};