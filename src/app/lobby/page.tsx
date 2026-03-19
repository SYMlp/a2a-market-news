import { buildSCENES } from '@/lib/scenes'
import LobbyClient from './LobbyClient'

export default function LobbyPage() {
  const scenes = buildSCENES()
  return <LobbyClient scenes={scenes} />
}
