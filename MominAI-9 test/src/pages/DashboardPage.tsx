import React from 'react';
import { Header } from '../components/Header';
import { ProjectCard } from '../components/ProjectCard';
import { PlusIcon } from '../components/icons';

// Mock data for projects
const mockProjects = [
    { id: 'project-1', name: 'Kanban Board App', lastUpdated: '2 hours ago' },
    { id: 'project-2', name: 'E-commerce Storefront', lastUpdated: '1 day ago' },
    { id: 'project-3', name: 'Data Analytics Dashboard', lastUpdated: '3 days ago' },
    { id: 'project-4', name: 'Company Landing Page', lastUpdated: '1 week ago' },
];

const DashboardPage: React.FC = () => {
    return (
        <div className="flex flex-col h-screen w-screen text-gray-800 dark:text-gray-200 font-sans overflow-hidden">
            <Header onSettingsClick={() => {}} mainViewMode="CODE" onMainViewModeChange={() => {}} />
            <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-bold text-white">Your Projects</h1>
                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors">
                            <PlusIcon className="w-5 h-5" />
                            New Project
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {mockProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                projectId={project.id}
                                name={project.name}
                                lastUpdated={project.lastUpdated}
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;
