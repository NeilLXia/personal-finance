import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./index.module.css";

type ModalActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "default" | "danger";
};

const ModalActionButton = ({
  children,
  className = "",
  type = "button",
  variant = "default",
  ...props
}: ModalActionButtonProps) => (
  <button
    className={[
      styles.modalActionButton,
      variant === "danger" ? styles.modalDangerActionButton : "",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    type={type}
    {...props}
  >
    {children}
  </button>
);

export default ModalActionButton;
