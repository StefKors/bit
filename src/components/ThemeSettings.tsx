import { useState, useEffect, useRef } from "react"
import { XIcon, SunIcon, MoonIcon, DeviceDesktopIcon } from "@primer/octicons-react"
import { type ColorMode, themes, type ThemeDefinition } from "@/lib/themes/ThemeDefinitions"
import {
  getStoredThemeId,
  getStoredColorMode,
  setThemeId,
  setColorMode,
  getThemePreviewColors,
  resolveColorMode,
} from "@/lib/themes/ThemeManager"
import styles from "./ThemeSettings.module.css"

interface ThemeSettingsProps {
  onClose: () => void
}

const modeOptions: { value: ColorMode; label: string; icon: typeof SunIcon }[] = [
  { value: "system", label: "System", icon: DeviceDesktopIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
]

const ThemeCard = ({
  theme,
  isActive,
  previewMode,
  onSelect,
}: {
  theme: ThemeDefinition
  isActive: boolean
  previewMode: "light" | "dark"
  onSelect: () => void
}) => {
  const colors = getThemePreviewColors(theme.id, previewMode)

  return (
    <button
      type="button"
      className={isActive ? styles.themeCardActive : styles.themeCard}
      onClick={onSelect}
      aria-pressed={isActive}
    >
      <div className={styles.swatches}>
        {colors.map((color, i) => (
          <div key={i} className={styles.swatch} style={{ background: color }} />
        ))}
      </div>
      <span className={styles.themeName}>{theme.name}</span>
    </button>
  )
}

const groups = ["Standard", "Community", "Fun"] as const

export const ThemeSettings = ({ onClose }: ThemeSettingsProps) => {
  const [activeThemeId, setActiveThemeId] = useState(getStoredThemeId)
  const [activeMode, setActiveMode] = useState(getStoredColorMode)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current()
    }
    document.addEventListener("keydown", handleKeyDown)
    panelRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const previewMode = resolveColorMode(activeMode)

  const handleModeChange = (mode: ColorMode) => {
    setActiveMode(mode)
    setColorMode(mode)
  }

  const handleThemeSelect = (themeId: string) => {
    setActiveThemeId(themeId)
    setThemeId(themeId)
  }

  const themesByGroup = groups.map((group) => ({
    group,
    themes: themes.filter((t) => t.group === group),
  }))

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Theme settings"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <span className={styles.title}>Appearance</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className={styles.body}>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Color mode</span>
            <div className={styles.modeToggle}>
              {modeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={activeMode === value ? styles.modeButtonActive : styles.modeButton}
                  onClick={() => {
                    handleModeChange(value)
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {themesByGroup.map(({ group, themes: groupThemes }) => (
            <div key={group} className={styles.themeGroup}>
              <span className={styles.groupLabel}>{group}</span>
              <div className={styles.themeGrid}>
                {groupThemes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={activeThemeId === theme.id}
                    previewMode={previewMode}
                    onSelect={() => {
                      handleThemeSelect(theme.id)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
