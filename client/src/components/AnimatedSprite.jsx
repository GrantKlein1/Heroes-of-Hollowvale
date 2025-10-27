import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Simple animated sprite that cycles through a list of frame image URLs.
 * Props:
 * - frames: string[] - list of image URLs in order
 * - fps?: number - frames per second (default 12)
 * - className?: string - classes applied to the <img>
 * - style?: React.CSSProperties - inline style override
 * - alt?: string - alt text for image
 */
export default function AnimatedSprite({ frames = [], fps = 12, className = '', style, alt = '', playing = true }) {
  const [idx, setIdx] = useState(0)
  const timerRef = useRef(null)

  // Preload frames to avoid flicker
  const images = useMemo(() => {
    return frames.map((src) => {
      const img = new Image()
      img.src = src
      return img
    })
  }, [frames])

  useEffect(() => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (!frames.length || fps <= 0 || !playing) return
    const interval = Math.max(20, Math.floor(1000 / fps))
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % frames.length)
    }, interval)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [frames.length, fps, playing])

  const src = frames.length ? frames[idx] : ''

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
    />
  )
}
