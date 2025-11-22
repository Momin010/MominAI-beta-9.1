import React from 'react';
import { Link } from 'react-router-dom';
import { CodeIcon } from './icons';

interface ProjectCardProps {
    projectId: string;
    name: string;
    lastUpdated: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ projectId, name, lastUpdated }) => {
    return (
        <Link to={`/ide/${projectId}`} className="block group">
            <div className="glass-panel p-6 rounded-lg h-full flex flex-col justify-between transition-all duration-300 hover:border-white/40 hover:scale-105">
                <div>
                    <div className="flex items-center justify-center w-12 h-12 bg-black/20 rounded-lg mb-4">
                        <CodeIcon className="w-6 h-6 text-blue-300" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{name}</h3>
                </div>
                <p className="text-sm text-gray-300 mt-4">Last updated {lastUpdated}</p>
            </div>
        </Link>
    );
};
