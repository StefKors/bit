import * as React from "react"
import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import { Link, useLocation } from "@tanstack/react-router"
import styles from "./Tabs.module.css"

interface TabItem {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  count?: number
  to?: string
  params?: Record<string, string>
}

interface TabsProps {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  trailing?: React.ReactNode
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
  trailing,
}: TabsProps) {
  const location = useLocation()

  // For link-based tabs, determine active from URL
  const activeValue =
    value ??
    items.find((item) => item.to && location.pathname.includes(item.to.replace(/\$\w+/g, "")))
      ?.value ??
    defaultValue ??
    items[0]?.value

  return (
    <BaseTabs.Root
      value={activeValue}
      onValueChange={onValueChange}
      className={`${styles.root} ${className ?? ""}`}
    >
      <BaseTabs.List className={styles.list}>
        <div className={styles.tabsGroup}>
          {items.map((item) => (
            <TabTrigger key={item.value} item={item} />
          ))}
        </div>
        {trailing && <div className={styles.trailing}>{trailing}</div>}
        <BaseTabs.Indicator className={styles.indicator} />
      </BaseTabs.List>
    </BaseTabs.Root>
  )
}

function TabTrigger({ item }: { item: TabItem }) {
  const content = (
    <>
      {item.icon && <span className={styles.icon}>{item.icon}</span>}
      <span>{item.label}</span>
      {item.count !== undefined && item.count > 0 && (
        <span className={styles.count}>{item.count}</span>
      )}
    </>
  )

  if (item.to) {
    return (
      <BaseTabs.Tab
        value={item.value}
        className={styles.tab}
        render={<Link to={item.to} params={item.params} />}
        nativeButton={false}
      >
        {content}
      </BaseTabs.Tab>
    )
  }

  return (
    <BaseTabs.Tab value={item.value} className={styles.tab}>
      {content}
    </BaseTabs.Tab>
  )
}

// Re-export for convenience
export { BaseTabs as TabsPrimitive }
