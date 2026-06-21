'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, BackgroundVariant } from 'reactflow';
import 'reactflow/dist/style.css';
import { X, Plus, Save, Loader2, Clock, AlertCircle, CheckCircle2, HelpCircle, Trash2, Sticker, Type } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { getUserPermissionLevel } from '../../../lib/projectPermissions';

const StickyNode = ({ data, id }) => {
  const { label, color = '#fef3c7', onDelete, onColorChange, onContentChange, canEdit } = data;
  const [localContent, setLocalContent] = useState(label || '');
  
  const colors = [
    { bg: '#fef3c7', name: 'yellow' },
    { bg: '#dbeafe', name: 'blue' },
    { bg: '#d1fae5', name: 'green' },
    { bg: '#fce7f3', name: 'pink' },
    { bg: '#ede9fe', name: 'purple' },
  ];
  
  return (
    <div style={{ background: color }} className="rounded-lg shadow-md border border-opacity-20 w-48 min-h-32 flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 rounded-t-lg" style={{backgroundColor: color, filter: 'brightness(0.9)'}}>
        <div className="flex gap-1">
          {canEdit && colors.map(c => (
            <button key={c.name} onClick={() => onColorChange(id, c.bg)} 
              className="w-3 h-3 rounded-full border border-white hover:scale-125 transition-transform"
              style={{backgroundColor: c.bg}} />
          ))}
        </div>
        {canEdit && <button onClick={() => onDelete(id)} className="text-gray-500 hover:text-red-500 ml-1"><X size={12} /></button>}
      </div>
      <div className="flex-1 p-2">
        {canEdit ? (
          <textarea
            value={localContent}
            onChange={(e) => { setLocalContent(e.target.value); onContentChange(id, e.target.value); }}
            className="w-full h-full resize-none bg-transparent text-sm text-gray-700 focus:outline-none"
            placeholder="Write your idea..."
            rows={4}
          />
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{localContent || 'Empty note'}</p>
        )}
      </div>
    </div>
  );
};

const TextLabelNode = ({ data, id }) => {
  const { label, onDelete, onLabelChange, canEdit } = data;
  const [localLabel, setLocalLabel] = useState(label || 'Label');
  return (
    <div className="relative group">
      {canEdit ? (
        <input
          value={localLabel}
          onChange={(e) => { setLocalLabel(e.target.value); onLabelChange(id, e.target.value); }}
          className="bg-transparent text-gray-800 font-semibold text-sm border-b border-dashed border-gray-400 focus:outline-none min-w-16"
        />
      ) : (
        <span className="text-gray-800 font-semibold text-sm">{localLabel}</span>
      )}
      {canEdit && (
        <button onClick={() => onDelete(id)} className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><X size={10} /></button>
      )}
    </div>
  );
};

const nodeTypes = { sticky: StickyNode, textlabel: TextLabelNode };

const IdeaCanvas = ({ project, userTeams }) => {
  const { user } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedContentRef = useRef('');

  const perms = React.useMemo(() => {
    return getUserPermissionLevel(user, project, userTeams);
  }, [user, project, userTeams]);

  const canEdit = React.useMemo(() => {
    return perms && (perms.level === 'full' || perms.level === 'write');
  }, [perms]);

  const canView = React.useMemo(() => {
    return perms !== null;
  }, [perms]);

  const deleteNode = useCallback((id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setHasUnsavedChanges(true);
  }, [setNodes]);

  const onColorChange = useCallback((id, color) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id === id) n.data = { ...n.data, color };
      return n;
    }));
    setHasUnsavedChanges(true);
  }, [setNodes]);

  const onContentChange = useCallback((id, content) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id === id) n.data = { ...n.data, label: content };
      return n;
    }));
    setHasUnsavedChanges(true);
  }, [setNodes]);

  const onLabelChange = useCallback((id, label) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id === id) n.data = { ...n.data, label };
      return n;
    }));
    setHasUnsavedChanges(true);
  }, [setNodes]);

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onDelete: deleteNode,
        onColorChange,
        onContentChange,
        onLabelChange,
        canEdit
      }
    }));
  }, [nodes, deleteNode, onColorChange, onContentChange, onLabelChange, canEdit]);

  const autoSave = useCallback(async (currentNodes, currentEdges) => {
    if (!canEdit || !project?._id) return;
    
    const contentToSave = JSON.stringify({
      nodes: currentNodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { label: n.data.label, color: n.data.color }
      })),
      edges: currentEdges
    });
    
    if (contentToSave === lastSavedContentRef.current) return;
    
    setAutoSaving(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentToSave }),
      });
      
      if (res.ok) {
        lastSavedContentRef.current = contentToSave;
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setAutoSaving(false);
    }
  }, [canEdit, project?._id]);

  useEffect(() => {
    if (hasUnsavedChanges) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSave(nodes, edges);
      }, 3000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [hasUnsavedChanges, nodes, edges, autoSave]);

  const fetchCanvas = useCallback(async () => {
    if (!project?._id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project._id}/canvas`);
      if (!res.ok) throw new Error('Failed to fetch canvas');
      const data = await res.json();
      const content = data.content;
      
      let parsedNodes = [];
      let parsedEdges = [];
      
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.nodes) parsedNodes = parsed.nodes;
          if (parsed.edges) parsedEdges = parsed.edges;
        } catch (e) {
          // Legacy string content -> single sticky note
          parsedNodes = [{
            id: 'legacy-1',
            type: 'sticky',
            position: { x: 100, y: 100 },
            data: { label: content, color: '#fef3c7' }
          }];
        }
      }
      
      setNodes(parsedNodes);
      setEdges(parsedEdges);
      lastSavedContentRef.current = JSON.stringify({ nodes: parsedNodes, edges: parsedEdges });
      setHasUnsavedChanges(false);
      setLastSaved(data.updatedAt ? new Date(data.updatedAt) : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [project?._id, setNodes, setEdges]);

  useEffect(() => {
    fetchCanvas();
  }, [fetchCanvas]);

  const saveCanvas = async () => {
    setSaving(true);
    setError(null);
    try {
      const contentToSave = JSON.stringify({
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { label: n.data.label, color: n.data.color }
        })),
        edges
      });
      const res = await fetch(`/api/projects/${project._id}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentToSave }),
      });
      if (!res.ok) throw new Error('Failed to save canvas');
      lastSavedContentRef.current = contentToSave;
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      setSuccessMessage('Canvas saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSticky = () => {
    const newNode = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      type: 'sticky',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: '', color: '#fef3c7' }
    };
    setNodes((nds) => [...nds, newNode]);
    setHasUnsavedChanges(true);
  };

  const handleAddText = () => {
    const newNode = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      type: 'textlabel',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: 'New Label' }
    };
    setNodes((nds) => [...nds, newNode]);
    setHasUnsavedChanges(true);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear the canvas?')) {
      setNodes([]);
      setEdges([]);
      setHasUnsavedChanges(true);
    }
  };

  const formatLastSaved = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
          <p className="text-yellow-800">You don't have permission to view this canvas.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold text-gray-900">Super Canvas</h2>
                <button
                  onClick={() => setHelpOpen(true)}
                  className="text-gray-400 hover:text-gray-600"
                  title="What's this?"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              </div>
            {lastSaved && (
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <Clock className="h-4 w-4 mr-1" />
                Last saved: {formatLastSaved(lastSaved)}
                {autoSaving && <span className="ml-2 text-blue-500">(Auto-saving on cloud...)</span>}
                {hasUnsavedChanges && !autoSaving && (
                  <span className="ml-2 text-orange-500">(Unsaved changes)</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {canEdit && (
              <>
                <button onClick={handleAddSticky} className="flex items-center bg-yellow-100 text-yellow-800 border border-yellow-300 text-sm px-3 py-1.5 rounded-md hover:bg-yellow-200 transition-colors">
                  <Sticker className="h-4 w-4 mr-1" /> Sticky Note
                </button>
                <button onClick={handleAddText} className="flex items-center bg-gray-100 text-gray-800 border border-gray-300 text-sm px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors">
                  <Type className="h-4 w-4 mr-1" /> Text Label
                </button>
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                <button onClick={handleClearAll} className="flex items-center bg-red-100 text-red-800 border border-red-300 text-sm px-3 py-1.5 rounded-md hover:bg-red-200 transition-colors">
                  <Trash2 className="h-4 w-4 mr-1" /> Clear All
                </button>
                {hasUnsavedChanges && (
                  <button onClick={saveCanvas} disabled={saving} className="flex items-center bg-green-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md text-sm flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-500 hover:text-green-700"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-md" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            onNodesChange={(changes) => { onNodesChange(changes); setHasUnsavedChanges(true); }}
            onEdgesChange={(changes) => { onEdgesChange(changes); setHasUnsavedChanges(true); }}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={canEdit}
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </>
  );
};

export default IdeaCanvas;