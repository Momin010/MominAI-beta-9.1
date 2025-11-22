import React, { useState } from 'react';
import type { AIAction, AITask, TaskStatus } from '../types';
import {
    SparklesIcon, ListChecksIcon, TerminalIcon, EyeIcon, FilePlus2Icon,
    EditIcon, HammerIcon, WrenchIcon, ChevronRightIcon, CheckCircleIcon,
    ChevronUpIcon, ChevronDownIcon, SpinnerIcon, GlobeIcon, ShieldCheckIcon,
    BrainCircuitIcon
} from './icons/Icons';

// --- Task Journal (New) ---

const getTaskStatusDetails = (status: TaskStatus): { icon: React.ReactNode, color: string } => {
  switch (status) {
    case 'PENDING':
      return { icon: <div className="w-5 h-5 mt-0.5 border-2 border-gray-400 dark:border-gray-400 rounded-full"></div>, color: 'text-gray-300 dark:text-gray-300' };
    case 'IN_PROGRESS':
      return { icon: <SpinnerIcon className="w-5 h-5 animate-spin" />, color: 'text-blue-400 dark:text-blue-300' };
    case 'COMPLETED':
      return { icon: <CheckCircleIcon className="w-5 h-5" />, color: 'text-green-500 dark:text-green-400' };
    case 'FAILED':
      return { icon: <WrenchIcon className="w-5 h-5" />, color: 'text-red-400 dark:text-red-400' };
    default:
        return { icon: <div className="w-5 h-5" />, color: '' };
  }
};

const getActionDetails = (action: AIAction): { icon: React.ReactNode, text: React.ReactNode, pill?: string } => {
  switch (action.type) {
    case 'THINKING':
      return { icon: <SparklesIcon className="w-5 h-5 text-gray-300 dark:text-gray-300 animate-pulse-opacity" />, text: <span className="text-gray-300 dark:text-gray-300">Thinking...</span> };
    case 'PLANNING':
      return { icon: <ListChecksIcon className="w-5 h-5 text-gray-300 dark:text-gray-300" />, text: <span className="text-gray-300 dark:text-gray-300">Planning the file structure and tasks</span> };
    case 'PLAN_GENERATE':
        return { icon: <ListChecksIcon className="w-5 h-5 text-purple-400 dark:text-purple-300" />, text: <span className="text-gray-300 dark:text-gray-300">Generating project plan & PRD...</span> };
    case 'RESEARCH':
        return { icon: <BrainCircuitIcon className="w-5 h-5 text-purple-400 dark:text-purple-300 animate-pulse" />, text: <span className="text-gray-300 dark:text-gray-300">{action.target}</span> };
    case 'SEARCH':
        return { icon: <GlobeIcon className="w-5 h-5 text-blue-400 dark:text-blue-300" />, text: 'Searching the web', pill: action.target };
    case 'INSTALL':
      return { icon: <TerminalIcon className="w-5 h-5 text-gray-300 dark:text-gray-200" />, text: 'Install', pill: 'project dependencies' };
    case 'READ':
      return { icon: <EyeIcon className="w-5 h-5 text-gray-300 dark:text-gray-200" />, text: 'Read', pill: action.target };
    case 'WRITE':
      return { icon: <FilePlus2Icon className="w-5 h-5 text-green-500 dark:text-green-400" />, text: 'Wrote', pill: action.target };
    case 'EDIT':
      return { icon: <EditIcon className="w-5 h-5 text-blue-500 dark:text-blue-300" />, text: 'Edited', pill: action.target };
    case 'BUILD':
      return { icon: <HammerIcon className="w-5 h-5 text-gray-300 dark:text-gray-200" />, text: 'Built the project to verify everything works' };
    case 'FIXING':
      return { icon: <WrenchIcon className="w-5 h-5 text-yellow-400 dark:text-yellow-300" />, text: 'An error occurred. Attempting to fix...' };
    case 'VALIDATING':
      return { icon: <ShieldCheckIcon className="w-5 h-5 text-indigo-400 dark:text-indigo-300 animate-pulse" />, text: 'Running automated code review...' };
    case 'COMMAND':
      return { icon: <ChevronRightIcon className="w-5 h-5 text-gray-300 dark:text-gray-200" />, text: 'Run', pill: action.target };
    case 'COMPLETE':
      return { icon: <CheckCircleIcon className="w-5 h-5 text-green-500 dark:text-green-400" />, text: 'Task complete' };
    case 'TASK_START':
    case 'TASK_COMPLETE':
    case 'TASK_FAIL':
        return { icon: <></>, text: <></> }; // Task actions are handled by TaskJournal, so they render nothing here.
    default:
      return { icon: <div className="w-5 h-5" />, text: 'Unknown action' };
  }
};

const TaskActionRow: React.FC<{ action: AIAction }> = ({ action }) => {
    const { icon, pill } = getActionDetails(action);

    if (action.type !== 'WRITE' && action.type !== 'EDIT' && action.type !== 'READ') {
        return null;
    }

    return (
        <div className="flex items-center text-xs ml-4 py-1 group">
            <div className="w-5 flex-shrink-0">{icon}</div>
            <span className="ml-2 font-mono text-gray-400 dark:text-gray-400 truncate" title={pill}>{pill}</span>
        </div>
    );
};


const TaskRow: React.FC<{ task: AITask }> = ({ task }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { icon, color } = getTaskStatusDetails(task.status);
    const fileActions = task.actions?.filter(a => ['WRITE', 'EDIT', 'READ'].includes(a.type)) || [];
    const hasActions = fileActions.length > 0;

    return (
        <>
            <div
                className={`flex items-start text-sm mb-3 group ${hasActions ? 'cursor-pointer' : ''} ${task.status === 'COMPLETED' ? 'opacity-60' : ''}`}
                onClick={() => hasActions && setIsOpen(!isOpen)}
            >
                <div className={`w-6 flex-shrink-0 flex items-center justify-center ${color}`}>{icon}</div>
                <span className="ml-3 text-gray-200 dark:text-gray-200 flex-1">{task.description}</span>
                {hasActions && (
                    <ChevronDownIcon className={`w-4 h-4 ml-2 text-gray-400 dark:text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </div>
            {isOpen && hasActions && (
                <div className="pl-4 pb-2 -mt-2">
                    {fileActions.map((action, index) => <TaskActionRow key={index} action={action} />)}
                </div>
            )}
        </>
    );
};

const TaskJournal: React.FC<{ tasks: AITask[], isLoading: boolean }> = ({ tasks, isLoading }) => {
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const totalTasks = tasks.length;

  const renderHeader = () => (
    <div className="flex items-center text-sm mb-3">
        {isLoading ? <SpinnerIcon className="w-5 h-5 text-gray-300 dark:text-gray-300 animate-spin" /> : <CheckCircleIcon className="w-5 h-5 text-green-500 dark:text-green-400"/>}
        <span className="ml-2 font-semibold text-gray-200 dark:text-gray-200">
            Tasks ({completedTasks}/{totalTasks} Complete)
        </span>
    </div>
  );

  return (
    <div className="bg-black/20 dark:bg-black/20 p-4 rounded-md my-2">
        {renderHeader()}
        <div className="pl-1 mt-3 border-l-2 border-gray-400/50 dark:border-gray-500/50 ml-2.5">
            {tasks.map((task) => (
                <div key={task.id} className="pl-4 relative">
                    {/* The line connecting the dots */}
                    <div className="absolute left-[-11px] top-3 w-5 h-px bg-gray-400/50 dark:bg-gray-500/50"></div>
                    <TaskRow task={task} />
                </div>
            ))}
        </div>
    </div>
  );
};


// --- Action Journal (Original) ---

const ActionRow: React.FC<{ action: AIAction }> = ({ action }) => {
    const { icon, text, pill } = getActionDetails(action);
    const hasLink = action.type === 'WRITE' || action.type === 'EDIT';

    if (!text) return null;

    return (
        <div className="flex items-center text-sm mb-2 group">
            <div className="w-6">{icon}</div>
            <span className="ml-2 text-gray-200 dark:text-gray-200">{text}</span>
            {pill && <span className="ml-2 px-2 py-0.5 bg-black/20 dark:bg-black/30 text-gray-200 dark:text-gray-200 rounded-md font-mono text-xs">{pill}</span>}
            <div className="flex-grow"></div>
        </div>
    );
};

const ActionJournal: React.FC<{ actions: AIAction[], isLoading: boolean }> = ({ actions, isLoading }) => {
  const [isOpen, setIsOpen] = useState(true);
  const onToggle = () => setIsOpen(!isOpen);

  const visibleActions = actions.filter(a => a.type !== 'TASK_START' && a.type !== 'TASK_COMPLETE' && a.type !== 'TASK_FAIL');

  const actionCount = visibleActions.length;
  if (actionCount === 0) return null;

  const renderHeader = () => (
    <div className="flex items-center text-sm mb-2 cursor-pointer" onClick={onToggle}>
        {isLoading ? <SpinnerIcon className="w-5 h-5 text-gray-300 dark:text-gray-300 animate-spin" /> : <CheckCircleIcon className="w-5 h-5 text-green-500 dark:text-green-400"/>}
        <span className="ml-2 font-semibold text-gray-200 dark:text-gray-200">{actionCount} action{actionCount !== 1 ? 's' : ''} taken</span>
        <div className="flex-grow"></div>
        {isOpen ? <ChevronUpIcon className="w-5 h-5 text-gray-400 dark:text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400 dark:text-gray-400" />}
    </div>
  );

  return (
    <div className="bg-black/20 dark:bg-black/20 p-3 rounded-md my-2">
        {renderHeader()}
        {isOpen && (
            <div className="pl-1 mt-2 border-l border-gray-400/50 dark:border-gray-500/50 ml-2">
                {visibleActions.map((action, index) => (
                    <div key={index} className="pl-3">
                      <ActionRow action={action} />
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};


// --- Main Component ---

interface AIActionJournalProps {
  actions?: AIAction[];
  tasks?: AITask[];
  isLoading: boolean;
}

export const AIActionJournal: React.FC<AIActionJournalProps> = ({ actions, tasks, isLoading }) => {
  // Prefer the new TaskJournal if tasks are available
  if (tasks && tasks.length > 0) {
    return <TaskJournal tasks={tasks} isLoading={isLoading} />;
  }

  // Fallback to the original ActionJournal if there are no tasks
  if (actions && actions.length > 0) {
    return <ActionJournal actions={actions} isLoading={isLoading} />;
  }

  return null;
};