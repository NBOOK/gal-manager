import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'

export const useGameStore = defineStore("game", () => {
  const folderName = ref<string>("")
  // const folderPaths = ref<string[]>([])
  const gameBrand = ref<string>("")
  const gameBrandEN = ref<string>("")
  const gameName = ref<string>("")
  const gameNameEN = ref<string>("")
  const createdTime = ref<number>(0)
  const modifiedTime = ref<number>(0)
  const diskUsage = ref<number>(0)
  const selected = ref<boolean>(false)
  const linked = ref<boolean>(false)
  const inNetDisk = ref<boolean>(false)
  const inSDCard = ref<boolean>(false)
  const inDeck = ref<boolean>(false)

  return {
    folderName,
    // folderPaths,
    gameBrand,
    gameBrandEN,
    gameName,
    gameNameEN,
    createdTime,
    modifiedTime,
    diskUsage,
    selected,
    linked,
    inNetDisk,
    inSDCard,
    inDeck,
  }
})


export const useGameListStore = defineStore('gameList', () => {
  // const games = ref<Record<string, ReturnType<typeof useGameStore>>>({});
  const games = reactive<Record<string, typeof GameEntry>>({});
  const loading = ref<boolean>(false);

  const totalGames = computed(() => Object.keys(games).length);
  const totalDiskUsage = computed(() => {
    return Object.values(games).reduce((sum, game) => sum + game.diskUsage, 0);
  })


  return {
    games,
    loading,
    totalGames,
    totalDiskUsage,
  }
})