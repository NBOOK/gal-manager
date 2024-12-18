import { ref, computed, reactive } from 'vue'
import {defineStore} from 'pinia'

export const useGameStore = defineStore("game", () => {
    const folderName = ref<string>("")
    const folderPaths = ref<string[]>([])
    const gameName = ref<string>("")
    const gameNameEN = ref<string>("")
    const gameBrand = ref<string>("")
    const gameBrandEN = ref<string>("")
    const updateTime = ref<string>("")
    const size = ref<number>(0)
    const selected = ref<boolean>(false)

    return {
        folderName,
        folderPaths,
        gameName,
        gameNameEN,
        gameBrand,
        gameBrandEN,
        updateTime,
        size,
        selected,
      }
})


export const useGameListStore = defineStore('gameList', () => {
    const games = ref<Array<ReturnType<typeof useGameStore>>>([]);
    const loading = ref<boolean>(false);
  
    const totalGames = computed(() => games.value.length);
    const totalDiskUsage = computed(() => {
      return games.value.reduce((acc, game) => acc + game.size, 0)
    })
  
  
    return {
      games,
      loading,
      totalGames,
      totalDiskUsage,
    }
  })