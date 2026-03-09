import { ChevronDownIcon } from "@primer/octicons-react"
import { Select } from "@base-ui/react/select"
import { Toolbar } from "@base-ui/react/toolbar"
import styles from "./ToolbarSelect.module.css"

interface ToolbarSelectItem {
  value: string
  label: React.ReactNode
}

interface ToolbarSelectProps {
  value: string
  onValueChange: (value: string) => void
  items: ToolbarSelectItem[]
  defaultValue?: string
  icon?: React.ReactNode
  itemIcon?: React.ReactNode
  emptyLabel?: string
  placeholder?: string
  renderValue?: (value: string | null) => React.ReactNode
  hideLabel?: boolean
  triggerClassName?: string
}

export const ToolbarSelect = ({
  value,
  onValueChange,
  items,
  defaultValue,
  icon,
  itemIcon,
  emptyLabel,
  placeholder,
  renderValue,
  hideLabel = false,
  triggerClassName,
}: ToolbarSelectProps) => {
  const active = defaultValue != null && value !== defaultValue

  return (
    <Toolbar.Group className={styles.group}>
      <Select.Root
        value={value}
        onValueChange={(v) => {
          if (v != null) onValueChange(String(v))
        }}
        items={items}
      >
        <Toolbar.Button
          render={<Select.Trigger />}
          className={`${styles.trigger} ${active ? styles.triggerActive : ""} ${triggerClassName ?? ""}`}
        >
          {icon}
          {!hideLabel && (
            <>
              <Select.Value placeholder={placeholder} className={styles.triggerValue}>
                {renderValue}
              </Select.Value>
              <Select.Icon render={<ChevronDownIcon size={10} />} />
            </>
          )}
        </Toolbar.Button>
        <Select.Portal>
          <Select.Backdrop />
          <Select.Positioner>
            <Select.Popup className={styles.popup}>
              <Select.List>
                {items.map((item) => (
                  <Select.Item key={item.value} value={item.value} className={styles.item}>
                    {itemIcon}
                    <Select.ItemText className={styles.itemText}>{item.label}</Select.ItemText>
                  </Select.Item>
                ))}
                {Boolean(emptyLabel) && items.length === 0 && (
                  <span className={styles.empty}>{emptyLabel}</span>
                )}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </Toolbar.Group>
  )
}
