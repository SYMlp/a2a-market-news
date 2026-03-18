'use client'

const SCENE_BG_IMAGES: Record<string, string> = {}

interface SceneBackgroundProps {
  scene: string
}

export default function SceneBackground({ scene }: SceneBackgroundProps) {
  const bgSrc = SCENE_BG_IMAGES[scene]

  if (bgSrc) {
    return (
      <div className="scene-bg">
        <img src={bgSrc} alt="" className="scene-bg__img" />
        <div className="scene-bg__overlay" />
      </div>
    )
  }

  return <FallbackBg scene={scene} />
}

function FallbackBg({ scene }: { scene: string }) {
  if (scene === 'news') return <NewsFallback />
  if (scene === 'developer') return <DevFallback />
  return <LobbyFallback />
}

function LobbyFallback() {
  return (
    <div className="scene-bg-lobby">
      <div className="scene-bg-lobby__floor">
        <div className="scene-bg-lobby__floor-grid" />
      </div>
      <div className="scene-bg-lobby__door" />
      <div className="scene-bg-lobby__desk" />
    </div>
  )
}

function NewsFallback() {
  return (
    <div className="scene-bg-news">
      <div className="scene-bg-news__floor" />
      <div className="scene-bg-news__board" />
      <div className="scene-bg-news__monitor scene-bg-news__monitor--1" />
      <div className="scene-bg-news__monitor scene-bg-news__monitor--2" />
    </div>
  )
}

function DevFallback() {
  return (
    <div className="scene-bg-dev">
      <div className="scene-bg-dev__circuit" />
      <div className="scene-bg-dev__floor" />
      <div className="scene-bg-dev__hologram" />
    </div>
  )
}
