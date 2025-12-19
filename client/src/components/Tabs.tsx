import * as React from "react"
import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import { Link, useLocation } from "wouter"
import styles from "./Tabs.module.css"

interface TabItem {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  count?: number
  href?: string
}

interface TabsProps {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
}: TabsProps) {
  const [location] = useLocation()

  // For link-based tabs, determine active from URL
  const activeValue =
    value ??
    items.find((item) => item.href && location === item.href)?.value ??
    defaultValue ??
    items[0]?.value

  return (
    <BaseTabs.Root
      value={activeValue}
      onValueChange={onValueChange}
      className={`${styles.root} ${className ?? ""}`}
    >
      <BaseTabs.List className={styles.list}>
        {items.map((item) => (
          <TabTrigger key={item.value} item={item} />
        ))}
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

  if (item.href) {
    return (
      <BaseTabs.Tab
        value={item.value}
        className={styles.tab}
        render={<Link href={item.href} />}
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
