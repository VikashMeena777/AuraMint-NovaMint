"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Field — label + description + error, wired with the correct ARIA plumbing.
 *
 * The render prop hands the child the ids it must spread onto the control, so
 * a label can never drift out of sync with its input and an error can never be
 * invisible to assistive tech (the old forms were placeholder-only).
 *
 * ```tsx
 * <Field label="Email" id="login-email" error={errors.email}>
 *   {(field) => <Input type="email" autoComplete="email" {...field} />}
 * </Field>
 * ```
 */
type FieldControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
  "aria-required": boolean;
};

function Field({
  label,
  id,
  description,
  error,
  required = true,
  className,
  children,
}: {
  label: string;
  id: string;
  description?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="label-micro">
        {label}
        {!required ? <span className="normal-case tracking-normal"> (optional)</span> : null}
      </label>

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        "aria-required": required,
      })}

      {description ? (
        <p id={descriptionId} className="text-[12px] text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[12px] font-medium text-[hsl(var(--destructive))]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** An error/success banner that announces itself when it appears. */
function FormBanner({
  tone = "error",
  title,
  children,
  className,
}: {
  tone?: "error" | "success" | "info";
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "plate rail px-4 py-3",
        tone === "error" && "rail-negative",
        tone === "success" && "rail-positive",
        tone === "info" && "rail-brass",
        className
      )}
    >
      <p className="text-[14px] font-semibold">{title}</p>
      {children ? (
        <div className="mt-0.5 text-[13px] text-[hsl(var(--muted-foreground))]">{children}</div>
      ) : null}
    </div>
  );
}

export { Field, FormBanner };
