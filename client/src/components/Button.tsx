import * as React from "react"
import styles from "./Button.module.css"

type ButtonVariant = "primary" | "default" | "invisible" | "danger" | "success"
type ButtonSize = "small" | "medium" | "large"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  loading?: boolean
  block?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "medium",
      leadingIcon,
      trailingIcon,
      loading = false,
      block = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${styles[size]} ${block ? styles.block : ""} ${loading ? styles.loading : ""} ${className ?? ""}`}
        disabled={isDisabled}
        {...props}
      >
        {loading && <span className={styles.spinner} />}
        {!loading && leadingIcon && <span className={styles.icon}>{leadingIcon}</span>}
        {children && <span className={styles.label}>{children}</span>}
        {!loading && trailingIcon && <span className={styles.icon}>{trailingIcon}</span>}
      </button>
    )
  },
)

Button.displayName = "Button"
