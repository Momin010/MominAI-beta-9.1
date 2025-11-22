import React from 'react';
import { SpinnerIcon, CheckCircle2Icon } from './icons';
import type { FileNode, ChatMessage } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsPanelProps {
  files: FileNode;
  chatHistory: ChatMessage[];
  theme: 'light' | 'dark';
}

const countFileTypes = (node: FileNode, counts: { [key: string]: number } = {}): { [key: string]: number } => {
  if (node.type === 'file') {
    const extension = node.name.split('.').pop()?.toLowerCase() || 'other';
    counts[extension] = (counts[extension] || 0) + 1;
  } else if (node.children) {
    node.children.forEach(child => countFileTypes(child, counts));
  }
  return counts;
};

const countTotalFiles = (node: FileNode): number => {
    if (node.type === 'file') return 1;
    if (!node.children) return 0;
    return node.children.reduce((acc, child) => acc + countTotalFiles(child), 0);
}

const MetricCard: React.FC<{ title: string; value: string; subtext: string }> = ({ title, value, subtext }) => (
  <div className="glass-panel p-4 rounded-lg">
    <h3 className="text-sm font-medium text-gray-300 dark:text-gray-300">{title}</h3>
    <p className="text-2xl font-semibold text-white dark:text-white mt-1">{value}</p>
    <p className="text-xs text-gray-300 dark:text-gray-400 mt-1">{subtext}</p>
  </div>
);

// Add this for label calculation
const RADIAN = Math.PI / 180;

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ files, chatHistory, theme }) => {
    const totalTokens = chatHistory.reduce((acc, msg) => acc + (msg.usageMetadata?.totalTokenCount || 0), 0);
    const totalFiles = countTotalFiles(files);
    const estimatedWorth = (totalFiles * 50 + totalTokens * 0.001).toFixed(2);

    const fileCounts = countFileTypes(files);
    const pieData = Object.entries(fileCounts).map(([name, value]) => ({ name: `.${name}`, value })).sort((a,b) => b.value - a.value);
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1975'];

    // Mock data for the line chart
    const tokenData = [
        { name: 'Day 1', tokens: Math.floor(totalTokens * 0.1) || 1500 },
        { name: 'Day 2', tokens: Math.floor(totalTokens * 0.25) || 3000 },
        { name: 'Day 3', tokens: Math.floor(totalTokens * 0.15) || 2000 },
        { name: 'Day 4', tokens: Math.floor(totalTokens * 0.3) || 4500 },
        { name: 'Day 5', tokens: Math.floor(totalTokens * 0.5) || 5000 },
        { name: 'Day 6', tokens: Math.floor(totalTokens * 0.75) || 8000 },
        { name: 'Day 7', tokens: totalTokens || 12000 },
    ];

    const chartColors = {
        dark: { text: '#e0e0e0', line: '#ffffff30', tooltipBg: '#00000080', tooltipBorder: '#ffffff30' },
        light: { text: '#f0f0f0', line: '#ffffff50', tooltipBg: '#ffffff30', tooltipBorder: '#ffffff50' }
    };
    const currentChartColors = chartColors[theme];
    
    // FIX: The formatter property on Pie's label object has a restrictive type.
    // Use a custom label renderer function to achieve the desired format.
    const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, name }: any) => {
        // Simple positioning for the label outside the pie chart
        const radius = outerRadius * 1.3;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const textAnchor = x > cx ? 'start' : 'end';

        if (!percent || percent < 0.02) return null; // Don't render for very small slices

        return (
            <text x={x} y={y} fill={currentChartColors.text} textAnchor={textAnchor} dominantBaseline="central" fontSize={12}>
                {`${name} ${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="w-full h-full bg-transparent p-4 sm:p-6 overflow-y-auto">
            <h1 className="text-2xl font-bold text-white dark:text-white mb-6">Analytics Dashboard</h1>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <MetricCard title="Total Tokens Used" value={totalTokens.toLocaleString()} subtext="Across all conversations" />
                <MetricCard title="Estimated App Worth" value={`$${estimatedWorth}`} subtext="Based on files & AI usage" />
                <MetricCard title="Total Files" value={totalFiles.toString()} subtext="In the current workspace" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <div className="lg:col-span-3 glass-panel p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-200 dark:text-gray-200 mb-4">Token Usage Over Time (Simulated)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={tokenData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={currentChartColors.line} />
                            <XAxis dataKey="name" stroke={currentChartColors.text} fontSize={12} />
                            <YAxis stroke={currentChartColors.text} fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: currentChartColors.tooltipBg, border: `1px solid ${currentChartColors.tooltipBorder}`, backdropFilter: 'blur(5px)' }} 
                                     itemStyle={{ color: currentChartColors.text }} 
                                     labelStyle={{ color: currentChartColors.text }} />
                            <Legend wrapperStyle={{fontSize: "14px", color: currentChartColors.text}}/>
                            <Area type="monotone" dataKey="tokens" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="lg:col-span-2 glass-panel p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-200 dark:text-gray-200 mb-4">Project Composition</h3>
                    <ResponsiveContainer width="100%" height={300} key={theme}>
                         <PieChart>
                            <Pie 
                                data={pieData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                outerRadius={80} 
                                fill="#8884d8" 
                                labelLine={false} 
                                label={renderCustomizedLabel}
                            >
                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: currentChartColors.tooltipBg, border: `1px solid ${currentChartColors.tooltipBorder}`, backdropFilter: 'blur(5px)' }}
                                     itemStyle={{ color: currentChartColors.text }}
                                     labelStyle={{ color: currentChartColors.text }}/>
                            <Legend wrapperStyle={{fontSize: "14px", color: currentChartColors.text}}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};