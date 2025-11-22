import React, { useState, useEffect } from 'react';

interface WebContainerPreviewProps {
  iframeUrl: string;
  status: string;
}

const inspirationCards = [
  {
    title: 'Build a Habit Tracker',
    description: 'Track daily goals with interactive charts and streaks.',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726a?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    title: 'Create a Portfolio Site',
    description: 'Showcase your best work with a stunning, responsive design.',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    title: 'Launch a Notes App',
    description: 'Organize your thoughts with a clean, minimalist interface.',
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    title: 'Design a Weather Dashboard',
    description: 'Visualize real-time weather data with elegant graphs.',
    imageUrl: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  }
];


const PreviewPlaceholder: React.FC<{ status: string }> = ({ status }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex(prev => (prev + 1) % inspirationCards.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center overflow-hidden relative">
            <div className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-3 z-20">
                {inspirationCards.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-white scale-150 ring-2 ring-white/30' : 'bg-brand-muted hover:bg-white'}`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>

            <div className="relative w-[320px] h-[200px] sm:w-[400px] sm:h-[250px] md:w-[480px] md:h-[300px] mb-8">
                {inspirationCards.map((card, index) => {
                    const distance = (index - activeIndex + inspirationCards.length) % inspirationCards.length;

                    const style: React.CSSProperties = {
                        transform: `translateY(${distance * 12}px) scale(${1 - distance * 0.04})`,
                        zIndex: inspirationCards.length - distance,
                        opacity: distance > 2 ? 0 : 1,
                        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out',
                        filter: `blur(${distance > 0 ? '2px' : '0px'})`
                    };

                    if (distance > 3) return null;

                    return (
                        <div key={index} className="absolute inset-0 bg-brand-surface rounded-lg shadow-2xl p-2 border border-brand-subtle" style={style}>
                            <img src={card.imageUrl} className="w-full h-full object-cover rounded-md" alt={card.title} />
                        </div>
                    );
                })}
            </div>

            <div className="z-10 text-center">
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">
                  Spinning up preview...
                </p>
                <p className="text-sm sm:text-base text-brand-muted max-w-md mb-6">
                  While you wait, here's a taste of what you can build.
                </p>
                <p className="text-sm text-brand-muted font-mono mt-2 max-w-full truncate bg-ide-bg-darker px-3 py-1.5 rounded-md border border-brand-subtle">{status}</p>
            </div>
        </div>
    );
};


const WebContainerPreview: React.FC<WebContainerPreviewProps> = ({ iframeUrl, status }) => {
  return (
    <div className="w-full h-full bg-ide-bg-darker rounded-lg overflow-hidden flex flex-col shadow-2xl border border-brand-subtle">
        {iframeUrl ? (
            <iframe
                src={iframeUrl}
                title="Preview"
                className="w-full h-full border-0"
                allow="cross-origin-isolated"
            />
        ) : (
             <PreviewPlaceholder status={status} />
        )}
    </div>
  );
};

export default WebContainerPreview;