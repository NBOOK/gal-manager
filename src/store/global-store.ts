import { ref, computed, reactive } from "vue";
import { defineStore } from "pinia";
import GameEntry from "@modules/GameEntry";
import SteamDB from "@modules/SteamDB";


export const useGameStore = defineStore("globalStore", () => {
  // const games = ref<Record<string, ReturnType<typeof useGameStore>>>({});
  const games = reactive({} as Record<string, GameEntry>);
  const loading = ref<boolean>(false);
  const searchQuery = ref<string>("");
  const sort = reactive({ by: "gameName", ascending: true });
  const filter = reactive({
    linked: { toggled: false, value: true },
    inDatabase: { toggled: false, value: 1 },
    inAssets: { toggled: false, value: 1 },
    starred: { toggled: false, value: true },

    inNetDisk: { toggled: false, value: true },
    inSDCard: { toggled: false, value: true },
    inDeck: { toggled: false, value: true },
    inUSB: { toggled: false, value: true },
  });

  const filterOperator = ref(true)

  const totalGames = computed(() => Object.keys(games).length);
  const totalDiskUsage = computed(() => {
    return Object.values(games).reduce((sum, game) => sum + game.diskUsage, 0);
  });

  const config = ref({} as any);

  const steamDB = ref<SteamDB>(new SteamDB());

  return {
    games,
    loading,
    totalGames,
    totalDiskUsage,
    searchQuery,
    sort,
    filter,
    filterOperator,
    config,
    steamDB
  };
});
