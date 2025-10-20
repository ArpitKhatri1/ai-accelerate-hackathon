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

import { chartMetadata } from './chart-library'
import {
  AnalyticsDashboard,
  ChartVisualizationType,
  ChartWidget,
  DashboardWidget,
} from './types'
import { TEXT_INSIGHT_META } from './widget-metadata'

interface DashboardBuilderProps {
  onSave: (dashboard: Omit<AnalyticsDashboard, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

const chartPaletteTypes: ChartVisualizationType[] = ['bar', 'double-bar', 'line', 'pie']

type PaletteItem =
  | {
      id: string
      kind: 'chart'
      chartType: ChartVisualizationType
      label: string
      description: string
    }
  | {
      id: string
      kind: 'text-insight'
      label: string
      description: string
    }

const paletteItems: PaletteItem[] = [
  ...chartPaletteTypes.map<PaletteItem>((chartType) => ({
    id: `chart-${chartType}`,
    kind: 'chart',
    chartType,
    label: chartMetadata[chartType].label,
    description: chartMetadata[chartType].description,
  })),
  {
    id: 'text-insight',
    kind: 'text-insight',
    label: TEXT_INSIGHT_META.label,
    description: TEXT_INSIGHT_META.description,
  },
]

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function createWidget(item: PaletteItem): DashboardWidget {
  if (item.kind === 'chart') {
    const widget: ChartWidget = {
      id: generateId(),
      kind: 'chart',
      chartType: item.chartType,
      prompt: '',
      height: 'half',
      width: 'full',
    }
    return widget
  }

  return {
    id: generateId(),
    kind: 'text-insight',
    prompt: '',
    width: 'full',
  }
}

const isChartWidget = (widget: DashboardWidget): widget is ChartWidget => widget.kind === 'chart'

interface SortableWidgetProps {
  widget: DashboardWidget
  onRemove: (id: string) => void
  onToggleHeight: (id: string) => void
  onToggleWidth: (id: string) => void
  onPromptChange: (id: string, value: string) => void
}

function SortableWidget({
  widget,
  onRemove,
  onToggleHeight,
  onToggleWidth,
  onPromptChange,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, data: { from: 'canvas', widgetId: widget.id } })

  const isChart = isChartWidget(widget)
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    width:
      isChart && widget.width === 'half'
        ? 'min(100%, calc(50% - 0.5rem))'
        : '100%',
  }

  const cardMinHeight = isChart ? (widget.height === 'full' ? 420 : 280) : 240
  const promptPlaceholder = isChart
    ? 'Describe the chart you want the agent to generate (e.g. "Plot quarterly revenue by region").'
    : 'Describe the insight you want the agent to write (e.g. "Summarize YoY churn drivers").'
  const headerMeta = isChart
    ? chartMetadata[widget.chartType]
    : TEXT_INSIGHT_META

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
              aria-label="Reorder widget"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <CardTitle className="text-base font-semibold text-primary">
              {headerMeta.label}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isChart && (
              <>
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
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => onRemove(widget.id)}
              aria-label="Remove widget"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <Textarea
            value={widget.prompt}
            onChange={(event) => onPromptChange(widget.id, event.target.value)}
            placeholder={promptPlaceholder}
            rows={isChart && widget.height === 'full' ? 6 : 4}
          />
          <p className="text-xs text-muted-foreground">
            {headerMeta.description} This prompt will be sent to the agent each time the dashboard loads.
          </p>
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
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDropFromPalette = (item: PaletteItem, index?: number) => {
    setWidgets((prev) => {
      const next = [...prev]
      const widget = createWidget(item)
      if (typeof index === 'number') {
        next.splice(index, 0, widget)
      } else {
        next.push(widget)
      }
      return next
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as
      | { from: 'palette'; item: PaletteItem }
      | { from: 'canvas'; widgetId: string }
      | undefined

    if (!activeData) {
      return
    }

    if (activeData.from === 'palette') {
      const overId = over.id.toString()
      const overIndex = widgets.findIndex((item) => item.id === overId)

      if (overId === 'canvas-dropzone' || overIndex === -1) {
        handleDropFromPalette(activeData.item)
      } else {
        handleDropFromPalette(activeData.item, overIndex)
      }
      return
    }

    const activeIndex = widgets.findIndex((item) => item.id === activeData.widgetId)
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

  const allPromptsFilled = widgets.every((widget) => widget.prompt.trim().length > 0)
  const canSave = name.trim().length > 0 && widgets.length > 0 && allPromptsFilled

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
        isChartWidget(item) && item.id === id
          ? { ...item, height: item.height === 'full' ? 'half' : 'full' }
          : item
      )
    )
  }

  const handleToggleWidth = (id: string) => {
    setWidgets((prev) =>
      prev.map((item) =>
        isChartWidget(item) && item.id === id
          ? { ...item, width: item.width === 'full' ? 'half' : 'full' }
          : item
      )
    )
  }

  const handlePromptChange = (id: string, value: string) => {
    setWidgets((prev) =>
      prev.map((item) => (item.id === id ? { ...item, prompt: value } : item))
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
              Drag tiles into the canvas, then describe exactly what you want the agent to build or write.
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
              Widget library
            </h3>
            <div className="grid gap-3">
              {paletteItems.map((item) => (
                <PaletteDraggable key={`palette-${item.id}`} item={item} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Drag a widget into the canvas on the right. Prompts are saved alongside your layout.
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
          {!allPromptsFilled && widgets.length > 0 && (
            <p className="text-xs text-destructive">
              Add a prompt to every widget before saving.
            </p>
          )}
        </div>
        <Canvas>
          {widgets.length === 0 ? (
            <div className="text-primary/60 flex flex-1 items-center justify-center text-sm">
              Drag widgets from the left, then describe what to generate in each prompt field.
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
                    onPromptChange={handlePromptChange}
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

function PaletteDraggable({ item }: { item: PaletteItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${item.id}`,
    data: { from: 'palette', item },
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
      <span className="text-sm font-semibold text-primary">{item.label}</span>
      <span className="text-xs text-muted-foreground">{item.description}</span>
    </div>
  )
}
