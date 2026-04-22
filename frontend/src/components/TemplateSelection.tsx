import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/session';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
}

interface TemplateSelectionProps {
  onSelect?: (templateId: string) => void;
  autoSuggest?: boolean;
}

export const TemplateSelection: React.FC<TemplateSelectionProps> = ({
  onSelect,
  autoSuggest = true,
}) => {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [suggestedTemplates, setSuggestedTemplates] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const sessionId = useSessionStore((state) => state.sessionId);
  const colTypes = useSessionStore((state) => state.colTypes);
  const setSelectedTemplateStore = useSessionStore((state) => state.setSelectedTemplate);
  const setSuggestedTemplatesStore = useSessionStore((state) => state.setSuggestedTemplates);

  useEffect(() => {
    loadTemplates();
    if (autoSuggest && sessionId && Object.keys(colTypes).length > 0) {
      suggestTemplates();
    } else {
      setLoading(false);
    }
  }, [sessionId, colTypes]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates/list');
      const data = await response.json();
      
      // Convert array response to object if needed
      if (Array.isArray(data)) {
        const templatesObj: Record<string, Template> = {};
        data.forEach((template: any) => {
          templatesObj[template.id] = template;
        });
        setTemplates(templatesObj);
      } else {
        setTemplates(data);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const suggestTemplates = async () => {
    if (!sessionId || Object.keys(colTypes).length === 0) {
      setLoading(false);
      return;
    }

    try {
      // Get column names from colTypes
      const columns = Object.keys(colTypes);

      // Call suggestion endpoint
      const response = await fetch('/api/templates/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns }),
      });

      if (!response.ok) throw new Error('Failed to suggest templates');
      
      const data = await response.json();
      const suggestions = data.suggestions || [];
      
      setSuggestedTemplates(suggestions);
      setSuggestedTemplatesStore(suggestions);
      
      // Auto-select the first suggested template
      if (suggestions.length > 0) {
        setSelectedTemplate(suggestions[0]);
      }
    } catch (err) {
      console.error('Error suggesting templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setSelectedTemplateStore(templateId);
    onSelect?.(templateId);
  };

  const getColorClass = (color?: string) => {
    const colorMap: Record<string, string> = {
      blue: 'from-blue-900 to-blue-800 border-blue-600',
      emerald: 'from-emerald-900 to-emerald-800 border-emerald-600',
      orange: 'from-orange-900 to-orange-800 border-orange-600',
      purple: 'from-purple-900 to-purple-800 border-purple-600',
      pink: 'from-pink-900 to-pink-800 border-pink-600',
    };
    return colorMap[color || 'blue'];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <div className="animate-spin text-4xl">⚙️</div>
        <p className="text-gray-400">Analisando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 w-full max-w-6xl mx-auto">
        {Object.entries(templates).map(([id, template]) => {
          const isSuggested = suggestedTemplates.includes(id);
          const isSelected = selectedTemplate === id;

          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={`relative p-6 rounded-xl border-2 transition-all duration-300 text-left group overflow-hidden ${
                isSelected
                  ? `bg-gradient-to-br ${getColorClass(template.color)} ring-2 ring-offset-2 ring-offset-slate-900 shadow-lg`
                  : isSuggested
                    ? `bg-gradient-to-br ${getColorClass(template.color)} shadow-md hover:shadow-lg`
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
              }`}
            >
              {/* Background glow effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity" />

              {/* Suggested Badge */}
              {isSuggested && !isSelected && (
                <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  ✓ Sugerido
                </div>
              )}

              {/* Selected Check */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-lg">✓</span>
                </div>
              )}

              {/* Content */}
              <div className="relative space-y-3 z-10">
                <p className="text-4xl">{template.icon}</p>
                <h3 className="text-base font-bold text-white leading-tight">
                  {template.name}
                </h3>
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                  {template.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      {selectedTemplate && (
        <div className="flex gap-4 justify-center pt-6 max-w-2xl mx-auto w-full">
          <button
            onClick={() => handleSelect(selectedTemplate)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            ✨ Usar Template: {templates[selectedTemplate]?.name}
          </button>
          <button
            onClick={() => setSelectedTemplate(null)}
            className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 rounded-xl transition-all shadow-lg"
          >
            ✕ Cancelar
          </button>
        </div>
      )}
    </div>
  );
};
