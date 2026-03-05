import { useState } from "react"
import { DrawerPreview as Drawer } from "@base-ui/react/drawer"
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
  open: boolean
  onOpenChange: (open: boolean) => void
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
        {colors.map((color) => (
          <div key={color} className={styles.swatch} style={{ background: color }} />
        ))}
      </div>
      <span className={styles.themeName}>{theme.name}</span>
    </button>
  )
}

const groups = ["Standard", "Community", "Fun"] as const

export const ThemeSettings = ({ open, onOpenChange }: ThemeSettingsProps) => {
  const [activeThemeId, setActiveThemeId] = useState(getStoredThemeId)
  const [activeMode, setActiveMode] = useState(getStoredColorMode)

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
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.backdrop} />
        <Drawer.Popup className={styles.popup}>
          <div className={styles.header}>
            <Drawer.Title className={styles.title}>Appearance</Drawer.Title>
            <Drawer.Close className={styles.closeButton} aria-label="Close">
              <XIcon size={16} />
            </Drawer.Close>
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
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
