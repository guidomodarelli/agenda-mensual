"use client"

import { useEffect, useRef, useState } from "react"
import type React from "react"
import { annotate } from "rough-notation"
import { type RoughAnnotation } from "rough-notation/lib/model"

type AnnotationAction =
  | "highlight"
  | "underline"
  | "box"
  | "circle"
  | "strike-through"
  | "crossed-off"
  | "bracket"

interface HighlighterProps {
  children: React.ReactNode
  action?: AnnotationAction
  color?: string
  strokeWidth?: number
  animationDuration?: number
  iterations?: number
  padding?: number
  multiline?: boolean
  isView?: boolean
}

export function Highlighter({
  children,
  action = "highlight",
  color = "#ffd1dc",
  strokeWidth = 1.5,
  animationDuration = 600,
  iterations = 2,
  padding = 2,
  multiline = true,
  isView = false,
}: HighlighterProps) {
  const elementRef = useRef<HTMLSpanElement>(null)
  const annotationRef = useRef<RoughAnnotation | null>(null)
  const [isInView, setIsInView] = useState(
    () => !isView || typeof IntersectionObserver === "undefined"
  )

  useEffect(() => {
    if (!isView) {
      return
    }

    const element = elementRef.current
    if (!element || typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: "-10%",
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [isView])

  // If isView is false, always show. If isView is true, wait for inView
  const shouldShow = !isView || isInView

  useEffect(() => {
    const element = elementRef.current
    let resizeObserver: ResizeObserver | null = null
    let redrawFrameId: number | null = null

    if (shouldShow && element) {
      const annotationConfig = {
        type: action,
        color,
        strokeWidth,
        animationDuration,
        iterations,
        padding,
        multiline,
      }

      const annotation = annotate(element, annotationConfig)

      annotationRef.current = annotation
      annotation.show()

      if (typeof ResizeObserver !== "undefined") {
        // Solo se observa el elemento anotado, nunca `document.body`: redibujar
        // la anotación inserta un SVG en el body, y observar el body provocaba
        // un loop infinito (resize -> redibujo -> resize) que colgaba la página.
        // El redibujo se difiere a un frame y se coalescen ráfagas para evitar
        // el warning «ResizeObserver loop» y trabajo redundante.
        resizeObserver = new ResizeObserver(() => {
          if (redrawFrameId != null) {
            return
          }

          redrawFrameId = window.requestAnimationFrame(() => {
            redrawFrameId = null
            annotation.hide()
            annotation.show()
          })
        })

        resizeObserver.observe(element)
      }
    }

    return () => {
      if (redrawFrameId != null) {
        window.cancelAnimationFrame(redrawFrameId)
      }
      if (annotationRef.current) {
        annotationRef.current.remove()
        annotationRef.current = null
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [
    shouldShow,
    action,
    color,
    strokeWidth,
    animationDuration,
    iterations,
    padding,
    multiline,
  ])

  return (
    <span ref={elementRef} className="relative inline-block bg-transparent">
      {children}
    </span>
  )
}
