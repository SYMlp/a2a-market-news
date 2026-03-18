import { registerScene, getScene, listScenes, buildSCENES } from './registry'
import lobby from './lobby/definition'
import news from './news/definition'
import developer from './developer/definition'

registerScene(lobby)
registerScene(news)
registerScene(developer)

export { getScene, listScenes }
export const SCENES = buildSCENES()
