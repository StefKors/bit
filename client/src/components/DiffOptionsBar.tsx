import {
  ColumnsIcon,
  RowsIcon,
  ListOrderedIcon,
  WrapIcon,
  PaintbrushIcon,
} from "@primer/octicons-react"
import styles from "./DiffOptionsBar.module.css"

export type DiffStyle = "split" | "unified"
export type DiffIndicators = "classic" | "bars" | "none"
export type LineDiffType = "word-alt" | "word" | "char" | "none"
export type Overflow = "scroll" | "wrap"

export interface DiffOptions {
  diffStyle: DiffStyle
  diffIndicators: DiffIndicators
  lineDiffType: LineDiffType
  disableLineNumbers: boolean
  disableBackground: boolean
  overflow: Overflow
}

export const defaultDiffOptions: DiffOptions = {
  diffStyle: "split",
  diffIndicators: "bars",
  lineDiffType: "word",
  disableLineNumbers: false,
  disableBackground: false,
  overflow: "scroll",
}

interface DiffOptionsBarProps {
  options: DiffOptions
  onChange: (options: DiffOptions) => void
}

// Toggle button component
const ToggleButton = ({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) => (
  <button
    type="button"
    className={`${styles.toggleButton} ${active ? styles.active : ""}`}
    onClick={onClick}
    title={title}
  >
    {children}
  </button>
)

// Segmented control component
const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  title,
}: {
  value: T
  options: { value: T; label: React.ReactNode; title?: string }[]
  onChange: (value: T) => void
  title: string
}) => (
  <div className={styles.segmentedControl} title={title}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={`${styles.segmentOption} ${value === option.value ? styles.active : ""}`}
        onClick={() => onChange(option.value)}
        title={option.title ?? option.value}
      >
        {option.label}
      </button>
    ))}
  </div>
)

export const DiffOptionsBar = ({ options, onChange }: DiffOptionsBarProps) => {
  const update = <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className={styles.container}>
      {/* Split / Unified */}
      <SegmentedControl
        value={options.diffStyle}
        title="Diff layout"
        onChange={(v) => update("diffStyle", v)}
        options={[
          { value: "split", label: <ColumnsIcon size={14} />, title: "Split" },
          { value: "unified", label: <RowsIcon size={14} />, title: "Unified" },
        ]}
      />

      <div className={styles.divider} />

      {/* Line Numbers */}
      <ToggleButton
        active={!options.disableLineNumbers}
        onClick={() => update("disableLineNumbers", !options.disableLineNumbers)}
        title="Line numbers"
      >
        <ListOrderedIcon size={14} />
      </ToggleButton>

      {/* Word Wrap */}
      <ToggleButton
        active={options.overflow === "wrap"}
        onClick={() => update("overflow", options.overflow === "wrap" ? "scroll" : "wrap")}
        title="Word wrap"
      >
        <WrapIcon size={14} />
      </ToggleButton>

      <div className={styles.divider} />

      {/* Diff Indicators */}
      <SegmentedControl
        value={options.diffIndicators}
        title="Diff indicators"
        onChange={(v) => update("diffIndicators", v)}
        options={[
          { value: "bars", label: "Bars", title: "Bars" },
          { value: "classic", label: "+/-", title: "Classic (+/-)" },
          { value: "none", label: "None", title: "No indicators" },
        ]}
      />

      <div className={styles.divider} />

      {/* Highlighting Mode */}
      <SegmentedControl
        value={options.lineDiffType}
        title="Highlighting mode"
        onChange={(v) => update("lineDiffType", v)}
        options={[
          { value: "word", label: "Word", title: "Word highlighting" },
          {
            value: "word-alt",
            label: "Word+",
            title: "Word highlighting (alt)",
          },
          { value: "char", label: "Char", title: "Character highlighting" },
          { value: "none", label: "None", title: "No highlighting" },
        ]}
      />

      <div className={styles.divider} />

      {/* Background */}
      <ToggleButton
        active={!options.disableBackground}
        onClick={() => update("disableBackground", !options.disableBackground)}
        title="Diff backgrounds"
      >
        <PaintbrushIcon size={14} />
      </ToggleButton>
    </div>
  )
}
