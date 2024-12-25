import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'



export const useGameListStore = defineStore('gameList', () => {
  // const games = ref<Record<string, ReturnType<typeof useGameStore>>>({});
  const games = reactive<Record<string, typeof GameEntry>>({});
  const loading = ref<boolean>(false);
  // const loaded = ref<boolean>(false);

  const totalGames = computed(() => Object.keys(games).length);
  const totalDiskUsage = computed(() => {
    return Object.values(games).reduce((sum, game) => sum + game.diskUsage, 0);
  })


  return {
    games,
    loading,
    // loaded,
    totalGames,
    totalDiskUsage,
  }
})