'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeftRight, GripVertical, Trash2, Maximize2, Minimize2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'

import { ChartRenderer, chartMetadata } from './chart-library'
import { AnalyticsDashboard, ChartType, ChartWidget } from './types'

interface DashboardBuilderProps {
  onSave: (dashboard: Omit<AnalyticsDashboard, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

const paletteItems: ChartType[] = ['bar', 'double-bar', 'line', 'pie']

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function createWidget(type: ChartType): ChartWidget {
  return {
    id: generateId(),
    type,
    height: 'half',
    width: 'full',
  }
}

function SortableWidget({ widget, onRemove, onToggleHeight, onToggleWidth }: {
  widget: ChartWidget
  onRemove: (id: string) => void
  onToggleHeight: (id: string) => void
  onToggleWidth: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, data: { from: 'canvas', type: widget.type } })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    width:
      widget.width === 'full'
        ? '100%'
        : 'min(100%, calc(50% - 0.5rem))',
  }

  const chartHeight = widget.height === 'full' ? 360 : 220
  const cardMinHeight = widget.height === 'full' ? 420 : 280

  return (
    <div ref={setNodeRef} style={style} className="flex w-full flex-col">
      <Card
        className="border-primary/20 bg-primary/5 flex h-full flex-1 flex-col"
        style={{ minHeight: cardMinHeight }}
      >
        <CardHeader className="flex items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="bg-transparent text-primary/70 hover:text-primary flex cursor-grab items-center rounded p-1"
              aria-label="Reorder chart"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <CardTitle className="text-base font-semibold text-primary">
              {chartMetadata[widget.type].label}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onToggleWidth(widget.id)}
              aria-label={`Set ${widget.width === 'full' ? 'half' : 'full'} width`}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onToggleHeight(widget.id)}
              aria-label={`Set ${widget.height === 'full' ? 'half' : 'full'} height`}
            >
              {widget.height === 'full' ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => onRemove(widget.id)}
              aria-label="Remove chart"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1">
          <ChartRenderer type={widget.type} height={chartHeight} />
        </CardContent>
      </Card>
    </div>
  )
}

function Canvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-dropzone' })

  return (
    <div
      ref={setNodeRef}
      className={`border-primary/30 bg-primary/5 flex min-h-[360px] flex-1 flex-col gap-4 rounded-xl border border-dashed p-6 transition ${
        isOver ? 'bg-primary/10' : ''
      }`}
    >
      {children}
    </div>
  )
}

export function DashboardBuilder({ onSave, onCancel }: DashboardBuilderProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [widgets, setWidgets] = useState<ChartWidget[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDropFromPalette = (type: ChartType, index?: number) => {
    setWidgets((prev) => {
      const next = [...prev]
      if (typeof index === 'number') {
        next.splice(index, 0, createWidget(type))
      } else {
        next.push(createWidget(type))
      }
      return next
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as
      | { from: 'palette'; type: ChartType }
      | { from: 'canvas'; type: ChartType }
      | undefined

    if (!activeData) {
      return
    }

    if (activeData.from === 'palette') {
      const overId = over.id.toString()
      const overIndex = widgets.findIndex((item) => item.id === overId)

      if (overId === 'canvas-dropzone' || overIndex === -1) {
        handleDropFromPalette(activeData.type)
      } else {
        handleDropFromPalette(activeData.type, overIndex)
      }
      return
    }

    // Reordering existing widgets
    const activeIndex = widgets.findIndex((item) => item.id === active.id)
    if (activeIndex === -1) {
      return
    }

    if (over.id === 'canvas-dropzone') {
      if (activeIndex === widgets.length - 1) {
        return
      }
      setWidgets((items) => arrayMove(items, activeIndex, items.length - 1))
      return
    }

    const overIndex = widgets.findIndex((item) => item.id === over.id)
    if (overIndex === -1 || overIndex === activeIndex) {
      return
    }

    setWidgets((items) => arrayMove(items, activeIndex, overIndex))
  }

  const canSave = name.trim().length > 0 && widgets.length > 0

  const resetBuilder = () => {
    setName('')
    setDescription('')
    setWidgets([])
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      charts: widgets,
    })
    resetBuilder()
  }

  const handleRemove = (id: string) => {
    setWidgets((prev) => prev.filter((item) => item.id !== id))
  }

  const handleToggleHeight = (id: string) => {
    setWidgets((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, height: item.height === 'full' ? 'half' : 'full' }
          : item
      )
    )
  }

  const handleToggleWidth = (id: string) => {
    setWidgets((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, width: item.width === 'full' ? 'half' : 'full' }
          : item
      )
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Create Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Drag chart tiles into the canvas to assemble your custom analytics layout.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-primary" htmlFor="dashboard-name">
            Dashboard name
          </label>
          <Input
            id="dashboard-name"
            placeholder="Quarterly performance overview"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-primary" htmlFor="dashboard-description">
            Description (optional)
          </label>
          <Textarea
            id="dashboard-description"
            placeholder="Add a quick summary for this dashboard"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </div>
        <Separator className="my-4" />
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Chart library
          </h3>
          <div className="grid gap-3">
            {paletteItems.map((type) => (
              <PaletteDraggable key={`palette-${type}`} type={type} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Drag a chart into the canvas on the right. Each chart uses dummy data and a blue palette by default.
          </p>
        </div>
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              resetBuilder()
              onCancel()
            }}
          >
            Cancel
          </Button>
          <Button className="flex-1" disabled={!canSave} onClick={handleSave}>
            Save dashboard
          </Button>
        </div>
        </div>
        <Canvas>
          {widgets.length === 0 ? (
            <div className="text-primary/60 flex flex-1 items-center justify-center text-sm">
              Drag charts from the left to get started.
            </div>
          ) : (
            <SortableContext
              items={widgets.map((widget) => widget.id)}
              strategy={rectSortingStrategy}
            >
              <div className="flex flex-wrap gap-4">
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onRemove={handleRemove}
                    onToggleHeight={handleToggleHeight}
                    onToggleWidth={handleToggleWidth}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </Canvas>
      </div>
    </DndContext>
  )
}

function PaletteDraggable({ type }: { type: ChartType }) {
  const metadata = chartMetadata[type]

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { from: 'palette', type },
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="border-primary/20 bg-background hover:bg-primary/5 flex cursor-grab flex-col gap-1 rounded-lg border p-3 shadow-sm transition"
    >
      <span className="text-sm font-semibold text-primary">{metadata.label}</span>
      <span className="text-xs text-muted-foreground">{metadata.description}</span>
    </div>
  )
}
