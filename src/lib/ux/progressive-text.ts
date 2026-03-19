'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ProgressiveTextOptions {
  minDelay?: number
  maxDelay?: number
  enabled?: boolean
}

interface ProgressiveTextResult {
  displayedText: string
  isRevealing: boolean
  revealAll: () => void
}

const CODE_BLOCK_FENCE = /```/g

/**
 * Split text into display chunks, respecting code block boundaries.
 *
 * Priority: paragraph breaks > newlines > sentence-ending punctuation.
 * Code blocks (``` ... ```) are never split internally.
 */
function splitIntoChunks(text: string): string[] {
  const fences = [...text.matchAll(CODE_BLOCK_FENCE)]
  const fencePositions = fences.map((m) => m.index!)

  const isInsideCodeBlock = (pos: number): boolean => {
    let openCount = 0
    for (const fp of fencePositions) {
      if (fp >= pos) break
      openCount++
    }
    return openCount % 2 === 1
  }

  const chunks: string[] = []
  let cursor = 0

  const paragraphs = text.split(/\n{2,}/)
  if (paragraphs.length > 1) {
    for (const para of paragraphs) {
      if (para.trim()) chunks.push(para.trim())
    }
    return chunks.length > 0 ? chunks : [text]
  }

  const lines = text.split('\n')
  if (lines.length > 2) {
    let buf = ''
    for (const line of lines) {
      const globalPos = cursor
      cursor += line.length + 1

      if (isInsideCodeBlock(globalPos)) {
        buf += (buf ? '\n' : '') + line
        continue
      }

      if (buf) {
        buf += '\n' + line
        if (!isInsideCodeBlock(cursor)) {
          chunks.push(buf.trim())
          buf = ''
        }
      } else {
        buf = line
      }
    }
    if (buf.trim()) chunks.push(buf.trim())
    return chunks.length > 0 ? chunks : [text]
  }

  const sentencePattern = /(?<=[。！？.!?])\s*/g
  const sentences = text.split(sentencePattern).filter(Boolean)
  if (sentences.length > 1) {
    return sentences
  }

  return [text]
}

function randomDelay(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function useProgressiveText(
  fullText: string,
  options: ProgressiveTextOptions = {}
): ProgressiveTextResult {
  const {
    minDelay = 400,
    maxDelay = 1200,
    enabled = true,
  } = options

  const [revealedCount, setRevealedCount] = useState(0)
  const [revealedAll, setRevealedAll] = useState(false)
  const chunksRef = useRef<string[]>([])
  const prevTextRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (fullText !== prevTextRef.current) {
      prevTextRef.current = fullText
      const newChunks = fullText ? splitIntoChunks(fullText) : []
      chunksRef.current = newChunks
      setRevealedCount(enabled ? (newChunks.length > 0 ? 1 : 0) : newChunks.length)
      setRevealedAll(!enabled)
    }
  }, [fullText, enabled])

  useEffect(() => {
    if (revealedAll || !enabled) return
    const chunks = chunksRef.current
    if (revealedCount >= chunks.length) {
      setRevealedAll(true)
      return
    }

    timerRef.current = setTimeout(() => {
      setRevealedCount((c) => c + 1)
    }, randomDelay(minDelay, maxDelay))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [revealedCount, revealedAll, enabled, minDelay, maxDelay])

  const revealAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setRevealedCount(chunksRef.current.length)
    setRevealedAll(true)
  }, [])

  const displayedText = revealedAll
    ? fullText
    : chunksRef.current.slice(0, revealedCount).join('\n\n')

  return {
    displayedText,
    isRevealing: !revealedAll && chunksRef.current.length > 0,
    revealAll,
  }
}
