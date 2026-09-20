import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditorTrack, EditorNote, EditorTool } from '../../types/editor';
import { pitchToNoteName, isBlackKey } from '../../utils/pitchHelper';
import { syncAutoKeySwitches } from '../../utils/keySwitchSync';

interface Props {
  track: EditorTrack | null;
  activeTool: EditorTool;
  isRangeMode: boolean;
  activeKeySwitch: number;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onNotesChange: (notes: EditorNote[]) => void;
  onRecordHistory?: (snapshotBeforeChange: EditorNote[]) => void; // ★ 履歴保存用
  ticksPerBeat?: number;
  onScrollXChange?: (scrollX: number) => void;
}

const KEYBOARD_WIDTH = 56;
const RULER_HEIGHT = 26;
const NOTE_ROW_HEIGHT = 18;
const BASE_TICK_WIDTH = 0.12;
const TOTAL_PITCHES = 128;
const TOTAL_HEIGHT = TOTAL_PITCHES * NOTE_ROW_HEIGHT;
const RESIZE_HANDLE_WIDTH = 8;

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

export const PianoRollCanvas: React.FC<Props> = ({
  track,
  activeTool,
  isRangeMode,
  activeKeySwitch,
  zoomLevel,
  onZoomChange,
  onNotesChange,
  onRecordHistory, // ★ 分割代入で確実に受け取り
  ticksPerBeat = 480,
  onScrollXChange
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(TOTAL_HEIGHT / 2 - 250);

  const updateScrollX = useCallback((updater: (prev: number) => number) => {
    setScrollX(prev => {
      const next = updater(prev);
      if (next !== prev) {
        onScrollXChange?.(next);
      }
      return next;
    });
  }, [onScrollXChange]);

  const currentTickWidth = BASE_TICK_WIDTH * zoomLevel;

  type DragAction =
    | { type: 'pan'; startX: number; startY: number; initScrollX: number; initScrollY: number }
    | { type: 'resize'; noteId: string; initDuration: number; startTick: number; initialNotes: EditorNote[] }
    | { type: 'move'; noteId: string; grabOffsetTick: number; initialNotes: EditorNote[] }
    | { type: 'create'; noteId: string; startTick: number; pitch: number; initialNotes: EditorNote[] };

  const dragActionRef = useRef<DragAction | null>(null);
  const isSpacePressedRef = useRef(false);
  const [hoverCursor, setHoverCursor] = useState<string>('default');

  const pitchToY = useCallback((pitch: number) => {
    return RULER_HEIGHT + (127 - pitch) * NOTE_ROW_HEIGHT;
  }, []);

  const yToPitch = useCallback((y: number) => {
    const pitch = 127 - Math.floor((y - RULER_HEIGHT) / NOTE_ROW_HEIGHT);
    return Math.max(0, Math.min(127, pitch));
  }, []);

  const xToTick = useCallback((x: number) => {
    const gridTick = ticksPerBeat / 4;
    const rawTick = Math.max(0, (x - KEYBOARD_WIDTH) / currentTickWidth);
    return Math.floor(rawTick / gridTick) * gridTick;
  }, [ticksPerBeat, currentTickWidth]);

  const tickToX = useCallback((tick: number) => {
    return KEYBOARD_WIDTH + tick * currentTickWidth;
  }, [currentTickWidth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpacePressedRef.current = true;
        setHoverCursor('grab');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setHoverCursor('default');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ネイティブ wheel イベント（ブラウザ全体のズームを防止し、小節幅を縮小拡大）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey || e.altKey) {
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        const nextZoom = Math.min(3.0, Math.max(0.1, Number((zoomLevel * factor).toFixed(2))));
        onZoomChange(nextZoom);
        return;
      }

      if (e.shiftKey) {
        updateScrollX(prev => Math.max(0, prev + e.deltaY));
      } else {
        if (Math.abs(e.deltaX) > 0) {
          updateScrollX(prev => Math.max(0, prev + e.deltaX));
        }
        if (Math.abs(e.deltaY) > 0) {
          setScrollY(prev => Math.max(0, Math.min(TOTAL_HEIGHT - 300, prev + e.deltaY)));
        }
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [zoomLevel, onZoomChange, updateScrollX]);

  // 描画ループ
  useEffect(() => {
    if (!track) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1E202C';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYBOARD_WIDTH, RULER_HEIGHT, Math.max(0, width - KEYBOARD_WIDTH), Math.max(0, height - RULER_HEIGHT));
    ctx.clip();

    ctx.translate(-scrollX, -scrollY);

    const minVisibleY = scrollY;
    const maxVisibleY = scrollY + height;
    const minVisiblePitch = yToPitch(maxVisibleY);
    const maxVisiblePitch = yToPitch(minVisibleY);

    // 行グリッド
    for (let p = minVisiblePitch; p <= maxVisiblePitch + 1; p++) {
      if (p < 0 || p > 127) continue;
      const y = pitchToY(p);
      ctx.fillStyle = isBlackKey(p) ? '#161B2B' : '#1C2237';
      ctx.fillRect(KEYBOARD_WIDTH, y, width + scrollX, NOTE_ROW_HEIGHT);

      ctx.strokeStyle = '#222B45';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(KEYBOARD_WIDTH, y);
      ctx.lineTo(KEYBOARD_WIDTH + width + scrollX, y);
      ctx.stroke();
    }

    // 小節グリッド
    const startTick = Math.max(0, Math.floor(scrollX / currentTickWidth));
    const endTick = Math.floor((scrollX + width) / currentTickWidth);
    const gridInterval = ticksPerBeat / 4;
    const firstGridTick = Math.floor(startTick / gridInterval) * gridInterval;

    for (let t = firstGridTick; t <= endTick; t += gridInterval) {
      const x = tickToX(t);
      const isBar = t % (ticksPerBeat * 4) === 0;
      const isBeat = t % ticksPerBeat === 0;

      ctx.strokeStyle = isBar ? 'rgba(164, 211, 255, 0.4)' : isBeat ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = isBar ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, minVisibleY);
      ctx.lineTo(x, maxVisibleY);
      ctx.stroke();
    }

    // 音域外マスク
    const minPitch = track.profile?.playableRange?.minPitch ?? 0;
    const maxPitch = track.profile?.playableRange?.maxPitch ?? 127;
    const topLimitY = pitchToY(maxPitch);
    const bottomLimitY = pitchToY(minPitch) + NOTE_ROW_HEIGHT;

    ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
    ctx.fillRect(KEYBOARD_WIDTH, 0, width + scrollX, topLimitY);

    ctx.strokeStyle = '#FF4757';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, topLimitY);
    ctx.lineTo(KEYBOARD_WIDTH + width + scrollX, topLimitY);
    ctx.stroke();

    ctx.fillRect(KEYBOARD_WIDTH, bottomLimitY, width + scrollX, Math.max(0, TOTAL_HEIGHT - bottomLimitY + RULER_HEIGHT));
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, bottomLimitY);
    ctx.lineTo(KEYBOARD_WIDTH + width + scrollX, bottomLimitY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ノーツ描画
    const notes = track.notes || [];
    const keySwitches = track.profile?.keySwitches || [];
    const pitchSplitRules = track.profile?.pitchSplitRules || [];
    const isPitchSplitEnabled = track.profile?.isPitchSplitEnabled ?? false;

    const audibleNotesSorted = notes
      .filter(n => n.pitch > 10)
      .sort((a, b) => a.startTick - b.startTick);

    const rangeStartNoteIds = new Set<string>();
    let prevRangeNote: EditorNote | null = null;

    for (const n of audibleNotesSorted) {
      if (n.articulationNote > 1 && n.isRangeArt) {
        if (!prevRangeNote || prevRangeNote.articulationNote !== n.articulationNote) {
          rangeStartNoteIds.add(n.id);
        }
        prevRangeNote = n;
      } else {
        prevRangeNote = null;
      }
    }

    for (const note of notes) {
      if (note.pitch <= 10) continue;

      const noteX = tickToX(note.startTick);
      const noteY = pitchToY(note.pitch);
      const noteW = Math.max(2, note.durationTicks * currentTickWidth - 1);
      const noteH = NOTE_ROW_HEIGHT - 2;

      if (noteX + noteW < scrollX + KEYBOARD_WIDTH || noteX > scrollX + width) continue;
      if (noteY + noteH < minVisibleY || noteY > maxVisibleY) continue;

      const isOutOfRange = note.pitch < minPitch || note.pitch > maxPitch;

      let baseColor = '#54A0FF';
      if (isPitchSplitEnabled) {
        const matchedRule = pitchSplitRules.find(
          r => note.pitch >= r.minPitch && note.pitch <= r.maxPitch
        );
        if (matchedRule) baseColor = matchedRule.color;
      }

      const ksConfig = keySwitches.find(k => k.note === note.articulationNote);
      const isSpecial = note.articulationNote > 1 && !!ksConfig;

      let fillCol = baseColor;
      if (isOutOfRange) {
        fillCol = '#515c6c';
      } else if (isSpecial && ksConfig) {
        fillCol = ksConfig.badgeColor;
      }

      ctx.fillStyle = fillCol;
      ctx.beginPath();
      drawRoundedRect(ctx, noteX, noteY + 1, noteW, noteH, 3);
      ctx.fill();

      ctx.strokeStyle = isOutOfRange
        ? 'rgba(255, 255, 255, 0.2)'
        : isSpecial
        ? '#FFFFFF'
        : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = isSpecial && !isOutOfRange ? 1.5 : 1;
      ctx.stroke();

      ctx.fillStyle = isOutOfRange ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(noteX + noteW - 3, noteY + 2, 2, noteH - 2);

      const shouldShowLabel = !note.isRangeArt || rangeStartNoteIds.has(note.id);

      if (isSpecial && ksConfig && noteW > 24 && shouldShowLabel) {
        ctx.fillStyle = isOutOfRange ? '#94A3B8' : '#1E202C';
        ctx.font = 'bold 10px sans-serif';
        const label = (ksConfig.customName || '').split(' ')[0];
        ctx.fillText(label, noteX + 4, noteY + 12, noteW - 12);
      }
    }

    ctx.restore();

    // 鍵盤描画
    ctx.fillStyle = '#181822';
    ctx.fillRect(0, RULER_HEIGHT, KEYBOARD_WIDTH, Math.max(0, height - RULER_HEIGHT));

    for (let p = minVisiblePitch; p <= maxVisiblePitch + 1; p++) {
      if (p < 0 || p > 127) continue;
      const y = pitchToY(p) - scrollY;
      const isBlack = isBlackKey(p);
      const inRange = p >= minPitch && p <= maxPitch;

      ctx.fillStyle = isBlack
        ? (inRange ? '#242B3D' : '#141722')
        : (inRange ? '#E2EFFF' : '#4E5568');
      ctx.fillRect(0, y, KEYBOARD_WIDTH - 2, NOTE_ROW_HEIGHT - 1);

      if (p % 12 === 0 || p === minPitch || p === maxPitch) {
        ctx.fillStyle = isBlack ? '#A4D3FF' : '#1E202C';
        if (!inRange) ctx.fillStyle = '#8FA4C4';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(pitchToNoteName(p), 4, y + 12);
      }
    }

    ctx.strokeStyle = '#5d6a82';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, RULER_HEIGHT);
    ctx.lineTo(KEYBOARD_WIDTH, height);
    ctx.stroke();

    // ルーラー
    ctx.fillStyle = '#2c2f3e';
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    ctx.strokeStyle = '#5d6a82';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(width, RULER_HEIGHT);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYBOARD_WIDTH, 0, Math.max(0, width - KEYBOARD_WIDTH), RULER_HEIGHT);
    ctx.clip();
    ctx.translate(-scrollX, 0);

    const barInterval = ticksPerBeat * 4;
    const firstBarTick = Math.floor(startTick / barInterval) * barInterval;
    for (let t = firstBarTick; t <= endTick; t += barInterval) {
      const x = tickToX(t);
      const barNum = Math.floor(t / barInterval) + 1;

      ctx.fillStyle = '#8FA4C4';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${barNum}`, x + 4, 16);

      ctx.strokeStyle = '#3E4B6E';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 8);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }, [track, scrollX, scrollY, ticksPerBeat, currentTickWidth, pitchToY, yToPitch, tickToX]);

  // マウスを離したときの確定処理
  const handleMouseUp = useCallback(() => {
    if (dragActionRef.current && track) {
      const action = dragActionRef.current;
      if (action.type === 'move' || action.type === 'resize' || action.type === 'create') {
        onRecordHistory?.(action.initialNotes);
        const synced = syncAutoKeySwitches(track.notes, track.channel, track.profile);
        onNotesChange(synced);
      }
    }
    dragActionRef.current = null;
  }, [track, onNotesChange, onRecordHistory]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  if (!track) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E202C', color: '#8FA4C4', fontSize: 13 }}>
        編集するトラックを選択してください
      </div>
    );
  }

  // マウスダウン
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!track) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseY <= RULER_HEIGHT) {
      dragActionRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, initScrollX: scrollX, initScrollY: scrollY };
      return;
    }
    if (isSpacePressedRef.current || e.button === 1) {
      dragActionRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, initScrollX: scrollX, initScrollY: scrollY };
      return;
    }
    if (mouseX < KEYBOARD_WIDTH) return;

    const clickedPitch = yToPitch(mouseY + scrollY);
    const clickedTick = xToTick(mouseX + scrollX);

    const notes = track.notes || [];
    const hitIndex = notes.findIndex(n => {
      if (n.pitch !== clickedPitch || n.pitch <= 10) return false;
      const nStartX = tickToX(n.startTick);
      const nEndX = nStartX + Math.max(2, n.durationTicks * currentTickWidth - 1);
      const curCanvasX = mouseX + scrollX;
      return curCanvasX >= nStartX && curCanvasX <= nEndX;
    });

    if (hitIndex >= 0) {
      const hitNote = notes[hitIndex];
      const nStartX = tickToX(hitNote.startTick);
      const nEndX = nStartX + Math.max(2, hitNote.durationTicks * currentTickWidth - 1);
      const isNearRightEdge = (mouseX + scrollX) >= (nEndX - RESIZE_HANDLE_WIDTH);

      if (isNearRightEdge) {
        dragActionRef.current = {
          type: 'resize',
          noteId: hitNote.id,
          initDuration: hitNote.durationTicks,
          startTick: hitNote.startTick,
          initialNotes: JSON.parse(JSON.stringify(track.notes))
        };
        return;
      }

      // 消しゴムツール
      if (activeTool === 'eraser') {
        onRecordHistory?.(track.notes);
        const remainingNotes = notes.filter(n => n.id !== hitNote.id);
        const synced = syncAutoKeySwitches(remainingNotes, track.channel, track.profile);
        onNotesChange(synced);
        return;
      }

      // 奏法ブラシツール
      if (activeTool === 'brush') {
        const newArt = activeKeySwitch;
        const updatedNotes = notes.map(n => {
          if (n.id === hitNote.id) {
            return {
              ...n,
              articulationNote: newArt,
              isRangeArt: newArt > 1 ? isRangeMode : false
            };
          }
          return n;
        });

        const synced = syncAutoKeySwitches(updatedNotes, track.channel, track.profile);
        onNotesChange(synced);
        return;
      }

      // 移動開始
      if (activeTool === 'pencil' || activeTool === 'select') {
        dragActionRef.current = {
          type: 'move',
          noteId: hitNote.id,
          grabOffsetTick: clickedTick - hitNote.startTick,
          initialNotes: JSON.parse(JSON.stringify(track.notes))
        };
        return;
      }
    }

    // 新規作成
    if (activeTool === 'pencil' && hitIndex < 0) {
      const initialSnapshot = JSON.parse(JSON.stringify(track.notes));
      const newId = crypto.randomUUID();
      const minDuration = ticksPerBeat / 4;
      const newNote: EditorNote = {
        id: newId,
        pitch: clickedPitch,
        startTick: clickedTick,
        durationTicks: minDuration,
        velocity: 100,
        channel: track.channel,
        articulationNote: 1
      };
      onNotesChange([...notes, newNote]);

      dragActionRef.current = {
        type: 'create',
        noteId: newId,
        startTick: clickedTick,
        pitch: clickedPitch,
        initialNotes: initialSnapshot
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!track) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (dragActionRef.current) {
      const action = dragActionRef.current;

      if (action.type === 'pan') {
        const deltaX = e.clientX - action.startX;
        const deltaY = e.clientY - action.startY;
        updateScrollX(() => Math.max(0, action.initScrollX - deltaX));
        setScrollY(Math.max(0, Math.min(TOTAL_HEIGHT - 300, action.initScrollY - deltaY)));
        return;
      }

      if (action.type === 'move') {
        const currentTick = xToTick(mouseX + scrollX);
        const currentPitch = yToPitch(mouseY + scrollY);
        const newStartTick = Math.max(0, currentTick - action.grabOffsetTick);

        const movedNotes = (track.notes || []).map(n =>
          n.id === action.noteId
            ? { ...n, startTick: newStartTick, pitch: currentPitch }
            : n
        );
        onNotesChange(movedNotes);
        return;
      }

      if (action.type === 'resize' || action.type === 'create') {
        const currentTick = xToTick(mouseX + scrollX);
        const minDuration = ticksPerBeat / 4;
        const newDuration = Math.max(minDuration, currentTick - action.startTick + minDuration);

        const resizedNotes = (track.notes || []).map(n =>
          n.id === action.noteId ? { ...n, durationTicks: newDuration } : n
        );
        onNotesChange(resizedNotes);
        return;
      }
    }

    if (isSpacePressedRef.current) {
      setHoverCursor('grab');
      return;
    }
    if (mouseY <= RULER_HEIGHT) {
      setHoverCursor('ew-resize');
      return;
    }
    if (mouseX < KEYBOARD_WIDTH) {
      setHoverCursor('default');
      return;
    }

    const curPitch = yToPitch(mouseY + scrollY);
    const curTickX = mouseX + scrollX;

    const hit = (track.notes || []).find(n => {
      if (n.pitch !== curPitch || n.pitch <= 10) return false;
      const nStartX = tickToX(n.startTick);
      const nEndX = nStartX + Math.max(2, n.durationTicks * currentTickWidth - 1);
      return curTickX >= nStartX && curTickX <= nEndX;
    });

    if (hit) {
      const nEndX = tickToX(hit.startTick) + Math.max(2, hit.durationTicks * currentTickWidth - 1);
      if (curTickX >= nEndX - RESIZE_HANDLE_WIDTH) {
        setHoverCursor('ew-resize');
        return;
      }
      if (activeTool === 'pencil' || activeTool === 'select') {
        setHoverCursor('move');
        return;
      }
    }

    if (activeTool === 'pencil') setHoverCursor('crosshair');
    else if (activeTool === 'eraser') setHoverCursor('pointer');
    else if (activeTool === 'brush') setHoverCursor('cell');
    else setHoverCursor('default');
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
        background: '#1E202C'
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: hoverCursor
        }}
      />
    </div>
  );
};