import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EditorTrack, EditorNote, EditorTool } from '../../types/editor';

interface Props {
  track: EditorTrack | null;
  activeTool: EditorTool;
  scrollX: number;
  zoomLevel: number;
  onScrollXChange: (scrollX: number) => void;
  onNotesChange: (notes: EditorNote[]) => void;
  onRecordHistory?: (snapshotBeforeChange: EditorNote[]) => void; // ★ 履歴保存用
  ticksPerBeat?: number;
}

const KEYBOARD_WIDTH = 56;
const ROW_HEIGHT = 16;
const BOTTOM_PADDING = 20; // ウィンドウ下部の余白 (px)
const BASE_TICK_WIDTH = 0.12;
const RESIZE_HANDLE_WIDTH = 8;

export const KeySwitchLane: React.FC<Props> = ({
  track,
  activeTool,
  scrollX,
  zoomLevel,
  onScrollXChange,
  onNotesChange,
  onRecordHistory, // ★ 分割代入で確実に受け取り
  ticksPerBeat = 480
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTickWidth = BASE_TICK_WIDTH * zoomLevel;

  type DragAction =
    | { type: 'pan'; startX: number; initScrollX: number }
    | { type: 'resize'; noteId: string; initDuration: number; startTick: number; initialNotes: EditorNote[] }
    | { type: 'move'; noteId: string; grabOffsetTick: number; initialNotes: EditorNote[] }
    | { type: 'create'; noteId: string; startTick: number; pitch: number; initialNotes: EditorNote[] };

  const dragActionRef = useRef<DragAction | null>(null);
  const isSpacePressedRef = useRef(false);
  const [hoverCursor, setHoverCursor] = useState<string>('default');

  const yToPitch = useCallback((y: number) => {
    const clampedY = Math.min(y, 10 * ROW_HEIGHT - 1);
    const p = 10 - Math.floor(clampedY / ROW_HEIGHT);
    return Math.max(1, Math.min(10, p));
  }, []);

  const pitchToY = useCallback((pitch: number) => {
    return (10 - pitch) * ROW_HEIGHT;
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

  // 描画ループ
  useEffect(() => {
    if (!track || !track.profile) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = 10 * ROW_HEIGHT + BOTTOM_PADDING;
    if (width <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const keySwitches = track.profile.keySwitches || [];

    for (let p = 10; p >= 1; p--) {
      const y = pitchToY(p);
      const ks = keySwitches.find(k => k.note === p);

      ctx.fillStyle = p % 2 === 0 ? '#0d0d17' : '#151522';
      ctx.fillRect(KEYBOARD_WIDTH, y, width - KEYBOARD_WIDTH, ROW_HEIGHT);

      ctx.strokeStyle = '#13151D';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(KEYBOARD_WIDTH, y + ROW_HEIGHT);
      ctx.lineTo(width, y + ROW_HEIGHT);
      ctx.stroke();

      ctx.fillStyle = '#181822';
      ctx.fillRect(0, y, KEYBOARD_WIDTH, ROW_HEIGHT - 0.5);

      if (ks && ks.isEnabled) {
        ctx.fillStyle = ks.badgeColor;
        ctx.beginPath();
        ctx.arc(8, y + ROW_HEIGHT / 2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#E2EFFF';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`${ks.customName.slice(0, 5)}`, 16, y + 11);
      }
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 10 * ROW_HEIGHT, KEYBOARD_WIDTH, BOTTOM_PADDING);

    ctx.strokeStyle = '#72829F';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, height);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(KEYBOARD_WIDTH, 0, Math.max(0, width - KEYBOARD_WIDTH), height);
    ctx.clip();
    ctx.translate(-scrollX, 0);

    const startTick = Math.max(0, Math.floor(scrollX / currentTickWidth));
    const endTick = Math.floor((scrollX + width) / currentTickWidth);
    const barInterval = ticksPerBeat * 4;
    const firstBarTick = Math.floor(startTick / barInterval) * barInterval;

    for (let t = firstBarTick; t <= endTick; t += barInterval) {
      const x = tickToX(t);
      ctx.strokeStyle = 'rgba(164, 211, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 10 * ROW_HEIGHT);
      ctx.stroke();
    }

    const ksNotes = (track.notes || []).filter(n => n.pitch >= 1 && n.pitch <= 10);

    for (const note of ksNotes) {
      const noteX = tickToX(note.startTick);
      const noteY = pitchToY(note.pitch);
      const noteW = Math.max(12, note.durationTicks * currentTickWidth - 1);
      const noteH = ROW_HEIGHT - 2;

      if (noteX + noteW < scrollX + KEYBOARD_WIDTH || noteX > scrollX + width) continue;

      const ksConfig = keySwitches.find(k => k.note === note.pitch);
      const fillCol = ksConfig?.badgeColor || '#7ECADC';

      ctx.fillStyle = fillCol;
      ctx.beginPath();
      ctx.roundRect(noteX, noteY + 1, noteW, noteH, 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(noteX + noteW - 3, noteY + 2, 2, noteH - 2);

      if (ksConfig && noteW > 28) {
        ctx.fillStyle = '#1E202C';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(ksConfig.customName, noteX + 4, noteY + 11, noteW - 8);
      }
    }

    ctx.restore();
    ctx.restore();
  }, [track, scrollX, zoomLevel, ticksPerBeat, currentTickWidth, pitchToY]);

  // マウスを離したときの確定処理
  const handleMouseUp = useCallback(() => {
    if (dragActionRef.current && track) {
      const action = dragActionRef.current;
      if (action.type === 'move' || action.type === 'resize' || action.type === 'create') {
        onRecordHistory?.(action.initialNotes);
      }
    }
    dragActionRef.current = null;
  }, [track, onRecordHistory]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  if (!track) return null;

  // マウスダウン
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'brush') return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isSpacePressedRef.current || e.button === 1) {
      dragActionRef.current = {
        type: 'pan',
        startX: e.clientX,
        initScrollX: scrollX
      };
      return;
    }

    if (mouseX < KEYBOARD_WIDTH) return;

    const clickedPitch = yToPitch(mouseY);
    const clickedTick = xToTick(mouseX + scrollX);

    const hitIndexInTrack = (track.notes || []).findIndex(n => {
      if (n.pitch !== clickedPitch) return false;
      const nStartX = tickToX(n.startTick);
      const nEndX = nStartX + Math.max(12, n.durationTicks * currentTickWidth - 1);
      const curCanvasX = mouseX + scrollX;
      return curCanvasX >= nStartX && curCanvasX <= nEndX;
    });

    if (hitIndexInTrack >= 0) {
      const hitNote = track.notes[hitIndexInTrack];
      const nStartX = tickToX(hitNote.startTick);
      const nEndX = nStartX + Math.max(12, hitNote.durationTicks * currentTickWidth - 1);
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

      // 消しゴムツール: 引数は1個
      if (activeTool === 'eraser') {
        onRecordHistory?.(track.notes);
        const updated = [...track.notes];
        updated.splice(hitIndexInTrack, 1);
        onNotesChange(updated);
        return;
      }

      if (activeTool === 'pencil') {
        dragActionRef.current = {
          type: 'move',
          noteId: hitNote.id,
          grabOffsetTick: clickedTick - hitNote.startTick,
          initialNotes: JSON.parse(JSON.stringify(track.notes))
        };
        return;
      }
    }

    // 新規作成: 引数は1個
    if (activeTool === 'pencil' && hitIndexInTrack < 0) {
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
        articulationNote: clickedPitch
      };
      onNotesChange([...track.notes, newNote]);

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
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (dragActionRef.current) {
      const action = dragActionRef.current;

      if (action.type === 'pan') {
        const deltaX = e.clientX - action.startX;
        onScrollXChange(Math.max(0, action.initScrollX - deltaX));
        return;
      }

      if (action.type === 'move') {
        const currentTick = xToTick(mouseX + scrollX);
        const currentPitch = yToPitch(mouseY);
        const newStartTick = Math.max(0, currentTick - action.grabOffsetTick);

        onNotesChange(
          track.notes.map(n =>
            n.id === action.noteId
              ? {
                  ...n,
                  startTick: newStartTick,
                  pitch: currentPitch,
                  articulationNote: currentPitch,
                  sourceNoteId: undefined
                }
              : n
          )
        );
        return;
      }

      if (action.type === 'resize' || action.type === 'create') {
        const currentTick = xToTick(mouseX + scrollX);
        const minDuration = ticksPerBeat / 4;
        const newDuration = Math.max(minDuration, currentTick - action.startTick + minDuration);

        onNotesChange(
          track.notes.map(n => (n.id === action.noteId ? { ...n, durationTicks: newDuration } : n))
        );
        return;
      }
    }

    if (isSpacePressedRef.current) {
      setHoverCursor('grab');
      return;
    }
    if (activeTool === 'brush') {
      setHoverCursor('not-allowed');
      return;
    }
    if (mouseX < KEYBOARD_WIDTH) {
      setHoverCursor('default');
      return;
    }

    const curPitch = yToPitch(mouseY);
    const curTickX = mouseX + scrollX;

    const hit = (track.notes || []).find(n => {
      if (n.pitch !== curPitch) return false;
      const nStartX = tickToX(n.startTick);
      const nEndX = nStartX + Math.max(12, n.durationTicks * currentTickWidth - 1);
      return curTickX >= nStartX && curTickX <= nEndX;
    });

    if (hit) {
      const nEndX = tickToX(hit.startTick) + Math.max(12, hit.durationTicks * currentTickWidth - 1);
      if (curTickX >= nEndX - RESIZE_HANDLE_WIDTH) {
        setHoverCursor('ew-resize');
        return;
      }
      if (activeTool === 'pencil') {
        setHoverCursor('move');
        return;
      }
    }

    if (activeTool === 'pencil') setHoverCursor('crosshair');
    else if (activeTool === 'eraser') setHoverCursor('pointer');
    else setHoverCursor('default');
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      onScrollXChange(Math.max(0, scrollX + e.deltaY));
    } else if (Math.abs(e.deltaX) > 0) {
      onScrollXChange(Math.max(0, scrollX + e.deltaX));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 10 * ROW_HEIGHT + BOTTOM_PADDING,
        background: '#000000',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        style={{ width: '100%', height: '100%', display: 'block', cursor: hoverCursor }}
      />
    </div>
  );
};