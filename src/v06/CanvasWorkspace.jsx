import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Film, Hand, Image as ImageIcon, KeyRound, Loader2, Minus, MousePointer2,
  Plus, RefreshCw, Save, Send, Settings2, Trash2, Upload, Video, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import {
  addCanvasNode, addMediaProfile, createCanvas, deleteCanvas, IMAGE_FORMATS,
  activeMediaProfile, removeCanvasNode, removeMediaProfile, renameCanvas,
  setActiveMediaApi, updateCanvasNode, updateMediaProfile, FEITUO_VIDEO_MODELS, VIDEO_DURATIONS, VIDEO_RATIOS, videoModelCapabilities,
} from '../../core/canvasStore.js';
import { Dialog } from './GlobalTools.jsx';
import { DeleteConfirm } from './DeleteConfirm.jsx';

const mediaUrl = (filePath) => filePath ? `xzmedia://${encodeURIComponent(filePath).replace(/%5C/g, '/').replace(/%3A/g, ':')}` : '';

/* ---------------- 媒体 API 设置弹窗 ---------------- */
export function MediaApiSettings({ state, setState, onClose }) {
  const profiles = state.mediaProfiles || [];
  const [form, setForm] = useState({ kind: 'image', name: '智启 gpt-image-2', endpoint: 'https://zhiqiapi.com/v1', model: 'gpt-image-2', apiKey: '' });
  const [editingId, setEditingId] = useState(null);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const save = () => {
    if (!form.endpoint.trim()) return;
    if (editingId) setState((s) => updateMediaProfile(s, editingId, { ...form }));
    else setState((s) => addMediaProfile(s, form));
    setForm({ kind: form.kind, name: '', endpoint: '', model: '', apiKey: '' });
    setEditingId(null);
  };
  const renderProfiles = (kind) => {
    const items = profiles.filter((profile) => profile.kind === kind);
    return <section className={`media-api-group ${kind}`}><header><div>{kind === 'video' ? <Video size={16} /> : <ImageIcon size={16} />}<strong>{kind === 'video' ? '视频生成 API' : '图片生成 API'}</strong></div><small>{kind === 'video' ? '用于分镜视频与画布视频节点' : '用于美术、资产与画布图片节点'}</small></header><div className="media-api-group-list">{items.map((profile) => {
      const activeId = kind === 'video' ? state.activeVideoApiId : state.activeImageApiId;
      return <div key={profile.id} className={`media-api-item${profile.id === activeId ? ' active' : ''}`}><span className="kind">{kind === 'video' ? <Video size={14} /> : <ImageIcon size={14} />}</span><span className="name">{profile.name}<small>{profile.model || profile.endpoint}</small></span>{profile.id === activeId ? <b>使用中</b> : <button onClick={() => setState((s) => setActiveMediaApi(s, kind, profile.id))}>启用</button>}<button onClick={() => { setEditingId(profile.id); setForm({ kind: profile.kind, name: profile.name, endpoint: profile.endpoint, model: profile.model, apiKey: profile.apiKey || '' }); }}>编辑</button><button className="danger" onClick={() => setState((s) => removeMediaProfile(s, profile.id))}><Trash2 size={13} /></button></div>;
    })}{!items.length && <div className="media-api-empty">暂未配置{kind === 'video' ? '视频' : '图片'}生成 API</div>}</div></section>;
  };
  return (
    <Dialog open title="画布生成接口设置" onClose={onClose}>
      <div className="media-api-settings">
        <p className="media-api-hint">图片接口需兼容 OpenAI 图片格式（/images/generations，如即梦、DALL·E、豆包）；视频接口需兼容火山方舟任务格式（/contents/generations/tasks，如 Seedance、即梦视频）。</p>
        <div className="media-api-form">
          <select value={form.kind} onChange={update('kind')}>
            <option value="image">图片生成接口</option>
            <option value="video">视频生成接口</option>
          </select>
          <input placeholder="名称（例如 即梦图片）" value={form.name} onChange={update('name')} />
          <input placeholder="接口地址（例如 https://ark.cn-beijing.volces.com/api/v3）" value={form.endpoint} onChange={update('endpoint')} />
          {form.kind === 'video' && <select value={FEITUO_VIDEO_MODELS.some((item) => item.id === form.model) ? form.model : ''} onChange={update('model')}><option value="">选择飞拓模型或手动填写</option>{FEITUO_VIDEO_MODELS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
          <input placeholder="模型 ID（例如 doubao-seedance-1-0-pro）" value={form.model} onChange={update('model')} />
          <input placeholder="API Key" type="password" value={form.apiKey} onChange={update('apiKey')} />
          <button className="primary" onClick={save}><Save size={14} /> {editingId ? '保存修改' : '添加接口'}</button>
        </div>
        <div className="media-api-list">{renderProfiles('image')}{renderProfiles('video')}</div>
      </div>
    </Dialog>
  );
}

/* ---------------- 画布节点 ---------------- */
function CanvasNode({ node, scale, selected, imageNodes, videoCapabilities, onSelect, onMove, onUpdate, onRemove, onGenerate, onImport, onExport }) {
  const dragRef = useRef(null);
  const startDrag = (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect(node.id);
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y };
    const move = (moveEvent) => {
      const d = dragRef.current;
      if (!d) return;
      onMove(node.id, { x: d.originX + (moveEvent.clientX - d.startX) / scale, y: d.originY + (moveEvent.clientY - d.startY) / scale });
    };
    const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const busy = node.status === 'generating';
  return (
    <div
      className={`canvas-node ${node.type}${selected ? ' selected' : ''}`}
      style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: node.w }}
      onPointerDown={startDrag}
    >
      <header className="node-head">
        <span>{node.type === 'video' ? <Video size={13} /> : <ImageIcon size={13} />} {node.type === 'video' ? '视频' : '图片'}</span>
        <span className="node-tools">
          <button title={node.type === 'video' ? '上传视频' : '上传图片'} onPointerDown={(e) => e.stopPropagation()} onClick={() => onImport(node)}><Upload size={13} /></button>
          {node.mediaFile && <button title="导出素材" onPointerDown={(e) => e.stopPropagation()} onClick={() => onExport(node)}><Save size={13} /></button>}
          <button title="删除节点" onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemove(node.id)}><Trash2 size={13} /></button>
        </span>
      </header>
      <div className="node-media" style={{ height: node.h - 130 }}>
        {node.mediaFile
          ? node.type === 'video'
            ? <video src={mediaUrl(node.mediaFile)} controls onPointerDown={(e) => e.stopPropagation()} />
            : <img src={mediaUrl(node.mediaFile)} alt={node.prompt || '画布图片'} draggable={false} />
          : (
            <div className="node-empty">
              {busy ? <Loader2 className="spin" /> : node.type === 'video' ? <Video /> : <ImageIcon />}
              <span>{busy ? (node.statusText || '生成中…') : node.type === 'video' ? '空视频节点' : '空图片节点'}</span>
            </div>
          )}
      </div>
      {node.error && <div className="node-error" title={node.error}>{node.error}</div>}
      <div className="node-compose" onPointerDown={(e) => e.stopPropagation()}>
        <textarea
          rows={2}
          placeholder={node.type === 'video' ? '描述要生成的视频内容' : '描述要生成的画面'}
          value={node.prompt}
          onChange={(event) => onUpdate(node.id, { prompt: event.target.value })}
        />
        <div className="node-params">
          {node.type === 'image' ? (
            <select value={node.params.size} onChange={(event) => onUpdate(node.id, { params: { ...node.params, size: event.target.value } })}>
              {IMAGE_FORMATS.map((format) => <option key={format.value} value={format.size}>{format.label}</option>)}
            </select>
          ) : (
            <>
              <select value={node.params.ratio} onChange={(event) => onUpdate(node.id, { params: { ...node.params, ratio: event.target.value } })}>
                {videoCapabilities.ratios.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select>
              <select value={node.params.duration} onChange={(event) => onUpdate(node.id, { params: { ...node.params, duration: Number(event.target.value) } })}>
                {videoCapabilities.durations.map((duration) => <option key={duration} value={duration}>{duration}s</option>)}
              </select>
              <select value={node.params.resolution || videoCapabilities.resolutions[0]} onChange={(event) => onUpdate(node.id, { params: { ...node.params, resolution: event.target.value } })}>
                {videoCapabilities.resolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}
              </select>
              <select value={node.params.firstFrameNodeId || ''} onChange={(event) => onUpdate(node.id, { params: { ...node.params, firstFrameNodeId: event.target.value } })} title="选择一个图片节点作为首帧">
                <option value="">无首帧</option>
                {imageNodes.filter((n) => n.mediaFile).map((n, index) => <option key={n.id} value={n.id}>首帧：图{index + 1}</option>)}
              </select>
            </>
          )}
          <button className="node-generate" disabled={busy} onClick={() => onGenerate(node)}>
            {busy ? <Loader2 size={14} className="spin" /> : <Send size={14} />} {busy ? '生成中' : '生成'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 画布工作区 ---------------- */
export function CanvasWorkspace({ state, setState, api }) {
  const [view, setView] = useState({ x: 60, y: 40, scale: 1 });
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteCanvasTarget, setDeleteCanvasTarget] = useState(null);
  const viewportRef = useRef(null);
  const panRef = useRef(null);

  const canvases = state.canvases || [];
  const canvas = canvases.find((c) => c.id === state.activeCanvasId) || canvases[0] || null;
  const activeVideoProfile = activeMediaProfile(state, 'video');
  const videoCapabilities = videoModelCapabilities(activeVideoProfile?.model);

  useEffect(() => {
    if (!canvases.length) setState((s) => (s.canvases || []).length ? s : createCanvas(s, '画布 1'));
  }, [canvases.length]);

  useEffect(() => {
    if (!api.onMediaTaskStatus) return undefined;
    return api.onMediaTaskStatus(({ nodeId, status }) => {
      if (!canvas) return;
      setState((s) => updateCanvasNode(s, canvas.id, nodeId, { statusText: `任务：${status}` }));
    });
  }, [canvas?.id]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left - view.x) / view.scale, y: (clientY - rect.top - view.y) / view.scale };
  }, [view]);

  const startPan = (event) => {
    if (event.target !== event.currentTarget && tool !== 'pan') return;
    setSelectedId(null);
    panRef.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
    const move = (moveEvent) => {
      const p = panRef.current;
      if (!p) return;
      setView((current) => ({ ...current, x: p.originX + moveEvent.clientX - p.startX, y: p.originY + moveEvent.clientY - p.startY }));
    };
    const up = () => { panRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onWheel = (event) => {
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    setView((current) => {
      const nextScale = Math.min(2.5, Math.max(0.2, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
      const ratio = nextScale / current.scale;
      return { scale: nextScale, x: mouseX - (mouseX - current.x) * ratio, y: mouseY - (mouseY - current.y) * ratio };
    });
  };

  const addNode = (type) => {
    if (!canvas) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    const center = rect ? screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 3) : { x: 150, y: 150 };
    const offset = canvas.nodes.length * 48;
    setState((s) => addCanvasNode(s, canvas.id, type, { x: center.x - 320 + offset, y: center.y - 40 + offset * 0.6 }));
  };

  const generate = async (node) => {
    const profile = activeMediaProfile(state, node.type);
    if (!profile) { setSettingsOpen(true); return; }
    if (!node.prompt.trim()) return;
    setState((s) => updateCanvasNode(s, canvas.id, node.id, { status: 'generating', error: '', statusText: '' }));
    try {
      let result;
      if (node.type === 'image') {
        result = await api.mediaGenerateImage({ endpoint: profile.endpoint, apiKey: profile.apiKey, model: profile.model, prompt: node.prompt, size: node.params.size });
      } else {
        const firstFrameNode = node.params.firstFrameNodeId ? canvas.nodes.find((n) => n.id === node.params.firstFrameNodeId) : null;
        result = await api.mediaGenerateVideo({
          nodeId: node.id, endpoint: profile.endpoint, apiKey: profile.apiKey, model: profile.model,
          prompt: node.prompt, ratio: node.params.ratio, duration: node.params.duration, resolution: node.params.resolution,
          firstFramePath: firstFrameNode?.mediaFile || '',
        });
      }
      setState((s) => updateCanvasNode(s, canvas.id, node.id, { status: 'done', mediaFile: result.filePath, error: '', statusText: '' }));
    } catch (reason) {
      setState((s) => updateCanvasNode(s, canvas.id, node.id, { status: 'error', error: reason.message || '生成失败', statusText: '' }));
    }
  };

  const importMedia = async (node) => {
    const result = await api.mediaImportFile(node.type);
    if (result?.filePath) setState((s) => updateCanvasNode(s, canvas.id, node.id, { status: 'done', mediaFile: result.filePath, error: '' }));
  };

  const exportMedia = (node) => api.mediaExportFile({ filePath: node.mediaFile });

  if (!canvas) return <div className="canvas-workspace"><div className="canvas-loading">正在创建画布…</div></div>;

  const imageNodes = canvas.nodes.filter((n) => n.type === 'image');

  return (
    <div className="canvas-workspace">
      <header className="canvas-topbar">
        <div className="canvas-tabs">
          {canvases.map((item) => (
            <button key={item.id} className={item.id === canvas.id ? 'active' : ''} onClick={() => setState((s) => ({ ...s, activeCanvasId: item.id }))}>
              {item.name}
              {canvases.length > 1 && item.id === canvas.id && (
                <X size={12} onClick={(event) => { event.stopPropagation(); setDeleteCanvasTarget(item); }} />
              )}
            </button>
          ))}
          <button className="add-canvas" title="新建画布" onClick={() => setState((s) => createCanvas(s, `画布 ${canvases.length + 1}`))}><Plus size={14} /></button>
        </div>
        <input
          className="canvas-name"
          value={canvas.name}
          onChange={(event) => setState((s) => renameCanvas(s, canvas.id, event.target.value))}
        />
        <div className="canvas-top-actions">
          <span className="canvas-count">节点 {canvas.nodes.length}</span>
          <button onClick={() => setSettingsOpen(true)}><KeyRound size={15} /> 生成接口</button>
        </div>
      </header>

      <div
        ref={viewportRef}
        className={`canvas-viewport${tool === 'pan' ? ' panning' : ''}`}
        onPointerDown={startPan}
        onWheel={onWheel}
      >
        <div className="canvas-plane" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          {canvas.nodes.map((node) => (
            <CanvasNode
              key={node.id}
              node={node}
              scale={view.scale}
              selected={node.id === selectedId}
              imageNodes={imageNodes}
              videoCapabilities={videoCapabilities}
              onSelect={setSelectedId}
              onMove={(nodeId, position) => setState((s) => updateCanvasNode(s, canvas.id, nodeId, position))}
              onUpdate={(nodeId, updates) => setState((s) => updateCanvasNode(s, canvas.id, nodeId, updates))}
              onRemove={(nodeId) => setState((s) => removeCanvasNode(s, canvas.id, nodeId))}
              onGenerate={generate}
              onImport={importMedia}
              onExport={exportMedia}
            />
          ))}
        </div>
        {!canvas.nodes.length && (
          <div className="canvas-empty-hint">
            <p>点击下方 <ImageIcon size={14} /> 或 <Film size={14} /> 添加图片 / 视频节点</p>
            <p>写好描述后点「生成」，即可调用配置的 API 生成画面素材</p>
          </div>
        )}
      </div>

      <footer className="canvas-toolbar">
        <button className={tool === 'select' ? 'active' : ''} title="选择" onClick={() => setTool('select')}><MousePointer2 size={17} /></button>
        <button className={tool === 'pan' ? 'active' : ''} title="拖动画布" onClick={() => setTool('pan')}><Hand size={17} /></button>
        <i />
        <button title="添加图片节点" onClick={() => addNode('image')}><ImageIcon size={17} /></button>
        <button title="添加视频节点" onClick={() => addNode('video')}><Film size={17} /></button>
        <i />
        <button title="缩小" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.2, v.scale * 0.85) }))}><ZoomOut size={17} /></button>
        <span className="zoom-label">{Math.round(view.scale * 100)}%</span>
        <button title="放大" onClick={() => setView((v) => ({ ...v, scale: Math.min(2.5, v.scale * 1.15) }))}><ZoomIn size={17} /></button>
        <button title="复位视图" onClick={() => setView({ x: 60, y: 40, scale: 1 })}><RefreshCw size={15} /></button>
      </footer>

      {settingsOpen && <MediaApiSettings state={state} setState={setState} onClose={() => setSettingsOpen(false)} />}
      <DeleteConfirm
        open={!!deleteCanvasTarget}
        title="删除画布"
        name={deleteCanvasTarget?.name}
        detail="删除画布会移除其中全部节点（已生成的素材文件仍保留在资料目录的「画布素材」文件夹中）。"
        onCancel={() => setDeleteCanvasTarget(null)}
        onConfirm={() => { setState((s) => deleteCanvas(s, deleteCanvasTarget.id)); setDeleteCanvasTarget(null); }}
      />
    </div>
  );
}
