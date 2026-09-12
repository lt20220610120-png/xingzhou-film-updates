// ============================================================
// canvasStore.js — 画布领域逻辑（纯函数）
// 画布节点 + 媒体生成 API 配置
// ============================================================
import { uid, now } from './projectStore.js';

export const CANVAS_NODE_SIZE = { image: { w: 360, h: 300 }, video: { w: 420, h: 300 } };
export const IMAGE_FORMATS = [
  { value: '1:1', label: '1:1 · 方形', size: '1024x1024' },
  { value: '16:9', label: '16:9 · 横屏', size: '1280x720' },
  { value: '9:16', label: '9:16 · 竖屏', size: '720x1280' },
  { value: '4:3', label: '4:3 · 横屏', size: '1024x768' },
  { value: '3:4', label: '3:4 · 竖屏', size: '768x1024' },
  { value: '3:2', label: '3:2 · 横屏', size: '1152x768' },
  { value: '2:3', label: '2:3 · 竖屏', size: '768x1152' },
];
export const IMAGE_SIZES = IMAGE_FORMATS.map((item) => item.size);
export const VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
export const VIDEO_DURATIONS = [5, 6, 10];
export const FEITUO_VIDEO_MODELS = [
  { name: 'XZ-Seedance 2.5 720p（9图参考）', id: 'ft-video-v1-69ef4c70291248a25c8198cd1c7c9c1f', durations: [4, 5, 10, 15, 20, 25, 30], ratios: ['9:16', '16:9', '1:1', '4:3', '3:4'] },
  { name: 'XZ-Seedance 2.5 720p（10图全参）', id: 'ft-video-v1-3dd9e73a8bd0d4e06ba6ebcbddafd811', durations: [4, 5, 10, 15, 20, 25, 30], ratios: ['9:16', '16:9', '1:1', '4:3', '3:4'] },
  { name: 'XZ-Seedance 2.0 720p（10秒）', id: 'ft-video-v1-5d6b990f8ef1d6159d4c94454ed6db5f', durations: [5, 10], ratios: ['9:16', '16:9', '1:1', '4:3', '3:4'] },
  { name: 'XZ-Seedance 2.0 720p（15秒）', id: 'ft-video-v1-81ceb24e127dcb0ccba4737c58170a3e', durations: [4, 5, 10, 15], ratios: ['9:16', '16:9', '1:1', '4:3', '3:4'] },
  { name: 'Wan 3.0 1080p（速度优化）', id: 'ft-video-v1-5c39062ebd696fff7c93dca19dc3b570', durations: [4, 5, 10, 15, 20, 25, 30], ratios: ['9:16', '16:9', '1:1', '4:3', '3:4'] },
];
export const VIDEO_MODEL_CAPABILITIES = {
  'seedance-2.0': { label: 'Seedance 2.0', durations: Array.from({ length: 15 }, (_, i) => i + 1), resolutions: ['480p', '720p', '1080p', '4K'], ratios: VIDEO_RATIOS, audio: true },
  'seedance-2.5': { label: 'Seedance 2.5', durations: [5, 10, 15, 20, 30], resolutions: ['480p', '720p', '1080p', '2K', '4K'], ratios: VIDEO_RATIOS, audio: true },
};
export const videoModelCapabilities = (model = '') => {
  const id = String(model).toLowerCase();
  const feituo = FEITUO_VIDEO_MODELS.find((item) => item.id.toLowerCase() === id);
  if (feituo) return { label: feituo.name, durations: feituo.durations, resolutions: ['720p', '1080p'], ratios: feituo.ratios, audio: false };
  if (id.includes('seedance') && id.includes('2.5')) return VIDEO_MODEL_CAPABILITIES['seedance-2.5'];
  if (id.includes('seedance') && id.includes('2.0')) return VIDEO_MODEL_CAPABILITIES['seedance-2.0'];
  return { label: model || '通用视频模型', durations: VIDEO_DURATIONS, resolutions: ['480p', '720p', '1080p'], ratios: VIDEO_RATIOS, audio: false };
};

export const createCanvas = (state, name = '未命名画布') => {
  const canvas = { id: uid(), name, nodes: [], createdAt: now(), updatedAt: now() };
  return { ...state, canvases: [...(state.canvases || []), canvas], activeCanvasId: canvas.id };
};

export const renameCanvas = (state, canvasId, name) => ({
  ...state,
  canvases: (state.canvases || []).map((c) => c.id === canvasId ? { ...c, name, updatedAt: now() } : c),
});

export const deleteCanvas = (state, canvasId) => {
  const canvases = (state.canvases || []).filter((c) => c.id !== canvasId);
  return { ...state, canvases, activeCanvasId: state.activeCanvasId === canvasId ? (canvases[0]?.id || null) : state.activeCanvasId };
};

export const addCanvasNode = (state, canvasId, type, position = {}) => {
  const size = CANVAS_NODE_SIZE[type] || CANVAS_NODE_SIZE.image;
  const node = {
    id: uid(), type,
    x: Math.round(position.x ?? 120), y: Math.round(position.y ?? 120), w: size.w, h: size.h,
    prompt: '', status: 'empty', mediaFile: '', error: '',
    params: type === 'video' ? { ratio: '16:9', duration: 5, resolution: '720p', firstFrameNodeId: '' } : { size: '1024x1024' },
    createdAt: now(),
  };
  return {
    ...state,
    canvases: (state.canvases || []).map((c) => c.id === canvasId ? { ...c, nodes: [...c.nodes, node], updatedAt: now() } : c),
  };
};

export const updateCanvasNode = (state, canvasId, nodeId, updates) => ({
  ...state,
  canvases: (state.canvases || []).map((c) => c.id === canvasId
    ? { ...c, nodes: c.nodes.map((n) => n.id === nodeId ? { ...n, ...updates } : n), updatedAt: now() }
    : c),
});

export const removeCanvasNode = (state, canvasId, nodeId) => ({
  ...state,
  canvases: (state.canvases || []).map((c) => c.id === canvasId
    ? { ...c, nodes: c.nodes.filter((n) => n.id !== nodeId), updatedAt: now() }
    : c),
});

// ---------- 媒体生成 API 配置（图片 / 视频） ----------
export const MEDIA_KINDS = { image: '图片生成', video: '视频生成' };

export const addMediaProfile = (state, profile) => {
  const item = {
    id: uid(),
    name: profile.name || '未命名接口',
    kind: profile.kind === 'video' ? 'video' : 'image',
    endpoint: profile.endpoint || '',
    apiKey: profile.apiKey || '',
    model: profile.model || '',
    createdAt: now(),
  };
  const next = { ...state, mediaProfiles: [...(state.mediaProfiles || []), item] };
  const activeKey = item.kind === 'video' ? 'activeVideoApiId' : 'activeImageApiId';
  if (!next[activeKey]) next[activeKey] = item.id;
  return next;
};

export const updateMediaProfile = (state, profileId, updates) => ({
  ...state,
  mediaProfiles: (state.mediaProfiles || []).map((p) => p.id === profileId ? { ...p, ...updates } : p),
});

export const removeMediaProfile = (state, profileId) => {
  const mediaProfiles = (state.mediaProfiles || []).filter((p) => p.id !== profileId);
  const fix = (activeId) => activeId === profileId ? null : activeId;
  return { ...state, mediaProfiles, activeImageApiId: fix(state.activeImageApiId), activeVideoApiId: fix(state.activeVideoApiId) };
};

export const setActiveMediaApi = (state, kind, profileId) => ({
  ...state,
  [kind === 'video' ? 'activeVideoApiId' : 'activeImageApiId']: profileId,
});

export const activeMediaProfile = (state, kind) => {
  const activeId = kind === 'video' ? state.activeVideoApiId : state.activeImageApiId;
  return (state.mediaProfiles || []).find((p) => p.id === activeId && p.kind === kind)
    || (state.mediaProfiles || []).find((p) => p.kind === kind)
    || null;
};
